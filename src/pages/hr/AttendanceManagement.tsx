import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { attendanceApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import Pagination from "../../components/Pagination";
import {
  PageHeader, Button, Input, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Select, Alert,
} from "../../components/ui";
import { dialog } from "../../services/dialog";
import { Pencil, Search, Upload } from "lucide-react";

interface RosterRow {
  employee: { _id: string; fullName: string; employeeCode: string; departmentId?: { name: string } };
  attendance: {
    status: string;
    checkIn?: string;
    checkOut?: string;
    remarks?: string;
    workedMinutes?: number;
    isLate?: boolean;
    checkInWithinGeofence?: boolean;
  } | null;
}

/** Minutes → "7h 30m", for the worked column. */
const dur = (m?: number) => {
  const n = Math.max(0, Math.round(m || 0));
  if (!n) return "—";
  return n < 60 ? `${n}m` : `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, "0")}m`;
};

const STATUSES = [
  { value: "present", label: "P", tone: "success" as const },
  { value: "absent", label: "A", tone: "danger" as const },
  { value: "half_day", label: "½", tone: "warning" as const },
  { value: "leave", label: "L", tone: "info" as const },
  { value: "holiday", label: "H", tone: "neutral" as const },
  { value: "week_off", label: "WO", tone: "neutral" as const },
];

// Local calendar date. `toISOString()` converts to UTC first, which in IST
// rolls the date back a day for anything before 05:30.
const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** What the import endpoint reports, for both the preview and the commit. */
interface ImportSummary {
  dryRun: boolean;
  totalRows: number;
  days: number;
  employees: number;
  from?: string;
  to?: string;
  newDays: number;
  overwrites: number;
  derivedFromHours: number;
  failed: number;
  imported?: number;
  unknownCodes: string[];
  warnings: string[];
  errors: { row: number; employee: string; date: string; errors: string[] }[];
  preview: {
    employeeCode: string;
    name: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    status: string;
    statusSource: string;
    workedMinutes: number;
    overwrites: boolean;
    punches: number;
  }[];
}

export default function AttendanceManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.ATTENDANCE_MANAGE);

  /**
   * Date and status sit in the URL so the HR dashboard's "Present Today" /
   * "On Leave Today" cards can open this page already showing those people —
   * the same records the count on the card was made from.
   */
  const [params, setParams] = useSearchParams();
  const date = params.get("date") || today();
  const statusFilter = params.get("status") || "";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const [roster, setRoster] = useState<RosterRow[]>([]);
  // The day being corrected by hand. A punch is a measurement, but people
  // forget to punch, arrive through a side door, or work a shift the system
  // never knew about — so HR has to be able to set the record straight.
  const [correcting, setCorrecting] = useState<RosterRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingWeekOffs, setApplyingWeekOffs] = useState(false);
  const [applyingHolidays, setApplyingHolidays] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  // What's actually queried: typing shouldn't fire a request per keystroke.
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.byDate({
        date,
        page,
        limit,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
      });
      const rows: RosterRow[] = res.data?.roster || [];
      setRoster(rows);
      setTotal(res.data?.pagination?.total ?? 0);
      // Merged, not replaced: marks made on one page must survive paging to
      // the next and back, or they are lost without ever saying so.
      setMarks((prev) => {
        const next = { ...prev };
        rows.forEach((r) => {
          if (r.attendance?.status) next[r.employee._id] = r.attendance.status;
        });
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [date, page, limit, statusFilter, searchQuery]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [date, statusFilter, searchQuery, limit]);

  // Unsaved marks belong to the day they were made on, so moving to another
  // date starts clean rather than carrying them onto the wrong register.
  useEffect(() => {
    setMarks({});
  }, [date]);

  const setAll = (status: string) => {
    // Only the rows on screen. Marking people you cannot see — because a
    // filter or another page is hiding them — would rewrite the day's
    // register by accident.
    const next: Record<string, string> = { ...marks };
    roster.forEach((r) => (next[r.employee._id] = status));
    setMarks(next);
  };

  /**
   * Fill the whole month's week offs into attendance in one pass — the same
   * shape as the holiday pass. Without it, every off day has to be marked by
   * hand or it reaches payroll as an unmarked (and so unpaid) day.
   */
  const applyWeekOffs = async () => {
    const [year, month] = date.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
    const ok = await dialog.confirm({
      title: `Fill week offs for ${label}?`,
      message:
        "Each employee's off days — from their own pattern, the organisation default, or a day the roster marks as a week off — are written into this month's attendance.\n\nDays that already carry a decision are never overwritten, so a week off somebody actually worked stays exactly as it is.",
      confirmLabel: "Fill week offs",
    });
    if (!ok) return;
    setApplyingWeekOffs(true);
    try {
      const res = await attendanceApi.applyWeekOffs(month, year);
      const days = res.data?.daysMarked ?? 0;
      await dialog.alert({
        title: days ? "Week offs filled" : "Nothing to fill",
        message: days
          ? `${days} ${days === 1 ? "day" : "days"} marked as week off across ${res.data?.employees ?? 0} employees. Days that already had a decision were left untouched.`
          : "Every week off this month already carries a decision, so nothing was changed.",
      });
      await load();
    } catch (err) {
      void dialog.alert(
        err instanceof Error ? err.message : "Could not fill the week offs.",
      );
    } finally {
      setApplyingWeekOffs(false);
    }
  };

  /**
   * The holiday calendar's counterpart to the pass above. The endpoint has
   * existed since holidays were made real, but nothing in the panel ever
   * called it — so a closed holiday reached payroll as an unmarked day.
   */
  const applyHolidays = async () => {
    const [year, month] = date.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
    const ok = await dialog.confirm({
      title: `Fill holidays for ${label}?`,
      message:
        "Days the organisation is closed for are written into this month's attendance for everyone on the rolls.\n\nWorking holidays are left out — those are worked and earn a compensatory off instead. Days that already carry a decision are never overwritten.",
      confirmLabel: "Fill holidays",
    });
    if (!ok) return;
    setApplyingHolidays(true);
    try {
      const res = await attendanceApi.applyHolidays(month, year);
      const days = res.data?.daysMarked ?? 0;
      await dialog.alert({
        title: days ? "Holidays filled" : "Nothing to fill",
        message: days
          ? `${days} ${days === 1 ? "day" : "days"} marked as holiday, from ${res.data?.holidays ?? 0} holiday(s) this month. Days that already had a decision were left untouched.`
          : "No closed holiday this month is missing from attendance, so nothing was changed.",
      });
      await load();
    } catch (err) {
      void dialog.alert(
        err instanceof Error ? err.message : "Could not fill the holidays.",
      );
    } finally {
      setApplyingHolidays(false);
    }
  };

  const save = async () => {
    const entries = Object.entries(marks).map(([employeeId, status]) => ({ employeeId, status }));
    if (entries.length === 0) return;
    setSaving(true);
    try {
      await attendanceApi.mark({ date, entries });
      await load();
    } catch (err: any) {
      void dialog.alert(err.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Attendance"
        subtitle="Mark daily attendance — feeds payroll loss-of-pay"
        actions={
          canManage ? (
            <>
              <Button
                variant="secondary"
                onClick={applyHolidays}
                disabled={applyingHolidays}
                title="Fill this month's holidays into attendance"
              >
                {applyingHolidays ? "Filling…" : "Apply holidays"}
              </Button>
              <Button
                variant="secondary"
                onClick={applyWeekOffs}
                disabled={applyingWeekOffs}
                title="Fill this month's week offs into attendance"
              >
                {applyingWeekOffs ? "Filling…" : "Apply week offs"}
              </Button>
              <Button
                variant="secondary"
                icon={<Upload className="h-4 w-4" />}
                onClick={() => setImportOpen(true)}
                title="Import a biometric device export — one day or a whole month"
              >
                Import biometric CSV
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save Attendance"}
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setParam("date", e.target.value)}
          className="w-44"
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="w-64 pl-9"
            placeholder="Name or employee code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={String(limit)}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="w-32"
          aria-label="Rows per page"
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </Select>
        {statusFilter && (
          <span className="inline-flex items-center gap-2 rounded-full bg-healwin-50 px-3 py-1 text-xs font-medium text-healwin-700">
            Showing {total} marked “{statusFilter.replace("_", " ")}”
            <button
              type="button"
              onClick={() => setParam("status", "")}
              className="text-healwin-500 hover:text-healwin-800"
              aria-label="Show everyone"
            >
              ✕
            </button>
          </span>
        )}
        {canManage && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>Mark this page:</span>
            {STATUSES.map((s) => (
              <Button key={s.value} size="sm" variant="secondary" onClick={() => setAll(s.value)}>
                {s.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <Table>
        <THead>
          <Th>Code</Th>
          <Th>Employee</Th>
          <Th>Department</Th>
          <Th>In</Th>
          <Th>Out</Th>
          <Th>Worked</Th>
          <Th>Status</Th>
          <Th className="text-right">Correct</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={8}>Loading…</TableState>
          ) : roster.length === 0 ? (
            <TableState colSpan={8}>
              {statusFilter
                ? `Nobody is marked “${statusFilter.replace("_", " ")}” on this date.`
                : searchQuery.trim()
                  ? "No employee matches that search."
                  : "No employees."}
            </TableState>
          ) : (
            roster.map((r) => (
              <TR key={r.employee._id}>
                <Td className="font-mono text-xs">{r.employee.employeeCode}</Td>
                <Td className="font-medium text-gray-900">{r.employee.fullName}</Td>
                <Td className="text-gray-500">{r.employee.departmentId?.name || "—"}</Td>
                {/* Punches, so HR can see what the day actually looked like
                    rather than only the verdict. */}
                <Td className="text-gray-600">
                  {r.attendance?.checkIn || "—"}
                  {r.attendance?.isLate && (
                    <span className="ml-1 text-[11px] font-medium text-amber-600">late</span>
                  )}
                </Td>
                <Td className="text-gray-600">{r.attendance?.checkOut || "—"}</Td>
                <Td className="text-gray-600">
                  {dur(r.attendance?.workedMinutes)}
                  {r.attendance?.checkInWithinGeofence === false && (
                    <span
                      className="ml-1 text-[11px] font-medium text-amber-600"
                      title="Punched in away from a registered work location"
                    >
                      off-site
                    </span>
                  )}
                </Td>
                <Td>
                  {canManage ? (
                    <div className="flex flex-wrap gap-1">
                      {STATUSES.map((s) => {
                        const active = marks[r.employee._id] === s.value;
                        return (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setMarks({ ...marks, [r.employee._id]: s.value })}
                            className={`h-7 min-w-7 rounded-md border px-2 text-xs font-medium transition-colors ${
                              active
                                ? "border-healwin-500 bg-healwin-600 text-white"
                                : "border-gray-300 text-gray-600 hover:bg-gray-50"
                            }`}
                            title={s.value.replace("_", " ")}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : marks[r.employee._id] ? (
                    <Badge tone={STATUSES.find((s) => s.value === marks[r.employee._id])?.tone || "neutral"}>
                      {marks[r.employee._id].replace("_", " ")}
                    </Badge>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </Td>
                <Td className="text-right">
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      title="Correct this day"
                      aria-label="Correct"
                      onClick={() => setCorrecting(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          label="employees"
          onPageChange={setPage}
        />
      </div>

      <CorrectionModal
        row={correcting}
        date={date}
        onClose={() => setCorrecting(null)}
        onSaved={() => { setCorrecting(null); load(); }}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
    </div>
  );
}

/**
 * Correct one person's day.
 *
 * Saves through the same endpoint the bulk marker uses, so the hours and
 * overtime are recomputed from the corrected punches against that day's shift
 * — a correction that left stale hours behind would flow straight into the
 * payslip.
 */
function CorrectionModal({
  row,
  date,
  onClose,
  onSaved,
}: {
  row: RosterRow | null;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ status: "present", checkIn: "", checkOut: "", remarks: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!row) return;
    setError("");
    setForm({
      status: row.attendance?.status || "present",
      checkIn: row.attendance?.checkIn || "",
      checkOut: row.attendance?.checkOut || "",
      remarks: row.attendance?.remarks || "",
    });
  }, [row]);

  const save = async () => {
    if (!row) return;
    // One punch without the other cannot produce hours; saying so up front
    // beats a silently zeroed day that looks correct.
    if ((form.checkIn && !form.checkOut) || (!form.checkIn && form.checkOut)) {
      setError("Enter both a check-in and a check-out, or neither — hours cannot be computed from one.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await attendanceApi.mark({
        date,
        entries: [
          {
            employeeId: row.employee._id,
            status: form.status,
            checkIn: form.checkIn || undefined,
            checkOut: form.checkOut || undefined,
            remarks: form.remarks || undefined,
          },
        ],
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the correction.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title="Correct attendance"
      subtitle={row ? `${row.employee.fullName} · ${new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save correction"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="capitalize"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.value.replace("_", " ")}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in">
            <Input type="time" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
          </Field>
          <Field label="Check-out">
            <Input type="time" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          </Field>
        </div>
        <Field label="Reason for the correction" hint="Kept on the record so the change can be explained later">
          <Input
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            placeholder="e.g. forgot to punch out"
          />
        </Field>
        <p className="text-xs text-gray-400">
          Hours and overtime are recalculated from these times against the
          shift worked that day.
        </p>
      </div>
    </Modal>
  );
}

/**
 * Import a biometric export.
 *
 * Previews before it writes, because committing OVERWRITES days that are
 * already marked — which is what an import is for, but never something to
 * discover afterwards. The preview counts those separately from new days.
 */
function ImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
  };

  const runPreview = async (f: File) => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await attendanceApi.importCsv(f, true);
      setPreview(res.data);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "That file could not be read.");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!file) return;
    if (
      preview?.overwrites &&
      !(await dialog.confirm({
        title: `Overwrite ${preview.overwrites} day${preview.overwrites === 1 ? "" : "s"} already marked?`,
        message:
          "Those days have an attendance decision on them already. The file's version replaces it, and attendance feeds payroll — so a day someone was marked present on becomes whatever this file says.",
        confirmLabel: "Replace them",
        tone: "danger",
      }))
    )
      return;

    setBusy(true);
    setError("");
    try {
      const res = await attendanceApi.importCsv(file, false);
      setResult(res.data);
      setPreview(null);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed.");
    } finally {
      setBusy(false);
    }
  };

  const range = (s?: ImportSummary | null) =>
    s?.from ? (s.from === s.to ? s.from : `${s.from} → ${s.to}`) : "—";

  return (
    <Modal
      open={open}
      onClose={() => { onClose(); reset(); }}
      title="Import biometric attendance"
      subtitle="One day or a whole month — the file's own dates decide"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => { onClose(); reset(); }}>
            Close
          </Button>
          {preview && preview.days > 0 && (
            <Button onClick={commit} disabled={busy}>
              {busy
                ? "Importing…"
                : `Import ${preview.days} day${preview.days === 1 ? "" : "s"}`}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          <p className="mb-2">
            <strong>Employee Code</strong> and <strong>Date</strong> are
            required; the code is matched against the roster (email or phone
            work too). Leave <strong>Status</strong> blank and the day is
            worked out from the hours against that person&rsquo;s shift.
            Several punch rows for one person on one day are combined into
            the earliest in and the latest out.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              attendanceApi
                .downloadImportTemplate()
                .catch((e) =>
                  setError(e instanceof Error ? e.message : "Download failed"),
                )
            }
          >
            Download template
          </Button>
        </div>

        <Field label="CSV file">
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-healwin-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-healwin-700 hover:file:bg-healwin-100"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              setResult(null);
              // Preview straight away — there is no reason to make someone
              // press a second button before seeing what is wrong.
              if (f) runPreview(f);
            }}
          />
        </Field>

        {busy && !preview && !result && (
          <p className="text-sm text-gray-500">Checking the file…</p>
        )}

        {/* Preview — what WOULD happen. Nothing has been written yet. */}
        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">{preview.totalRows} rows read</Badge>
              <Badge tone="neutral">{range(preview)}</Badge>
              <Badge tone="neutral">{preview.employees} people</Badge>
              <Badge tone={preview.newDays ? "success" : "neutral"}>
                {preview.newDays} new day{preview.newDays === 1 ? "" : "s"}
              </Badge>
              {preview.overwrites > 0 && (
                <Badge tone="warning">{preview.overwrites} already marked</Badge>
              )}
              {preview.derivedFromHours > 0 && (
                <Badge tone="info">
                  {preview.derivedFromHours} status worked out from hours
                </Badge>
              )}
              {preview.failed > 0 && (
                <Badge tone="danger">{preview.failed} rows with problems</Badge>
              )}
            </div>

            {preview.overwrites > 0 && (
              <Alert tone="warning">
                {preview.overwrites} of these days already carry an attendance
                decision. Importing replaces them.
              </Alert>
            )}
            {preview.warnings.map((w) => (
              <Alert key={w} tone="warning">{w}</Alert>
            ))}
            {preview.unknownCodes.length > 0 && (
              <Alert tone="danger">
                No employee matches: {preview.unknownCodes.join(", ")}. Those
                rows are skipped — fix the codes in the sheet, or add the
                people first.
              </Alert>
            )}
            {preview.errors.length > 0 && <RowProblems rows={preview.errors} />}
            {preview.preview.length > 0 && <PreviewRows rows={preview.preview} />}
          </div>
        )}

        {/* Result — what actually happened. */}
        {result && (
          <Alert tone="success">
            {result.imported} day{result.imported === 1 ? "" : "s"} imported
            for {result.employees} {result.employees === 1 ? "person" : "people"}{" "}
            ({range(result)}).
            {result.failed > 0 && ` ${result.failed} rows were skipped.`}
          </Alert>
        )}
      </div>
    </Modal>
  );
}

/** Rows the file got wrong, with the line number to fix in the spreadsheet. */
function RowProblems({
  rows,
}: {
  rows: { row: number; employee: string; date: string; errors: string[] }[];
}) {
  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border border-red-100 bg-red-50 p-2">
      {rows.map((r) => (
        <div key={`${r.row}`} className="px-2 py-1 text-xs text-red-700">
          <span className="font-medium">Row {r.row}</span>
          {r.employee !== "—" && <span> · {r.employee}</span>}
          {r.date && <span> · {r.date}</span>} — {r.errors.join("; ")}
        </div>
      ))}
    </div>
  );
}

/** What each day would become, so the decision is visible before committing. */
function PreviewRows({
  rows,
}: {
  rows: ImportSummary["preview"];
}) {
  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
      <Table>
        <THead>
          {/* THead renders the <tr> itself — these are its cells. */}
          <Th>Date</Th><Th>Employee</Th><Th>In</Th><Th>Out</Th>
          <Th>Worked</Th><Th>Status</Th>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={`${r.employeeCode}-${r.date}`}>
              <Td className="whitespace-nowrap text-xs">{r.date}</Td>
              <Td>
                <div className="text-sm text-gray-800">{r.name}</div>
                <div className="font-mono text-[11px] text-gray-400">
                  {r.employeeCode}
                  {r.punches > 1 && ` · ${r.punches} punches`}
                </div>
              </Td>
              <Td className="text-xs">{r.checkIn || "—"}</Td>
              <Td className="text-xs">{r.checkOut || "—"}</Td>
              <Td className="text-xs">{dur(r.workedMinutes)}</Td>
              <Td>
                <Badge
                  tone={
                    STATUSES.find((s) => s.value === r.status)?.tone || "neutral"
                  }
                >
                  {r.status.replace("_", " ")}
                </Badge>
                {r.overwrites && (
                  <div className="text-[11px] text-amber-600">replaces a marked day</div>
                )}
                <div className="text-[11px] text-gray-400">from {r.statusSource}</div>
              </Td>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

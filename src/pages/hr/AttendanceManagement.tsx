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
import { Pencil, Search } from "lucide-react";

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
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Attendance"}
            </Button>
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

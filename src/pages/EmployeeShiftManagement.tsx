import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  employeeShiftApi,
  departmentApi,
  designationApi,
} from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import { dialog } from "../services/dialog";
import Pagination from "../components/Pagination";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert, Select, cn,
} from "../components/ui";

/** Shifts someone can actually be rostered to work. */
const SHIFTS = ["morning", "evening", "night", "general"];
/** Week off is assignable too, but it is the absence of a shift, not one. */
const WEEK_OFF = "week_off";
const shiftLabel = (s: string) => (s === WEEK_OFF ? "week off" : s);

/**
 * How many people one bulk action may target. The picker endpoint is
 * unpaginated by design, so without this a department filter could quietly
 * put tens of thousands of ids in a request body.
 */
const MAX_TARGETS = 2000;
/** How many picker rows are rendered at once — the rest wait behind a search. */
const MAX_VISIBLE = 200;

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type Ref = { _id: string; name: string };
type PickerEmployee = {
  _id: string;
  fullName: string;
  employeeCode?: string;
  departmentId?: { name?: string };
  designationId?: { _id?: string; name?: string };
};

export default function EmployeeShiftManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.EMPLOYEES_UPDATE);

  const [date, setDate] = useState(today());
  // Blank = a single day. Set it to read the roster a week at a time, which is
  // how a ward pattern is actually checked.
  const [dateTo, setDateTo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationIds, setDesignationIds] = useState<string[]>([]);
  const [shift, setShift] = useState("");
  const [departments, setDepartments] = useState<Ref[]>([]);
  const [designations, setDesignations] = useState<Ref[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const [bulkMode, setBulkMode] = useState<"assign" | "clear" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeeShiftApi.list({
        date,
        dateTo: dateTo || undefined,
        departmentId: departmentId || undefined,
        // The endpoint reads several designations from one comma-separated
        // value — "roster the guards and housekeeping together" is one filter.
        designationId: designationIds.join(",") || undefined,
        shift: shift || undefined,
        page,
        limit,
      });
      setRows(res.data?.items || []);
      setTotal(res.data?.pagination?.total || 0);
    } finally { setLoading(false); }
  }, [date, dateTo, departmentId, designationIds, shift, page, limit]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setPage(1);
  }, [date, dateTo, departmentId, designationIds, shift, limit]);

  useEffect(() => {
    // Both lists are paged now; these fill filter dropdowns, so ask for the
    // whole (small) master rather than the server's default first page.
    departmentApi.getAll({ status: "active", limit: "100" })
      .then((r) => setDepartments(r.data?.items || r.data || []))
      .catch(() => {});
    designationApi.getAll({ status: "active", limit: "100" })
      .then((r) => setDesignations(r.data?.items || r.data || []))
      .catch(() => {});
  }, []);

  const remove = async (id: string) => { await employeeShiftApi.remove(id); load(); };

  const cols = dateTo ? 8 : 7;
  const filtered = !!(departmentId || designationIds.length || shift);
  // "Nothing assigned" and "nothing matches your filter" are different
  // problems, and telling them apart saves someone assuming the roster is
  // empty when it is only hidden.
  const emptyMessage = filtered
    ? "No shifts match these filters. Clear them to see the full roster."
    : dateTo
      ? "No shifts assigned in this date range."
      : "No shifts assigned for this day.";

  return (
    <div className="p-6">
      <PageHeader title="Employee Shifts" subtitle="Hospital/HR staff shift roster (nurses, ward, OPD/IPD support)"
        actions={
          <>
            <Button variant="secondary" onClick={load}>Refresh</Button>
            {canManage && (
              <>
                <Button variant="secondary" onClick={() => setBulkMode("clear")}>
                  Clear shifts in range
                </Button>
                {/* In the header rather than at the end of the filter row, where
                    it was pushed off-screen whenever the filters wrapped. */}
                <Button onClick={() => setBulkMode("assign")}>+ Assign shifts</Button>
              </>
            )}
          </>
        } />

      <div className="mb-4 flex flex-wrap items-start gap-3">
        <Field label="From" className="w-40">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="To (optional)" className="w-40">
          <Input
            type="date"
            value={dateTo}
            min={date}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </Field>
        <Field label="Department" className="w-52">
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            <option value="none">Unassigned</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </Select>
        </Field>
        <div className="w-52">
          <span className="mb-1 block text-xs font-medium text-gray-600">Designation</span>
          <MultiSelect
            options={designations}
            selected={designationIds}
            onChange={setDesignationIds}
            allLabel="All designations"
            extraOption={{ _id: "none", name: "Unassigned" }}
          />
        </div>
        <Field label="Shift" className="w-40">
          <Select value={shift} onChange={(e) => setShift(e.target.value)} className="capitalize">
            <option value="">All shifts</option>
            {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value={WEEK_OFF}>week off</option>
          </Select>
        </Field>
        <Field label="Rows" className="w-32">
          <Select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </Select>
        </Field>
        {(dateTo || departmentId || designationIds.length > 0 || shift) && (
          // Offset by a label's height so it lines up with the inputs.
          <div className="pt-5">
            <Button
              variant="secondary"
              onClick={() => { setDateTo(""); setDepartmentId(""); setDesignationIds([]); setShift(""); }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      <Table>
        <THead>
          {/* Only worth a date column when the view spans more than one day. */}
          {dateTo && <Th>Date</Th>}
          <Th>Employee</Th><Th>Department</Th><Th>Designation</Th>
          <Th>Shift</Th><Th>Time</Th><Th>Section</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading && rows.length === 0 ? <TableState colSpan={cols}>Loading…</TableState>
            : rows.length === 0 ? <TableState colSpan={cols}>{emptyMessage}</TableState>
            : rows.map((r) => (
              <TR key={r._id}>
                {dateTo && <Td className="text-gray-500 text-xs whitespace-nowrap">{r.date}</Td>}
                <Td className="font-medium text-gray-900">{r.employeeId?.fullName || "—"}<div className="text-xs text-gray-400">{r.employeeId?.employeeCode}</div></Td>
                <Td className="text-gray-500">{r.employeeId?.departmentId?.name || "—"}</Td>
                <Td className="text-gray-500">{r.employeeId?.designationId?.name || "—"}</Td>
                <Td>
                  {/* A week off is the absence of a shift, so it must not read
                      as one more colour of shift chip. */}
                  {r.shift === WEEK_OFF ? (
                    <Badge tone="neutral" className="border border-dashed border-gray-300 bg-transparent text-gray-500">
                      week off
                    </Badge>
                  ) : (
                    <Badge tone="info">{r.shift}</Badge>
                  )}
                </Td>
                <Td className="text-gray-500 text-xs">{r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : "—"}</Td>
                <Td className="text-gray-500">{[r.department, r.section].filter(Boolean).join(" · ") || "—"}</Td>
                <Td className="text-right">
                  {canManage && (
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(r._id)}>Remove</Button>
                  )}
                </Td>
              </TR>
            ))}
        </TBody>
      </Table>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          label="shifts"
          onPageChange={setPage}
        />
      </div>

      <BulkModal
        mode={bulkMode}
        onClose={() => setBulkMode(null)}
        onDone={load}
        departments={departments}
        designations={designations}
        initial={{ from: date, to: dateTo || date, departmentId, designationIds }}
      />
    </div>
  );
}

/* ===================== Bulk assign / clear ===================== */

/**
 * Roster a range in one action.
 *
 * Targets are either people picked by hand or everyone matching a department /
 * set of designations — the same either/or the endpoint enforces, so the form
 * cannot build a request the server will refuse.
 */
function BulkModal({
  mode,
  onClose,
  onDone,
  departments,
  designations,
  initial,
}: {
  mode: "assign" | "clear" | null;
  onClose: () => void;
  onDone: () => void;
  departments: Ref[];
  designations: Ref[];
  initial: { from: string; to: string; departmentId: string; designationIds: string[] };
}) {
  const clearing = mode === "clear";

  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [departmentId, setDepartmentId] = useState(initial.departmentId);
  const [designationIds, setDesignationIds] = useState<string[]>(initial.designationIds);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [shift, setShift] = useState("general");
  const [skipWeekOffs, setSkipWeekOffs] = useState(true);
  const [detail, setDetail] = useState({ startTime: "", endTime: "", department: "", section: "", notes: "" });

  const [pool, setPool] = useState<PickerEmployee[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setFrom(initial.from);
    setTo(initial.to);
    setDepartmentId(initial.departmentId);
    setDesignationIds(initial.designationIds);
    setEmployeeIds([]);
    setSearch("");
    setError("");
    setResult("");
    setShift(clearing ? "" : "general");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /**
   * The picker follows the same department/designation the assignment targets,
   * narrowed on the server wherever it can be: the endpoint takes one
   * designation, so several are narrowed by department and sifted here.
   */
  useEffect(() => {
    if (!mode) return;
    setPoolLoading(true);
    employeeShiftApi
      .employees({
        departmentId: departmentId || undefined,
        designationId: designationIds.length === 1 ? designationIds[0] : undefined,
      })
      .then((r) => setPool(r.data?.items || []))
      .catch(() => setPool([]))
      .finally(() => setPoolLoading(false));
  }, [mode, departmentId, designationIds]);

  const matching = useMemo(() => {
    if (designationIds.length <= 1) return pool;
    const wanted = new Set(designationIds);
    return pool.filter((e) =>
      wanted.has(e.designationId?._id || "none"),
    );
  }, [pool, designationIds]);

  const found = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return matching;
    return matching.filter(
      (e) =>
        e.fullName?.toLowerCase().includes(q) ||
        e.employeeCode?.toLowerCase().includes(q),
    );
  }, [matching, search]);

  const visible = found.slice(0, MAX_VISIBLE);

  const days = useMemo(() => {
    if (!from || !to || to < from) return 0;
    return Math.round(
      (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000,
    ) + 1;
  }, [from, to]);

  const targetsByFilter = employeeIds.length === 0;
  const targetCount = employeeIds.length || matching.length;

  const toggleEmployee = (id: string) =>
    setEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );

  const assign = async () => {
    setError("");
    setResult("");
    if (targetsByFilter && !departmentId && designationIds.length === 0) {
      setError("Pick people, or a department / designation to assign them by.");
      return;
    }
    setSaving(true);
    try {
      const res = await employeeShiftApi.bulkAssign({
        ...(employeeIds.length ? { employeeIds } : {}),
        ...(targetsByFilter && departmentId ? { departmentId } : {}),
        ...(targetsByFilter && designationIds.length ? { designationIds } : {}),
        from,
        to,
        shift,
        startTime: detail.startTime || undefined,
        endTime: detail.endTime || undefined,
        department: detail.department || undefined,
        section: detail.section || undefined,
        notes: detail.notes || undefined,
        // The server ignores this for a week-off assignment; sending the real
        // state keeps the request readable in a log.
        skipWeekOffs,
      });
      setResult(summarize(res.data));
      onDone();
    } catch (e: any) {
      setError(e?.data?.hint || e?.message || "Could not assign the shifts.");
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setError("");
    setResult("");
    // DELETE takes explicit ids only, so a filter-shaped selection is resolved
    // to the people it means before asking.
    const ids = employeeIds.length ? employeeIds : matching.map((e) => e._id);
    if (ids.length === 0) {
      setError("Nobody is selected. Pick people, or a department / designation.");
      return;
    }
    if (ids.length > MAX_TARGETS) {
      setError(`That is ${ids.length} people — narrow the selection (max ${MAX_TARGETS}).`);
      return;
    }
    const scope = shift ? `“${shiftLabel(shift)}” shifts` : "all shifts";
    if (
      !(await dialog.confirm({
        title: `Clear ${scope} for ${ids.length} ${ids.length === 1 ? "person" : "people"}?`,
        message: `Every roster entry from ${from} to ${to} is deleted for them. Attendance already marked is not affected, but the roster itself cannot be restored — it has to be assigned again.`,
        confirmLabel: "Clear shifts",
        tone: "danger",
      }))
    )
      return;
    setSaving(true);
    try {
      const res = await employeeShiftApi.bulkRemove({
        employeeIds: ids,
        from,
        to,
        shift: shift || undefined,
      });
      const removed = res.data?.removed ?? 0;
      setResult(
        removed === 0
          ? "Nothing to clear — no roster entries in that range."
          : `${removed} roster ${removed === 1 ? "entry" : "entries"} cleared.`,
      );
      onDone();
    } catch (e: any) {
      setError(e?.data?.hint || e?.message || "Could not clear the shifts.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!mode}
      onClose={onClose}
      size="lg"
      title={clearing ? "Clear shifts in range" : "Assign shifts"}
      subtitle={
        clearing
          ? "Removes roster entries — the undo for an assignment that went wrong"
          : "One shift, over a date range, for as many people as you like"
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            variant={clearing ? "danger" : "primary"}
            onClick={clearing ? clear : assign}
            disabled={saving || days === 0}
          >
            {saving
              ? clearing ? "Clearing…" : "Assigning…"
              : clearing ? "Clear shifts" : "Assign"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {result && <Alert tone="success">{result}</Alert>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="From *">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field
            label="To *"
            error={days === 0 ? "Not a valid range" : undefined}
          >
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label={clearing ? "Shift" : "Shift *"} className="md:col-span-2">
            <Select value={shift} onChange={(e) => setShift(e.target.value)} className="capitalize">
              {clearing && <option value="">All shifts</option>}
              {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value={WEEK_OFF}>week off</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Department">
            <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">All departments</option>
              <option value="none">Unassigned</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </Select>
          </Field>
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">Designation</span>
            <MultiSelect
              options={designations}
              selected={designationIds}
              onChange={setDesignationIds}
              allLabel="All designations"
              extraOption={{ _id: "none", name: "Unassigned" }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-gray-600">
              Employees {employeeIds.length > 0 && `· ${employeeIds.length} selected`}
            </span>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                className="text-healwin-600 hover:underline"
                onClick={() =>
                  setEmployeeIds((prev) => [
                    ...new Set([...prev, ...visible.map((e) => e._id)]),
                  ])
                }
              >
                Select all visible
              </button>
              {employeeIds.length > 0 && (
                <button type="button" className="text-gray-400 hover:text-gray-600" onClick={() => setEmployeeIds([])}>
                  Clear
                </button>
              )}
            </div>
          </div>
          <Input
            placeholder="Search name or employee code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200">
            {poolLoading ? (
              <p className="px-3 py-6 text-center text-sm text-gray-400">Loading people…</p>
            ) : visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-400">
                {matching.length === 0
                  ? "Nobody matches this department / designation."
                  : "No employee matches that search."}
              </p>
            ) : (
              visible.map((e) => (
                <label
                  key={e._id}
                  className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={employeeIds.includes(e._id)}
                    onChange={() => toggleEmployee(e._id)}
                  />
                  <span className="font-medium text-gray-900">{e.fullName}</span>
                  <span className="text-xs text-gray-400">
                    {[e.employeeCode, e.designationId?.name].filter(Boolean).join(" · ")}
                  </span>
                </label>
              ))
            )}
          </div>
          {found.length > visible.length && (
            <p className="mt-1 text-xs text-gray-400">
              Showing {visible.length} of {found.length} — search, or narrow by
              department/designation, to see the rest.
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {targetsByFilter
              ? `Nobody picked — this applies to everyone matching the filters above (${matching.length} ${matching.length === 1 ? "person" : "people"}).`
              : `${employeeIds.length} picked; the department and designation above are ignored.`}
          </p>
        </div>

        {!clearing && (
          <>
            {shift !== WEEK_OFF && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={skipWeekOffs}
                  onChange={(e) => setSkipWeekOffs(e.target.checked)}
                />
                <span>
                  Skip each person’s week offs
                  <span className="block text-xs text-gray-400">
                    Leaves their own off days alone, so the range can just be
                    the whole month.
                  </span>
                </span>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Start"><Input type="time" value={detail.startTime} onChange={(e) => setDetail({ ...detail, startTime: e.target.value })} /></Field>
              <Field label="End"><Input type="time" value={detail.endTime} onChange={(e) => setDetail({ ...detail, endTime: e.target.value })} /></Field>
              <Field label="Department"><Input value={detail.department} onChange={(e) => setDetail({ ...detail, department: e.target.value })} /></Field>
              <Field label="Section"><Input value={detail.section} onChange={(e) => setDetail({ ...detail, section: e.target.value })} placeholder="OPD / ICU / Ward-A" /></Field>
            </div>
            <Field label="Notes"><Input value={detail.notes} onChange={(e) => setDetail({ ...detail, notes: e.target.value })} /></Field>
          </>
        )}

        <p className="text-xs text-gray-400">
          {days > 0
            ? `${days} ${days === 1 ? "day" : "days"} × about ${targetCount} ${targetCount === 1 ? "person" : "people"}.`
            : "Pick a valid date range."}
        </p>
      </div>
    </Modal>
  );
}

/** The endpoint's counts, as a sentence someone can act on. */
const summarize = (d: any): string => {
  const parts: string[] = [];
  if (d?.assigned) parts.push(`${d.assigned} days assigned`);
  if (d?.updated) parts.push(`${d.updated} updated`);
  if (d?.skippedWeekOffs) parts.push(`${d.skippedWeekOffs} week offs skipped`);
  if (d?.skippedNotEmployed)
    parts.push(`${d.skippedNotEmployed} skipped (not employed on those days)`);
  const scope = `${d?.employees ?? 0} ${d?.employees === 1 ? "person" : "people"} over ${d?.days ?? 0} ${d?.days === 1 ? "day" : "days"}`;
  return parts.length
    ? `${parts.join(", ")} — ${scope}.`
    : `Nothing to do: every day for ${scope} was already assigned or skipped.`;
};

/* ===================== Multi-select ===================== */

/** A checkbox dropdown for filters that accept more than one value. */
function MultiSelect({
  options,
  selected,
  onChange,
  allLabel,
  extraOption,
}: {
  options: Ref[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
  extraOption?: Ref;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const all = extraOption ? [extraOption, ...options] : options;
  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? all.find((o) => o._id === selected[0])?.name || "1 selected"
        : `${selected.length} selected`;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm outline-none transition-colors focus:border-healwin-500 focus:ring-2 focus:ring-healwin-500/20",
          selected.length ? "text-gray-900" : "text-gray-500",
        )}
      >
        <span className="truncate">{label}</span>
        <span className="text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {selected.length > 0 && (
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50"
              onClick={() => onChange([])}
            >
              Clear selection
            </button>
          )}
          {all.map((o) => (
            <label key={o._id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50">
              <input type="checkbox" checked={selected.includes(o._id)} onChange={() => toggle(o._id)} />
              <span className="truncate">{o.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

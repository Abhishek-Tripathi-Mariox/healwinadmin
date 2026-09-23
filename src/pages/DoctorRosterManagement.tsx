import { useCallback, useEffect, useRef, useState } from "react";
import { doctorRosterApi, doctorScheduleApi, departmentApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert, Select,
} from "../components/ui";

const SHIFTS = ["morning", "evening", "night", "full"];
// Local calendar date. `toISOString()` converts to UTC first, which in IST
// returns yesterday for anything before 05:30 — the roster opened on the wrong
// day for the night shift.
const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function DoctorRosterManagement() {
  const [date, setDate] = useState(today());
  // End of range. Blank = single day, which is how this always behaved.
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ doctorId: "", shift: "full", isOnCall: false, department: "", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState("");

  /**
   * Guards against responses arriving out of order.
   *
   * Changing the date quickly fires several requests, and a slow earlier one
   * could land after the newer one and overwrite it — so the table showed the
   * previous day's roster, or nothing, for the date actually selected. Only the
   * most recent request is allowed to write.
   */
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError("");
    try {
      const res = await doctorRosterApi.list(date, toDate || undefined, { page, limit });
      if (seq !== requestSeq.current) return; // a newer request superseded this one
      setRows(res.data?.items || []);
      setTotal(res.data?.pagination?.total || 0);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setLoadError(e instanceof Error ? e.message : "Could not load the roster.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [date, toDate, page, limit]);

  /**
   * Moving "From" past "To" leaves an inverted range — from a later day to an
   * earlier one — which matches nothing. `min` on the To picker only limits
   * what can be picked, not a value already set, so the range is cleared here.
   */
  const changeFrom = (value: string) => {
    setDate(value);
    if (toDate && value && toDate < value) setToDate("");
  };

  useEffect(() => { load(); }, [load]);
  // A new date range is a new list — staying on page 4 of the old one shows
  // an empty table for a period that does have duties.
  useEffect(() => { setPage(1); }, [date, toDate, limit]);
  // Explicit limit: this fills the "Assign duty" doctor picker, and without it
  // the picker silently stops at the backend's default page of doctors.
  useEffect(() => { doctorScheduleApi.listDoctors({ limit: 100 }).then((r) => setDoctors(r.data?.items || [])).catch(() => {}); }, []);
  useEffect(() => {
    departmentApi
      .getAll({ status: "active" })
      .then((r) => setDepartments(r.data?.items || r.data || []))
      .catch(() => undefined);
  }, []);

  const add = async () => {
    if (!form.doctorId) { setError("Select a doctor"); return; }
    setSaving(true); setError("");
    try { await doctorRosterApi.add({ ...form, date }); setModal(false); load(); }
    catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };
  const remove = async (id: string) => { await doctorRosterApi.remove(id); load(); };

  return (
    <div className="p-6">
      <PageHeader title="Doctor Roster" subtitle="Daily duty & on-call schedule"
        actions={
          // Disabled and relabelled while loading, so a refresh of a populated
          // table visibly does something instead of looking ignored.
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        } />
      {loadError && <Alert className="mb-4">{loadError}</Alert>}

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-gray-500">From</label>
        <input type="date" value={date} onChange={(e) => changeFrom(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
        <label className="text-sm text-gray-500">To</label>
        <input type="date" value={toDate} min={date} onChange={(e) => setToDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
        {toDate && (
          <Button size="sm" variant="ghost" onClick={() => setToDate("")}>Clear range</Button>
        )}
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
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setForm({ doctorId: "", shift: "full", isOnCall: false, department: "", notes: "" }); setError(""); setModal(true); }}>+ Assign duty</Button>
        </div>
      </div>

      <Table>
        <THead>{toDate && <Th>Date</Th>}<Th>Doctor</Th><Th>Speciality</Th><Th>Shift</Th><Th>On-call</Th><Th>Dept</Th><Th className="text-right">Actions</Th></THead>
        <TBody>
          {loading && rows.length === 0 ? <TableState colSpan={toDate ? 7 : 6}>Loading…</TableState>
            : rows.length === 0 ? <TableState colSpan={toDate ? 7 : 6}>No duties assigned for this period.</TableState>
            : rows.map((r) => (
              <TR key={r._id}>
                {toDate && <Td className="whitespace-nowrap text-gray-600">{r.date}</Td>}
                <Td className="font-medium text-gray-900">{r.doctorId?.fullName || "—"}</Td>
                <Td className="text-gray-500">{r.doctorId?.doctorProfile?.speciality || "—"}</Td>
                <Td><Badge tone="info">{r.shift}</Badge></Td>
                <Td>{r.isOnCall ? <Badge tone="warning">On-call</Badge> : "—"}</Td>
                <Td className="text-gray-500">{r.department || "—"}</Td>
                <Td className="text-right"><Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(r._id)}>Remove</Button></Td>
              </TR>
            ))}
        </TBody>
      </Table>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          label="duties"
          onPageChange={setPage}
        />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={`Assign duty — ${date}`}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={add} disabled={saving}>{saving ? "Saving…" : "Assign"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Doctor *">
            <select value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— Select doctor —</option>
              {doctors.map((d) => <option key={d._id} value={d._id}>{d.fullName}{d.speciality ? ` · ${d.speciality}` : ""}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shift">
              <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="On-call">
              <select value={form.isOnCall ? "1" : "0"} onChange={(e) => setForm({ ...form, isOnCall: e.target.value === "1" })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="0">No</option><option value="1">Yes</option>
              </select>
            </Field>
          </div>
          {/* A list rather than free text: typed department names drift
              ("Cardio", "cardiology ", "Cardiology") and then never match
              anything that filters by department. */}
          <Field label="Department">
            <Select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            >
              <option value="">— Select department —</option>
              {departments.map((d) => (
                <option key={d._id} value={d.name}>{d.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

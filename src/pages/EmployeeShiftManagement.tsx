import { useCallback, useEffect, useState } from "react";
import {
  employeeShiftApi,
  departmentApi,
  designationApi,
} from "../services/admin-api";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert, Select,
} from "../components/ui";

const SHIFTS = ["morning", "evening", "night", "general"];
const today = () => new Date().toISOString().slice(0, 10);

type Ref = { _id: string; name: string };

export default function EmployeeShiftManagement() {
  const [date, setDate] = useState(today());
  // Blank = a single day. Set it to read the roster a week at a time, which is
  // how a ward pattern is actually checked.
  const [dateTo, setDateTo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [shift, setShift] = useState("");
  const [departments, setDepartments] = useState<Ref[]>([]);
  const [designations, setDesignations] = useState<Ref[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ employeeId: "", shift: "general", startTime: "", endTime: "", department: "", section: "", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeeShiftApi.list({
        date,
        dateTo: dateTo || undefined,
        departmentId: departmentId || undefined,
        designationId: designationId || undefined,
        shift: shift || undefined,
      });
      setRows(res.data?.items || []);
    } finally { setLoading(false); }
  }, [date, dateTo, departmentId, designationId, shift]);

  useEffect(() => { load(); }, [load]);

  // The picker in the assign dialog follows the same department/designation
  // filter, so the list you are looking at and the people you can add to it
  // stay consistent.
  useEffect(() => {
    employeeShiftApi
      .employees({
        departmentId: departmentId || undefined,
        designationId: designationId || undefined,
      })
      .then((r) => setEmployees(r.data?.items || []))
      .catch(() => {});
  }, [departmentId, designationId]);

  useEffect(() => {
    departmentApi.getAll({ status: "active" })
      .then((r) => setDepartments(r.data?.items || r.data || []))
      .catch(() => {});
    designationApi.getAll({ status: "active" })
      .then((r) => setDesignations(r.data?.items || r.data || []))
      .catch(() => {});
  }, []);

  const add = async () => {
    if (!form.employeeId) { setError("Select an employee"); return; }
    setSaving(true); setError("");
    try { await employeeShiftApi.add({ ...form, date }); setModal(false); load(); }
    catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };
  const remove = async (id: string) => { await employeeShiftApi.remove(id); load(); };

  const cols = dateTo ? 8 : 7;
  const filtered = !!(departmentId || designationId || shift);
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
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="From" className="w-40">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="To" hint="leave blank for a single day" className="w-40">
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
        <Field label="Designation" className="w-52">
          <Select value={designationId} onChange={(e) => setDesignationId(e.target.value)}>
            <option value="">All designations</option>
            <option value="none">Unassigned</option>
            {designations.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Shift" className="w-40">
          <Select value={shift} onChange={(e) => setShift(e.target.value)} className="capitalize">
            <option value="">All shifts</option>
            {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        {(dateTo || departmentId || designationId || shift) && (
          <Button
            variant="secondary"
            onClick={() => { setDateTo(""); setDepartmentId(""); setDesignationId(""); setShift(""); }}
          >
            Clear filters
          </Button>
        )}
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setForm({ employeeId: "", shift: "general", startTime: "", endTime: "", department: "", section: "", notes: "" }); setError(""); setModal(true); }}>+ Assign shift</Button>
        </div>
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
                <Td><Badge tone="info">{r.shift}</Badge></Td>
                <Td className="text-gray-500 text-xs">{r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : "—"}</Td>
                <Td className="text-gray-500">{[r.department, r.section].filter(Boolean).join(" · ") || "—"}</Td>
                <Td className="text-right"><Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(r._id)}>Remove</Button></Td>
              </TR>
            ))}
        </TBody>
      </Table>

      <Modal open={modal} onClose={() => setModal(false)} title={`Assign shift — ${date}`}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={add} disabled={saving}>{saving ? "Saving…" : "Assign"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Employee *">
            <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— Select employee —</option>
              {employees.map((em) => <option key={em._id} value={em._id}>{em.employeeCode} — {em.fullName}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Shift">
              <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Start"><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
            <Field label="End"><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
            <Field label="Section"><Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="OPD / ICU / Ward-A" /></Field>
          </div>
          <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

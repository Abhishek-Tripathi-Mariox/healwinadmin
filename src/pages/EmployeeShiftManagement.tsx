import { useCallback, useEffect, useState } from "react";
import { employeeShiftApi } from "../services/admin-api";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";

const SHIFTS = ["morning", "evening", "night", "general"];
const today = () => new Date().toISOString().slice(0, 10);

export default function EmployeeShiftManagement() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ employeeId: "", shift: "general", startTime: "", endTime: "", department: "", section: "", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await employeeShiftApi.list(date)).data?.items || []); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { employeeShiftApi.employees().then((r) => setEmployees(r.data?.items || [])).catch(() => {}); }, []);

  const add = async () => {
    if (!form.employeeId) { setError("Select an employee"); return; }
    setSaving(true); setError("");
    try { await employeeShiftApi.add({ ...form, date }); setModal(false); load(); }
    catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };
  const remove = async (id: string) => { await employeeShiftApi.remove(id); load(); };

  return (
    <div className="p-6">
      <PageHeader title="Employee Shifts" subtitle="Hospital/HR staff shift roster (nurses, ward, OPD/IPD support)"
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>} />

      <div className="mb-4 flex items-center gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setForm({ employeeId: "", shift: "general", startTime: "", endTime: "", department: "", section: "", notes: "" }); setError(""); setModal(true); }}>+ Assign shift</Button>
        </div>
      </div>

      <Table>
        <THead><Th>Employee</Th><Th>Shift</Th><Th>Time</Th><Th>Section</Th><Th className="text-right">Actions</Th></THead>
        <TBody>
          {loading && rows.length === 0 ? <TableState colSpan={5}>Loading…</TableState>
            : rows.length === 0 ? <TableState colSpan={5}>No shifts assigned for this day.</TableState>
            : rows.map((r) => (
              <TR key={r._id}>
                <Td className="font-medium text-gray-900">{r.employeeId?.fullName || "—"}<div className="text-xs text-gray-400">{r.employeeId?.employeeCode}</div></Td>
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

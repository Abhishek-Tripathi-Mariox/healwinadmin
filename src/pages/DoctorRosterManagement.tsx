import { useCallback, useEffect, useState } from "react";
import { doctorRosterApi, doctorScheduleApi } from "../services/admin-api";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";

const SHIFTS = ["morning", "evening", "night", "full"];
const today = () => new Date().toISOString().slice(0, 10);

export default function DoctorRosterManagement() {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ doctorId: "", shift: "full", isOnCall: false, department: "", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await doctorRosterApi.list(date)).data?.items || []);
    } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { doctorScheduleApi.listDoctors().then((r) => setDoctors(r.data?.items || [])).catch(() => {}); }, []);

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
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>} />

      <div className="mb-4 flex items-center gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setForm({ doctorId: "", shift: "full", isOnCall: false, department: "", notes: "" }); setError(""); setModal(true); }}>+ Assign duty</Button>
        </div>
      </div>

      <Table>
        <THead><Th>Doctor</Th><Th>Speciality</Th><Th>Shift</Th><Th>On-call</Th><Th>Dept</Th><Th className="text-right">Actions</Th></THead>
        <TBody>
          {loading && rows.length === 0 ? <TableState colSpan={6}>Loading…</TableState>
            : rows.length === 0 ? <TableState colSpan={6}>No duties assigned for this day.</TableState>
            : rows.map((r) => (
              <TR key={r._id}>
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
          <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

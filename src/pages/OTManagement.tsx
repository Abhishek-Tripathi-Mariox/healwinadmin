import { useCallback, useEffect, useState } from "react";
import { otApi, hospitalPatientApi } from "../services/admin-api";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";

type Tab = "surgeries" | "theatres";
const surgeryTone: Record<string, "neutral" | "info" | "success" | "danger"> = {
  scheduled: "info", in_progress: "info", completed: "success", cancelled: "danger",
};

export default function OTManagement() {
  const [tab, setTab] = useState<Tab>("surgeries");
  const [loading, setLoading] = useState(false);
  const [theatres, setTheatres] = useState<any[]>([]);
  const [surgeries, setSurgeries] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [theatreModal, setTheatreModal] = useState<any | null>(null);
  const [theatreForm, setTheatreForm] = useState({ name: "", location: "" });
  const [surgeryModal, setSurgeryModal] = useState(false);
  const [surgeryForm, setSurgeryForm] = useState({ otId: "", patientId: "", procedureName: "", scheduledAt: "", durationMinutes: "60", notes: "" });
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "theatres") setTheatres((await otApi.listTheatres()).data?.items || []);
      else setSurgeries((await otApi.listSurgeries()).data?.items || []);
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { otApi.listTheatres().then((r) => setTheatres(r.data?.items || [])).catch(() => {}); }, []);

  const searchPatients = async (q: string) => {
    setPatientQuery(q);
    if (q.trim().length < 2) { setPatientResults([]); return; }
    try { const r = await hospitalPatientApi.list({ search: q }); setPatientResults(r.data?.items || r.data?.patients || []); }
    catch { setPatientResults([]); }
  };

  const saveTheatre = async () => {
    if (!theatreForm.name.trim()) { setError("Name required"); return; }
    setSaving(true); setError("");
    try {
      if (theatreModal?._id) await otApi.updateTheatre(theatreModal._id, theatreForm);
      else await otApi.createTheatre(theatreForm);
      setTheatreModal(null); load();
    } catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };
  const saveSurgery = async () => {
    if (!surgeryForm.otId || !surgeryForm.patientId || !surgeryForm.procedureName || !surgeryForm.scheduledAt) {
      setError("OT, patient, procedure and date/time are required"); return;
    }
    setSaving(true); setError("");
    try { await otApi.createSurgery({ ...surgeryForm, durationMinutes: Number(surgeryForm.durationMinutes) || 60 }); setSurgeryModal(false); load(); }
    catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };
  const advance = async (s: any, status: string) => { await otApi.updateSurgeryStatus(s._id, status); load(); };

  return (
    <div className="p-6">
      <PageHeader title="Operation Theatre" subtitle="Theatres and surgery scheduling (overlap-protected)"
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>} />

      <div className="mb-4 flex gap-2">
        {(["surgeries", "theatres"] as Tab[]).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "primary" : "secondary"} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </Button>
        ))}
        <div className="ml-auto">
          {tab === "theatres" && <Button size="sm" onClick={() => { setTheatreForm({ name: "", location: "" }); setError(""); setTheatreModal({}); }}>+ Theatre</Button>}
          {tab === "surgeries" && <Button size="sm" onClick={() => { setSurgeryForm({ otId: "", patientId: "", procedureName: "", scheduledAt: "", durationMinutes: "60", notes: "" }); setPatientQuery(""); setPatientResults([]); setError(""); setSurgeryModal(true); }}>+ Schedule Surgery</Button>}
        </div>
      </div>

      {tab === "theatres" && (
        <Table>
          <THead><Th>Name</Th><Th>Location</Th><Th>Status</Th><Th className="text-right">Actions</Th></THead>
          <TBody>
            {loading && theatres.length === 0 ? <TableState colSpan={4}>Loading…</TableState>
              : theatres.length === 0 ? <TableState colSpan={4}>No theatres.</TableState>
              : theatres.map((t) => (
                <TR key={t._id}>
                  <Td className="font-medium text-gray-900">{t.name}</Td>
                  <Td className="text-gray-500">{t.location || "—"}</Td>
                  <Td><Badge tone={t.isActive ? "success" : "neutral"}>{t.isActive ? "Active" : "Inactive"}</Badge></Td>
                  <Td className="text-right"><Button size="sm" variant="secondary" onClick={() => { setTheatreForm({ name: t.name, location: t.location || "" }); setError(""); setTheatreModal(t); }}>Edit</Button></Td>
                </TR>
              ))}
          </TBody>
        </Table>
      )}

      {tab === "surgeries" && (
        <Table>
          <THead><Th>Procedure</Th><Th>Patient</Th><Th>OT</Th><Th>When</Th><Th>Status</Th><Th className="text-right">Actions</Th></THead>
          <TBody>
            {loading && surgeries.length === 0 ? <TableState colSpan={6}>Loading…</TableState>
              : surgeries.length === 0 ? <TableState colSpan={6}>No surgeries.</TableState>
              : surgeries.map((s) => (
                <TR key={s._id}>
                  <Td className="font-medium text-gray-900">{s.procedureName}</Td>
                  <Td>{s.patientId?.fullName || "—"}</Td>
                  <Td>{s.otId?.name || "—"}</Td>
                  <Td className="text-xs text-gray-500">{new Date(s.scheduledAt).toLocaleString("en-IN")} · {s.durationMinutes}m</Td>
                  <Td><Badge tone={surgeryTone[s.status] || "neutral"}>{s.status.replace("_", " ")}</Badge></Td>
                  <Td className="text-right whitespace-nowrap">
                    {s.status === "scheduled" && <Button size="sm" variant="secondary" onClick={() => advance(s, "in_progress")}>Start</Button>}
                    {s.status === "in_progress" && <Button size="sm" variant="secondary" onClick={() => advance(s, "completed")}>Complete</Button>}
                    {["scheduled", "in_progress"].includes(s.status) && <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => advance(s, "cancelled")}>Cancel</Button>}
                  </Td>
                </TR>
              ))}
          </TBody>
        </Table>
      )}

      <Modal open={!!theatreModal} onClose={() => setTheatreModal(null)} title={theatreModal?._id ? "Edit Theatre" : "Add Theatre"}
        footer={<><Button variant="secondary" onClick={() => setTheatreModal(null)}>Cancel</Button><Button onClick={saveTheatre} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Name *"><Input value={theatreForm.name} onChange={(e) => setTheatreForm({ ...theatreForm, name: e.target.value })} placeholder="OT-1 / Cardiac OT" /></Field>
          <Field label="Location"><Input value={theatreForm.location} onChange={(e) => setTheatreForm({ ...theatreForm, location: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={surgeryModal} onClose={() => setSurgeryModal(false)} title="Schedule Surgery"
        footer={<><Button variant="secondary" onClick={() => setSurgeryModal(false)}>Cancel</Button><Button onClick={saveSurgery} disabled={saving}>{saving ? "Saving…" : "Schedule"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Theatre *">
            <select value={surgeryForm.otId} onChange={(e) => setSurgeryForm({ ...surgeryForm, otId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— Select OT —</option>
              {theatres.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Patient *">
            <Input placeholder="Search patient by name/phone…" value={patientQuery} onChange={(e) => searchPatients(e.target.value)} />
            {patientResults.length > 0 && (
              <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-gray-200">
                {patientResults.map((p) => (
                  <button key={p._id} onClick={() => { setSurgeryForm({ ...surgeryForm, patientId: p._id }); setPatientQuery(`${p.fullName} (${p.patientId || p.phone})`); setPatientResults([]); }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">{p.fullName} · {p.patientId || p.phone}</button>
                ))}
              </div>
            )}
          </Field>
          <Field label="Procedure *"><Input value={surgeryForm.procedureName} onChange={(e) => setSurgeryForm({ ...surgeryForm, procedureName: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date & time *"><Input type="datetime-local" value={surgeryForm.scheduledAt} onChange={(e) => setSurgeryForm({ ...surgeryForm, scheduledAt: e.target.value })} /></Field>
            <Field label="Duration (min)"><Input type="number" value={surgeryForm.durationMinutes} onChange={(e) => setSurgeryForm({ ...surgeryForm, durationMinutes: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Input value={surgeryForm.notes} onChange={(e) => setSurgeryForm({ ...surgeryForm, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { insuranceApi, hospitalPatientApi } from "../services/admin-api";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";

type Tab = "claims" | "policies" | "payers";
const claimTone: Record<string, "neutral" | "info" | "success" | "danger" | "warning"> = {
  draft: "neutral", submitted: "info", approved: "success", rejected: "danger", settled: "success",
};

export default function InsuranceManagement() {
  const [tab, setTab] = useState<Tab>("claims");
  const [loading, setLoading] = useState(false);
  const [payers, setPayers] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [error, setError] = useState("");

  // modals
  const [payerModal, setPayerModal] = useState<any | null>(null);
  const [policyModal, setPolicyModal] = useState(false);
  const [claimModal, setClaimModal] = useState(false);
  const [statusFor, setStatusFor] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // forms
  const [payerForm, setPayerForm] = useState({ name: "", type: "insurer", code: "", contactPhone: "", contactEmail: "" });
  const [policyForm, setPolicyForm] = useState({ patientId: "", payerId: "", policyNumber: "", holderName: "", sumInsured: "", validTo: "" });
  const [claimForm, setClaimForm] = useState({ policyId: "", claimedAmount: "", notes: "" });
  const [statusForm, setStatusForm] = useState({ status: "submitted", approvedAmount: "", notes: "" });
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "payers") setPayers((await insuranceApi.listPayers()).data?.items || []);
      else if (tab === "policies") setPolicies((await insuranceApi.listPolicies()).data?.items || []);
      else setClaims((await insuranceApi.listClaims()).data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);
  // Payers are needed in the policy form dropdown.
  useEffect(() => { insuranceApi.listPayers().then((r) => setPayers(r.data?.items || [])).catch(() => {}); }, []);

  const searchPatients = async (q: string) => {
    setPatientQuery(q);
    if (q.trim().length < 2) { setPatientResults([]); return; }
    try {
      const r = await hospitalPatientApi.list({ search: q });
      setPatientResults(r.data?.items || r.data?.patients || []);
    } catch { setPatientResults([]); }
  };

  // ---- save handlers ----
  const savePayer = async () => {
    if (!payerForm.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      if (payerModal?._id) await insuranceApi.updatePayer(payerModal._id, payerForm);
      else await insuranceApi.createPayer(payerForm);
      setPayerModal(null); load();
    } catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };
  const savePolicy = async () => {
    if (!policyForm.patientId || !policyForm.payerId || !policyForm.policyNumber) {
      setError("Patient, payer and policy number are required"); return;
    }
    setSaving(true); setError("");
    try { await insuranceApi.createPolicy(policyForm); setPolicyModal(false); if (tab === "policies") load(); }
    catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };
  const saveClaim = async () => {
    if (!claimForm.policyId) { setError("Select a policy"); return; }
    setSaving(true); setError("");
    try { await insuranceApi.createClaim(claimForm); setClaimModal(false); load(); }
    catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };
  const saveStatus = async () => {
    if (!statusFor) return;
    setSaving(true); setError("");
    try { await insuranceApi.updateClaimStatus(statusFor._id, statusForm); setStatusFor(null); load(); }
    catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };

  const openPolicy = () => { setPolicyForm({ patientId: "", payerId: "", policyNumber: "", holderName: "", sumInsured: "", validTo: "" }); setPatientQuery(""); setPatientResults([]); setError(""); setPolicyModal(true); };

  return (
    <div className="p-6">
      <PageHeader
        title="Insurance & TPA"
        subtitle="Manage insurers/TPAs, patient policies and claims"
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />

      <div className="mb-4 flex gap-2">
        {(["claims", "policies", "payers"] as Tab[]).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "primary" : "secondary"} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </Button>
        ))}
        <div className="ml-auto">
          {tab === "payers" && <Button size="sm" onClick={() => { setPayerForm({ name: "", type: "insurer", code: "", contactPhone: "", contactEmail: "" }); setError(""); setPayerModal({}); }}>+ Payer</Button>}
          {tab === "policies" && <Button size="sm" onClick={openPolicy}>+ Policy</Button>}
          {tab === "claims" && <Button size="sm" onClick={() => { setClaimForm({ policyId: "", claimedAmount: "", notes: "" }); setError(""); insuranceApi.listPolicies().then((r) => setPolicies(r.data?.items || [])); setClaimModal(true); }}>+ Claim</Button>}
        </div>
      </div>

      {tab === "payers" && (
        <Table>
          <THead><Th>Name</Th><Th>Type</Th><Th>Code</Th><Th>Contact</Th><Th className="text-right">Actions</Th></THead>
          <TBody>
            {loading && payers.length === 0 ? <TableState colSpan={5}>Loading…</TableState>
              : payers.length === 0 ? <TableState colSpan={5}>No payers.</TableState>
              : payers.map((p) => (
                <TR key={p._id}>
                  <Td className="font-medium text-gray-900">{p.name}</Td>
                  <Td><Badge tone={p.type === "tpa" ? "info" : "neutral"}>{p.type.toUpperCase()}</Badge></Td>
                  <Td className="text-gray-500">{p.code || "—"}</Td>
                  <Td className="text-gray-500 text-xs">{p.contactPhone || p.contactEmail || "—"}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => { setPayerForm({ name: p.name, type: p.type, code: p.code || "", contactPhone: p.contactPhone || "", contactEmail: p.contactEmail || "" }); setError(""); setPayerModal(p); }}>Edit</Button>
                  </Td>
                </TR>
              ))}
          </TBody>
        </Table>
      )}

      {tab === "policies" && (
        <Table>
          <THead><Th>Patient</Th><Th>Payer</Th><Th>Policy No.</Th><Th>Sum Insured</Th><Th>Valid To</Th></THead>
          <TBody>
            {loading && policies.length === 0 ? <TableState colSpan={5}>Loading…</TableState>
              : policies.length === 0 ? <TableState colSpan={5}>No policies.</TableState>
              : policies.map((p) => (
                <TR key={p._id}>
                  <Td className="font-medium text-gray-900">{p.patientId?.fullName || "—"}<div className="text-xs text-gray-400">{p.patientId?.patientId}</div></Td>
                  <Td>{p.payerId?.name || "—"}</Td>
                  <Td className="text-gray-600">{p.policyNumber}</Td>
                  <Td>₹{(p.sumInsured || 0).toLocaleString("en-IN")}</Td>
                  <Td className="text-gray-500 text-xs">{p.validTo ? new Date(p.validTo).toLocaleDateString("en-IN") : "—"}</Td>
                </TR>
              ))}
          </TBody>
        </Table>
      )}

      {tab === "claims" && (
        <Table>
          <THead><Th>Claim #</Th><Th>Patient</Th><Th>Payer</Th><Th>Claimed</Th><Th>Approved</Th><Th>Status</Th><Th className="text-right">Actions</Th></THead>
          <TBody>
            {loading && claims.length === 0 ? <TableState colSpan={7}>Loading…</TableState>
              : claims.length === 0 ? <TableState colSpan={7}>No claims.</TableState>
              : claims.map((c) => (
                <TR key={c._id}>
                  <Td className="font-medium text-gray-900">{c.claimNumber}</Td>
                  <Td>{c.patientId?.fullName || "—"}</Td>
                  <Td>{c.payerId?.name || "—"}</Td>
                  <Td>₹{(c.claimedAmount || 0).toLocaleString("en-IN")}</Td>
                  <Td>₹{(c.approvedAmount || 0).toLocaleString("en-IN")}</Td>
                  <Td><Badge tone={claimTone[c.status] || "neutral"}>{c.status}</Badge></Td>
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => { setStatusForm({ status: c.status === "draft" ? "submitted" : c.status, approvedAmount: String(c.approvedAmount || ""), notes: c.notes || "" }); setError(""); setStatusFor(c); }}>Update</Button>
                  </Td>
                </TR>
              ))}
          </TBody>
        </Table>
      )}

      {/* Payer modal */}
      <Modal open={!!payerModal} onClose={() => setPayerModal(null)} title={payerModal?._id ? "Edit Payer" : "Add Payer"}
        footer={<><Button variant="secondary" onClick={() => setPayerModal(null)}>Cancel</Button><Button onClick={savePayer} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Name *"><Input value={payerForm.name} onChange={(e) => setPayerForm({ ...payerForm, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={payerForm.type} onChange={(e) => setPayerForm({ ...payerForm, type: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="insurer">Insurer</option><option value="tpa">TPA</option>
              </select>
            </Field>
            <Field label="Code"><Input value={payerForm.code} onChange={(e) => setPayerForm({ ...payerForm, code: e.target.value })} /></Field>
            <Field label="Contact phone"><Input value={payerForm.contactPhone} onChange={(e) => setPayerForm({ ...payerForm, contactPhone: e.target.value })} /></Field>
            <Field label="Contact email"><Input value={payerForm.contactEmail} onChange={(e) => setPayerForm({ ...payerForm, contactEmail: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      {/* Policy modal */}
      <Modal open={policyModal} onClose={() => setPolicyModal(false)} title="Add Policy"
        footer={<><Button variant="secondary" onClick={() => setPolicyModal(false)}>Cancel</Button><Button onClick={savePolicy} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Patient *">
            <Input placeholder="Search patient by name/phone…" value={patientQuery} onChange={(e) => searchPatients(e.target.value)} />
            {patientResults.length > 0 && (
              <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-gray-200">
                {patientResults.map((p) => (
                  <button key={p._id} onClick={() => { setPolicyForm({ ...policyForm, patientId: p._id }); setPatientQuery(`${p.fullName} (${p.patientId || p.phone})`); setPatientResults([]); }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                    {p.fullName} · {p.patientId || p.phone}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <Field label="Payer *">
            <select value={policyForm.payerId} onChange={(e) => setPolicyForm({ ...policyForm, payerId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— Select —</option>
              {payers.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Policy number *"><Input value={policyForm.policyNumber} onChange={(e) => setPolicyForm({ ...policyForm, policyNumber: e.target.value })} /></Field>
            <Field label="Holder name"><Input value={policyForm.holderName} onChange={(e) => setPolicyForm({ ...policyForm, holderName: e.target.value })} /></Field>
            <Field label="Sum insured"><Input type="number" value={policyForm.sumInsured} onChange={(e) => setPolicyForm({ ...policyForm, sumInsured: e.target.value })} /></Field>
            <Field label="Valid to"><Input type="date" value={policyForm.validTo} onChange={(e) => setPolicyForm({ ...policyForm, validTo: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      {/* Claim modal */}
      <Modal open={claimModal} onClose={() => setClaimModal(false)} title="Raise Claim"
        footer={<><Button variant="secondary" onClick={() => setClaimModal(false)}>Cancel</Button><Button onClick={saveClaim} disabled={saving}>{saving ? "Saving…" : "Create"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Policy *">
            <select value={claimForm.policyId} onChange={(e) => setClaimForm({ ...claimForm, policyId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— Select policy —</option>
              {policies.map((p) => <option key={p._id} value={p._id}>{(p.patientId?.fullName || "Patient")} · {p.policyNumber} · {p.payerId?.name}</option>)}
            </select>
          </Field>
          <Field label="Claimed amount"><Input type="number" value={claimForm.claimedAmount} onChange={(e) => setClaimForm({ ...claimForm, claimedAmount: e.target.value })} /></Field>
          <Field label="Notes"><Input value={claimForm.notes} onChange={(e) => setClaimForm({ ...claimForm, notes: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* Claim status modal */}
      <Modal open={!!statusFor} onClose={() => setStatusFor(null)} title={`Claim ${statusFor?.claimNumber || ""}`}
        footer={<><Button variant="secondary" onClick={() => setStatusFor(null)}>Cancel</Button><Button onClick={saveStatus} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Status">
            <select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {["draft", "submitted", "approved", "rejected", "settled"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Approved amount"><Input type="number" value={statusForm.approvedAmount} onChange={(e) => setStatusForm({ ...statusForm, approvedAmount: e.target.value })} /></Field>
          <Field label="Notes"><Input value={statusForm.notes} onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

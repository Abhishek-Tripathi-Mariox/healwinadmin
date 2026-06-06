import { useEffect, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  hospitalPatientApi,
  emrApi,
  billingApi,
  diagnosticsApi,
  opdApi,
} from "../services/admin-api";
import type { EncounterPayload, Prescription } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  Button,
  Card,
  Badge,
  Alert,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
} from "../components/ui";

interface Patient {
  _id: string;
  patientId: string;
  fullName: string;
  gender: string;
  age?: number;
  dateOfBirth?: string;
  bloodGroup?: string;
  phone: string;
  email?: string;
  photo?: string;
  address?: Record<string, string>;
  emergencyContacts?: { name: string; relation?: string; phone: string }[];
  healthHistory?: Record<string, string>;
  documents?: { type: string; label?: string; url: string; uploadedAt: string }[];
}

interface DiagnosticOrder {
  _id: string;
  category: "lab" | "imaging";
  name: string;
  status: "ordered" | "collected" | "reported";
  resultValue?: string;
  resultNotes?: string;
  attachments?: { url: string; label: string; uploadedAt: string }[];
  orderedAt?: string;
  reportedAt?: string;
}

interface Encounter {
  _id: string;
  encounterType: string;
  visitDate: string;
  chiefComplaint?: string;
  vitals?: Record<string, any>;
  soap?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  diagnoses?: string[];
  prescriptions?: Prescription[];
  labOrders?: string[];
  imagingOrders?: string[];
  notes?: string;
  doctorId?: { fullName?: string } | string;
}

const emptyEncounter: EncounterPayload = {
  patientId: "",
  encounterType: "OPD",
  chiefComplaint: "",
  vitals: {},
  soap: { subjective: "", objective: "", assessment: "", plan: "" },
  diagnoses: [],
  prescriptions: [],
  labOrders: [],
  imagingOrders: [],
  notes: "",
};

export default function PatientDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEmrCreate = hasPermission(PERMISSIONS.EMR_CREATE);
  const canUpload = hasPermission(PERMISSIONS.HMS_PATIENTS_UPDATE);
  const canDispense = hasPermission(PERMISSIONS.INVENTORY_ADJUST);
  const canBill = hasPermission(PERMISSIONS.BILLING_CREATE);

  const dispenseRx = async (encounterId: string) => {
    try {
      const res = await emrApi.dispense(encounterId);
      const r = res.data;
      const lines = (r?.results || [])
        .map((x: any) =>
          x.status === "issued"
            ? `✓ ${x.drug} ×${x.quantity}`
            : x.status === "insufficient"
              ? `⚠ ${x.drug} (only ${x.available} in stock)`
              : `✗ ${x.drug} (not in inventory)`,
        )
        .join("\n");
      alert(
        `Dispensed ${r?.issued}/${r?.total} from pharmacy inventory:\n\n${lines || "no prescriptions"}`,
      );
      load();
    } catch (e: any) {
      alert(e.message || "Failed to dispense");
    }
  };

  const billDiagnostics = async (encounterId: string) => {
    const rate = window.prompt("Rate per diagnostic test (₹)?", "500");
    if (rate === null) return;
    const fee = window.prompt("Consultation fee to add (₹, blank to skip)?", "");
    try {
      const res = await billingApi.generate({
        patientId: id,
        encounterId,
        includeDiagnostics: true,
        diagnosticRate: Number(rate) || 0,
        includeConsultation: !!fee && Number(fee) > 0,
        consultationFee: Number(fee) || 0,
      });
      const inv = res.data?.invoice;
      alert(
        `Invoice ${inv?.invoiceNo} generated — total ₹${inv?.total?.toFixed(2)}. Open Billing to collect payment.`,
      );
    } catch (e: any) {
      alert(e.message || "Failed to generate invoice");
    }
  };

  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticOrder[]>([]);
  const [newDx, setNewDx] = useState<{
    category: "lab" | "imaging";
    name: string;
  }>({ category: "lab", name: "" });
  const [resultDraft, setResultDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EncounterPayload>({ ...emptyEncounter });
  const [diagnosesText, setDiagnosesText] = useState("");
  const [labText, setLabText] = useState("");
  const [imagingText, setImagingText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  // Set when arriving from the OPD queue ("Consult") so the created
  // encounter is linked back to that appointment.
  const [consultAppointmentId, setConsultAppointmentId] = useState<
    string | null
  >(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, eRes, dRes] = await Promise.all([
        hospitalPatientApi.detail(id),
        emrApi.listByPatient(id),
        diagnosticsApi.listByPatient(id),
      ]);
      setPatient(pRes.data?.patient || null);
      setEncounters(eRes.data?.encounters || []);
      setDiagnostics(dRes.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ---- Lab & Radiology (diagnostics) handlers ----
  const addDiagnostic = async () => {
    if (!newDx.name.trim()) return;
    try {
      await diagnosticsApi.create({
        patientId: id,
        category: newDx.category,
        name: newDx.name.trim(),
      });
      setNewDx({ category: newDx.category, name: "" });
      load();
    } catch (e: any) {
      alert(e.message || "Failed to add order");
    }
  };

  const saveResult = async (orderId: string) => {
    try {
      await diagnosticsApi.update(orderId, {
        resultValue: resultDraft[orderId] || "",
        status: "reported",
      });
      setResultDraft((d) => ({ ...d, [orderId]: "" }));
      load();
    } catch (e: any) {
      alert(e.message || "Failed to save result");
    }
  };

  const markCollected = async (orderId: string) => {
    try {
      await diagnosticsApi.update(orderId, { status: "collected" });
      load();
    } catch (e: any) {
      alert(e.message || "Failed to update");
    }
  };

  const uploadReport = async (orderId: string, file: File) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      await diagnosticsApi.uploadReport(orderId, fd);
      load();
    } catch (e: any) {
      alert(e.message || "Failed to upload report");
    }
  };

  const deleteDiagnostic = async (orderId: string) => {
    if (!window.confirm("Delete this diagnostic order?")) return;
    try {
      await diagnosticsApi.remove(orderId);
      load();
    } catch (e: any) {
      alert(e.message || "Failed to delete");
    }
  };

  const dxTone = (s: string): "warning" | "info" | "success" =>
    s === "reported" ? "success" : s === "collected" ? "info" : "warning";

  useEffect(() => {
    load();
  }, [load]);

  const openNewEncounter = () => {
    setForm({ ...emptyEncounter, patientId: id });
    setDiagnosesText("");
    setLabText("");
    setImagingText("");
    setError("");
    setShowForm(true);
  };

  // Arriving from the OPD queue ("Consult") → auto-open a SOAP encounter and
  // remember the appointment so we can link + complete it on save.
  useEffect(() => {
    if (searchParams.get("newEncounter")) {
      setConsultAppointmentId(searchParams.get("appointmentId"));
      openNewEncounter();
      searchParams.delete("newEncounter");
      searchParams.delete("appointmentId");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPrescription = () =>
    setForm((f) => ({
      ...f,
      prescriptions: [
        ...(f.prescriptions || []),
        { drug: "", dosage: "", frequency: "", duration: "" },
      ],
    }));

  const updatePrescription = (
    i: number,
    key: keyof Prescription,
    value: string,
  ) =>
    setForm((f) => {
      const next = [...(f.prescriptions || [])];
      next[i] = { ...next[i], [key]: value };
      return { ...f, prescriptions: next };
    });

  const removePrescription = (i: number) =>
    setForm((f) => ({
      ...f,
      prescriptions: (f.prescriptions || []).filter((_, idx) => idx !== i),
    }));

  const csvToArray = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const submitEncounter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await emrApi.create({
        ...form,
        patientId: id,
        diagnoses: csvToArray(diagnosesText),
        labOrders: csvToArray(labText),
        imagingOrders: csvToArray(imagingText),
        prescriptions: (form.prescriptions || []).filter((p) => p.drug.trim()),
      });
      // If this consult came from an OPD appointment, link the encounter and
      // mark the appointment completed.
      const encounterId = res.data?.encounter?._id;
      if (consultAppointmentId && encounterId) {
        try {
          await opdApi.update(consultAppointmentId, {
            encounterId,
            status: "completed",
          });
        } catch {
          /* non-fatal — encounter is saved regardless */
        }
        setConsultAppointmentId(null);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message || "Failed to save encounter");
    } finally {
      setSaving(false);
    }
  };

  const onUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    asPhoto: boolean,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("asPhoto", String(asPhoto));
      if (!asPhoto) fd.append("type", "document");
      await hospitalPatientApi.uploadDocument(id, fd);
      load();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;
  if (!patient) return <div className="p-6 text-gray-400">Patient not found.</div>;

  return (
    <div className="p-6">
      <button
        onClick={() => navigate("/admin/patients")}
        className="mb-4 text-sm text-gray-500 hover:underline"
      >
        ← Back to patients
      </button>

      {/* Demographics header */}
      <Card padded className="flex gap-4 mb-5">
        <div className="flex items-center justify-center w-20 h-20 overflow-hidden text-2xl text-gray-400 bg-gray-100 rounded-full">
          {patient.photo ? (
            <img
              src={patient.photo}
              alt={patient.fullName}
              className="object-cover w-full h-full"
            />
          ) : (
            patient.fullName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{patient.fullName}</h1>
            <span className="font-mono text-xs text-gray-500">
              {patient.patientId}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            <span className="capitalize">{patient.gender}</span>
            {patient.age != null && ` · ${patient.age} yrs`}
            {patient.bloodGroup &&
              patient.bloodGroup !== "unknown" &&
              ` · ${patient.bloodGroup}`}
            {` · ${patient.phone}`}
            {patient.email && ` · ${patient.email}`}
          </div>
          {patient.address?.line1 && (
            <div className="mt-1 text-xs text-gray-500">
              {[
                patient.address.line1,
                patient.address.city,
                patient.address.state,
                patient.address.pincode,
              ]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}
        </div>
        {canUpload && (
          <div className="flex flex-col gap-2 text-xs">
            <label className="px-3 py-1.5 text-center border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
              {uploading ? "Uploading…" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload(e, true)}
              />
            </label>
            <label className="px-3 py-1.5 text-center border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
              Add document
              <input
                type="file"
                className="hidden"
                onChange={(e) => onUpload(e, false)}
              />
            </label>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: health history + documents */}
        <div className="space-y-5">
          <Card padded>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Health History
            </h2>
            {patient.healthHistory &&
            Object.values(patient.healthHistory).some(Boolean) ? (
              <dl className="space-y-2 text-sm">
                {(
                  [
                    ["pastMedical", "Past medical"],
                    ["surgical", "Surgical"],
                    ["medications", "Medications"],
                    ["allergies", "Allergies"],
                    ["familyHistory", "Family history"],
                  ] as const
                ).map(([k, label]) =>
                  patient.healthHistory?.[k] ? (
                    <div key={k}>
                      <dt className="text-xs text-gray-400">{label}</dt>
                      <dd className="text-gray-700">
                        {patient.healthHistory[k]}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
            ) : (
              <p className="text-sm text-gray-400">No history recorded.</p>
            )}
          </Card>

          <Card padded>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Documents
            </h2>
            {patient.documents && patient.documents.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {patient.documents.map((d, i) => (
                  <li key={i}>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-healwin-700 hover:underline"
                    >
                      {d.label || d.type}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No documents uploaded.</p>
            )}
          </Card>

          {patient.emergencyContacts &&
            patient.emergencyContacts.length > 0 && (
              <Card padded>
                <h2 className="mb-3 text-sm font-semibold text-gray-700">
                  Emergency Contacts
                </h2>
                <ul className="space-y-1 text-sm text-gray-700">
                  {patient.emergencyContacts.map((c, i) => (
                    <li key={i}>
                      {c.name}
                      {c.relation && ` (${c.relation})`} — {c.phone}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
        </div>

        {/* Right: EMR timeline */}
        <div className="lg:col-span-2">
          {/* Lab & Radiology diagnostics */}
          <Card padded className="mb-5">
            <h2 className="mb-3 text-lg font-semibold">
              Lab &amp; Radiology ({diagnostics.length})
            </h2>
            {canEmrCreate && (
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <Select
                  value={newDx.category}
                  onChange={(e) =>
                    setNewDx({
                      ...newDx,
                      category: e.target.value as "lab" | "imaging",
                    })
                  }
                  className="w-32"
                >
                  <option value="lab">Lab</option>
                  <option value="imaging">Radiology</option>
                </Select>
                <Input
                  value={newDx.name}
                  onChange={(e) => setNewDx({ ...newDx, name: e.target.value })}
                  placeholder="Test / study (e.g. CBC, Chest X-Ray)"
                  className="h-10 min-w-[12rem] flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDiagnostic();
                    }
                  }}
                />
                <Button onClick={addDiagnostic}>+ Order</Button>
              </div>
            )}
            {diagnostics.length === 0 ? (
              <p className="text-sm text-gray-400">No diagnostic orders yet.</p>
            ) : (
              <div className="space-y-2">
                {diagnostics.map((d) => (
                  <div
                    key={d._id}
                    className="rounded-lg border border-gray-200 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={d.category === "lab" ? "info" : "accent"}>
                        {d.category === "lab" ? "Lab" : "Radiology"}
                      </Badge>
                      <span className="font-medium text-gray-900">{d.name}</span>
                      <Badge tone={dxTone(d.status)} dot>
                        {d.status}
                      </Badge>
                      <span className="ml-auto flex items-center gap-1">
                        {d.status === "ordered" && canEmrCreate && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markCollected(d._id)}
                          >
                            Mark collected
                          </Button>
                        )}
                        {canEmrCreate && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Delete"
                            aria-label="Delete"
                            onClick={() => deleteDiagnostic(d._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </span>
                    </div>

                    {d.resultValue && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                        <span className="text-gray-400">Result: </span>
                        {d.resultValue}
                      </p>
                    )}

                    {d.attachments && d.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {d.attachments.map((a, i) => (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded border border-gray-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                          >
                            📄 {a.label}
                          </a>
                        ))}
                      </div>
                    )}

                    {canEmrCreate && d.status !== "reported" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Input
                          value={resultDraft[d._id] || ""}
                          onChange={(e) =>
                            setResultDraft((s) => ({
                              ...s,
                              [d._id]: e.target.value,
                            }))
                          }
                          placeholder="Enter result / findings"
                          className="h-9 min-w-[12rem] flex-1"
                        />
                        <Button size="sm" onClick={() => saveResult(d._id)}>
                          Save result
                        </Button>
                        <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                          Upload report
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadReport(d._id, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              EMR — Encounters ({encounters.length})
            </h2>
            {canEmrCreate && (
              <Button onClick={openNewEncounter}>+ New Encounter</Button>
            )}
          </div>

          {encounters.length === 0 ? (
            <Card className="p-8 text-center text-gray-400">
              No clinical encounters yet.
            </Card>
          ) : (
            <div className="space-y-4">
              {encounters.map((enc) => (
                <Card key={enc._id} padded>
                  <div className="flex items-center justify-between mb-3">
                    <Badge tone="accent">{enc.encounterType}</Badge>
                    <span className="text-xs text-gray-400">
                      {new Date(enc.visitDate).toLocaleString()}
                      {typeof enc.doctorId === "object" &&
                        enc.doctorId?.fullName &&
                        ` · Dr. ${enc.doctorId.fullName}`}
                    </span>
                  </div>
                  {enc.chiefComplaint && (
                    <p className="mb-2 text-sm">
                      <span className="text-gray-400">Chief complaint: </span>
                      {enc.chiefComplaint}
                    </p>
                  )}
                  {enc.vitals && Object.values(enc.vitals).some(Boolean) && (
                    <p className="mb-2 text-xs text-gray-500">
                      {enc.vitals.bloodPressure &&
                        `BP ${enc.vitals.bloodPressure}  `}
                      {enc.vitals.pulse && `Pulse ${enc.vitals.pulse}  `}
                      {enc.vitals.temperature &&
                        `Temp ${enc.vitals.temperature}°F  `}
                      {enc.vitals.spo2 && `SpO₂ ${enc.vitals.spo2}%  `}
                      {enc.vitals.weight && `Wt ${enc.vitals.weight}kg`}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {(
                      [
                        ["subjective", "S — Subjective"],
                        ["objective", "O — Objective"],
                        ["assessment", "A — Assessment"],
                        ["plan", "P — Plan"],
                      ] as const
                    ).map(([k, label]) =>
                      enc.soap?.[k] ? (
                        <div key={k} className="p-2 rounded bg-gray-50">
                          <div className="text-xs font-semibold text-gray-400">
                            {label}
                          </div>
                          <div className="text-gray-700 whitespace-pre-wrap">
                            {enc.soap[k]}
                          </div>
                        </div>
                      ) : null,
                    )}
                  </div>
                  {enc.diagnoses && enc.diagnoses.length > 0 && (
                    <p className="mt-2 text-sm">
                      <span className="text-gray-400">Diagnoses: </span>
                      {enc.diagnoses.join(", ")}
                    </p>
                  )}
                  {enc.prescriptions && enc.prescriptions.length > 0 && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-400">Rx: </span>
                      {enc.prescriptions
                        .map(
                          (p) =>
                            `${p.drug}${p.dosage ? ` ${p.dosage}` : ""}${
                              p.frequency ? ` ${p.frequency}` : ""
                            }${p.duration ? ` × ${p.duration}` : ""}`,
                        )
                        .join("; ")}
                    </div>
                  )}
                  {((enc.labOrders && enc.labOrders.length > 0) ||
                    (enc.imagingOrders && enc.imagingOrders.length > 0)) && (
                    <p className="mt-2 text-xs text-gray-500">
                      {enc.labOrders?.length
                        ? `Labs: ${enc.labOrders.join(", ")}  `
                        : ""}
                      {enc.imagingOrders?.length
                        ? `Imaging: ${enc.imagingOrders.join(", ")}`
                        : ""}
                    </p>
                  )}
                  {(canDispense || canBill) && (
                    <div className="flex gap-3 pt-3 mt-3 border-t">
                      {canDispense && enc.prescriptions?.length ? (
                        <button
                          onClick={() => dispenseRx(enc._id)}
                          className="text-xs text-healwin-700 hover:underline"
                        >
                          Dispense Rx → pharmacy
                        </button>
                      ) : null}
                      {canBill &&
                      ((enc.labOrders && enc.labOrders.length > 0) ||
                        (enc.imagingOrders &&
                          enc.imagingOrders.length > 0)) ? (
                        <button
                          onClick={() => billDiagnostics(enc._id)}
                          className="text-xs text-healwin-700 hover:underline"
                        >
                          Generate diagnostics bill
                        </button>
                      ) : null}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New encounter modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Encounter (SOAP)"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={submitEncounter} disabled={saving}>
              {saving ? "Saving…" : "Save Encounter"}
            </Button>
          </>
        }
      >
        <form onSubmit={submitEncounter} className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Encounter type">
              <Select
                value={form.encounterType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    encounterType: e.target.value as any,
                  })
                }
              >
                <option value="OPD">OPD</option>
                <option value="IPD">IPD</option>
                <option value="consultation">Consultation</option>
                <option value="emergency">Emergency</option>
              </Select>
            </Field>
            <Field label="Chief complaint">
              <Input
                value={form.chiefComplaint}
                onChange={(e) =>
                  setForm({ ...form, chiefComplaint: e.target.value })
                }
              />
            </Field>
          </div>

          {/* Vitals */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Vitals</h3>
            <div className="grid grid-cols-4 gap-2">
              <Input
                placeholder="BP"
                value={form.vitals?.bloodPressure || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vitals: {
                      ...form.vitals,
                      bloodPressure: e.target.value,
                    },
                  })
                }
              />
              {(
                [
                  ["pulse", "Pulse"],
                  ["temperature", "Temp °F"],
                  ["spo2", "SpO₂ %"],
                  ["respiratoryRate", "Resp"],
                  ["height", "Ht cm"],
                  ["weight", "Wt kg"],
                ] as const
              ).map(([k, label]) => (
                <Input
                  key={k}
                  type="number"
                  placeholder={label}
                  value={(form.vitals as any)?.[k] ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      vitals: {
                        ...form.vitals,
                        [k]: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                />
              ))}
            </div>
          </section>

          {/* SOAP */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              SOAP Documentation
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {(
                [
                  ["subjective", "Subjective — patient's report"],
                  ["objective", "Objective — measurable findings"],
                  ["assessment", "Assessment — clinical interpretation"],
                  ["plan", "Plan — next steps / follow-up"],
                ] as const
              ).map(([k, label]) => (
                <Field key={k} label={label}>
                  <Textarea
                    rows={2}
                    value={(form.soap as any)?.[k] || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        soap: { ...form.soap, [k]: e.target.value },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          </section>

          {/* Orders */}
          <section className="grid grid-cols-1 gap-3">
            <Field label="Diagnoses (comma separated)">
              <Input
                value={diagnosesText}
                onChange={(e) => setDiagnosesText(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lab tests (comma separated)">
                <Input
                  value={labText}
                  onChange={(e) => setLabText(e.target.value)}
                />
              </Field>
              <Field label="Imaging (comma separated)">
                <Input
                  value={imagingText}
                  onChange={(e) => setImagingText(e.target.value)}
                />
              </Field>
            </div>
          </section>

          {/* Prescriptions */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Prescriptions
              </h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={addPrescription}
              >
                + Add drug
              </Button>
            </div>
            {(form.prescriptions || []).map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <Input
                  className="col-span-3"
                  placeholder="Drug"
                  value={p.drug}
                  onChange={(e) =>
                    updatePrescription(i, "drug", e.target.value)
                  }
                />
                <Input
                  className="col-span-3"
                  placeholder="Dosage"
                  value={p.dosage}
                  onChange={(e) =>
                    updatePrescription(i, "dosage", e.target.value)
                  }
                />
                <Input
                  className="col-span-3"
                  placeholder="Freq (1-0-1)"
                  value={p.frequency}
                  onChange={(e) =>
                    updatePrescription(i, "frequency", e.target.value)
                  }
                />
                <Input
                  className="col-span-2"
                  placeholder="Duration"
                  value={p.duration}
                  onChange={(e) =>
                    updatePrescription(i, "duration", e.target.value)
                  }
                />
                <button
                  type="button"
                  onClick={() => removePrescription(i)}
                  className="col-span-1 text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </section>
        </form>
      </Modal>
    </div>
  );
}

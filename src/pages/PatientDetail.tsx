import { useEffect, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  hospitalPatientApi,
  emrApi,
  billingApi,
  diagnosticsApi,
  opdApi,
  catalogApi,
} from "../services/admin-api";
import type { EncounterPayload, Prescription, ProcedureLine } from "../services/admin-api";
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
import { VoiceInput } from "../components/VoiceInput";

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
  procedures?: ProcedureLine[];
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
  procedures: [],
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

  // Generates a real invoice from this encounter — diagnostics (rate is
  // still manual, there's no per-test catalog price yet), procedures (real
  // prices snapshotted on the encounter when documented) and the
  // consultation fee (auto-resolved from the doctor's real configured rate
  // — see billing.controller.ts#generate — no need to type it here).
  const billEncounter = async (encounterId: string, hasDiagnostics: boolean) => {
    let rate = 0;
    if (hasDiagnostics) {
      const input = window.prompt("Rate per diagnostic test (₹)?", "500");
      if (input === null) return;
      rate = Number(input) || 0;
    }
    try {
      const res = await billingApi.generate({
        patientId: id,
        encounterId,
        includeDiagnostics: hasDiagnostics,
        diagnosticRate: rate,
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
  // Lab / imaging orders are now picked from the catalogue one by one rather
  // than typed as a comma list, so they carry real, consistent test names.
  const [labOrders, setLabOrders] = useState<string[]>([]);
  const [imagingOrders, setImagingOrders] = useState<string[]>([]);
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<any[]>([]);
  const [drugQuery, setDrugQuery] = useState("");
  const [drugResults, setDrugResults] = useState<any[]>([]);
  // Vitals recorded by the nurse at check-in — read-only for the doctor.
  const [apptVitals, setApptVitals] = useState<any>(null);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<
    { type: string; label?: string; url: string } | undefined
  >(undefined);
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
    setLabOrders([]);
    setImagingOrders([]);
    setTestQuery("");
    setTestResults([]);
    setDrugQuery("");
    setDrugResults([]);
    setShowMore(false);
    setError("");
    setShowForm(true);
  };

  // Arriving from the OPD queue ("Consult") → auto-open a SOAP encounter and
  // remember the appointment so we can link + complete it on save.
  useEffect(() => {
    if (searchParams.get("newEncounter")) {
      setConsultAppointmentId(searchParams.get("appointmentId"));
      openNewEncounter();
      // An IPD ward round arrives with ?encounterType=IPD — without this the
      // form silently defaulted to OPD and the note landed under the wrong
      // type, which also excludes it from the admission's procedure billing.
      const t = searchParams.get("encounterType");
      if (t) setForm((f) => ({ ...f, encounterType: t as any }));
      searchParams.delete("newEncounter");
      searchParams.delete("appointmentId");
      searchParams.delete("encounterType");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pull the nurse's check-in vitals for the appointment this consult came from.
  useEffect(() => {
    if (!consultAppointmentId) return setApptVitals(null);
    opdApi
      .detail(consultAppointmentId)
      .then((r) => setApptVitals(r.data?.appointment?.vitals || null))
      .catch(() => setApptVitals(null));
  }, [consultAppointmentId]);

  // Debounced catalogue pickers — the doctor types, we search, they click to add.
  useEffect(() => {
    if (!showForm) return;
    const t = setTimeout(() => {
      emrApi
        .labTestOptions(testQuery.trim())
        .then((r) => setTestResults(r.data?.items || []))
        .catch(() => setTestResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [testQuery, showForm]);

  useEffect(() => {
    if (!showForm) return;
    const t = setTimeout(() => {
      emrApi
        .drugOptions(drugQuery.trim())
        .then((r) => setDrugResults(r.data?.items || []))
        .catch(() => setDrugResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [drugQuery, showForm]);

  const addLabOrder = (name: string, category: "lab" | "imaging" = "lab") => {
    const setter = category === "lab" ? setLabOrders : setImagingOrders;
    setter((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setTestQuery("");
  };

  /**
   * Add a drug from the picker. `itemId` is only present when the drug maps to
   * real HMS stock — catalogue-only drugs are prescribed by name and the
   * pharmacy queue shows them as "not stocked" rather than decrementing.
   */
  const addDrugFromStock = (it: any) =>
    setForm((f) => ({
      ...f,
      prescriptions: [
        ...(f.prescriptions || []),
        {
          drug: it.name,
          itemId: it.itemId,
          dosage: "",
          frequency: "",
          duration: "",
          quantity: 1,
        } as any,
      ],
    }));

  /**
   * Standard Indian Rx frequencies. `perDay` drives the auto-quantity so the
   * pharmacy gets a real number of units to hand over rather than the doctor
   * doing the arithmetic: doses/day x days.
   */
  const FREQUENCIES = [
    { code: "1-0-0", label: "1-0-0 · OD (once)", perDay: 1 },
    { code: "0-0-1", label: "0-0-1 · HS (night)", perDay: 1 },
    { code: "1-0-1", label: "1-0-1 · BD (twice)", perDay: 2 },
    { code: "1-1-1", label: "1-1-1 · TDS (thrice)", perDay: 3 },
    { code: "1-1-1-1", label: "1-1-1-1 · QID", perDay: 4 },
    { code: "SOS", label: "SOS · if needed", perDay: 1 },
    { code: "STAT", label: "STAT · single dose", perDay: 1 },
  ];

  const perDayOf = (freq?: string) =>
    FREQUENCIES.find((f) => f.code === freq)?.perDay ?? 0;

  /** doses/day x days — 0 when either side is unknown, so we never guess. */
  const deriveQty = (freq?: string, days?: string | number) => {
    const d = Number(days);
    const pd = perDayOf(freq);
    if (!pd || !Number.isFinite(d) || d <= 0) return 0;
    return pd * d;
  };

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

  // Procedure catalog — for the name <datalist> autocomplete + auto-filling
  // price on an exact match, while still allowing a free-text procedure
  // with a manual price for anything not in the rate list.
  const [procedureCatalog, setProcedureCatalog] = useState<{ name: string; price: number }[]>([]);
  useEffect(() => {
    catalogApi.procedures.list({ limit: 200 }).then((res: any) =>
      setProcedureCatalog((res.data?.items || []).map((p: any) => ({ name: p.name, price: p.price }))),
    ).catch(() => setProcedureCatalog([]));
  }, []);

  const addProcedure = () =>
    setForm((f) => ({
      ...f,
      procedures: [...(f.procedures || []), { name: "", price: undefined, notes: "" }],
    }));

  const updateProcedure = (i: number, key: keyof ProcedureLine, value: string) =>
    setForm((f) => {
      const next = [...(f.procedures || [])];
      const line = { ...next[i], [key]: key === "price" ? (value ? Number(value) : undefined) : value };
      // Auto-fill price from the catalog on an exact name match, but only
      // when the price field itself hasn't been hand-edited already.
      if (key === "name") {
        const match = procedureCatalog.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());
        if (match && !next[i].price) line.price = match.price;
      }
      next[i] = line;
      return { ...f, procedures: next };
    });

  const removeProcedure = (i: number) =>
    setForm((f) => ({
      ...f,
      procedures: (f.procedures || []).filter((_, idx) => idx !== i),
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
        labOrders,
        imagingOrders,
        prescriptions: (form.prescriptions || []).filter((p) => p.drug.trim()),
        procedures: (form.procedures || []).filter((p) => p.name.trim()),
        // Drop an empty referral row.
        referrals: (form.referrals || []).filter((r) => r.department || r.reason),
        followUpAt: form.followUpAt || undefined,
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
      // Advisory only at prescribe-time (the doctor's clinical call) — the
      // encounter is already saved; dispense() below is where a conflict
      // actually blocks and requires an explicit override.
      const warnings = res.data?.allergyWarnings as { drug: string; allergyTerm: string }[] | undefined;
      if (warnings?.length) {
        alert(
          `⚠ Allergy warning — patient has a recorded allergy that may conflict:\n\n` +
            warnings.map((w) => `${w.drug} — conflicts with recorded allergy "${w.allergyTerm}"`).join("\n"),
        );
      }
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
              <div className="grid grid-cols-3 gap-2">
                {patient.documents.map((d, i) => {
                  const isPhoto = d.type === "photo";
                  const isVideo = d.type === "video";
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        isPhoto || isVideo
                          ? setMediaPreview(d)
                          : window.open(d.url, "_blank", "noreferrer")
                      }
                      className="relative flex flex-col items-center justify-center overflow-hidden text-xs bg-gray-100 border border-gray-200 rounded aspect-square hover:opacity-90"
                      title={d.label || d.type}
                    >
                      {isPhoto ? (
                        <img
                          src={d.url}
                          alt={d.label || "photo"}
                          className="object-cover w-full h-full"
                        />
                      ) : isVideo ? (
                        <>
                          <video src={d.url} className="object-cover w-full h-full" muted />
                          <span className="absolute flex items-center justify-center w-6 h-6 text-white rounded-full bg-black/50">
                            ▶
                          </span>
                        </>
                      ) : (
                        <span className="px-1 text-center text-gray-500 truncate">
                          {d.label || d.type}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
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
                  {enc.procedures && enc.procedures.length > 0 && (
                    <p className="mt-2 text-sm">
                      <span className="text-gray-400">Procedures: </span>
                      {enc.procedures
                        .map((p) => `${p.name}${p.price ? ` (₹${p.price})` : ""}`)
                        .join(", ")}
                    </p>
                  )}
                  {(canDispense || canBill) && (
                    <div className="flex gap-3 pt-3 mt-3 border-t">
                      {/* Dispensing moved to the Pharmacy Dispense queue —
                          prescriptions are raised there automatically when the
                          encounter is finalised. Two entry points meant the
                          same Rx could be dispensed twice. */}
                      {canDispense && enc.prescriptions?.length ? (
                        <button
                          onClick={() => navigate("/admin/pharmacy-dispense")}
                          className="text-xs text-healwin-700 hover:underline"
                          title="Prescriptions are dispensed from the pharmacy counter's queue"
                        >
                          View in Pharmacy queue →
                        </button>
                      ) : null}
                      {canBill &&
                      ((enc.labOrders && enc.labOrders.length > 0) ||
                        (enc.imagingOrders && enc.imagingOrders.length > 0) ||
                        (enc.procedures && enc.procedures.length > 0)) ? (
                        <button
                          onClick={() =>
                            billEncounter(
                              enc._id,
                              !!((enc.labOrders && enc.labOrders.length) || (enc.imagingOrders && enc.imagingOrders.length)),
                            )
                          }
                          className="text-xs text-healwin-700 hover:underline"
                        >
                          Generate bill
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

          {/* Vitals — recorded by the nurse at check-in, read-only here.
              The doctor reads them; triage owns entering them. */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              Vitals{" "}
              <span className="font-normal text-gray-400">
                (recorded at check-in)
              </span>
            </h3>
            {apptVitals ? (
              <div className="grid grid-cols-4 gap-2 rounded-lg bg-gray-50 p-3 text-sm">
                {(
                  [
                    ["bloodPressure", "BP", ""],
                    ["pulse", "Pulse", " bpm"],
                    ["temperature", "Temp", " °F"],
                    ["spo2", "SpO\u2082", " %"],
                    ["respiratoryRate", "Resp", ""],
                    ["height", "Ht", " cm"],
                    ["weight", "Wt", " kg"],
                  ] as const
                ).map(([k, label, unit]) => (
                  <div key={k}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="font-medium text-gray-900">
                      {apptVitals[k] != null && apptVitals[k] !== ""
                        ? `${apptVitals[k]}${unit}`
                        : "\u2014"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                No vitals recorded for this visit. The nurse can add them from
                the OPD queue (Record vitals).
              </p>
            )}
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

          {/* Consultation summary — the doctor's plain-language takeaway,
              mirroring Consultation.summary from the patient-app consult. */}
          <Field
            label="Consultation summary — what was advised"
            hint="Shown to the patient. Keep it plain and short."
          >
            <Textarea
              rows={3}
              value={form.summary || ""}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="e.g. Viral fever. Rest and fluids. Paracetamol as needed. Review in 3 days if fever persists."
            />
          </Field>

          {/* Orders — picked from the catalogue one at a time. Each saved
              lab/imaging order becomes a DiagnosticOrder linked to this
              encounter, so the lab's result lands back on this record. */}
          <section className="space-y-3">
            <Field label="Diagnosis">
              <Input
                value={diagnosesText}
                onChange={(e) => setDiagnosesText(e.target.value)}
                placeholder="e.g. Viral fever"
              />
            </Field>

            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-700">
                Lab & imaging orders
              </h3>
              {(labOrders.length > 0 || imagingOrders.length > 0) && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {labOrders.map((n) => (
                    <span
                      key={`l-${n}`}
                      className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                    >
                      {n}
                      <button
                        type="button"
                        onClick={() =>
                          setLabOrders((p) => p.filter((x) => x !== n))
                        }
                        className="text-blue-400 hover:text-blue-700"
                        aria-label={`Remove ${n}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {imagingOrders.map((n) => (
                    <span
                      key={`i-${n}`}
                      className="flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700"
                    >
                      {n}
                      <button
                        type="button"
                        onClick={() =>
                          setImagingOrders((p) => p.filter((x) => x !== n))
                        }
                        className="text-purple-400 hover:text-purple-700"
                        aria-label={`Remove ${n}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Search a test to add (e.g. CBC, Chest X-Ray)…"
              />
              {testQuery.trim() && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200">
                  {testResults.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => addLabOrder(testQuery.trim())}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Not in catalogue — add “{testQuery.trim()}” anyway
                    </button>
                  ) : (
                    testResults.map((t) => (
                      <div
                        key={t._id}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        <span>
                          {t.name}
                          {t.category ? (
                            <span className="text-gray-400"> · {t.category}</span>
                          ) : null}
                          {t.price ? (
                            <span className="text-gray-400"> · ₹{t.price}</span>
                          ) : null}
                        </span>
                        <span className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addLabOrder(t.name, "lab")}
                          >
                            + Lab
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addLabOrder(t.name, "imaging")}
                          >
                            + Imaging
                          </Button>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Everything below is optional detail. Collapsed by default — a
              routine OPD consult does not fill 15 structured sub-fields, and
              burying them keeps the common path short without losing data. */}
          <details
            open={showMore}
            onToggle={(e) => setShowMore((e.target as HTMLDetailsElement).open)}
            className="rounded-lg border border-gray-200"
          >
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700">
              More clinical detail (optional)
            </summary>
            <div className="space-y-3 border-t border-gray-100 p-3">
            {/* Structured S / O detail */}
            <section className="grid grid-cols-2 gap-3">
              <Field label="Symptoms (S)">
                <Input value={form.subjectiveDetail?.symptoms || ""} onChange={(e) => setForm({ ...form, subjectiveDetail: { ...form.subjectiveDetail, symptoms: e.target.value } })} />
              </Field>
              <Field label="Duration (S)">
                <Input value={form.subjectiveDetail?.duration || ""} onChange={(e) => setForm({ ...form, subjectiveDetail: { ...form.subjectiveDetail, duration: e.target.value } })} />
              </Field>
              <Field label="Pain level (0-10)">
                <Input type="number" value={form.subjectiveDetail?.painLevel ?? ""} onChange={(e) => setForm({ ...form, subjectiveDetail: { ...form.subjectiveDetail, painLevel: e.target.value ? Number(e.target.value) : undefined } })} />
              </Field>
              <Field label="Lifestyle (S)">
                <Input value={form.subjectiveDetail?.lifestyle || ""} onChange={(e) => setForm({ ...form, subjectiveDetail: { ...form.subjectiveDetail, lifestyle: e.target.value } })} />
              </Field>
              <Field label="Examination findings (O)">
                <Input value={form.objectiveDetail?.examFindings || ""} onChange={(e) => setForm({ ...form, objectiveDetail: { ...form.objectiveDetail, examFindings: e.target.value } })} />
              </Field>
              <Field label="Device data — ambulance vitals (O)">
                <Input value={form.objectiveDetail?.deviceData || ""} onChange={(e) => setForm({ ...form, objectiveDetail: { ...form.objectiveDetail, deviceData: e.target.value } })} />
              </Field>
            </section>

            {/* Assessment extras + Plan extras */}
            <section className="grid grid-cols-2 gap-3">
              <Field label="Severity (A)">
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.severity || ""} onChange={(e) => setForm({ ...form, severity: (e.target.value || undefined) as any })}>
                  <option value="">—</option>
                  {["mild", "moderate", "severe", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Differential diagnoses (comma)">
                <Input value={(form.differentialDiagnoses || []).join(", ")} onChange={(e) => setForm({ ...form, differentialDiagnoses: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
              </Field>
              <Field label="Treatment plan (P)">
                <Input value={form.treatmentPlan || ""} onChange={(e) => setForm({ ...form, treatmentPlan: e.target.value })} />
              </Field>
              <Field label="Follow-up date (P)">
                <Input type="date" value={form.followUpAt || ""} onChange={(e) => setForm({ ...form, followUpAt: e.target.value })} />
              </Field>
              <Field label="Referral — department">
                <Input value={form.referrals?.[0]?.department || ""} onChange={(e) => setForm({ ...form, referrals: [{ ...(form.referrals?.[0] || {}), department: e.target.value }] })} />
              </Field>
              <Field label="Referral — reason">
                <Input value={form.referrals?.[0]?.reason || ""} onChange={(e) => setForm({ ...form, referrals: [{ ...(form.referrals?.[0] || {}), reason: e.target.value }] })} />
              </Field>
              <Field label="Admission recommended (P)">
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.admissionRecommended ? "1" : "0"} onChange={(e) => setForm({ ...form, admissionRecommended: e.target.value === "1" })}>
                  <option value="0">No</option><option value="1">Yes</option>
                </select>
              </Field>
            </section>
            </div>
          </details>


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
                + Blank row
              </Button>
            </div>

            {/* Search HMS stock and add one drug at a time. A drug added this
                way carries its itemId, so the pharmacy dispense draws real FEFO
                stock; the blank row above is the escape hatch for anything not
                stocked. */}
            <div className="mb-3">
              <Input
                value={drugQuery}
                onChange={(e) => setDrugQuery(e.target.value)}
                placeholder="Search medicine in hospital stock…"
              />
              {drugQuery.trim() && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200">
                  {drugResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">
                      No medicine matches “{drugQuery.trim()}”. If the pharmacy
                      has no stock loaded yet, add medicines under{" "}
                      <span className="font-medium">Inventory</span> (category
                      “medicine”). You can still use “+ Blank row” to prescribe
                      it.
                    </p>
                  ) : (
                    drugResults.map((it) => {
                      // Only a drug backed by HMS stock can actually run out;
                      // a catalogue-only drug is just a name we can prescribe.
                      const dispensable = !!it.itemId;
                      const out = dispensable && (it.currentStock ?? 0) <= 0;
                      return (
                        <div
                          key={it.key || it.itemId || it.name}
                          className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          <span>
                            {it.name}
                            {it.sub ? (
                              <span className="text-gray-400"> · {it.sub}</span>
                            ) : null}
                            <span className="text-gray-400">
                              {" "}
                              · {it.currentStock ?? 0} {it.unit || ""}
                            </span>
                            {!dispensable && (
                              <span
                                className="ml-1 text-xs text-amber-600"
                                title="Catalogue item with no HMS stock link — it can be prescribed, but the pharmacy will not decrement stock. Link it to an inventory item under Pharmacy & Lab Catalog to make it dispensable."
                              >
                                catalogue only
                              </span>
                            )}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={out}
                            onClick={() => {
                              addDrugFromStock(it);
                              setDrugQuery("");
                            }}
                          >
                            {out ? "Out of stock" : "+ Add"}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {(form.prescriptions || []).length > 0 && (
              <div className="mb-1 flex gap-2 px-1 text-xs font-medium text-gray-500">
                <span className="min-w-0 flex-1">Medicine</span>
                <span className="w-24 shrink-0">Dose</span>
                <span className="w-44 shrink-0">Frequency</span>
                <span className="w-16 shrink-0">Days</span>
                <span className="w-16 shrink-0">Qty</span>
                <span className="w-6 shrink-0" />
              </div>
            )}
            {(form.prescriptions || []).map((p, i) => {
              // Days are stored inside the free-text `duration` ("5 days") so
              // existing records keep working; we parse the leading number out.
              const days = String(p.duration || "").replace(/[^0-9]/g, "");
              const autoQty = deriveQty(p.frequency, days);
              return (
                <div key={i} className="mb-2 space-y-1">
                  <div className="flex gap-2">
                    <VoiceInput
                      className="min-w-0 flex-1"
                      placeholder="Medicine"
                      value={p.drug}
                      onChange={(e) => updatePrescription(i, "drug", e.target.value)}
                      onTranscript={(text) => updatePrescription(i, "drug", text)}
                    />
                    <VoiceInput
                      className="w-24 shrink-0"
                      placeholder="500mg"
                      value={p.dosage}
                      onChange={(e) => updatePrescription(i, "dosage", e.target.value)}
                      onTranscript={(text) => updatePrescription(i, "dosage", text)}
                    />
                    <Select
                      className="w-44 shrink-0"
                      value={p.frequency || ""}
                      onChange={(e) => {
                        updatePrescription(i, "frequency", e.target.value);
                        const q = deriveQty(e.target.value, days);
                        if (q) updatePrescription(i, "quantity", q as any);
                      }}
                    >
                      <option value="">How often…</option>
                      {FREQUENCIES.map((f) => (
                        <option key={f.code} value={f.code}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      className="w-16 shrink-0"
                      type="number"
                      min="1"
                      placeholder="5"
                      value={days}
                      onChange={(e) => {
                        const v = e.target.value;
                        updatePrescription(i, "duration", v ? `${v} days` : "");
                        const q = deriveQty(p.frequency, v);
                        if (q) updatePrescription(i, "quantity", q as any);
                      }}
                    />
                    <Input
                      className="w-16 shrink-0"
                      type="number"
                      min="0"
                      placeholder={autoQty ? String(autoQty) : "Qty"}
                      value={p.quantity ?? ""}
                      onChange={(e) =>
                        updatePrescription(
                          i,
                          "quantity",
                          (e.target.value ? Number(e.target.value) : undefined) as any,
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removePrescription(i)}
                      className="w-6 shrink-0 text-red-500"
                      aria-label="Remove medicine"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      className="w-44 shrink-0"
                      value={p.timing || ""}
                      onChange={(e) => updatePrescription(i, "timing", e.target.value)}
                    >
                      <option value="">Food timing…</option>
                      <option value="After food">After food</option>
                      <option value="Before food">Before food</option>
                      <option value="With food">With food</option>
                      <option value="Empty stomach">Empty stomach</option>
                    </Select>
                    <Input
                      className="min-w-0 flex-1"
                      placeholder="Instructions (optional) — e.g. stop if rash appears"
                      value={p.notes || ""}
                      onChange={(e) => updatePrescription(i, "notes", e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          {/* Procedures — feeds real billing lines, see billing.controller.ts */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Procedures performed{" "}
                <span className="font-normal text-gray-400">
                  — billed to the patient
                </span>
              </h3>
              <Button type="button" size="sm" variant="ghost" onClick={addProcedure}>
                + Add procedure
              </Button>
            </div>
            <datalist id="procedure-catalog">
              {procedureCatalog.map((p) => (
                <option key={p.name} value={p.name} />
              ))}
            </datalist>
            {(form.procedures || []).map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <Input
                  className="col-span-6"
                  list="procedure-catalog"
                  placeholder="Procedure name (pick from list or type new)"
                  value={p.name}
                  onChange={(e) => updateProcedure(i, "name", e.target.value)}
                />
                <Input
                  className="col-span-2"
                  type="number"
                  placeholder="Price ₹"
                  value={p.price ?? ""}
                  onChange={(e) => updateProcedure(i, "price", e.target.value)}
                />
                <Input
                  className="col-span-3"
                  placeholder="Notes"
                  value={p.notes || ""}
                  onChange={(e) => updateProcedure(i, "notes", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeProcedure(i)}
                  className="col-span-1 text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </section>
        </form>
      </Modal>

      <Modal
        open={!!mediaPreview}
        onClose={() => setMediaPreview(undefined)}
        title={mediaPreview?.label || mediaPreview?.type}
        size="md"
      >
        {mediaPreview?.type === "video" ? (
          <video src={mediaPreview.url} controls className="w-full rounded max-h-[70vh]" />
        ) : (
          <img
            src={mediaPreview?.url}
            alt={mediaPreview?.label || "photo"}
            className="w-full rounded max-h-[70vh] object-contain"
          />
        )}
      </Modal>
    </div>
  );
}

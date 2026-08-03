import { useEffect, useState, useCallback } from "react";
import {
  ipdApi,
  hospitalPatientApi,
  staffApi,
  billingApi,
} from "../services/admin-api";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
  Alert,
  cn,
} from "../components/ui";

interface Bed {
  _id: string;
  ward: string;
  bedNumber: string;
  bedType?: string;
  status: "available" | "occupied" | "maintenance";
  currentAdmissionId?: any;
}
interface Ward {
  _id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  bedCount?: number;
}
interface Admission {
  _id: string;
  admissionNo: string;
  status: string;
  admittedAt: string;
  currentWard?: string;
  currentBedNumber?: string;
  patientId?: { patientId?: string; fullName?: string };
  attendingDoctorId?: { fullName?: string };
}

export default function IPDManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.IPD_MANAGE);
  const canBeds = hasPermission(PERMISSIONS.BEDS_MANAGE);

  const [tab, setTab] = useState<"admissions" | "beds" | "wards">("admissions");
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);

  const [showAdmit, setShowAdmit] = useState(false);
  const [showBed, setShowBed] = useState(false);
  const [wardForm, setWardForm] = useState<Ward | null | "new">(null);
  const [detail, setDetail] = useState<any>(null);

  const loadAdmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ipdApi.listAdmissions({ status: "admitted" });
      setAdmissions(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBeds = useCallback(async () => {
    const res = await ipdApi.listBeds();
    setBeds(res.data?.beds || []);
  }, []);

  const loadWards = useCallback(async () => {
    const res = await ipdApi.listWards();
    setWards(res.data?.wards || []);
  }, []);

  const deleteWard = async (w: Ward) => {
    if (!window.confirm(`Delete ward "${w.name}"?`)) return;
    try {
      await ipdApi.deleteWard(w._id);
      loadWards();
    } catch (e: any) {
      window.alert(e?.message || "Failed to delete ward");
    }
  };

  useEffect(() => {
    loadAdmissions();
    loadBeds();
    loadWards();
    staffApi
      .getAll({ limit: 200 })
      .then((res) => {
        const list = res.data?.staff || res.data?.items || res.data?.admins || [];
        setDoctors(
          list.filter(
            (s: any) =>
              (s.roleName || "").toLowerCase().includes("doctor") || !s.roleName,
          ),
        );
      })
      .catch(() => setDoctors([]));
  }, [loadAdmissions, loadBeds, loadWards]);

  const availableBeds = beds.filter((b) => b.status === "available");

  return (
    <div className="p-6">
      <PageHeader
        title="IPD — In-Patient Department"
        subtitle="Admissions, beds, transfers & discharge — Doctor Panel (HMS)"
        actions={
          <>
            {tab === "admissions" && canManage && (
              <Button onClick={() => setShowAdmit(true)}>+ Admit Patient</Button>
            )}
            {tab === "beds" && canBeds && (
              <Button onClick={() => setShowBed(true)}>+ Add Bed</Button>
            )}
            {tab === "wards" && canBeds && (
              <Button onClick={() => setWardForm("new")}>+ Add Ward</Button>
            )}
          </>
        }
      />

      <div className="flex gap-4 mb-4 border-b">
        {(["admissions", "beds", "wards"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "pb-2 capitalize",
              tab === t
                ? "border-b-2 border-healwin-600 text-healwin-700 font-medium"
                : "text-gray-500",
            )}
          >
            {t === "beds"
              ? `Beds (${beds.filter((b) => b.status === "available").length} free)`
              : t === "wards"
                ? `Wards (${wards.length})`
                : `Current Admissions (${admissions.length})`}
          </button>
        ))}
      </div>

      {tab === "admissions" ? (
        <Table>
          <THead>
            <Th>Admission</Th>
            <Th>Patient</Th>
            <Th>Ward / Bed</Th>
            <Th>Doctor</Th>
            <Th>Admitted</Th>
            <Th className="text-right">Actions</Th>
          </THead>
          <TBody>
            {loading ? (
              <TableState colSpan={6}>Loading…</TableState>
            ) : admissions.length === 0 ? (
              <TableState colSpan={6}>No current admissions.</TableState>
            ) : (
              admissions.map((a) => (
                <TR key={a._id}>
                  <Td className="font-mono text-xs">{a.admissionNo}</Td>
                  <Td className="font-medium text-gray-900">
                    {a.patientId?.fullName || "—"}
                  </Td>
                  <Td>
                    {a.currentWard} / {a.currentBedNumber}
                  </Td>
                  <Td>{a.attendingDoctorId?.fullName || "—"}</Td>
                  <Td className="text-gray-500">
                    {new Date(a.admittedAt).toLocaleDateString()}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const res = await ipdApi.admissionDetail(a._id);
                        setDetail(res.data?.admission);
                      }}
                    >
                      Manage
                    </Button>
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      ) : tab === "wards" ? (
        <Table>
          <THead>
            <Th>Ward</Th>
            <Th>Description</Th>
            <Th>Beds</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </THead>
          <TBody>
            {wards.length === 0 ? (
              <TableState colSpan={5}>No wards yet — add one to group beds under it.</TableState>
            ) : (
              wards.map((w) => (
                <TR key={w._id}>
                  <Td className="font-medium text-gray-900">{w.name}</Td>
                  <Td className="text-gray-500">{w.description || "—"}</Td>
                  <Td>{w.bedCount ?? 0}</Td>
                  <Td>
                    <Badge tone={w.isActive === false ? "neutral" : "success"}>
                      {w.isActive === false ? "inactive" : "active"}
                    </Badge>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {canBeds && (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Edit ward"
                          aria-label="Edit ward"
                          onClick={() => setWardForm(w)}
                          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete ward"
                          aria-label="Delete ward"
                          onClick={() => deleteWard(w)}
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {beds.length === 0 ? (
            <p className="text-gray-400">No beds configured.</p>
          ) : (
            beds.map((b) => (
              <Card
                key={b._id}
                padded
                className={cn(
                  b.status === "available"
                    ? "border-emerald-200 bg-emerald-50"
                    : b.status === "occupied"
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200 bg-gray-50",
                )}
              >
                <div className="font-semibold">
                  {b.ward} · {b.bedNumber}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {b.bedType}
                </div>
                <div className="mt-1">
                  <Badge
                    tone={
                      b.status === "available"
                        ? "success"
                        : b.status === "occupied"
                          ? "danger"
                          : "neutral"
                    }
                    dot
                  >
                    {b.status}
                  </Badge>
                </div>
                {b.currentAdmissionId?.patientId?.fullName && (
                  <div className="mt-1 text-xs text-gray-600">
                    {b.currentAdmissionId.patientId.fullName}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {showAdmit && (
        <AdmitModal
          doctors={doctors}
          availableBeds={availableBeds}
          onClose={() => setShowAdmit(false)}
          onDone={() => {
            setShowAdmit(false);
            loadAdmissions();
            loadBeds();
          }}
        />
      )}
      {showBed && (
        <BedModal
          wards={wards}
          onClose={() => setShowBed(false)}
          onDone={() => {
            setShowBed(false);
            loadBeds();
          }}
        />
      )}
      {wardForm !== null && (
        <WardModal
          ward={wardForm === "new" ? null : wardForm}
          onClose={() => setWardForm(null)}
          onDone={() => {
            setWardForm(null);
            loadWards();
          }}
        />
      )}
      {detail && (
        <AdmissionDrawer
          admission={detail}
          availableBeds={availableBeds}
          canManage={canManage}
          onClose={() => setDetail(null)}
          onChanged={async () => {
            const res = await ipdApi.admissionDetail(detail._id);
            setDetail(res.data?.admission);
            loadAdmissions();
            loadBeds();
          }}
          onDischarged={() => {
            setDetail(null);
            loadAdmissions();
            loadBeds();
          }}
        />
      )}
    </div>
  );
}

function PatientPicker({
  selected,
  onSelect,
}: {
  selected: any;
  onSelect: (p: any) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const search = async (v: string) => {
    setQ(v);
    if (v.trim().length < 2) return setResults([]);
    const res = await hospitalPatientApi.list({ search: v.trim(), limit: 8 });
    setResults(res.data?.items || []);
  };
  if (selected)
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
        <span>
          {selected.fullName}{" "}
          <span className="font-mono text-xs text-gray-500">
            {selected.patientId}
          </span>
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onSelect(null)}
        >
          Change
        </Button>
      </div>
    );
  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => search(e.target.value)}
        placeholder="Search patient"
      />
      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow">
          {results.map((p) => (
            <button
              type="button"
              key={p._id}
              onClick={() => {
                onSelect(p);
                setResults([]);
              }}
              className="block w-full px-3 py-2 text-left hover:bg-gray-50"
            >
              {p.fullName}{" "}
              <span className="font-mono text-xs text-gray-400">
                {p.patientId}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AdmitModal({
  doctors,
  availableBeds,
  onClose,
  onDone,
}: {
  doctors: any[];
  availableBeds: Bed[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [patient, setPatient] = useState<any>(null);
  const [doctorId, setDoctorId] = useState("");
  const [bedId, setBedId] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!patient || !doctorId || !bedId) {
      setErr("Patient, doctor and bed are required.");
      return;
    }
    try {
      await ipdApi.admit({
        patientId: patient._id,
        attendingDoctorId: doctorId,
        bedId,
        reason: reason || undefined,
      });
      onDone();
    } catch (e2: any) {
      setErr(e2.message || "Failed to admit");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Admit Patient"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Admit</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <PatientPicker selected={patient} onSelect={setPatient} />
        <Field label="Attending doctor">
          <Select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="">Select doctor…</option>
            {doctors.map((d) => (
              <option key={d._id} value={d._id}>
                {d.fullName} {d.roleName ? `(${d.roleName})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bed">
          <Select value={bedId} onChange={(e) => setBedId(e.target.value)}>
            <option value="">Select available bed…</option>
            {availableBeds.map((b) => (
              <option key={b._id} value={b._id}>
                {b.ward} · {b.bedNumber} ({b.bedType})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reason / diagnosis">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

function BedModal({
  wards,
  onClose,
  onDone,
}: {
  wards: Ward[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    ward: "",
    bedNumber: "",
    bedType: "general",
    dailyCharge: "",
  });
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!form.ward.trim() || !form.bedNumber.trim()) {
      setErr("Ward and bed number are required.");
      return;
    }
    try {
      await ipdApi.createBed(form);
      onDone();
    } catch (e2: any) {
      setErr(e2.message || "Failed to add bed");
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Add Bed"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Ward">
          {wards.length === 0 ? (
            <p className="text-xs text-amber-600">
              No wards yet — add one from the “Wards” tab first.
            </p>
          ) : (
            <Select value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })}>
              <option value="">— Select ward —</option>
              {wards.map((w) => (
                <option key={w._id} value={w.name}>
                  {w.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Bed number">
          <Input
            placeholder="Bed number"
            value={form.bedNumber}
            onChange={(e) => setForm({ ...form, bedNumber: e.target.value })}
          />
        </Field>
        <Field label="Bed type">
          <Select
            value={form.bedType}
            onChange={(e) => setForm({ ...form, bedType: e.target.value })}
          >
            {["general", "semi_private", "private", "icu", "emergency"].map(
              (t) => (
                <option key={t} value={t} className="capitalize">
                  {t.replace("_", " ")}
                </option>
              ),
            )}
          </Select>
        </Field>
        <Field label="Daily charge ₹">
          <Input
            type="number"
            placeholder="Daily charge ₹"
            value={form.dailyCharge}
            onChange={(e) => setForm({ ...form, dailyCharge: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}

function AdmissionDrawer({
  admission,
  availableBeds,
  canManage,
  onClose,
  onChanged,
  onDischarged,
}: {
  admission: any;
  availableBeds: Bed[];
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
  onDischarged: () => void;
}) {
  const [vital, setVital] = useState({ bloodPressure: "", pulse: "", temperature: "", spo2: "" });
  const [med, setMed] = useState({ drug: "", dose: "", route: "" });
  const [note, setNote] = useState("");
  const [mar, setMar] = useState<any[]>([]);
  const [marLoading, setMarLoading] = useState(false);

  const loadMar = useCallback(async () => {
    setMarLoading(true);
    try {
      const res = await ipdApi.mar(admission._id);
      setMar(res.data?.doses || []);
    } finally {
      setMarLoading(false);
    }
  }, [admission._id]);

  useEffect(() => {
    loadMar();
  }, [loadMar]);

  const markDoseGiven = async (dose: any) => {
    await ipdApi.addLog(admission._id, { kind: "medication", drug: dose.drug, dose: dose.dosage });
    await loadMar();
    onChanged();
  };

  const addVital = async () => {
    await ipdApi.addLog(admission._id, { kind: "vital", ...vital });
    setVital({ bloodPressure: "", pulse: "", temperature: "", spo2: "" });
    onChanged();
  };
  const addMed = async () => {
    if (!med.drug.trim()) return;
    await ipdApi.addLog(admission._id, { kind: "medication", ...med });
    setMed({ drug: "", dose: "", route: "" });
    onChanged();
  };
  const addNote = async () => {
    if (!note.trim()) return;
    await ipdApi.addLog(admission._id, { kind: "progress", note });
    setNote("");
    onChanged();
  };
  const transfer = async (bedId: string) => {
    if (!bedId) return;
    await ipdApi.transfer(admission._id, bedId);
    onChanged();
  };
  const discharge = async () => {
    const summary = window.prompt("Discharge summary (optional):") || undefined;
    if (!window.confirm("Confirm discharge?")) return;
    await ipdApi.discharge(admission._id, summary);
    onDischarged();
  };
  const generateBill = async () => {
    const patientId =
      admission.patientId?._id || admission.patientId; // populated or raw id
    try {
      const res = await billingApi.generate({
        patientId,
        admissionId: admission._id,
        includeBedCharges: true,
      });
      const inv = res.data?.invoice;
      alert(
        `Invoice ${inv?.invoiceNo} generated from bed charges — total ₹${inv?.total?.toFixed(
          2,
        )}. Open Billing to record payment.`,
      );
    } catch (e: any) {
      alert(e.message || "Failed to generate bill");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md h-full overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {admission.admissionNo}
            </h2>
            <p className="text-sm text-gray-500">
              {admission.patientId?.fullName} · {admission.currentWard}/
              {admission.currentBedNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-5 text-sm">
          {canManage && (
            <div className="flex gap-2">
              <Select
                onChange={(e) => transfer(e.target.value)}
                value=""
                className="flex-1"
              >
                <option value="">Transfer to bed…</option>
                {availableBeds.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.ward} · {b.bedNumber}
                  </option>
                ))}
              </Select>
              <Button variant="danger" onClick={discharge}>
                Discharge
              </Button>
            </div>
          )}
          {canManage && (
            <Button
              variant="subtle"
              className="w-full"
              onClick={generateBill}
            >
              Generate Bill (bed charges)
            </Button>
          )}
          {admission.status === "discharged" && (
            <Button
              variant="subtle"
              className="w-full"
              onClick={() => ipdApi.downloadDischargeSummary(admission._id, admission.admissionNo).catch((e: any) => alert(e.message))}
            >
              Download Discharge Summary (PDF)
            </Button>
          )}

          {/* Vitals */}
          <section>
            <h3 className="mb-2 font-semibold text-gray-700">Vitals</h3>
            {canManage && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                <Input
                  placeholder="BP"
                  value={vital.bloodPressure}
                  onChange={(e) => setVital({ ...vital, bloodPressure: e.target.value })}
                />
                <Input
                  placeholder="Pulse"
                  value={vital.pulse}
                  onChange={(e) => setVital({ ...vital, pulse: e.target.value })}
                />
                <Input
                  placeholder="Temp"
                  value={vital.temperature}
                  onChange={(e) => setVital({ ...vital, temperature: e.target.value })}
                />
                <Input
                  placeholder="SpO₂"
                  value={vital.spo2}
                  onChange={(e) => setVital({ ...vital, spo2: e.target.value })}
                />
                <Button onClick={addVital} className="col-span-4">
                  Log vitals
                </Button>
              </div>
            )}
            <div className="space-y-1 text-xs text-gray-600">
              {(admission.vitalsLog || []).slice().reverse().map((v: any, i: number) => (
                <div key={i}>
                  {new Date(v.at).toLocaleString()} — BP {v.bloodPressure || "–"}, P{" "}
                  {v.pulse || "–"}, T {v.temperature || "–"}, SpO₂ {v.spo2 || "–"}
                </div>
              ))}
            </div>
          </section>

          {/* Medication Administration Record — today's real schedule, from prescriptions */}
          <section>
            <h3 className="mb-2 font-semibold text-gray-700">Medication Schedule (MAR) — Today</h3>
            {marLoading ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : mar.length === 0 ? (
              <p className="text-xs text-gray-400">No scheduled doses today (no active IPD prescriptions, or none due on a fixed round).</p>
            ) : (
              <div className="space-y-1.5">
                {mar.map((d, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs ${
                      d.status === "given" ? "border-green-200 bg-green-50" : d.status === "overdue" ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div>
                      <span className="font-medium text-gray-800">{d.time}</span> — {d.drug}{d.dosage ? ` ${d.dosage}` : ""}
                      {d.prescribedBy && <span className="text-gray-400"> · Dr. {d.prescribedBy}</span>}
                      {d.status === "given" && d.givenAt && (
                        <span className="text-green-700"> · given {new Date(d.givenAt).toLocaleTimeString()}{d.givenBy ? ` by ${d.givenBy}` : ""}</span>
                      )}
                    </div>
                    {d.status !== "given" ? (
                      canManage && (
                        <Button size="sm" variant={d.status === "overdue" ? "danger" : "secondary"} onClick={() => markDoseGiven(d)}>
                          Mark given
                        </Button>
                      )
                    ) : (
                      <span className="font-medium text-green-700">✓ Given</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Medication */}
          <section>
            <h3 className="mb-2 font-semibold text-gray-700">Medication</h3>
            {canManage && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                <Input
                  placeholder="Drug"
                  value={med.drug}
                  onChange={(e) => setMed({ ...med, drug: e.target.value })}
                />
                <Input
                  placeholder="Dose"
                  value={med.dose}
                  onChange={(e) => setMed({ ...med, dose: e.target.value })}
                />
                <Input
                  placeholder="Route"
                  value={med.route}
                  onChange={(e) => setMed({ ...med, route: e.target.value })}
                />
                <Button onClick={addMed} className="col-span-3">
                  Log medication
                </Button>
              </div>
            )}
            <div className="space-y-1 text-xs text-gray-600">
              {(admission.medicationLog || []).slice().reverse().map((m: any, i: number) => (
                <div key={i}>
                  {new Date(m.at).toLocaleString()} — {m.drug} {m.dose} {m.route}
                </div>
              ))}
            </div>
          </section>

          {/* Progress notes / rounds */}
          <section>
            <h3 className="mb-2 font-semibold text-gray-700">Progress Notes (Rounds)</h3>
            {canManage && (
              <div className="mb-2">
                <Textarea
                  rows={2}
                  placeholder="Add progress note…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button onClick={addNote} className="w-full mt-1">
                  Add note
                </Button>
              </div>
            )}
            <div className="space-y-2 text-xs text-gray-600">
              {(admission.progressNotes || []).slice().reverse().map((n: any, i: number) => (
                <div key={i} className="p-2 rounded bg-gray-50">
                  <div className="text-gray-400">
                    {new Date(n.at).toLocaleString()}
                  </div>
                  {n.note}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function WardModal({
  ward,
  onClose,
  onDone,
}: {
  ward: Ward | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(ward?.name || "");
  const [description, setDescription] = useState(ward?.description || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setErr("");
    setBusy(true);
    try {
      if (ward) await ipdApi.updateWard(ward._id, { name: name.trim(), description: description.trim() });
      else await ipdApi.createWard({ name: name.trim(), description: description.trim() || undefined });
      onDone();
    } catch (e2: any) {
      setErr(e2.message || "Failed to save ward");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={ward ? "Edit Ward" : "Add Ward"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? "Saving…" : ward ? "Save" : "Add"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Ward name">
          <Input placeholder="e.g. General Ward, ICU" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description (optional)">
          <Input placeholder="Short note" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

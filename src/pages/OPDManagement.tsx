import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  opdApi,
  hospitalPatientApi,
  doctorScheduleApi,
  billingApi,
} from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  PageHeader,
  Button,
  Input,
  Select,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
  Badge,
  Modal,
  Field,
  Alert,
} from "../components/ui";

interface Appt {
  _id: string;
  tokenNumber: number;
  scheduledAt: string;
  status: string;
  reason?: string;
  patientId?: {
    _id?: string;
    patientId?: string;
    fullName?: string;
    phone?: string;
  };
  doctorId?: { fullName?: string };
  vitals?: Record<string, string | number | undefined> | null;
  invoiceId?: {
    _id: string;
    invoiceNo: string;
    total: number;
    amountPaid: number;
    balanceDue: number;
    status: string;
  } | null;
}

const PAY_METHODS = ["cash", "upi", "card", "insurance", "wallet"] as const;

const payTone: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
  refunded: "neutral",
  cancelled: "neutral",
  draft: "neutral",
};

const STATUS_FLOW: Record<string, { next?: string; label?: string }> = {
  booked: { next: "checked_in", label: "Check in" },
  checked_in: { next: "in_consultation", label: "Start consult" },
  in_consultation: { next: "completed", label: "Complete" },
};

const statusTone: Record<
  string,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  booked: "neutral",
  checked_in: "info",
  in_consultation: "warning",
  completed: "success",
  cancelled: "danger",
  no_show: "danger",
};

const todayStr = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

export default function OPDManagement() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.OPD_MANAGE);
  const canConsult = hasPermission(PERMISSIONS.EMR_CREATE);
  const canCollect = hasPermission(PERMISSIONS.BILLING_PAYMENT);

  // Jump to the patient's EMR and auto-open a SOAP encounter for this visit.
  const startConsult = (a: Appt) => {
    if (!a.patientId?._id) {
      alert("This appointment is not linked to a registered patient.");
      return;
    }
    navigate(
      `/admin/patients/${a.patientId._id}?newEncounter=1&appointmentId=${a._id}`,
    );
  };

  const [date, setDate] = useState(todayStr());
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorsError, setDoctorsError] = useState("");
  // The board had only a date filter; the backend list already accepted
  // doctorId and status, they were simply never wired to anything.
  const [doctorFilter, setDoctorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // Nurse / front-desk vitals, captured at check-in. Deliberately here and not
  // on the doctor's encounter form — triage records vitals, the doctor reads them.
  const emptyVitals = {
    bloodPressure: "",
    pulse: "",
    temperature: "",
    spo2: "",
    respiratoryRate: "",
    height: "",
    weight: "",
  };
  const [vitalsFor, setVitalsFor] = useState<Appt | null>(null);
  const [vitals, setVitals] = useState({ ...emptyVitals });
  const [vitalsErr, setVitalsErr] = useState("");
  const [savingVitals, setSavingVitals] = useState(false);

  // Collect-payment modal (consultation bill raised at booking time).
  const [payFor, setPayFor] = useState<Appt | null>(null);
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [payAmount, setPayAmount] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payErr, setPayErr] = useState("");
  const [paying, setPaying] = useState(false);

  const [showBook, setShowBook] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [doctorId, setDoctorId] = useState("");
  const [time, setTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await opdApi.list({
        date,
        ...(doctorFilter ? { doctorId: doctorFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setAppts(res.data?.appointments || []);
    } finally {
      setLoading(false);
    }
  }, [date, doctorFilter, statusFilter]);

  // Name / phone / token search across the day's list. Client-side because the
  // list is already scoped to one day — no round trip needed.
  const visibleAppts = appts.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (a.patientId?.fullName || "").toLowerCase().includes(q) ||
      (a.patientId?.phone || "").includes(q) ||
      (a.patientId?.patientId || "").toLowerCase().includes(q) ||
      String(a.tokenNumber) === q
    );
  });

  useEffect(() => {
    load();
  }, [load]);

  // Doctors for the booking dropdown.
  //
  // Sourced from /admin/doctor-schedules (opd:view) rather than /admin/staff
  // (staff:view). A front-desk role that can run OPD legitimately has opd:view
  // but usually NOT staff:view — reading the full admin-staff directory just to
  // populate a dropdown 403'd for them, and the old `.catch(() => setDoctors([]))`
  // swallowed it, so the list silently came up empty with no explanation.
  useEffect(() => {
    doctorScheduleApi
      .listDoctors()
      .then((res) => setDoctors(res.data?.items || []))
      .catch((e: any) => {
        setDoctors([]);
        setDoctorsError(
          e?.message || "Could not load doctors. Check your permissions.",
        );
      });
  }, []);

  const searchPatients = async (q: string) => {
    setPatientSearch(q);
    if (q.trim().length < 2) return setPatientResults([]);
    const res = await hospitalPatientApi.list({ search: q.trim(), limit: 8 });
    setPatientResults(res.data?.items || []);
  };

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!selectedPatient) {
      setErr("Please search and pick a registered patient from the list. Typing a name isn't enough — register the patient under Patients first if they're not found.");
      return;
    }
    if (!doctorId) {
      setErr("Please select a doctor.");
      return;
    }
    try {
      await opdApi.create({
        patientId: selectedPatient._id,
        doctorId,
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        reason: reason || undefined,
      });
      setShowBook(false);
      setSelectedPatient(null);
      setPatientSearch("");
      setReason("");
      load();
    } catch (e2: any) {
      setErr(e2.message || "Failed to book");
    }
  };

  const openPay = (a: Appt) => {
    setPayFor(a);
    setPayMethod("cash");
    // Default to the outstanding balance — the common case is collecting the
    // consultation fee in full at the desk.
    setPayAmount(String(a.invoiceId?.balanceDue ?? ""));
    setPayRef("");
    setPayErr("");
  };

  const submitPayment = async () => {
    if (!payFor?.invoiceId) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayErr("Enter a valid amount.");
      return;
    }
    setPaying(true);
    setPayErr("");
    try {
      await billingApi.recordPayment(payFor.invoiceId._id, {
        method: payMethod,
        amount,
        reference: payRef.trim() || undefined,
      });
      setPayFor(null);
      load();
    } catch (e: any) {
      setPayErr(e?.message || "Failed to record payment");
    } finally {
      setPaying(false);
    }
  };

  const openVitals = (a: Appt) => {
    setVitalsFor(a);
    setVitals({
      ...emptyVitals,
      ...Object.fromEntries(
        Object.entries(a.vitals || {}).map(([k, v]) => [k, v == null ? "" : String(v)]),
      ),
    });
    setVitalsErr("");
  };

  const saveVitals = async () => {
    if (!vitalsFor) return;
    setSavingVitals(true);
    setVitalsErr("");
    try {
      await opdApi.recordVitals(vitalsFor._id, vitals);
      setVitalsFor(null);
      load();
    } catch (e: any) {
      setVitalsErr(e?.message || "Failed to save vitals");
    } finally {
      setSavingVitals(false);
    }
  };

  const advance = async (a: Appt) => {
    const flow = STATUS_FLOW[a.status];
    if (!flow?.next) return;
    await opdApi.update(a._id, { status: flow.next });
    load();
  };

  const cancel = async (a: Appt) => {
    if (!window.confirm("Cancel this appointment?")) return;
    await opdApi.update(a._id, { status: "cancelled" });
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="OPD — Appointments & Queue"
        subtitle="Out-Patient Department — Hospital (HMS)"
        actions={
          canManage && (
            <Button
              onClick={() => {
                setErr("");
                setShowBook(true);
              }}
            >
              + Book Appointment
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
        <Select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="w-52"
        >
          <option value="">All doctors</option>
          {doctors.map((d) => (
            <option key={d._id} value={d._id}>
              {d.fullName}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All statuses</option>
          <option value="booked">Booked</option>
          <option value="checked_in">Checked in</option>
          <option value="in_consultation">In consultation</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No show</option>
        </Select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient, phone or token…"
          className="w-64"
        />
        {(doctorFilter || statusFilter || search) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDoctorFilter("");
              setStatusFilter("");
              setSearch("");
            }}
          >
            Clear
          </Button>
        )}
        <span className="text-sm text-gray-500">
          {visibleAppts.length} appointment(s)
        </span>
      </div>

      <Table>
        <THead>
          <Th>Token</Th>
          <Th>Time</Th>
          <Th>Patient</Th>
          <Th>Doctor</Th>
          <Th>Reason</Th>
          <Th>Status</Th>
          <Th>Payment</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={8}>Loading…</TableState>
          ) : visibleAppts.length === 0 ? (
            <TableState colSpan={8}>No appointments for this day.</TableState>
          ) : (
            visibleAppts.map((a) => (
              <TR key={a._id}>
                <Td className="font-semibold text-gray-900">#{a.tokenNumber}</Td>
                <Td>
                  {new Date(a.scheduledAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Td>
                <Td>{a.patientId?.fullName || "—"}</Td>
                <Td>{a.doctorId?.fullName || "—"}</Td>
                <Td className="text-gray-500">{a.reason || "—"}</Td>
                <Td>
                  <Badge tone={statusTone[a.status] || "neutral"} dot>
                    {a.status.replace("_", " ")}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap">
                  {a.invoiceId ? (
                    <span className="flex items-center gap-2">
                      <Badge tone={payTone[a.invoiceId.status] || "neutral"} dot>
                        {a.invoiceId.status}
                      </Badge>
                      <span className="text-gray-500">
                        ₹{a.invoiceId.amountPaid} / ₹{a.invoiceId.total}
                      </span>
                      {canCollect && a.invoiceId.balanceDue > 0 && (
                        <Button size="sm" onClick={() => openPay(a)}>
                          Collect
                        </Button>
                      )}
                    </span>
                  ) : (
                    <span
                      className="text-xs text-gray-400"
                      title="No consultation fee is set on this doctor's profile, so no bill was raised."
                    >
                      No bill
                    </span>
                  )}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {canConsult &&
                    (a.status === "booked" ||
                      a.status === "checked_in" ||
                      a.status === "in_consultation") && (
                      <Button size="sm" onClick={() => startConsult(a)}>
                        Consult
                      </Button>
                    )}
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openVitals(a)}
                      title="Record vitals (nurse / front desk)"
                    >
                      {a.vitals ? "Vitals ✓" : "Vitals"}
                    </Button>
                  )}
                  {canManage && STATUS_FLOW[a.status]?.next && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => advance(a)}
                    >
                      {STATUS_FLOW[a.status].label}
                    </Button>
                  )}
                  {canManage &&
                    a.status !== "completed" &&
                    a.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => cancel(a)}
                      >
                        Cancel
                      </Button>
                    )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Modal
        open={showBook}
        onClose={() => setShowBook(false)}
        title="Book Appointment"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowBook(false)}>
              Cancel
            </Button>
            <Button onClick={book}>Book</Button>
          </>
        }
      >
        <form onSubmit={book} className="space-y-3">
          {err && <Alert tone="danger">{err}</Alert>}
          {selectedPatient ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span>
                {selectedPatient.fullName}{" "}
                <span className="font-mono text-xs text-gray-500">
                  {selectedPatient.patientId}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="text-sm text-red-600"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                value={patientSearch}
                onChange={(e) => searchPatients(e.target.value)}
                placeholder="Search patient"
              />
              {patientResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow">
                  {patientResults.map((p) => (
                    <button
                      type="button"
                      key={p._id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientResults([]);
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
              {patientSearch.trim().length >= 2 && patientResults.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  No registered patient matches “{patientSearch.trim()}”. Register them first under{" "}
                  <span className="font-medium">Hospital (HMS) → Patients</span>, then search here.
                </p>
              )}
            </div>
          )}

          <Field
            label="Doctor"
            hint={
              doctorsError ||
              (doctors.length === 0
                ? "No staff member has the Doctor role yet — add one under Team Management."
                : undefined)
            }
          >
            <Select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              <option value="">Select doctor…</option>
              {doctors.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.fullName} {d.speciality ? `(${d.speciality})` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Time">
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Reason">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </form>
      </Modal>

      {/* Record vitals — nurse / front desk, at check-in */}
      <Modal
        open={!!vitalsFor}
        onClose={() => setVitalsFor(null)}
        title="Record Vitals"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setVitalsFor(null)}>
              Cancel
            </Button>
            <Button onClick={saveVitals} disabled={savingVitals}>
              {savingVitals ? "Saving…" : "Save Vitals"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {vitalsErr && <Alert tone="danger">{vitalsErr}</Alert>}
          <p className="text-sm text-gray-500">
            {vitalsFor?.patientId?.fullName || "Patient"} — these appear
            read-only on the doctor's encounter.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["bloodPressure", "BP (e.g. 120/80)", "text"],
                ["pulse", "Pulse (bpm)", "number"],
                ["temperature", "Temp (°F)", "number"],
                ["spo2", "SpO₂ (%)", "number"],
                ["respiratoryRate", "Resp rate", "number"],
                ["height", "Height (cm)", "number"],
                ["weight", "Weight (kg)", "number"],
              ] as const
            ).map(([k, label, type]) => (
              <Field key={k} label={label}>
                <Input
                  type={type}
                  value={(vitals as any)[k]}
                  onChange={(e) => setVitals({ ...vitals, [k]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </div>
      </Modal>

      {/* Collect payment against the consultation invoice raised at booking */}
      <Modal
        open={!!payFor}
        onClose={() => setPayFor(null)}
        title="Collect Payment"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayFor(null)}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={paying}>
              {paying ? "Saving…" : "Record Payment"}
            </Button>
          </>
        }
      >
        {payFor?.invoiceId && (
          <div className="space-y-3">
            {payErr && <Alert tone="danger">{payErr}</Alert>}

            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice</span>
                <span className="font-medium">{payFor.invoiceId.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Patient</span>
                <span className="font-medium">
                  {payFor.patientId?.fullName || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total</span>
                <span>₹{payFor.invoiceId.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Already paid</span>
                <span>₹{payFor.invoiceId.amountPaid}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-semibold">
                <span>Balance due</span>
                <span>₹{payFor.invoiceId.balanceDue}</span>
              </div>
            </div>

            <Field label="Payment mode">
              <Select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m === "upi"
                      ? "UPI"
                      : m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Amount"
              hint="Defaults to the full balance — lower it to record a part payment."
            >
              <Input
                type="number"
                min="0"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </Field>

            {payMethod !== "cash" && (
              <Field
                label="Reference"
                hint="UPI / card / transaction reference, for reconciliation."
              >
                <Input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UPI txn id"
                />
              </Field>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

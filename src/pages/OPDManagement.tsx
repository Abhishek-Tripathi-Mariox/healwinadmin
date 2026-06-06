import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { opdApi, hospitalPatientApi, staffApi } from "../services/admin-api";
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
}

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
      const res = await opdApi.list({ date });
      setAppts(res.data?.appointments || []);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    staffApi
      .getAll({ limit: 200 })
      .then((res) => {
        const list = res.data?.staff || res.data?.items || res.data?.admins || [];
        setDoctors(
          list.filter(
            (s: any) =>
              (s.roleName || "").toLowerCase().includes("doctor") ||
              !s.roleName,
          ),
        );
      })
      .catch(() => setDoctors([]));
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
    if (!selectedPatient || !doctorId) {
      setErr("Patient and doctor are required.");
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
        subtitle="Out-Patient Department — Doctor Panel (HMS)"
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
        <span className="text-sm text-gray-500">
          {appts.length} appointment(s)
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
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={7}>Loading…</TableState>
          ) : appts.length === 0 ? (
            <TableState colSpan={7}>No appointments for this day.</TableState>
          ) : (
            appts.map((a) => (
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
                <Td className="text-right whitespace-nowrap">
                  {canConsult &&
                    (a.status === "checked_in" ||
                      a.status === "in_consultation") && (
                      <Button size="sm" onClick={() => startConsult(a)}>
                        Consult
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
            </div>
          )}

          <Field label="Doctor">
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
    </div>
  );
}

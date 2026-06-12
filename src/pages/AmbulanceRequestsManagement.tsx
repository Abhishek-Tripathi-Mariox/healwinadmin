import { useCallback, useEffect, useState } from "react";
import { ambulanceRequestApi, ambulanceStaffApi } from "../services/admin-api";
import { adminSocket } from "../services/socket";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";

interface ReqRow {
  _id: string;
  type?: string;
  emergency?: boolean;
  status: string;
  pickup?: { address?: string };
  patientName?: string;
  recipientName?: string;
  recipientPhone?: string;
  notes?: string;
  driverName?: string;
  vehicleNumber?: string;
  etaMinutes?: number;
  otp?: string;
  createdAt?: string;
  userId?: { fullName?: string; mobileNumber?: string };
}

const statusTone: Record<string, "warning" | "info" | "success" | "neutral" | "danger"> = {
  SEARCHING: "warning",
  ASSIGNED: "info",
  ARRIVED: "info",
  ON_TRIP: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export default function AmbulanceRequestsManagement() {
  const [items, setItems] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const [assignFor, setAssignFor] = useState<ReqRow | null>(null);
  const [form, setForm] = useState({ driverName: "", driverPhone: "", vehicleNumber: "", etaMinutes: "", driverStaffId: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [crew, setCrew] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ambulanceRequestApi.list(statusFilter || undefined);
      setItems(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Poll as a fallback safety net behind the realtime socket below.
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  // Realtime: a new patient "Where To?" ambulance request shows up the instant
  // it's created — and the row refreshes the moment its status changes
  // (assigned/en-route/etc.). Backend emits `ambulance-request:new` to the
  // "admin" room. NOTE: SOS events (`sos:new`/`sos:dispatched`) are deliberately
  // NOT handled here — SOS belongs to the SOS Dashboard only, never the
  // Ambulance Requests queue.
  useEffect(() => {
    adminSocket.connect();
    const offs = [adminSocket.on("ambulance-request:new", load)];
    return () => offs.forEach((off) => off());
  }, [load]);

  const openAssign = (r: ReqRow) => {
    setAssignFor(r);
    setForm({
      driverName: r.driverName || "",
      driverPhone: "",
      vehicleNumber: r.vehicleNumber || "",
      etaMinutes: r.etaMinutes != null ? String(r.etaMinutes) : "",
      driverStaffId: "",
    });
    setError("");
    // Load the ambulance crew so the dispatcher picks a real driver — that's
    // what notifies the driver/staff app (socket + FCM dispatch push).
    ambulanceStaffApi
      .list({ role: "driver" })
      .then((res: any) => setCrew(res?.data?.items || res?.data || []))
      .catch(() => setCrew([]));
  };

  const pickCrew = (id: string) => {
    const s = crew.find((c) => String(c._id) === id);
    setForm((f) => ({
      ...f,
      driverStaffId: id,
      driverName: s?.fullName || f.driverName,
      driverPhone: s?.mobileNumber || f.driverPhone,
      vehicleNumber: s?.vehicleNumber || s?.ambulance?.registrationNumber || f.vehicleNumber,
    }));
  };

  const submitAssign = async () => {
    if (!assignFor || saving) return;
    if (!form.driverName.trim() || !form.vehicleNumber.trim()) {
      setError("Driver name and vehicle number are required.");
      return;
    }
    setSaving(true);
    try {
      await ambulanceRequestApi.assign(assignFor._id, {
        driverName: form.driverName.trim(),
        driverPhone: form.driverPhone.trim() || undefined,
        vehicleNumber: form.vehicleNumber.trim(),
        etaMinutes: form.etaMinutes ? Number(form.etaMinutes) : undefined,
        driverStaffId: form.driverStaffId || undefined,
      });
      setAssignFor(null);
      load();
    } catch (e: any) {
      setError(e.message || "Failed to assign");
    } finally {
      setSaving(false);
    }
  };

  const advance = async (r: ReqRow, status: string) => {
    await ambulanceRequestApi.updateStatus(r._id, status);
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Ambulance Requests"
        subtitle="Live patient ambulance bookings — assign a driver to notify the patient (SOS emergencies live in the SOS Dashboard)"
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />

      <div className="mb-4 flex gap-2">
        {["", "SEARCHING", "ASSIGNED", "ON_TRIP", "COMPLETED", "CANCELLED"].map((s) => (
          <Button key={s || "open"} size="sm" variant={statusFilter === s ? "primary" : "secondary"} onClick={() => setStatusFilter(s)}>
            {s || "Open"}
          </Button>
        ))}
      </div>

      <Table>
        <THead>
          <Th>Patient</Th><Th>Type</Th><Th>Pickup</Th><Th>Status</Th><Th>Driver</Th><Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading && items.length === 0 ? (
            <TableState colSpan={6}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={6}>No requests.</TableState>
          ) : (
            items.map((r) => (
              <TR key={r._id}>
                <Td className="font-medium text-gray-900">
                  {r.recipientName || r.userId?.fullName || r.patientName || "Patient"}
                  {r.recipientPhone && <div className="text-xs text-gray-400">{r.recipientPhone}</div>}
                  {/* When booked for someone else, show who placed the request. */}
                  {r.recipientName && r.userId?.fullName && (
                    <div className="text-xs text-gray-400">
                      by {r.userId.fullName}
                      {r.userId?.mobileNumber ? ` · ${r.userId.mobileNumber}` : ""}
                    </div>
                  )}
                  {!r.recipientName && r.userId?.mobileNumber && (
                    <div className="text-xs text-gray-400">{r.userId.mobileNumber}</div>
                  )}
                </Td>
                <Td>{r.emergency ? <Badge tone="danger">SOS</Badge> : r.type || "—"}</Td>
                <Td className="text-xs text-gray-500">{r.pickup?.address || "—"}</Td>
                <Td><Badge tone={statusTone[r.status] || "neutral"}>{r.status}</Badge></Td>
                <Td className="text-xs">{r.driverName ? `${r.driverName} · ${r.vehicleNumber || ""}` : "—"}{r.otp ? ` · OTP ${r.otp}` : ""}</Td>
                <Td className="text-right whitespace-nowrap">
                  {r.status === "SEARCHING" && (
                    <Button size="sm" onClick={() => openAssign(r)}>Assign</Button>
                  )}
                  {r.status === "ASSIGNED" && (
                    <Button size="sm" variant="secondary" onClick={() => advance(r, "ON_TRIP")}>Start trip</Button>
                  )}
                  {r.status === "ON_TRIP" && (
                    <Button size="sm" variant="secondary" onClick={() => advance(r, "COMPLETED")}>Complete</Button>
                  )}
                  {["SEARCHING", "ASSIGNED"].includes(r.status) && (
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => advance(r, "CANCELLED")}>Cancel</Button>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Modal
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        title="Assign Ambulance"
        subtitle={assignFor?.pickup?.address}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignFor(null)}>Cancel</Button>
            <Button onClick={submitAssign} disabled={saving}>{saving ? "Assigning…" : "Assign & Notify"}</Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); submitAssign(); }} className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Ambulance crew (notifies their app)">
            <select
              value={form.driverStaffId}
              onChange={(e) => pickCrew(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            >
              <option value="">— Manual entry —</option>
              {crew.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.fullName} · {c.mobileNumber}
                  {c.vehicleNumber ? ` · ${c.vehicleNumber}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Driver name *"><Input value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} /></Field>
            <Field label="Driver phone"><Input value={form.driverPhone} onChange={(e) => setForm({ ...form, driverPhone: e.target.value })} /></Field>
            <Field label="Vehicle number *"><Input value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} placeholder="MH 12 AB 1234" /></Field>
            <Field label="ETA (minutes)"><Input type="number" value={form.etaMinutes} onChange={(e) => setForm({ ...form, etaMinutes: e.target.value })} /></Field>
          </div>
          <p className="text-xs text-gray-500">On assign, the patient gets a push notification + live tracking opens with the driver, vehicle and OTP.</p>
        </form>
      </Modal>
    </div>
  );
}

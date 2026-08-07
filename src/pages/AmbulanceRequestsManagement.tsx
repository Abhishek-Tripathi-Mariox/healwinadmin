import { useCallback, useEffect, useMemo, useState } from "react";
import { ambulanceRequestApi, ambulanceStaffApi, inventoryApi } from "../services/admin-api";
import { adminSocket } from "../services/socket";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";
import Pagination from "../components/Pagination";

interface ExpenseLine {
  inventoryItemId?: string;
  item: string;
  qty: number;
  rate: number;
  amount?: number;
}

interface InvItem {
  _id: string;
  name: string;
  unit?: string;
  sellingPrice?: number;
  currentStock?: number;
}

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
  // Billing
  amount?: number;
  inTransitExpenses?: ExpenseLine[];
  inTransitTotal?: number;
  grandTotal?: number;
  paymentStatus?: "PENDING" | "PAID";
  // Photos/videos of the patient captured by the crew during transport.
  patientMedia?: { url: string; type: "photo" | "video"; uploadedAt?: string }[];
  // The HMS patient record the crew registered for this trip, if any (see
  // ambulance-staff-extras.controller.ts#addPatient).
  hospitalPatientId?: { patientId?: string; fullName?: string; phone?: string } | null;
}

const money = (n?: number) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const statusTone: Record<string, "warning" | "info" | "success" | "neutral" | "danger"> = {
  SEARCHING: "warning",
  ASSIGNED: "warning",
  ACCEPTED: "info",
  ARRIVED: "info",
  ON_TRIP: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

// ASSIGNED = admin picked a driver, awaiting their acceptance. ACCEPTED = the
// driver/attendant explicitly accepted on their app — a real, separate,
// persisted status (see ambulance-staff-request.controller.ts#accept), not
// just a label.
const statusLabel: Record<string, string> = {
  SEARCHING: "Searching",
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted and on the way",
  ARRIVED: "Arrived",
  ON_TRIP: "On Trip",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function AmbulanceRequestsManagement() {
  const [items, setItems] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [assignFor, setAssignFor] = useState<ReqRow | null>(null);
  const [form, setForm] = useState({ driverName: "", driverPhone: "", vehicleNumber: "", etaMinutes: "", driverStaffId: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [crew, setCrew] = useState<any[]>([]);
  const [nearby, setNearby] = useState<any[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  // In-transit medical expense editor.
  const [billFor, setBillFor] = useState<ReqRow | null>(null);
  const [lines, setLines] = useState<ExpenseLine[]>([]);
  const [billSaving, setBillSaving] = useState(false);
  const [billError, setBillError] = useState("");
  const [invItems, setInvItems] = useState<InvItem[]>([]);

  // Patient photos/videos captured by the crew during transport.
  const [mediaFor, setMediaFor] = useState<ReqRow | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  useEffect(() => { setPage(1); }, [statusFilter]);
  const totalPages = Math.max(1, Math.ceil(items.length / limit));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageItems = useMemo(
    () => items.slice((page - 1) * limit, page * limit),
    [items, page, limit],
  );

  // Realtime: a new patient "Where To?" ambulance request shows up the instant
  // it's created (`ambulance-request:new`), and the row refreshes the moment
  // its status changes — accept/arrived/start/complete/reject, all emitted by
  // the driver/staff app as `ambulance-request:status` — instead of waiting on
  // the 15s poll below to catch up. NOTE: SOS events (`sos:new`/`sos:dispatched`)
  // are deliberately NOT handled here — SOS belongs to the SOS Dashboard only,
  // never the Ambulance Requests queue.
  useEffect(() => {
    adminSocket.connect();
    const offs = [
      adminSocket.on("ambulance-request:new", load),
      adminSocket.on("ambulance-request:status", load),
    ];
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
    setNearby([]);
    // Load the ambulance crew so the dispatcher picks a real driver — that's
    // what notifies the driver/staff app (socket + FCM dispatch push).
    ambulanceStaffApi
      .list({ role: "driver" })
      .then((res: any) => setCrew(res?.data?.items || res?.data || []))
      .catch(() => setCrew([]));
    // Geo-ranked available ambulances near the pickup — same as SOS dispatch.
    setNearbyLoading(true);
    ambulanceRequestApi
      .nearby(r._id)
      .then((res: any) => setNearby(res?.data?.ambulances || []))
      .catch(() => setNearby([]))
      .finally(() => setNearbyLoading(false));
  };

  // One-tap dispatch: reserve the picked ambulance + auto-fill crew (atomic on
  // the backend) and ring the crew app — exactly like SOS dispatch.
  const assignNearby = async (amb: any) => {
    if (!assignFor || saving) return;
    setSaving(true);
    setError("");
    try {
      await ambulanceRequestApi.assign(assignFor._id, {
        ambulanceId: amb.ambulanceId,
        etaMinutes: amb.etaMinutes != null ? Number(amb.etaMinutes) : undefined,
      });
      setAssignFor(null);
      load();
    } catch (e: any) {
      setError(e.message || "Failed to dispatch — try another ambulance.");
    } finally {
      setSaving(false);
    }
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

  // ----- In-transit medical expenses -----
  const openBill = (r: ReqRow) => {
    setBillFor(r);
    setBillError("");
    const existing = (r.inTransitExpenses || []).map((e) => ({
      inventoryItemId: (e as any).inventoryItemId ? String((e as any).inventoryItemId) : undefined,
      item: e.item,
      qty: e.qty,
      rate: e.rate,
    }));
    setLines(existing.length ? existing : [{ item: "", qty: 1, rate: 0 }]);
    // Active HMS inventory items (medicine/consumable) drive the picker + price.
    inventoryApi
      .list({ isActive: "true" })
      .then((res: any) => setInvItems(res?.data?.items || res?.data || []))
      .catch(() => setInvItems([]));
  };
  const addLine = () => setLines((ls) => [...ls, { item: "", qty: 1, rate: 0 }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<ExpenseLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  // Pick an inventory item for a line → snapshot its name + selling price.
  const pickItem = (i: number, invId: string) => {
    if (!invId) {
      updateLine(i, { inventoryItemId: undefined, item: "", rate: 0 });
      return;
    }
    const it = invItems.find((x) => x._id === invId);
    updateLine(i, {
      inventoryItemId: invId,
      item: it?.name || "",
      rate: Number(it?.sellingPrice) || 0,
    });
  };
  const expensesTotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
  const grandTotal = (Number(billFor?.amount) || 0) + expensesTotal;

  const saveBill = async () => {
    if (!billFor || billSaving) return;
    const clean = lines
      .map((l) => ({
        inventoryItemId: l.inventoryItemId,
        item: l.item.trim(),
        qty: Number(l.qty) || 0,
        rate: Number(l.rate) || 0,
      }))
      .filter((l) => l.item && l.qty > 0);
    setBillSaving(true);
    setBillError("");
    try {
      await ambulanceRequestApi.setExpenses(billFor._id, clean);
      setBillFor(null);
      load();
    } catch (e: any) {
      setBillError(e.message || "Failed to save expenses");
    } finally {
      setBillSaving(false);
    }
  };

  const markPaid = async (r: ReqRow) => {
    await ambulanceRequestApi.markPaid(r._id, "CASH").catch(() => undefined);
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
        {["", "SEARCHING", "ASSIGNED", "ACCEPTED", "ON_TRIP", "COMPLETED", "CANCELLED"].map((s) => (
          <Button key={s || "open"} size="sm" variant={statusFilter === s ? "primary" : "secondary"} onClick={() => setStatusFilter(s)}>
            {s ? statusLabel[s] || s : "Open"}
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
            pageItems.map((r) => (
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
                  {r.hospitalPatientId && (
                    <div className="mt-1">
                      <Badge tone="info">HMS: {r.hospitalPatientId.fullName || r.hospitalPatientId.patientId}</Badge>
                    </div>
                  )}
                </Td>
                <Td>{r.emergency ? <Badge tone="danger">SOS</Badge> : r.type || "—"}</Td>
                <Td className="text-xs text-gray-500">{r.pickup?.address || "—"}</Td>
                <Td><Badge tone={statusTone[r.status] || "neutral"}>{statusLabel[r.status] || r.status}</Badge></Td>
                <Td className="text-xs">{r.driverName ? `${r.driverName} · ${r.vehicleNumber || ""}` : "—"}{r.otp ? ` · OTP ${r.otp}` : ""}</Td>
                <Td className="text-right whitespace-nowrap">
                  {r.status === "SEARCHING" && (
                    <Button size="sm" onClick={() => openAssign(r)}>Assign</Button>
                  )}
                  {["ASSIGNED", "ACCEPTED"].includes(r.status) && (
                    <Button size="sm" variant="secondary" onClick={() => advance(r, "ON_TRIP")}>Start trip</Button>
                  )}
                  {r.status === "ON_TRIP" && (
                    <Button size="sm" variant="secondary" onClick={() => advance(r, "COMPLETED")}>Complete</Button>
                  )}
                  {["ASSIGNED", "ACCEPTED", "ARRIVED", "ON_TRIP", "COMPLETED"].includes(r.status) && (
                    <div className="inline-block text-left align-middle">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openBill(r)}
                        title={
                          `Ambulance charge: ${money(r.amount)}` +
                          (r.inTransitTotal ? `\nIn-transit expenses: ${money(r.inTransitTotal)}` : "") +
                          `\nGrand total: ${money(r.grandTotal ?? r.amount)}`
                        }
                      >
                        Expenses · {money(r.grandTotal ?? r.amount)}
                      </Button>
                      {!!r.inTransitTotal && (
                        <div className="mt-0.5 text-[11px] leading-tight text-gray-400">
                          Fare {money(r.amount)} + Expenses {money(r.inTransitTotal)}
                        </div>
                      )}
                    </div>
                  )}
                  {["ASSIGNED", "ACCEPTED", "ARRIVED", "ON_TRIP", "COMPLETED"].includes(r.status) &&
                    (r.paymentStatus === "PAID" ? (
                      <Badge tone="success">Paid</Badge>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => markPaid(r)}>Mark paid</Button>
                    ))}
                  {["SEARCHING", "ASSIGNED", "ACCEPTED"].includes(r.status) && (
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => advance(r, "CANCELLED")}>Cancel</Button>
                  )}
                  {!!r.patientMedia?.length && (
                    <Button size="sm" variant="ghost" onClick={() => setMediaFor(r)}>
                      Media · {r.patientMedia.length}
                    </Button>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Rows per page
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
          >
            {[5, 10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <Pagination page={page} totalPages={totalPages} total={items.length} label="requests" onPageChange={setPage} />
      </div>

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
        {/* SOS-style geo-ranked picker: tap an available ambulance to dispatch
            instantly (reserve + auto-fill crew + ring the crew app). */}
        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Nearby available ambulances
          </div>
          {nearbyLoading ? (
            <div className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-400">Finding nearby ambulances…</div>
          ) : nearby.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-400">
              No available ambulances nearby — assign manually below.
            </div>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {nearby.map((a) => (
                <div key={a.ambulanceId} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {a.registrationNumber || "Ambulance"}{a.ambulanceType ? ` · ${a.ambulanceType}` : ""}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {a.driverName || "No driver"}{a.driverPhone ? ` · ${a.driverPhone}` : ""}
                    </div>
                    <div className="text-xs text-gray-400">
                      {a.roadDistanceKm != null ? `${a.roadDistanceKm} km` : ""}
                      {a.etaMinutes != null ? ` · ~${a.etaMinutes} min` : ""}
                    </div>
                  </div>
                  <Button size="sm" disabled={saving} onClick={() => assignNearby(a)}>Dispatch</Button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-center text-xs text-gray-400">— or assign manually —</div>
        </div>

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

      {/* In-transit medical expenses — billed on top of the ambulance fare and
          shown to the patient as a separate section + new grand total. */}
      <Modal
        open={!!billFor}
        onClose={() => setBillFor(null)}
        title="In-Transit Medical Expenses"
        subtitle={billFor ? (billFor.recipientName || billFor.userId?.fullName || billFor.patientName || "Patient") : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBillFor(null)}>Cancel</Button>
            <Button onClick={saveBill} disabled={billSaving}>{billSaving ? "Saving…" : "Save & bill patient"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {billError && <Alert tone="danger">{billError}</Alert>}

          <div className="grid grid-cols-[1fr_64px_84px_84px_28px] items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>Item</span><span>Qty</span><span>Rate ₹</span><span className="text-right">Amount</span><span />
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_64px_84px_84px_28px] items-center gap-2">
              <div className="space-y-1">
                <select
                  value={l.inventoryItemId || ""}
                  onChange={(e) => pickItem(i, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-sky-500 focus:outline-none"
                >
                  <option value="">— Custom item —</option>
                  {invItems.map((it) => (
                    <option key={it._id} value={it._id}>
                      {it.name}{it.sellingPrice != null ? ` · ₹${it.sellingPrice}` : ""}
                      {it.currentStock != null ? ` · ${it.currentStock} ${it.unit || ""} left` : ""}
                    </option>
                  ))}
                </select>
                {/* Free-text name only when no inventory item is picked. */}
                {!l.inventoryItemId && (
                  <Input value={l.item} placeholder="Item name" onChange={(e) => updateLine(i, { item: e.target.value })} />
                )}
              </div>
              <Input type="number" value={String(l.qty)} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} />
              <Input type="number" value={String(l.rate)} onChange={(e) => updateLine(i, { rate: Number(e.target.value) })} />
              <span className="text-right text-sm text-gray-700">{money((Number(l.qty) || 0) * (Number(l.rate) || 0))}</span>
              <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => removeLine(i)} aria-label="Remove">×</button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={addLine}>+ Add item</Button>
          <p className="text-xs text-gray-500">Pick from HMS inventory (price auto-fills, stock deducts) or choose “Custom item” for a one-off.</p>

          <div className="mt-2 space-y-1 border-t border-gray-200 pt-3 text-sm">
            <div className="flex justify-between text-gray-600"><span>Ambulance Charge</span><span>{money(billFor?.amount)}</span></div>
            <div className="flex justify-between text-gray-600"><span>In-Transit Medical Expense</span><span>{money(expensesTotal)}</span></div>
            <div className="flex justify-between font-semibold text-gray-900"><span>Grand Total</span><span>{money(grandTotal)}</span></div>
          </div>
          <p className="text-xs text-gray-500">Saving updates the patient's bill on their tracking screen in real time.</p>
        </div>
      </Modal>

      {/* Patient photos/videos captured by the crew during transport. */}
      <Modal
        open={!!mediaFor}
        onClose={() => setMediaFor(null)}
        title="Patient photos/videos"
        subtitle={mediaFor ? (mediaFor.recipientName || mediaFor.userId?.fullName || mediaFor.patientName || "Patient") : undefined}
      >
        <div className="grid grid-cols-4 gap-3">
          {(mediaFor?.patientMedia || []).map((m, i) => (
            <button
              key={m.url}
              type="button"
              className="relative aspect-square overflow-hidden rounded-lg border-2 border-transparent bg-gray-100 hover:border-healwin-400"
              onClick={() => setLightboxIndex(i)}
            >
              {m.type === "video" ? (
                <>
                  <video src={m.url} className="h-full w-full object-cover" muted />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-lg text-white">▶</span>
                </>
              ) : (
                <img src={m.url} alt={`Media ${i + 1}`} className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      </Modal>

      {/* Media lightbox — enlarged photo, or a playable video. */}
      {mediaFor && lightboxIndex != null && mediaFor.patientMedia?.[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative mx-4 w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-lg text-white hover:bg-black/70"
            >
              ×
            </button>
            <div className="flex items-center justify-center bg-gray-100 p-4" style={{ minHeight: 300 }}>
              {mediaFor.patientMedia[lightboxIndex].type === "video" ? (
                <video src={mediaFor.patientMedia[lightboxIndex].url} className="max-h-[70vh] max-w-full rounded" controls autoPlay />
              ) : (
                <img
                  src={mediaFor.patientMedia[lightboxIndex].url}
                  alt={`Media ${lightboxIndex + 1}`}
                  className="max-h-[70vh] max-w-full rounded object-contain"
                />
              )}
            </div>
            {mediaFor.patientMedia.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setLightboxIndex((prev) => ((prev! - 1 + mediaFor.patientMedia!.length) % mediaFor.patientMedia!.length))
                  }
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-xl text-white hover:bg-black/70"
                >
                  ‹
                </button>
                <button
                  onClick={() => setLightboxIndex((prev) => (prev! + 1) % mediaFor.patientMedia!.length)}
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-xl text-white hover:bg-black/70"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

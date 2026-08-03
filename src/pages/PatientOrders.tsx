import { useCallback, useEffect, useState } from "react";
import { patientCommerceApi } from "../services/admin-api";
import { adminSocket } from "../services/socket";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  PageHeader, Table, THead, TBody, TR, Th, Td, TableState, Select, Modal, Badge, Button,
} from "../components/ui";

/**
 * Admin inbox for the patient-app commerce flows — doctor consultations, lab
 * bookings and pharmacy orders. Patients place these from the app; ops view
 * them here (click a row for full detail) and advance their status. New orders
 * arrive in real time over the socket so the desk knows the instant one lands.
 */

type Tab = "consultations" | "lab-bookings" | "pharmacy-orders";

interface User {
  _id?: string;
  fullName?: string;
  mobileNumber?: string;
  countryCode?: string;
}
interface Row {
  _id: string;
  userId?: User | string;
  status: string;
  createdAt?: string;
  scheduledAt?: string;
  slotLabel?: string;
  slotTime?: string;
  summary?: string; // consultation
  reportUrl?: string; // lab (legacy single-file)
  reportFiles?: { url: string; label?: string; uploadedAt?: string }[]; // lab (multi-page)
  reportNotes?: string; // lab
  // consultation
  doctorName?: string;
  speciality?: string;
  symptoms?: string;
  teleconsult?: boolean;
  fee?: number;
  // lab
  tests?: { name: string; price: number }[];
  slot?: string;
  // pharmacy
  items?: { name: string; qty: number; price: number }[];
  prescriptionUrl?: string;
  totalAmount?: number;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "consultations", label: "Consultations" },
  { key: "lab-bookings", label: "Lab Bookings" },
  { key: "pharmacy-orders", label: "Pharmacy Orders" },
];

// New-order socket event per tab, so an arriving order refreshes the right list.
const NEW_EVENT: Record<Tab, string> = {
  consultations: "consultation:new",
  "lab-bookings": "lab-booking:new",
  "pharmacy-orders": "pharmacy-order:new",
};

const STATUSES: Record<Tab, string[]> = {
  consultations: ["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED"],
  "lab-bookings": ["BOOKED", "SAMPLE_COLLECTED", "PROCESSING", "REPORT_READY", "CANCELLED"],
  "pharmacy-orders": ["PLACED", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
};

const userName = (u?: User | string) => (u && typeof u === "object" ? u.fullName || "—" : "—");
const userPhone = (u?: User | string) =>
  u && typeof u === "object" ? `${u.countryCode || ""}${u.mobileNumber || ""}` : "";

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

const statusTone = (s: string): "danger" | "success" | "info" =>
  s === "CANCELLED" ? "danger" : ["COMPLETED", "DELIVERED", "REPORT_READY"].includes(s) ? "success" : "info";

const itemSummary = (r: Row, tab: Tab): string => {
  if (tab === "consultations") return [r.doctorName ? `Dr. ${r.doctorName}` : "", r.speciality].filter(Boolean).join(" · ") || "—";
  if (tab === "lab-bookings") return (r.tests || []).map((t) => t.name).join(", ") || "—";
  return (r.items || []).map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ") || "—";
};

const amountOf = (r: Row, tab: Tab): number => (tab === "consultations" ? r.fee ?? 0 : r.totalAmount ?? 0);

export default function PatientOrders() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.PATIENT_COMMERCE_MANAGE);

  const [tab, setTab] = useState<Tab>("consultations");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [flash, setFlash] = useState(false);
  const [rsDate, setRsDate] = useState("");
  const [rsTime, setRsTime] = useState("");
  const [summary, setSummary] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const canSchedule = tab === "consultations" || tab === "lab-bookings";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res =
        tab === "consultations"
          ? await patientCommerceApi.consultations()
          : tab === "lab-bookings"
            ? await patientCommerceApi.labBookings()
            : await patientCommerceApi.pharmacyOrders();
      setRows(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time: a new order (or a status change) lands → reload + flash a banner.
  useEffect(() => {
    adminSocket.connect();
    const onNew = () => {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 4000);
      load();
    };
    const offs = [
      adminSocket.on(NEW_EVENT[tab], onNew),
      adminSocket.on("consultation:updated", load),
      adminSocket.on("lab-booking:updated", load),
      adminSocket.on("pharmacy-order:updated", load),
    ];
    return () => offs.forEach((off) => off());
  }, [tab, load]);

  const setStatus = async (id: string, status: string) => {
    if (tab === "consultations") await patientCommerceApi.setConsultationStatus(id, status);
    else if (tab === "lab-bookings") await patientCommerceApi.setLabBookingStatus(id, status);
    else await patientCommerceApi.setPharmacyOrderStatus(id, status);
    load();
    setSelected((s) => (s && s._id === id ? { ...s, status } : s));
  };

  const saveSchedule = async (id: string) => {
    if (!rsDate || !rsTime) return;
    const res =
      tab === "consultations"
        ? await patientCommerceApi.rescheduleConsultation(id, rsDate, rsTime)
        : await patientCommerceApi.rescheduleLabBooking(id, rsDate, rsTime);
    const item = res.data?.item as Row | undefined;
    if (item) setSelected(item);
    setRsDate("");
    setRsTime("");
    load();
  };

  const openDetail = (r: Row) => {
    setSelected(r);
    setRsDate("");
    setRsTime("");
    setSummary(r.summary || "");
    setReportNotes(r.reportNotes || "");
    setReportFiles([]);
  };

  const saveSummary = async (id: string) => {
    if (!summary.trim() || saving) return;
    setSaving(true);
    try {
      const res = await patientCommerceApi.setConsultationSummary(id, summary.trim());
      if (res.data?.item) setSelected(res.data.item as Row);
      load();
    } finally {
      setSaving(false);
    }
  };

  const saveReport = async (id: string) => {
    if ((!reportNotes.trim() && reportFiles.length === 0) || saving) return;
    setSaving(true);
    try {
      const form = new FormData();
      if (reportNotes.trim()) form.append("reportNotes", reportNotes.trim());
      reportFiles.forEach((f) => form.append("file", f));
      const res = await patientCommerceApi.setLabReport(id, form);
      if (res.data?.item) setSelected(res.data.item as Row);
      setReportFiles([]);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Patient Orders"
        subtitle="Doctor consultations, lab bookings and pharmacy orders placed from the patient app"
      />

      {flash && (
        <div className="rounded-lg border border-healwin-200 bg-healwin-50 px-4 py-2 text-sm font-medium text-healwin-700">
          🔔 A new {TABS.find((t) => t.key === tab)?.label.toLowerCase()} order just arrived.
        </div>
      )}

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === t.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Table>
        <THead>
          <Th>Patient</Th>
          <Th>{tab === "consultations" ? "Doctor" : tab === "lab-bookings" ? "Tests" : "Items"}</Th>
          {tab === "lab-bookings" && <Th>Slot</Th>}
          <Th>Amount</Th>
          <Th>Date</Th>
          <Th>Status</Th>
          <Th className="text-right">Action</Th>
        </THead>
        <TBody>
          {loading && rows.length === 0 ? (
            <TableState colSpan={7}>Loading…</TableState>
          ) : rows.length === 0 ? (
            <TableState colSpan={7}>Nothing here yet.</TableState>
          ) : (
            rows.map((r) => (
              <TR key={r._id} clickable onClick={() => openDetail(r)}>
                <Td>
                  <div className="font-medium text-gray-900">{userName(r.userId)}</div>
                  {userPhone(r.userId) && <div className="text-xs text-gray-500">{userPhone(r.userId)}</div>}
                </Td>
                <Td className="max-w-xs">
                  <div className="truncate">{itemSummary(r, tab)}</div>
                  {r.slotLabel && <div className="text-xs font-medium text-healwin-700">🕒 {r.slotLabel}</div>}
                </Td>
                {tab === "lab-bookings" && <Td>{r.slot || "—"}</Td>}
                <Td>₹{amountOf(r, tab)}</Td>
                <Td className="text-xs text-gray-500">{fmtDate(r.createdAt)}</Td>
                <Td onClick={(e) => e.stopPropagation()}>
                  <Select value={r.status} disabled={!canManage} onChange={(e) => setStatus(r._id, e.target.value)} className="w-44">
                    {STATUSES[tab].map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </Select>
                </Td>
                <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="secondary" onClick={() => openDetail(r)}>
                    Details
                  </Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Order details"
        subtitle={selected ? fmtDate(selected.createdAt) : undefined}
      >
        {selected && (
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Patient</div>
                <div className="font-medium text-gray-900">{userName(selected.userId)}</div>
                {userPhone(selected.userId) && <div className="text-sm text-gray-500">{userPhone(selected.userId)}</div>}
              </div>
              <Badge tone={statusTone(selected.status)}>{selected.status.replace(/_/g, " ")}</Badge>
            </div>

            {tab === "consultations" && (
              <div className="space-y-1 text-sm">
                <Detail k="Doctor" v={selected.doctorName ? `Dr. ${selected.doctorName}` : "—"} />
                <Detail k="Speciality" v={selected.speciality || "—"} />
                <Detail k="Mode" v={selected.teleconsult ? "Teleconsult" : "In-person"} />
                <Detail k="Symptoms" v={selected.symptoms || "—"} />
                <Detail k="Fee" v={`₹${selected.fee ?? 0}`} />
              </div>
            )}

            {tab === "lab-bookings" && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Tests</div>
                {(selected.tests || []).map((t, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-800">{t.name}</span>
                    <span className="text-gray-600">₹{t.price}</span>
                  </div>
                ))}
                <Detail k="Slot" v={selected.slot || "—"} />
                <Detail k="Total" v={`₹${selected.totalAmount ?? 0}`} />
              </div>
            )}

            {tab === "pharmacy-orders" && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Items</div>
                {(selected.items || []).map((it, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-800">{it.name} × {it.qty}</span>
                    <span className="text-gray-600">₹{it.price * it.qty}</span>
                  </div>
                ))}
                {selected.prescriptionUrl && (
                  <a href={selected.prescriptionUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
                    View prescription
                  </a>
                )}
                <Detail k="Total" v={`₹${selected.totalAmount ?? 0}`} />
              </div>
            )}

            {canSchedule && canManage && (
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="mb-1 text-sm font-medium text-gray-700">
                  Appointment {selected.slotLabel ? `· 🕒 ${selected.slotLabel}` : "· not scheduled"}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={rsDate}
                    onChange={(e) => setRsDate(e.target.value)}
                    className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                  />
                  <input
                    type="time"
                    value={rsTime}
                    onChange={(e) => setRsTime(e.target.value)}
                    className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
                  />
                  <button
                    disabled={!rsDate || !rsTime}
                    onClick={() => saveSchedule(selected._id)}
                    className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {selected.slotLabel ? "Reschedule" : "Set time"}
                  </button>
                </div>
              </div>
            )}

            {/* Consultation summary — what the doctor advised */}
            {tab === "consultations" && canManage && (
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="mb-1 text-sm font-medium text-gray-700">Consultation summary</div>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  placeholder="What was discussed / advised / prescribed to the patient…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  disabled={!summary.trim() || saving}
                  onClick={() => saveSummary(selected._id)}
                  className="mt-2 h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  {selected.summary ? "Update summary" : "Save & complete"}
                </button>
              </div>
            )}

            {/* Lab report — upload a file and/or type findings. Only available
                once the sample has actually been collected; at the BOOKED stage
                the admin is still scheduling/rescheduling, so there's nothing to
                upload yet and the option is hidden. */}
            {tab === "lab-bookings" && canManage &&
              ["SAMPLE_COLLECTED", "PROCESSING", "REPORT_READY"].includes(selected.status) && (
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="mb-1 text-sm font-medium text-gray-700">Lab report</div>
                {(() => {
                  const current =
                    selected.reportFiles && selected.reportFiles.length > 0
                      ? selected.reportFiles
                      : selected.reportUrl
                        ? [{ url: selected.reportUrl, label: "Report" }]
                        : [];
                  return current.length > 0 ? (
                    <div className="mb-2 space-y-1">
                      {current.map((f, i) => (
                        <a
                          key={i}
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-sm text-blue-600 underline"
                        >
                          📄 {f.label || `Page ${i + 1}`}
                        </a>
                      ))}
                    </div>
                  ) : null;
                })()}
                <textarea
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  rows={3}
                  placeholder="Findings / what problem was detected…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => setReportFiles(Array.from(e.target.files || []))}
                  className="mt-2 block w-full text-sm"
                />
                {reportFiles.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    {reportFiles.length} file{reportFiles.length > 1 ? "s" : ""} selected — uploading replaces the current report.
                  </div>
                )}
                <button
                  disabled={(!reportNotes.trim() && reportFiles.length === 0) || saving}
                  onClick={() => saveReport(selected._id)}
                  className="mt-2 h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save report (mark ready)"}
                </button>
              </div>
            )}

            <div>
              <div className="mb-1 text-sm font-medium text-gray-700">Update status</div>
              <Select value={selected.status} disabled={!canManage} onChange={(e) => setStatus(selected._id, e.target.value)} className="w-full">
                {STATUSES[tab].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{k}</span>
      <span className="text-right font-medium text-gray-900">{v}</span>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { staffRecordsApi } from "../services/admin-api";
import { adminSocket } from "../services/socket";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
} from "../components/ui";

/**
 * Admin view of records the ambulance-staff (attendant) app creates: case
 * notes, stock requests and leave applications. Data is written by the staff
 * app and read here so ops can see and action it.
 *
 * NOTE: Staff-registered PATIENTS are NOT here — they register straight into
 * the HMS HospitalPatient registry and appear on the admin "Patients" page
 * (tagged source: ambulance_staff).
 */

type Tab = "patients" | "case-notes" | "stock-requests" | "leaves";

interface Staff {
  _id?: string;
  fullName?: string;
  mobileNumber?: string;
}
interface PatientRow {
  _id: string;
  patientId?: string;
  fullName?: string;
  phone?: string;
  gender?: string;
  registeredByStaffId?: Staff | string;
  createdAt?: string;
}
interface CaseNoteRow {
  _id: string;
  dispatchId?: string;
  patientId?: string;
  vitals?: Record<string, unknown>;
  notes?: string;
  staffId?: Staff | string;
  createdAt?: string;
}
interface StockRow {
  _id: string;
  items: { name: string; qty: number }[];
  status: string;
  staffId?: Staff | string;
  createdAt?: string;
}
interface LeaveRow {
  _id: string;
  type: string;
  day?: string;
  fromDate?: string;
  toDate?: string;
  reason?: string;
  attachmentUrl?: string;
  status: string;
  staffId?: Staff | string;
  createdAt?: string;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "patients", label: "Patients" },
  { key: "case-notes", label: "Case Notes" },
  { key: "stock-requests", label: "Stock Requests" },
  { key: "leaves", label: "Leaves" },
];

const statusTone: Record<string, "warning" | "info" | "success" | "neutral" | "danger"> = {
  Pending: "warning",
  Approved: "success",
  Fulfilled: "success",
  Rejected: "danger",
};

const staffName = (s?: Staff | string) =>
  s && typeof s === "object" ? s.fullName || "—" : "—";
const staffPhone = (s?: Staff | string) =>
  s && typeof s === "object" ? s.mobileNumber : undefined;
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function StaffAppRecords() {
  // Open the tab requested via ?tab= (e.g. the bell's "New leave request"
  // notification deep-links to ?tab=leaves), and keep it in sync if the URL
  // changes while this page is already mounted.
  const [searchParams] = useSearchParams();
  const tabFromUrl = (): Tab => {
    const t = searchParams.get("tab");
    return TABS.some((x) => x.key === t) ? (t as Tab) : "patients";
  };
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as Tab);
  }, [searchParams]);
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [caseNotes, setCaseNotes] = useState<CaseNoteRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "patients") setPatients((await staffRecordsApi.patients()).data?.items || []);
      else if (tab === "case-notes") setCaseNotes((await staffRecordsApi.caseNotes()).data?.items || []);
      else if (tab === "stock-requests") setStock((await staffRecordsApi.stockRequests()).data?.items || []);
      else if (tab === "leaves") setLeaves((await staffRecordsApi.leaves()).data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  // Live refresh: the staff app emits leave:new / stock:new when a record is
  // submitted, plus a 20s poll so the current tab never goes stale without a
  // manual Refresh.
  useEffect(() => {
    adminSocket.connect();
    const offLeave = adminSocket.on("leave:new", load);
    const offStock = adminSocket.on("stock:new", load);
    const poll = setInterval(load, 20000);
    return () => {
      offLeave();
      offStock();
      clearInterval(poll);
    };
  }, [load]);

  const setStockStatus = async (id: string, status: string) => {
    await staffRecordsApi.setStockRequestStatus(id, status);
    load();
  };
  const setLeaveStatus = async (id: string, status: string) => {
    await staffRecordsApi.setLeaveStatus(id, status);
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Staff App Records"
        subtitle="Case notes, stock requests and leaves submitted from the ambulance-staff app (staff-added patients appear on the Patients page)"
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "primary" : "secondary"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "patients" && (
        <Table>
          <THead>
            <Th>Patient ID</Th><Th>Name</Th><Th>Phone</Th><Th>Gender</Th><Th>Registered by</Th><Th>Date</Th>
          </THead>
          <TBody>
            {loading && patients.length === 0 ? (
              <TableState colSpan={6}>Loading…</TableState>
            ) : patients.length === 0 ? (
              <TableState colSpan={6}>No patients registered from the staff app.</TableState>
            ) : (
              patients.map((p) => (
                <TR key={p._id}>
                  <Td className="text-xs text-gray-500">{p.patientId || "—"}</Td>
                  <Td className="text-sm text-gray-800">{p.fullName || "—"}</Td>
                  <Td className="text-xs text-gray-600">{p.phone || "—"}</Td>
                  <Td className="text-xs text-gray-600 capitalize">{p.gender || "—"}</Td>
                  <Td className="text-xs text-gray-500">
                    {staffName(p.registeredByStaffId)}
                    {staffPhone(p.registeredByStaffId) && <div className="text-gray-400">{staffPhone(p.registeredByStaffId)}</div>}
                  </Td>
                  <Td className="text-xs text-gray-500">{fmtDate(p.createdAt)}</Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      )}

      {tab === "case-notes" && (
        <Table>
          <THead>
            <Th>Staff</Th><Th>Dispatch</Th><Th>Patient</Th><Th>Vitals</Th><Th>Notes</Th><Th>Date</Th>
          </THead>
          <TBody>
            {loading && caseNotes.length === 0 ? (
              <TableState colSpan={6}>Loading…</TableState>
            ) : caseNotes.length === 0 ? (
              <TableState colSpan={6}>No case notes.</TableState>
            ) : (
              caseNotes.map((c) => (
                <TR key={c._id}>
                  <Td className="text-xs text-gray-500">
                    {staffName(c.staffId)}
                    {staffPhone(c.staffId) && <div className="text-gray-400">{staffPhone(c.staffId)}</div>}
                  </Td>
                  <Td className="text-xs text-gray-400">{c.dispatchId || "—"}</Td>
                  <Td className="text-xs text-gray-400">{c.patientId || "—"}</Td>
                  <Td className="text-xs text-gray-600 max-w-xs">
                    {c.vitals && Object.keys(c.vitals).length
                      ? Object.entries(c.vitals).map(([k, v]) => `${k}: ${String(v)}`).join(", ")
                      : "—"}
                  </Td>
                  <Td className="text-xs text-gray-700 max-w-md whitespace-pre-wrap">{c.notes || "—"}</Td>
                  <Td className="text-xs text-gray-500">{fmtDate(c.createdAt)}</Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      )}

      {tab === "stock-requests" && (
        <Table>
          <THead>
            <Th>Staff</Th><Th>Items</Th><Th>Status</Th><Th>Date</Th><Th className="text-right">Actions</Th>
          </THead>
          <TBody>
            {loading && stock.length === 0 ? (
              <TableState colSpan={5}>Loading…</TableState>
            ) : stock.length === 0 ? (
              <TableState colSpan={5}>No stock requests.</TableState>
            ) : (
              stock.map((s) => (
                <TR key={s._id}>
                  <Td className="text-xs text-gray-500">
                    {staffName(s.staffId)}
                    {staffPhone(s.staffId) && <div className="text-gray-400">{staffPhone(s.staffId)}</div>}
                  </Td>
                  <Td className="text-sm text-gray-700">
                    {s.items?.map((it, i) => (
                      <div key={i}>{it.name} × {it.qty}</div>
                    ))}
                  </Td>
                  <Td><Badge tone={statusTone[s.status] || "neutral"}>{s.status}</Badge></Td>
                  <Td className="text-xs text-gray-500">{fmtDate(s.createdAt)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {s.status === "Pending" && (
                      <>
                        <Button size="sm" onClick={() => setStockStatus(s._id, "Fulfilled")}>Fulfill</Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setStockStatus(s._id, "Rejected")}>Reject</Button>
                      </>
                    )}
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      )}

      {tab === "leaves" && (
        <Table>
          <THead>
            <Th>Staff</Th><Th>Type</Th><Th>Day</Th><Th>From</Th><Th>To</Th><Th>Reason</Th><Th>Status</Th><Th className="text-right">Actions</Th>
          </THead>
          <TBody>
            {loading && leaves.length === 0 ? (
              <TableState colSpan={8}>Loading…</TableState>
            ) : leaves.length === 0 ? (
              <TableState colSpan={8}>No leave applications.</TableState>
            ) : (
              leaves.map((l) => (
                <TR key={l._id}>
                  <Td className="text-xs text-gray-500">
                    {staffName(l.staffId)}
                    {staffPhone(l.staffId) && <div className="text-gray-400">{staffPhone(l.staffId)}</div>}
                  </Td>
                  <Td>{l.type}</Td>
                  <Td className="text-xs">{l.day || "—"}</Td>
                  <Td className="text-xs text-gray-500">{fmtDate(l.fromDate)}</Td>
                  <Td className="text-xs text-gray-500">{fmtDate(l.toDate)}</Td>
                  <Td className="text-xs text-gray-700 max-w-xs whitespace-pre-wrap">
                    {l.reason || "—"}
                    {l.attachmentUrl && (
                      <a href={l.attachmentUrl} target="_blank" rel="noreferrer" className="block text-sky-600 hover:underline">attachment</a>
                    )}
                  </Td>
                  <Td><Badge tone={statusTone[l.status] || "neutral"}>{l.status}</Badge></Td>
                  <Td className="text-right whitespace-nowrap">
                    {l.status === "Pending" && (
                      <>
                        <Button size="sm" onClick={() => setLeaveStatus(l._id, "Approved")}>Approve</Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setLeaveStatus(l._id, "Rejected")}>Reject</Button>
                      </>
                    )}
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      )}
    </div>
  );
}

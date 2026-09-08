// Attendance regularization (§4.5). Corrections to past attendance go through
// request → approve rather than a silent edit, because attendance is what
// payroll is computed from.
import { useCallback, useEffect, useState } from "react";
import { Check, X, Plus } from "lucide-react";
import { regularizationApi, hrEmployeeApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import {
  PageHeader, Button, Card, Select, Table, THead, TBody, TR, Th, Td,
  TableState, Badge, Modal, Field, Input, Textarea, Alert,
} from "../../components/ui";

interface AR {
  _id: string;
  employeeId?: { _id: string; fullName: string; employeeCode: string };
  date: string;
  reason: string;
  note?: string;
  fromStatus?: string;
  fromCheckIn?: string;
  fromCheckOut?: string;
  toStatus: string;
  toCheckIn?: string;
  toCheckOut?: string;
  status: string;
  decisionNote?: string;
}
interface Emp { _id: string; fullName: string; employeeCode: string }

const REASONS = [
  { v: "MISSED_PUNCH", l: "Missed punch" },
  { v: "WRONG_STATUS", l: "Wrong status marked" },
  { v: "ON_DUTY", l: "On duty / official work" },
  { v: "EMERGENCY", l: "Emergency" },
  { v: "REGISTER_RECONCILIATION", l: "Manual register reconciliation" },
  { v: "OTHER", l: "Other" },
];
const STATUSES = ["present", "absent", "half_day", "leave", "holiday", "week_off"];
const tone: Record<string, "warning" | "success" | "danger"> = {
  pending: "warning", approved: "success", rejected: "danger",
};
const label = (s?: string) =>
  s ? s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ") : "—";

export default function AttendanceRegularization() {
  const { hasPermission } = useAuth();
  const canRequest = hasPermission(PERMISSIONS.ATTENDANCE_MANAGE);
  const canDecide = hasPermission(PERMISSIONS.ATTENDANCE_APPROVE);

  const [items, setItems] = useState<AR[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState("");
  const [form, setForm] = useState({
    employeeId: "", date: "", reason: "MISSED_PUNCH",
    toStatus: "present", toCheckIn: "", toCheckOut: "", note: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await regularizationApi.list(
        statusFilter ? { status: statusFilter } : {},
      );
      setItems(res.data?.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    hrEmployeeApi
      .list({ limit: 200 })
      .then((r) => setEmployees(r.data?.items || []))
      .catch(() => setEmployees([]));
  }, []);

  const submit = async () => {
    setSaving(true);
    setModalErr("");
    try {
      await regularizationApi.create(form);
      setOpen(false);
      setForm({
        employeeId: "", date: "", reason: "MISSED_PUNCH",
        toStatus: "present", toCheckIn: "", toCheckOut: "", note: "",
      });
      load();
    } catch (err: unknown) {
      const e = err as { data?: { hint?: string }; message?: string };
      setModalErr(e.data?.hint || e.message || "Failed to raise the request");
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: string, action: "approve" | "reject") => {
    try {
      if (action === "approve") await regularizationApi.approve(id);
      else await regularizationApi.reject(id);
      load();
    } catch (err: unknown) {
      const e = err as { data?: { hint?: string }; message?: string };
      setError(e.data?.hint || e.message || "Failed");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Attendance Regularization"
        subtitle="Corrections to past attendance — requested, then approved, with a full trail"
        actions={
          canRequest && (
            <Button onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>
              Raise Correction
            </Button>
          )
        }
      />
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48">
          <option value="">All requests</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <span className="text-sm text-gray-500">{items.length} request(s)</span>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Employee</Th><Th>Date</Th><Th>Reason</Th>
            <Th>From</Th><Th>To</Th><Th>Status</Th><Th></Th>
          </THead>
          <TBody>
            {loading ? (
              <TableState colSpan={7}>Loading…</TableState>
            ) : items.length === 0 ? (
              <TableState colSpan={7}>Nothing here.</TableState>
            ) : (
              items.map((r) => (
                <TR key={r._id}>
                  <Td>
                    <span className="font-medium text-gray-900">
                      {r.employeeId?.fullName || "Employee"}
                    </span>
                    <span className="ml-2 font-mono text-xs text-gray-400">
                      {r.employeeId?.employeeCode}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {new Date(r.date).toLocaleDateString("en-IN")}
                  </Td>
                  <Td className="text-xs">
                    {REASONS.find((x) => x.v === r.reason)?.l || r.reason}
                    {r.note && <div className="text-gray-400">{r.note}</div>}
                  </Td>
                  <Td className="text-xs text-gray-500">
                    {label(r.fromStatus) || "No record"}
                    {(r.fromCheckIn || r.fromCheckOut) && (
                      <div>{r.fromCheckIn || "—"} → {r.fromCheckOut || "—"}</div>
                    )}
                  </Td>
                  <Td className="text-xs">
                    <span className="font-medium text-gray-900">{label(r.toStatus)}</span>
                    {(r.toCheckIn || r.toCheckOut) && (
                      <div className="text-gray-500">{r.toCheckIn || "—"} → {r.toCheckOut || "—"}</div>
                    )}
                  </Td>
                  <Td><Badge tone={tone[r.status] || "neutral"} dot>{r.status}</Badge></Td>
                  <Td className="text-right whitespace-nowrap">
                    {canDecide && r.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" className="px-2 text-emerald-600 hover:bg-emerald-50" title="Approve" aria-label="Approve" onClick={() => decide(r._id, "approve")}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="px-2 text-red-600 hover:bg-red-50" title="Reject" aria-label="Reject" onClick={() => decide(r._id, "reject")}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Raise an attendance correction"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Submitting…" : "Submit for approval"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {modalErr && <Alert tone="danger">{modalErr}</Alert>}
          <p className="text-sm text-gray-500">
            Approving this rewrites the day and the hours computed from it, so
            it needs a separate approval.
          </p>
          <Field label="Employee *">
            <Select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">— Select —</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.fullName} ({e.employeeCode})
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Reason">
              <Select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                {REASONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </Select>
            </Field>
            <Field label="Correct status *">
              <Select value={form.toStatus} onChange={(e) => setForm({ ...form, toStatus: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </Select>
            </Field>
            <Field label="Check in" hint="Leave blank if not applicable.">
              <Input type="time" value={form.toCheckIn} onChange={(e) => setForm({ ...form, toCheckIn: e.target.value })} />
            </Field>
            <Field label="Check out">
              <Input type="time" value={form.toCheckOut} onChange={(e) => setForm({ ...form, toCheckOut: e.target.value })} />
            </Field>
          </div>
          <Field label="Note" hint="Why the original record was wrong.">
            <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

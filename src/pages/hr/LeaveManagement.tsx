import { useCallback, useEffect, useState } from "react";
import { Check, X, Plus } from "lucide-react";
import { leaveApi, hrEmployeeApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import {
  PageHeader, Button, Select, Table, THead, TBody, TR, Th, Td, TableState,
  Badge, Modal, Field, Input, Textarea, Alert,
} from "../../components/ui";

interface LeaveType { _id: string; name: string; code: string; annualQuota: number; isPaid: boolean; isActive: boolean }
interface LeaveRequest {
  _id: string;
  employeeId?: { fullName: string; employeeCode: string };
  leaveTypeId?: { name: string; code: string };
  fromDate: string;
  toDate: string;
  days: number;
  reason?: string;
  status: string;
}

const reqTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  approved: "success", pending: "warning", rejected: "danger", cancelled: "neutral",
};

export default function LeaveManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.LEAVE_MANAGE);
  const canApprove = hasPermission(PERMISSIONS.LEAVE_APPROVE);

  const [tab, setTab] = useState<"requests" | "types">("requests");
  const [statusFilter, setStatusFilter] = useState("");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(false);

  // create-request modal
  const [showReq, setShowReq] = useState(false);
  const [employees, setEmployees] = useState<{ _id: string; fullName: string; employeeCode: string }[]>([]);
  const [reqForm, setReqForm] = useState({ employeeId: "", leaveTypeId: "", fromDate: "", toDate: "", reason: "" });
  const [reqError, setReqError] = useState("");

  // type modal
  const [showType, setShowType] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState({ name: "", code: "", annualQuota: 0, isPaid: true });
  const [typeError, setTypeError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await leaveApi.listRequests(params);
      setRequests(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadTypes = useCallback(async () => {
    const res = await leaveApi.listTypes();
    setTypes(res.data?.items || []);
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    if (tab === "requests") loadRequests();
  }, [tab, loadRequests]);

  const openReq = async () => {
    setReqError("");
    setReqForm({ employeeId: "", leaveTypeId: "", fromDate: "", toDate: "", reason: "" });
    if (employees.length === 0) {
      const res = await hrEmployeeApi.list({ status: "active", limit: 200 });
      setEmployees(res.data?.items || []);
    }
    setShowReq(true);
  };

  const submitReq = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqError("");
    if (!reqForm.employeeId || !reqForm.leaveTypeId || !reqForm.fromDate || !reqForm.toDate) {
      setReqError("All fields except reason are required.");
      return;
    }
    try {
      await leaveApi.createRequest(reqForm);
      setShowReq(false);
      loadRequests();
    } catch (err: any) {
      setReqError(err.message || "Failed to submit");
    }
  };

  const decide = async (id: string, action: "approve" | "reject") => {
    try {
      if (action === "approve") await leaveApi.approve(id);
      else await leaveApi.reject(id);
      loadRequests();
    } catch (err: any) {
      alert(err.message || "Failed");
    }
  };

  const openType = (t?: LeaveType) => {
    setTypeError("");
    if (t) {
      setEditingType(t._id);
      setTypeForm({ name: t.name, code: t.code, annualQuota: t.annualQuota, isPaid: t.isPaid });
    } else {
      setEditingType(null);
      setTypeForm({ name: "", code: "", annualQuota: 0, isPaid: true });
    }
    setShowType(true);
  };

  const submitType = async (e: React.FormEvent) => {
    e.preventDefault();
    setTypeError("");
    if (!typeForm.name.trim() || !typeForm.code.trim()) {
      setTypeError("Name and code are required.");
      return;
    }
    try {
      await leaveApi.saveType(typeForm, editingType || undefined);
      setShowType(false);
      loadTypes();
    } catch (err: any) {
      setTypeError(err.message || "Failed to save");
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Leave Management"
        subtitle="Leave requests, approvals & leave types"
        actions={
          tab === "requests" && canManage ? (
            <Button onClick={openReq} icon={<Plus className="h-4 w-4" />}>New Request</Button>
          ) : tab === "types" && canManage ? (
            <Button onClick={() => openType()} icon={<Plus className="h-4 w-4" />}>Add Leave Type</Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-2">
        <Button variant={tab === "requests" ? "primary" : "secondary"} size="sm" onClick={() => setTab("requests")}>Requests</Button>
        <Button variant={tab === "types" ? "primary" : "secondary"} size="sm" onClick={() => setTab("types")}>Leave Types</Button>
        {tab === "requests" && (
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ml-auto w-44 capitalize">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        )}
      </div>

      {tab === "requests" ? (
        <Table>
          <THead>
            <Th>Employee</Th><Th>Type</Th><Th>From → To</Th><Th>Days</Th><Th>Status</Th><Th className="text-right">Actions</Th>
          </THead>
          <TBody>
            {loading ? (
              <TableState colSpan={6}>Loading…</TableState>
            ) : requests.length === 0 ? (
              <TableState colSpan={6}>No leave requests.</TableState>
            ) : (
              requests.map((r) => (
                <TR key={r._id}>
                  <Td className="font-medium text-gray-900">
                    {r.employeeId?.fullName || "—"}
                    <div className="text-xs text-gray-400">{r.employeeId?.employeeCode}</div>
                  </Td>
                  <Td>{r.leaveTypeId?.code || "—"}</Td>
                  <Td className="text-xs">
                    {new Date(r.fromDate).toLocaleDateString("en-IN")} → {new Date(r.toDate).toLocaleDateString("en-IN")}
                  </Td>
                  <Td>{r.days}</Td>
                  <Td><Badge tone={reqTone[r.status] || "neutral"}>{r.status}</Badge></Td>
                  <Td className="text-right whitespace-nowrap">
                    {canApprove && r.status === "pending" && (
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
      ) : (
        <Table>
          <THead>
            <Th>Code</Th><Th>Name</Th><Th>Annual Quota</Th><Th>Paid</Th><Th className="text-right">Actions</Th>
          </THead>
          <TBody>
            {types.length === 0 ? (
              <TableState colSpan={5}>No leave types.</TableState>
            ) : (
              types.map((t) => (
                <TR key={t._id}>
                  <Td className="font-mono text-xs">{t.code}</Td>
                  <Td className="font-medium text-gray-900">{t.name}</Td>
                  <Td>{t.annualQuota}</Td>
                  <Td>{t.isPaid ? <Badge tone="success">Paid</Badge> : <Badge tone="neutral">Unpaid</Badge>}</Td>
                  <Td className="text-right">
                    {canManage && (
                      <Button size="sm" variant="ghost" onClick={() => openType(t)}>Edit</Button>
                    )}
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      )}

      {/* New request modal */}
      <Modal
        open={showReq}
        onClose={() => setShowReq(false)}
        title="New Leave Request"
        footer={<><Button variant="secondary" onClick={() => setShowReq(false)}>Cancel</Button><Button onClick={submitReq}>Submit</Button></>}
      >
        <form onSubmit={submitReq} className="space-y-3">
          {reqError && <Alert tone="danger">{reqError}</Alert>}
          <Field label="Employee *">
            <Select value={reqForm.employeeId} onChange={(e) => setReqForm({ ...reqForm, employeeId: e.target.value })}>
              <option value="">Select…</option>
              {employees.map((em) => <option key={em._id} value={em._id}>{em.employeeCode} — {em.fullName}</option>)}
            </Select>
          </Field>
          <Field label="Leave type *">
            <Select value={reqForm.leaveTypeId} onChange={(e) => setReqForm({ ...reqForm, leaveTypeId: e.target.value })}>
              <option value="">Select…</option>
              {types.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.code})</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From *"><Input type="date" value={reqForm.fromDate} onChange={(e) => setReqForm({ ...reqForm, fromDate: e.target.value })} /></Field>
            <Field label="To *"><Input type="date" value={reqForm.toDate} onChange={(e) => setReqForm({ ...reqForm, toDate: e.target.value })} /></Field>
          </div>
          <Field label="Reason"><Textarea rows={2} value={reqForm.reason} onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })} /></Field>
        </form>
      </Modal>

      {/* Leave type modal */}
      <Modal
        open={showType}
        onClose={() => setShowType(false)}
        title={editingType ? "Edit Leave Type" : "Add Leave Type"}
        footer={<><Button variant="secondary" onClick={() => setShowType(false)}>Cancel</Button><Button onClick={submitType}>{editingType ? "Update" : "Create"}</Button></>}
      >
        <form onSubmit={submitType} className="space-y-3">
          {typeError && <Alert tone="danger">{typeError}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *"><Input value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} /></Field>
            <Field label="Code *"><Input value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })} disabled={!!editingType} /></Field>
            <Field label="Annual quota"><Input type="number" value={typeForm.annualQuota} onChange={(e) => setTypeForm({ ...typeForm, annualQuota: Number(e.target.value) })} /></Field>
            <Field label="Paid leave">
              <Select value={typeForm.isPaid ? "yes" : "no"} onChange={(e) => setTypeForm({ ...typeForm, isPaid: e.target.value === "yes" })}>
                <option value="yes">Paid</option><option value="no">Unpaid (LOP)</option>
              </Select>
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, X, Plus, Undo2 } from "lucide-react";
import { leaveApi, hrEmployeeApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import Pagination from "../../components/Pagination";
import {
  PageHeader, Button, Select, Table, THead, TBody, TR, Th, Td, TableState,
  Badge, Modal, Field, Input, Textarea, Alert, Card,
} from "../../components/ui";
import { dialog } from "../../services/dialog";

interface LeaveType {
  _id: string;
  name: string;
  code: string;
  annualQuota: number;
  isPaid: boolean;
  isActive: boolean;
  /** "monthly" earns 1/12 per completed month; "annual" grants it up front. */
  accrual?: "annual" | "monthly";
  carryForward?: boolean;
  /** 0 with carryForward on means uncapped. */
  maxCarryForward?: number;
}
interface LeaveRequest {
  _id: string;
  subjectType?: "hr_employee" | "ambulance_staff";
  subjectName?: string;
  subjectRef?: string;
  typeName?: string;
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

  const [tab, setTab] = useState<"requests" | "types" | "balances">("requests");

  /**
   * One person's leave, end to end.
   *
   * Until now a balance existed only once someone had taken leave, and the
   * only place it ever appeared was a generic report. Entitlement, what was
   * carried in, what is pending and what is left now live on the page where
   * leave is actually decided.
   */
  const [balYear, setBalYear] = useState(new Date().getFullYear());
  const [balEmployee, setBalEmployee] = useState("");
  const [sheet, setSheet] = useState<any | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [balMsg, setBalMsg] = useState("");
  const [balErr, setBalErr] = useState("");
  const [balBusy, setBalBusy] = useState(false);

  const loadSheet = useCallback(async (employeeId: string, year: number) => {
    if (!employeeId) {
      setSheet(null);
      return;
    }
    setSheetLoading(true);
    setBalErr("");
    try {
      const res = await leaveApi.employeeLeave(employeeId, year);
      setSheet(res.data);
    } catch (e) {
      setSheet(null);
      setBalErr(e instanceof Error ? e.message : "Could not load this person's leave.");
    } finally {
      setSheetLoading(false);
    }
  }, []);

  const syncAll = async () => {
    setBalBusy(true);
    setBalErr("");
    setBalMsg("");
    try {
      const res = await leaveApi.syncBalances({ year: balYear });
      setBalMsg(res.message || "Entitlement updated.");
      if (balEmployee) await loadSheet(balEmployee, balYear);
    } catch (e) {
      setBalErr(e instanceof Error ? e.message : "Could not update entitlement.");
    } finally {
      setBalBusy(false);
    }
  };

  const rollover = async () => {
    if (
      !(await dialog.confirm({
        title: `Carry ${balYear} balances into ${balYear + 1}?`,
        message:
          "Unused days roll over for the leave types that allow it, up to each type's cap. Types without carry-forward lapse. Safe to run again — it sets next year's carried-forward rather than adding to it.",
        confirmLabel: "Carry forward",
      }))
    )
      return;
    setBalBusy(true);
    setBalErr("");
    setBalMsg("");
    try {
      const res = await leaveApi.rollover({ fromYear: balYear, toYear: balYear + 1 });
      setBalMsg(res.message || "Balances carried forward.");
    } catch (e) {
      setBalErr(e instanceof Error ? e.message : "Could not carry the balances forward.");
    } finally {
      setBalBusy(false);
    }
  };
  // In the URL so the HR dashboard's "Pending Leave Requests" card can open
  // this page already showing the pending ones.
  const [params, setParams] = useSearchParams();
  const statusFilter = params.get("status") || "";
  const setStatusFilter = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("status", value);
    else next.delete("status");
    setParams(next, { replace: true });
  };
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  // The request form must offer every leave type, not whichever page of the
  // Leave Types tab happens to be open — so it has its own fetch.
  const [typeOptions, setTypeOptions] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(false);

  // create-request modal
  const [showReq, setShowReq] = useState(false);
  const [employees, setEmployees] = useState<{ _id: string; fullName: string; employeeCode: string }[]>([]);
  const [reqForm, setReqForm] = useState({ employeeId: "", leaveTypeId: "", fromDate: "", toDate: "", reason: "" });
  const [reqError, setReqError] = useState("");

  // type modal
  const [showType, setShowType] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState({
    name: "",
    code: "",
    annualQuota: 0,
    isPaid: true,
    accrual: "annual" as "annual" | "monthly",
    carryForward: false,
    maxCarryForward: 0,
  });
  const [typeError, setTypeError] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [typePage, setTypePage] = useState(1);
  const [typeTotal, setTypeTotal] = useState(0);
  const TYPE_LIMIT = 25;

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (statusFilter) params.status = statusFilter;
      const res = await leaveApi.listRequests(params);
      setRequests(res.data?.items || []);
      setTotal(res.data?.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, limit]);

  const loadTypes = useCallback(async () => {
    const res = await leaveApi.listTypes({ page: typePage, limit: TYPE_LIMIT });
    setTypes(res.data?.items || []);
    setTypeTotal(res.data?.pagination?.total ?? 0);
  }, [typePage]);

  const loadTypeOptions = useCallback(async () => {
    const res = await leaveApi.listTypes({ limit: 100 });
    setTypeOptions(res.data?.items || []);
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    loadTypeOptions();
  }, [loadTypeOptions]);

  useEffect(() => {
    if (tab === "requests") loadRequests();
  }, [tab, loadRequests]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, limit]);

  const loadEmployees = useCallback(async () => {
    const res = await hrEmployeeApi.list({ status: "active", limit: 200 });
    setEmployees(res.data?.items || []);
  }, []);

  const openReq = async () => {
    setReqError("");
    setReqForm({ employeeId: "", leaveTypeId: "", fromDate: "", toDate: "", reason: "" });
    if (employees.length === 0) await loadEmployees();
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

  const decide = async (
    id: string,
    action: "approve" | "reject" | "cancel",
    overrideBalance = false,
  ) => {
    try {
      if (action === "approve") await leaveApi.approve(id, undefined, overrideBalance);
      else if (action === "reject") await leaveApi.reject(id);
      else await leaveApi.cancel(id);
      loadRequests();
    } catch (err: any) {
      // Out of quota: the server refuses rather than letting the balance go
      // negative behind HR's back. Offer the override explicitly.
      if (err?.data?.requiresOverride && action === "approve") {
        if (
          await dialog.confirm({
            title: "Insufficient leave balance",
            message: `${err.data.hint || "This employee has no balance left"}.\n\nApproving anyway will take the balance negative.`,
            confirmLabel: "Approve anyway",
            tone: "danger",
          })
        ) {
          return decide(id, "approve", true);
        }
        return;
      }
      void dialog.alert(err?.data?.hint || err.message || "Failed");
    }
  };

  const cancelLeave = async (id: string) => {
    if (
      await dialog.confirm({ message: "Cancel this approved leave?\n\nThe leave days will be removed from attendance and the balance handed back.", confirmLabel: "Yes, cancel", cancelLabel: "Keep it", tone: "danger" },)
    ) {
      decide(id, "cancel");
    }
  };

  const openType = (t?: LeaveType) => {
    setTypeError("");
    if (t) {
      setEditingType(t._id);
      setTypeForm({
        name: t.name,
        code: t.code,
        annualQuota: t.annualQuota,
        isPaid: t.isPaid,
        accrual: t.accrual || "annual",
        carryForward: !!t.carryForward,
        maxCarryForward: t.maxCarryForward || 0,
      });
    } else {
      setEditingType(null);
      setTypeForm({
        name: "",
        code: "",
        annualQuota: 0,
        isPaid: true,
        accrual: "annual",
        carryForward: false,
        maxCarryForward: 0,
      });
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
        <Button
          variant={tab === "balances" ? "primary" : "secondary"}
          size="sm"
          onClick={() => {
            setTab("balances");
            if (employees.length === 0) loadEmployees();
          }}
        >
          Balances &amp; History
        </Button>
        {tab === "requests" && (
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ml-auto w-44 capitalize">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        )}
        {tab === "requests" && (
          <Select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-auto"
            aria-label="Rows per page"
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </Select>
        )}
      </div>

      {tab === "requests" ? (
        <Table>
          <THead>
            <Th>Person</Th><Th>Kind</Th><Th>Type</Th><Th>From → To</Th><Th>Days</Th><Th>Status</Th><Th className="text-right">Actions</Th>
          </THead>
          <TBody>
            {loading ? (
              <TableState colSpan={7}>Loading…</TableState>
            ) : requests.length === 0 ? (
              <TableState colSpan={7}>No leave requests.</TableState>
            ) : (
              requests.map((r) => (
                <TR key={r._id}>
                  <Td className="font-medium text-gray-900">
                    {r.subjectName || r.employeeId?.fullName || "—"}
                    <div className="text-xs text-gray-400">{r.subjectRef || r.employeeId?.employeeCode}</div>
                  </Td>
                  <Td>
                    <Badge tone={r.subjectType === "ambulance_staff" ? "info" : "neutral"}>
                      {r.subjectType === "ambulance_staff" ? "Ambulance" : "Employee"}
                    </Badge>
                  </Td>
                  <Td>{r.typeName || r.leaveTypeId?.code || "—"}</Td>
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
                    {canApprove && r.status === "approved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-2 text-amber-600 hover:bg-amber-50"
                        title="Cancel this leave"
                        aria-label="Cancel leave"
                        onClick={() => cancelLeave(r._id)}
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
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

      {tab === "balances" && (
        <div className="space-y-4">
          {balErr && <Alert tone="danger">{balErr}</Alert>}
          {balMsg && <Alert tone="success">{balMsg}</Alert>}

          <div className="flex flex-wrap items-end gap-3">
            <Field label="Employee" className="w-72">
              <Select
                value={balEmployee}
                onChange={(e) => {
                  setBalEmployee(e.target.value);
                  loadSheet(e.target.value, balYear);
                }}
              >
                <option value="">Choose an employee…</option>
                {employees.map((em) => (
                  <option key={em._id} value={em._id}>
                    {em.employeeCode} — {em.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Year" className="w-32">
              <Select
                value={String(balYear)}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setBalYear(y);
                  loadSheet(balEmployee, y);
                }}
              >
                {[0, 1, 2].map((back) => {
                  const y = new Date().getFullYear() - back;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </Select>
            </Field>
            {canManage && (
              <>
                <Button variant="secondary" disabled={balBusy} onClick={syncAll}>
                  {balBusy ? "Working…" : "Update entitlement"}
                </Button>
                <Button variant="secondary" disabled={balBusy} onClick={rollover}>
                  Carry forward to {balYear + 1}
                </Button>
              </>
            )}
          </div>

          {!balEmployee && (
            <p className="text-sm text-gray-500">
              Pick someone to see what they are entitled to, what they have
              taken and what is left.
            </p>
          )}
          {sheetLoading && <p className="text-sm text-gray-500">Loading…</p>}

          {sheet && !sheetLoading && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  { label: "Entitled", value: sheet.totals.entitled, tone: "text-gray-900" },
                  { label: "Taken", value: sheet.totals.used, tone: "text-gray-900" },
                  { label: "Balance", value: sheet.totals.balance, tone: "text-green-700" },
                  { label: "Awaiting decision", value: sheet.totals.pending, tone: "text-amber-600" },
                  { label: "Unpaid days", value: sheet.totals.unpaidDays, tone: "text-red-600" },
                ].map((s) => (
                  <Card key={s.label} className="p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500">{s.label}</div>
                    <div className={`mt-1 text-2xl font-semibold ${s.tone}`}>{s.value}</div>
                  </Card>
                ))}
              </div>

              <Table>
                <THead>
                  <Th>Leave type</Th><Th>Paid</Th><Th>Quota</Th><Th>Earned</Th>
                  <Th>Carried in</Th><Th>Taken</Th><Th>Pending</Th><Th>Balance</Th>
                </THead>
                <TBody>
                  {sheet.entitlements.map((e: any) => (
                    <TR key={e.leaveTypeId}>
                      <Td>
                        <div className="font-medium text-gray-900">{e.name}</div>
                        <div className="font-mono text-[11px] text-gray-400">
                          {e.code}
                          {e.accrual === "monthly" ? " · accrues monthly" : ""}
                        </div>
                      </Td>
                      <Td>{e.isPaid ? <Badge tone="success">Paid</Badge> : <Badge tone="neutral">Unpaid</Badge>}</Td>
                      <Td className="text-gray-500">{e.annualQuota}</Td>
                      {/* Earned, not the headline quota — a mid-year joiner
                          has not earned a full year of it. */}
                      <Td>{e.allocated}</Td>
                      <Td>{e.carriedForward || "—"}</Td>
                      <Td>{e.used}</Td>
                      <Td className={e.pending ? "text-amber-600" : "text-gray-400"}>
                        {e.pending || "—"}
                      </Td>
                      <Td className={e.balance < 0 ? "font-semibold text-red-600" : "font-semibold"}>
                        {e.balance}
                      </Td>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  {sheet.year} history
                </h3>
                <Table>
                  <THead>
                    <Th>Type</Th><Th>From → To</Th><Th>Days</Th><Th>Paid</Th>
                    <Th>Status</Th><Th>Reason</Th>
                  </THead>
                  <TBody>
                    {sheet.history.length === 0 ? (
                      <TableState colSpan={6}>No leave taken this year.</TableState>
                    ) : (
                      sheet.history.map((h: any) => (
                        <TR key={h._id}>
                          <Td>{h.leaveTypeId?.name || h.leaveTypeName || "—"}</Td>
                          <Td className="whitespace-nowrap text-xs">
                            {new Date(h.fromDate).toLocaleDateString("en-IN")} →{" "}
                            {new Date(h.toDate).toLocaleDateString("en-IN")}
                          </Td>
                          <Td>{h.days}</Td>
                          <Td>
                            {h.leaveTypeId?.isPaid === false ? (
                              <Badge tone="neutral">Unpaid</Badge>
                            ) : (
                              <Badge tone="success">Paid</Badge>
                            )}
                          </Td>
                          <Td className="capitalize">{h.status}</Td>
                          <Td className="text-xs text-gray-500">{h.reason || "—"}</Td>
                        </TR>
                      ))
                    )}
                  </TBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "requests" ? (
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          label="requests"
          onPageChange={setPage}
        />
      ) : (
        <Pagination
          page={typePage}
          totalPages={Math.max(1, Math.ceil(typeTotal / TYPE_LIMIT))}
          total={typeTotal}
          label="leave types"
          onPageChange={setTypePage}
        />
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
              {typeOptions.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.code})</option>)}
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
            <Field label="Annual quota" hint="Days a full year on the rolls earns"><Input type="number" value={typeForm.annualQuota} onChange={(e) => setTypeForm({ ...typeForm, annualQuota: Number(e.target.value) })} /></Field>
            <Field
              label="How it is earned"
              hint="Monthly suits earned leave — four months in has earned four twelfths, not a year"
            >
              <Select
                value={typeForm.accrual}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, accrual: e.target.value as "annual" | "monthly" })
                }
              >
                <option value="annual">All at once, on 1 January</option>
                <option value="monthly">Accrues each completed month</option>
              </Select>
            </Field>
            <Field label="Unused days carry into next year">
              <Select
                value={typeForm.carryForward ? "yes" : "no"}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, carryForward: e.target.value === "yes" })
                }
              >
                <option value="no">No — they lapse</option>
                <option value="yes">Yes</option>
              </Select>
            </Field>
            {typeForm.carryForward && (
              <Field label="Most that can carry over" hint="0 means no cap">
                <Input
                  type="number"
                  min={0}
                  value={typeForm.maxCarryForward}
                  onChange={(e) =>
                    setTypeForm({ ...typeForm, maxCarryForward: Number(e.target.value) })
                  }
                />
              </Field>
            )}
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

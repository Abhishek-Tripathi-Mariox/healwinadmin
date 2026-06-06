import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Eye } from "lucide-react";
import {
  hrEmployeeApi,
  departmentApi,
  designationApi,
  employmentTypeApi,
} from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import {
  PageHeader, Button, SearchInput, Select, Table, THead, TBody, TR, Th, Td,
  TableState, Badge, Modal, Field, Input, Alert,
} from "../../components/ui";

interface Ref { _id: string; name: string }
interface Employee {
  _id: string;
  employeeCode: string;
  fullName: string;
  email?: string;
  phone?: string;
  status: string;
  joiningDate: string;
  departmentId?: Ref;
  designationId?: Ref;
  employmentTypeId?: Ref;
}

const STATUSES = ["active", "on_leave", "inactive", "terminated"];
const statusTone: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  active: "success",
  on_leave: "warning",
  inactive: "neutral",
  terminated: "danger",
};

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  gender: "male",
  dob: "",
  address: "",
  joiningDate: "",
  departmentId: "",
  designationId: "",
  employmentTypeId: "",
  status: "active",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  pan: "",
  aadhaar: "",
  uan: "",
  // salary structure
  ctcAnnual: 0,
  basic: 0,
  hra: 0,
  conveyance: 0,
  medical: 0,
  specialAllowance: 0,
  pfApplicable: true,
  esiApplicable: true,
  ptApplicable: true,
};

export default function EmployeeManagement() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.EMPLOYEES_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.EMPLOYEES_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.EMPLOYEES_DELETE);

  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [departments, setDepartments] = useState<Ref[]>([]);
  const [designations, setDesignations] = useState<Ref[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<Ref[]>([]);

  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      const res = await hrEmployeeApi.list(params);
      setItems(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Master data for dropdowns (load once).
  useEffect(() => {
    departmentApi.getAll({ status: "active" }).then((r) =>
      setDepartments(r.data?.items || r.data || []),
    );
    designationApi.getAll({ status: "active" }).then((r) =>
      setDesignations(r.data?.items || r.data || []),
    );
    employmentTypeApi.getAll({ status: "active" }).then((r) =>
      setEmploymentTypes(r.data?.items || r.data || []),
    );
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setShow(true);
  };

  const openEdit = async (e: Employee) => {
    setError("");
    setEditingId(e._id);
    const res = await hrEmployeeApi.detail(e._id);
    const emp = res.data?.employee;
    const s = emp?.salaryStructure || {};
    setForm({
      ...emptyForm,
      fullName: emp.fullName || "",
      email: emp.email || "",
      phone: emp.phone || "",
      gender: emp.gender || "male",
      dob: emp.dob ? emp.dob.substring(0, 10) : "",
      address: emp.address || "",
      joiningDate: emp.joiningDate ? emp.joiningDate.substring(0, 10) : "",
      departmentId: emp.departmentId?._id || emp.departmentId || "",
      designationId: emp.designationId?._id || emp.designationId || "",
      employmentTypeId: emp.employmentTypeId?._id || emp.employmentTypeId || "",
      status: emp.status || "active",
      bankName: emp.bankName || "",
      accountNumber: emp.accountNumber || "",
      ifsc: emp.ifsc || "",
      pan: emp.pan || "",
      aadhaar: emp.aadhaar || "",
      uan: emp.uan || "",
      ctcAnnual: s.ctcAnnual || 0,
      basic: s.basic || 0,
      hra: s.hra || 0,
      conveyance: s.conveyance || 0,
      medical: s.medical || 0,
      specialAllowance: s.specialAllowance || 0,
      pfApplicable: s.pfApplicable !== false,
      esiApplicable: s.esiApplicable !== false,
      ptApplicable: s.ptApplicable !== false,
    });
    setShow(true);
  };

  const buildPayload = () => ({
    fullName: form.fullName,
    email: form.email || undefined,
    phone: form.phone || undefined,
    gender: form.gender,
    dob: form.dob || undefined,
    address: form.address || undefined,
    joiningDate: form.joiningDate,
    departmentId: form.departmentId || undefined,
    designationId: form.designationId || undefined,
    employmentTypeId: form.employmentTypeId || undefined,
    status: form.status,
    bankName: form.bankName || undefined,
    accountNumber: form.accountNumber || undefined,
    ifsc: form.ifsc || undefined,
    pan: form.pan || undefined,
    aadhaar: form.aadhaar || undefined,
    uan: form.uan || undefined,
    salaryStructure: {
      ctcAnnual: Number(form.ctcAnnual) || 0,
      basic: Number(form.basic) || 0,
      hra: Number(form.hra) || 0,
      conveyance: Number(form.conveyance) || 0,
      medical: Number(form.medical) || 0,
      specialAllowance: Number(form.specialAllowance) || 0,
      pfApplicable: form.pfApplicable,
      esiApplicable: form.esiApplicable,
      ptApplicable: form.ptApplicable,
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.fullName.trim() || !form.joiningDate) {
      setError("Full name and joining date are required.");
      return;
    }
    try {
      const payload = buildPayload();
      if (editingId) await hrEmployeeApi.update(editingId, payload);
      else await hrEmployeeApi.create(payload);
      setShow(false);
      load();
    } catch (err: any) {
      setError(err.message || "Failed to save employee");
    }
  };

  const onDelete = async (e: Employee) => {
    if (!window.confirm(`Remove ${e.fullName}? This marks them terminated.`)) return;
    await hrEmployeeApi.remove(e._id);
    load();
  };

  const grossMonthly =
    Number(form.basic) + Number(form.hra) + Number(form.conveyance) +
    Number(form.medical) + Number(form.specialAllowance);

  return (
    <div className="p-6">
      <PageHeader
        title="Employees"
        subtitle="Staff records, salary structure & statutory details"
        actions={canCreate ? <Button onClick={openCreate}>+ Add Employee</Button> : undefined}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search name / code / email"
          className="w-full max-w-xs"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44 capitalize">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </Select>
        <Button variant="secondary" onClick={load}>Search</Button>
      </div>

      <Table>
        <THead>
          <Th>Code</Th>
          <Th>Name</Th>
          <Th>Department</Th>
          <Th>Designation</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={6}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={6}>No employees.</TableState>
          ) : (
            items.map((e) => (
              <TR key={e._id}>
                <Td className="font-mono text-xs">{e.employeeCode}</Td>
                <Td className="font-medium text-gray-900">
                  {e.fullName}
                  {e.email && <div className="text-xs text-gray-400">{e.email}</div>}
                </Td>
                <Td>{e.departmentId?.name || "—"}</Td>
                <Td>{e.designationId?.name || "—"}</Td>
                <Td><Badge tone={statusTone[e.status] || "neutral"}>{e.status.replace("_", " ")}</Badge></Td>
                <Td className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" className="px-2" title="View" aria-label="View" onClick={() => navigate(`/admin/employees/${e._id}`)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canUpdate && (
                    <Button size="sm" variant="ghost" className="px-2" title="Edit" aria-label="Edit" onClick={() => openEdit(e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="sm" variant="ghost" className="px-2 text-red-600 hover:bg-red-50" title="Remove" aria-label="Remove" onClick={() => onDelete(e)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title={editingId ? "Edit Employee" : "Add Employee"}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
            <Button onClick={submit}>{editingId ? "Update" : "Create"}</Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Personal</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Full name *"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Gender">
                <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Date of birth"><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
              <Field label="Joining date *"><Input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></Field>
              <Field label="Address" className="col-span-2 md:col-span-3"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Organization</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Department">
                <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                  <option value="">—</option>
                  {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Designation">
                <Select value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })}>
                  <option value="">—</option>
                  {designations.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Employment type">
                <Select value={form.employmentTypeId} onChange={(e) => setForm({ ...form, employmentTypeId: e.target.value })}>
                  <option value="">—</option>
                  {employmentTypes.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="capitalize">
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </Select>
              </Field>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Bank & Statutory</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Bank name"><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></Field>
              <Field label="Account no."><Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></Field>
              <Field label="IFSC"><Input value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} /></Field>
              <Field label="PAN"><Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} /></Field>
              <Field label="Aadhaar"><Input value={form.aadhaar} onChange={(e) => setForm({ ...form, aadhaar: e.target.value })} /></Field>
              <Field label="UAN (PF)"><Input value={form.uan} onChange={(e) => setForm({ ...form, uan: e.target.value })} /></Field>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Salary Structure (monthly) — gross ₹{grossMonthly.toLocaleString("en-IN")}
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="CTC (annual)"><Input type="number" value={form.ctcAnnual} onChange={(e) => setForm({ ...form, ctcAnnual: Number(e.target.value) })} /></Field>
              <Field label="Basic"><Input type="number" value={form.basic} onChange={(e) => setForm({ ...form, basic: Number(e.target.value) })} /></Field>
              <Field label="HRA"><Input type="number" value={form.hra} onChange={(e) => setForm({ ...form, hra: Number(e.target.value) })} /></Field>
              <Field label="Conveyance"><Input type="number" value={form.conveyance} onChange={(e) => setForm({ ...form, conveyance: Number(e.target.value) })} /></Field>
              <Field label="Medical"><Input type="number" value={form.medical} onChange={(e) => setForm({ ...form, medical: Number(e.target.value) })} /></Field>
              <Field label="Special allowance"><Input type="number" value={form.specialAllowance} onChange={(e) => setForm({ ...form, specialAllowance: Number(e.target.value) })} /></Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.pfApplicable} onChange={(e) => setForm({ ...form, pfApplicable: e.target.checked })} /> PF applicable
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.esiApplicable} onChange={(e) => setForm({ ...form, esiApplicable: e.target.checked })} /> ESI applicable
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.ptApplicable} onChange={(e) => setForm({ ...form, ptApplicable: e.target.checked })} /> Professional Tax
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Eye, ExternalLink, KeyRound } from "lucide-react";
import {
  hrEmployeeApi,
  peopleApi,
  ambulanceStaffApi,
  rolesApi,
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
import { dialog } from "../../services/dialog";
import Pagination from "../../components/Pagination";

interface Ref { _id: string; name: string }

/** What the import endpoint reports, for both the preview and the commit. */
interface ImportResult {
  dryRun: boolean;
  totalRows: number;
  wouldCreate?: number;
  created?: number;
  failed: number;
  errors: { row: number; fullName: string; errors: string[] }[];
  createdRows?: { row: number; employeeCode: string; fullName: string }[];
}

/**
 * A row of the unified roster.
 *
 * Ambulance crew, panel admins and ride drivers are HealWin's employees too;
 * they just live in their own collections because each carries things the
 * others do not. `editableAs` says which form opens for this person, so one
 * list can serve all of them without pretending they are the same record.
 */
type PersonType =
  | "hr_employee"
  | "ambulance_driver"
  | "ambulance_attendant"
  | "admin"
  | "doctor"
  | "ride_driver";

interface PersonRow {
  type: PersonType;
  sourceId: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  /** System role from Roles & Permissions. Empty without a panel login. */
  role: string;
  /** A doctor's speciality — free text, not a role. */
  speciality?: string;
  department?: string;
  designation?: string;
  category?: string;
  status: string;
  /** True when this employee can also sign in to the panel. */
  hasPanelLogin?: boolean;
  editableAs: "hr" | "crew" | "admin" | "ride_driver";
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "hr_employee", label: "HR Staff" },
  { value: "ambulance_driver", label: "Ambulance Driver" },
  { value: "ambulance_attendant", label: "Ambulance Attendant" },
  { value: "doctor", label: "Doctor" },
  { value: "admin", label: "Panel Admin" },
  { value: "ride_driver", label: "Ride Driver" },
];

const typeTone: Record<PersonType, "info" | "accent" | "neutral" | "success"> = {
  hr_employee: "info",
  ambulance_driver: "accent",
  ambulance_attendant: "accent",
  doctor: "success",
  admin: "neutral",
  ride_driver: "neutral",
};

const STATUSES = ["active", "on_leave", "inactive", "terminated"];
const statusTone: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  active: "success",
  on_leave: "warning",
  inactive: "neutral",
  terminated: "danger",
};

/** Mirrors EMPLOYEE_CATEGORIES on the backend. */
const CATEGORIES = [
  "clinical",
  "field",
  "ambulance",
  "security",
  "support",
  "administrative",
];

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  gender: "male",
  dob: "",
  address: "",
  joiningDate: "",
  category: "",
  departmentId: "",
  designationId: "",
  employmentTypeId: "",
  linkedAdminId: "",
  roleId: "",
  loginPassword: "",
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

  const [items, setItems] = useState<PersonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;

  // Crew edit, opened straight from this list — the extra details a driver
  // carries (role, licence, whether they are still on the rolls) are theirs
  // alone, so they get their own form rather than being squeezed into the HR
  // one or sending someone off to another screen.
  const [crewEdit, setCrewEdit] = useState<PersonRow | null>(null);

  // Password reset, straight from the roster — otherwise HR has to find the
  // same person again under Team Management.
  const [resetFor, setResetFor] = useState<PersonRow | null>(null);
  const [resetResult, setResetResult] = useState<{
    email?: string;
    temporaryPassword?: string;
    emailSent?: boolean;
    warning?: string;
  } | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  const doReset = async (p: PersonRow) => {
    if (
      !(await dialog.confirm({
        title: `Reset the password for ${p.name}?`,
        message:
          "A new password is generated and emailed to them. They are signed out everywhere, and the old password stops working immediately.",
        confirmLabel: "Reset password",
        tone: "danger",
      }))
    )
      return;
    setResetBusy(true);
    setResetFor(p);
    setResetResult(null);
    try {
      const res = await hrEmployeeApi.resetPassword(p.sourceId);
      setResetResult(res.data);
    } catch (e) {
      setResetFor(null);
      setError(e instanceof Error ? e.message : "Could not reset the password.");
    } finally {
      setResetBusy(false);
    }
  };
  const [loading, setLoading] = useState(false);
  /**
   * Filters live in the URL so the HR dashboard can link straight to a subset
   * ("Active", or one department's headcount) and land on exactly the records
   * behind that number. It also makes the filtered view shareable and
   * survivable across a refresh.
   */
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const departmentId = params.get("departmentId") || "";
  const designationId = params.get("designationId") || "";
  const type = params.get("type") || "";
  const [search, setSearch] = useState(params.get("search") || "");

  /** Update one filter, dropping it from the URL when cleared. */
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setPage(1);
  };

  const [roles, setRoles] = useState<Ref[]>([]);
  /**
   * The login created alongside the employee. Held so the password can be
   * shown once after saving — it is stored hashed and cannot be read back, so
   * if it is not passed on now it is gone.
   */
  const [newLogin, setNewLogin] = useState<{
    email?: string;
    role?: string;
    temporaryPassword?: string;
  } | null>(null);

  const [departments, setDepartments] = useState<Ref[]>([]);
  const [designations, setDesignations] = useState<Ref[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<Ref[]>([]);
  // Admin-panel logins available to link — mainly for doctors, so leave/
  // attendance here actually affects OPD slot availability (see
  // doctor-slots.service.ts#isDoctorOnApprovedLeave).

  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState("");

  // ── Bulk import ──────────────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");

  const resetImport = () => {
    setImportFile(null);
    setPreview(null);
    setImportResult(null);
    setImportError("");
  };

  /** Validate the file without writing anything. */
  const runPreview = async (file: File) => {
    setImportBusy(true);
    setImportError("");
    setPreview(null);
    setImportResult(null);
    try {
      const res = await hrEmployeeApi.importCsv(file, true);
      setPreview(res.data as ImportResult);
    } catch (e) {
      setImportError(
        e instanceof Error ? e.message : "Could not read that file.",
      );
    } finally {
      setImportBusy(false);
    }
  };

  /** Commit the rows that passed validation. */
  const runImport = async () => {
    if (!importFile) return;
    setImportBusy(true);
    setImportError("");
    try {
      const res = await hrEmployeeApi.importCsv(importFile, false);
      setImportResult(res.data as ImportResult);
      setPreview(null);
      await load();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "The import failed.");
    } finally {
      setImportBusy(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query: Record<string, string | number> = { page, limit };
      if (search.trim()) query.q = search.trim();
      if (status) query.status = status;
      if (departmentId) query.departmentId = departmentId;
      if (designationId) query.designationId = designationId;
      if (type) query.type = type;
      const res = await peopleApi.list(query);
      setItems(res.data?.items || []);
      setTotal(res.data?.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, status, departmentId, designationId, type, page]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, departmentId]);

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
    rolesApi
      .getAll()
      .then((r) => setRoles(r.data?.roles || r.data?.items || r.data || []))
      .catch(() => undefined);
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setShow(true);
  };

  const openEdit = async (id: string) => {
    setError("");
    setEditingId(id);
    const res = await hrEmployeeApi.detail(id);
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
      category: emp.category || "",
      departmentId: emp.departmentId?._id || emp.departmentId || "",
      designationId: emp.designationId?._id || emp.designationId || "",
      employmentTypeId: emp.employmentTypeId?._id || emp.employmentTypeId || "",
      linkedAdminId: emp.linkedAdminId?._id || emp.linkedAdminId || "",
      // Their current system role, so the dropdown opens on it rather than
      // blank (which would read as "no access" for someone who has it).
      roleId:
        emp.linkedAdminId?.roleId?._id ||
        emp.linkedAdminId?.roleId ||
        "",
      loginPassword: "",
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
    category: form.category || undefined,
    departmentId: form.departmentId || undefined,
    designationId: form.designationId || undefined,
    employmentTypeId: form.employmentTypeId || undefined,
    linkedAdminId: form.linkedAdminId || undefined,
    // Choosing a role sets it on their login, or creates one if they have
    // none — so nobody has to be entered a second time under Team Management.
    // A password is only offered when there is no login yet.
    ...(form.roleId
      ? {
          roleId: form.roleId,
          ...(hasLogin ? {} : { password: form.loginPassword || undefined }),
        }
      : {}),
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
    if (form.roleId && !hasLogin && !form.email.trim()) {
      setError("An email address is required to create a panel login.");
      return;
    }
    try {
      const payload = buildPayload();
      // A login can now be created from either mode, so both check for one.
      // Shown once — the password is hashed on the server and cannot be
      // fetched again, so it has to be handed over now or reset later.
      const res = editingId
        ? await hrEmployeeApi.update(editingId, payload)
        : await hrEmployeeApi.create(payload);
      if (res?.data?.panelLogin) setNewLogin(res.data.panelLogin);
      setShow(false);
      load();
    } catch (err: any) {
      setError(err.message || "Failed to save employee");
    }
  };

  const onDelete = async (p: PersonRow) => {
    if (!await dialog.confirm({ message: `Remove ${p.name}? This marks them terminated.`, confirmLabel: "Remove", tone: "danger" })) return;
    await hrEmployeeApi.remove(p.sourceId);
    load();
  };

  /**
   * Open the right editor for whoever was clicked.
   *
   * HR records and ambulance crew are both edited here. A panel admin's row
   * and permissions, and a ride driver's onboarding, belong to their own
   * modules — duplicating those forms would mean two places that could
   * disagree about the same person.
   */
  const openPerson = (p: PersonRow) => {
    if (p.editableAs === "hr") return openEdit(p.sourceId);
    if (p.editableAs === "crew") return setCrewEdit(p);
    if (p.editableAs === "admin") return navigate(`/admin/team?highlight=${p.sourceId}`);
    return navigate(`/admin/drivers?highlight=${p.sourceId}`);
  };

  const filtered = !!(search.trim() || status || departmentId || designationId || type);
  // "Nobody works here" and "nothing matches your filter" are different
  // things, and saying the first when the second is true sends someone
  // looking for a data problem that is not there.
  const emptyMessage = filtered
    ? "Nobody matches these filters. Clear them to see everyone."
    : "No people yet. Add an employee, or import a list from CSV.";

  /** Where a row can be looked at in full. */
  const viewPath = (p: PersonRow) =>
    p.editableAs === "hr"
      ? `/admin/employees/${p.sourceId}`
      : p.editableAs === "crew"
        ? `/admin/ambulance-staff/${p.sourceId}`
        : p.editableAs === "admin"
          ? `/admin/team?highlight=${p.sourceId}`
          : `/admin/drivers?highlight=${p.sourceId}`;

  // Whether the person being edited already signs in. Drives whether the role
  // dropdown offers "no access" and whether a password is asked for.
  const hasLogin = !!editingId && !!form.linkedAdminId;

  const grossMonthly =
    Number(form.basic) + Number(form.hra) + Number(form.conveyance) +
    Number(form.medical) + Number(form.specialAllowance);

  return (
    <div className="p-6">
      <PageHeader
        title="Employees"
        subtitle="Everyone who works for HealWin — HR staff, ambulance crew, doctors and panel users"
        actions={
          canCreate ? (
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                Import CSV
              </Button>
              <Button onClick={openCreate}>+ Add Employee</Button>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Select
          value={type}
          onChange={(e) => setFilter("type", e.target.value)}
          className="w-52"
          aria-label="Filter by type"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value || "all"} value={t.value}>{t.label}</option>
          ))}
        </Select>
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search name / code / email"
          className="w-full max-w-xs"
        />
        <Select
          value={status}
          onChange={(e) => setFilter("status", e.target.value)}
          className="w-44 capitalize"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </Select>
        <Select
          value={departmentId}
          onChange={(e) => setFilter("departmentId", e.target.value)}
          className="w-52"
        >
          <option value="">All departments</option>
          {/* Mirrors the dashboard's "Unassigned" group. */}
          <option value="none">Unassigned</option>
          {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </Select>
        <Button variant="secondary" onClick={load}>Search</Button>
        {filtered && (
          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setParams(new URLSearchParams(), { replace: true });
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Table>
        <THead>
          <Th>Code</Th>
          <Th>Name</Th>
          <Th>Type</Th>
          <Th>Role</Th>
          <Th>Designation</Th>
          <Th>Department</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={8}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={8}>{emptyMessage}</TableState>
          ) : (
            items.map((p) => (
              <TR key={`${p.type}:${p.sourceId}`}>
                <Td className="font-mono text-xs">{p.code || "—"}</Td>
                <Td className="font-medium text-gray-900">
                  {p.name}
                  {(p.email || p.phone) && (
                    <div className="text-xs text-gray-400">{p.email || p.phone}</div>
                  )}
                </Td>
                <Td>
                  <Badge tone={typeTone[p.type] || "neutral"}>
                    {TYPE_OPTIONS.find((t) => t.value === p.type)?.label || p.type}
                  </Badge>
                </Td>
                {/* The system role only. Someone with no panel login has
                    none — their job title is the Designation column. */}
                <Td className="text-gray-600">
                  {p.role ? (
                    <span className="inline-flex items-center gap-1.5">
                      {p.role}
                      {p.hasPanelLogin && (
                        <span
                          title="Can sign in to the panel"
                          className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"
                        >
                          login
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </Td>
                <Td className="text-gray-600">
                  {p.designation || p.speciality || (
                    <span className="text-gray-300">—</span>
                  )}
                  {/* A doctor's speciality sits under their designation rather
                      than masquerading as a role, which is where it used to
                      end up. */}
                  {p.designation && p.speciality && (
                    <div className="text-xs text-gray-400">{p.speciality}</div>
                  )}
                </Td>
                <Td>{p.department || "—"}</Td>
                <Td>
                  <Badge tone={statusTone[p.status] || "neutral"}>
                    {p.status.replace("_", " ")}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" className="px-2" title="View" aria-label="View" onClick={() => navigate(viewPath(p))}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canUpdate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      title={
                        p.editableAs === "hr" || p.editableAs === "crew"
                          ? "Edit"
                          : `Managed in ${p.editableAs === "admin" ? "Team Management" : "Drivers"} — opens there`
                      }
                      aria-label="Edit"
                      onClick={() => openPerson(p)}
                    >
                      {p.editableAs === "hr" || p.editableAs === "crew" ? (
                        <Pencil className="h-4 w-4" />
                      ) : (
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  )}
                  {/* Only an HR record is removed from here. Deactivating a
                      driver takes them out of dispatch, which is that
                      module's decision to make. */}
                  {/* Only for people who actually have a login to reset. */}
                  {canUpdate && p.editableAs === "hr" && p.hasPanelLogin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      title="Reset panel password"
                      aria-label="Reset password"
                      onClick={() => doReset(p)}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && p.editableAs === "hr" && (
                    <Button size="sm" variant="ghost" className="px-2 text-red-600 hover:bg-red-50" title="Remove" aria-label="Remove" onClick={() => onDelete(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        label="people"
        onPageChange={setPage}
      />

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
              {/* Category drives where a person may mark attendance (§4.4)
                  and how they group in reports — separate from Department
                  (org structure) and Designation (job title). */}
              <Field label="Category" hint="Clinical, field, ambulance, security, support or administrative.">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">—</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
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
              {/* A role, not a list of account names.
                  Which login row someone is attached to is an implementation
                  detail, and choosing the wrong name from that list silently
                  handed one person another person's permissions. Picking a role
                  sets it on their login, or creates one if they have none. */}
              <Field
                label="Panel role"
                hint={
                  hasLogin
                    ? "Changes the role on their existing login. Remove access from Team Management."
                    : form.roleId
                      ? "A login will be created with this role. An email address is required."
                      : "Leave blank if this person does not sign in to the panel."
                }
              >
                <Select
                  value={form.roleId}
                  onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                >
                  {/* Only offered while they have no login — clearing it would
                      read as "revoke access", which this form does not do. */}
                  {!hasLogin && <option value="">— No panel access —</option>}
                  {roles.map((r) => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </Select>
              </Field>
              {!hasLogin && form.roleId && (
                <Field
                  label="Password"
                  hint="Leave blank and one is generated — you will see it once, right after saving."
                >
                  <Input
                    type="text"
                    value={form.loginPassword}
                    onChange={(e) => setForm({ ...form, loginPassword: e.target.value })}
                    placeholder="Generate automatically"
                  />
                </Field>
              )}
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

      {/* ── Password reset ───────────────────────────────────────────────── */}
      <Modal
        open={!!resetFor}
        onClose={() => { setResetFor(null); setResetResult(null); }}
        title="Password reset"
        subtitle={resetFor?.name}
        size="sm"
        footer={
          <Button onClick={() => { setResetFor(null); setResetResult(null); }}>Done</Button>
        }
      >
        {resetBusy || !resetResult ? (
          <p className="text-sm text-gray-500">Resetting…</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="flex justify-between gap-4 py-1">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-900">{resetResult.email}</span>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <span className="text-gray-500">New password</span>
                <code className="rounded bg-white px-2 py-0.5 font-mono text-sm text-gray-900 ring-1 ring-gray-200">
                  {resetResult.temporaryPassword}
                </code>
              </div>
            </div>
            {resetResult.emailSent ? (
              <Alert tone="success">
                Emailed to them along with the panel address. They have been
                signed out everywhere and must use this password next time.
              </Alert>
            ) : (
              <Alert tone="warning">
                {resetResult.warning ||
                  "The password was reset but the email could not be sent — pass it on another way."}
              </Alert>
            )}
            <p className="text-xs text-gray-400">
              This is the only time it can be shown. If it is lost, reset it
              again.
            </p>
          </div>
        )}
      </Modal>

      {/* ── New panel login ──────────────────────────────────────────────── */}
      <Modal
        open={!!newLogin}
        onClose={() => setNewLogin(null)}
        title="Panel login created"
        subtitle="Pass these on now — the password cannot be shown again"
        size="sm"
        footer={<Button onClick={() => setNewLogin(null)}>Done</Button>}
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="flex justify-between gap-4 py-1">
              <span className="text-gray-500">Role</span>
              <span className="font-medium text-gray-900">{newLogin?.role}</span>
            </div>
            <div className="flex justify-between gap-4 py-1">
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-900">{newLogin?.email}</span>
            </div>
            {newLogin?.temporaryPassword && (
              <div className="flex justify-between gap-4 py-1">
                <span className="text-gray-500">Password</span>
                <code className="rounded bg-white px-2 py-0.5 font-mono text-sm text-gray-900 ring-1 ring-gray-200">
                  {newLogin.temporaryPassword}
                </code>
              </div>
            )}
          </div>
          {newLogin?.temporaryPassword ? (
            <Alert tone="warning">
              This password is stored hashed and cannot be retrieved. Give it to
              them now; if it is lost, reset it from Team Management.
            </Alert>
          ) : (
            <Alert tone="info">
              They sign in with the password you set.
            </Alert>
          )}
        </div>
      </Modal>

      {/* ── Ambulance crew ───────────────────────────────────────────────── */}
      <CrewEditModal
        person={crewEdit}
        onClose={() => setCrewEdit(null)}
        onSaved={() => { setCrewEdit(null); load(); }}
      />

      {/* ── Bulk import ───────────────────────────────────────────────────── */}
      <Modal
        open={importOpen}
        onClose={() => { setImportOpen(false); resetImport(); }}
        title="Import employees from CSV"
        subtitle="Build the list in Excel, save as CSV, and upload it here."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => { setImportOpen(false); resetImport(); }}
            >
              Close
            </Button>
            {preview && (preview.wouldCreate ?? 0) > 0 && (
              <Button onClick={runImport} disabled={importBusy}>
                {importBusy
                  ? "Importing…"
                  : `Import ${preview.wouldCreate} employee${preview.wouldCreate === 1 ? "" : "s"}`}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {importError && <Alert>{importError}</Alert>}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            <p className="mb-2">
              <strong>Full Name</strong> and <strong>Joining Date</strong> are
              required. Department, Designation and Employment Type are matched
              by name and must already exist. Dates can be{" "}
              <code>YYYY-MM-DD</code> or <code>DD/MM/YYYY</code>.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                hrEmployeeApi.downloadImportTemplate().catch((e) =>
                  setImportError(
                    e instanceof Error ? e.message : "Download failed",
                  ),
                )
              }
            >
              Download template
            </Button>
          </div>

          <Field label="CSV file">
            <input
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-healwin-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-healwin-700 hover:file:bg-healwin-100"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setImportFile(f);
                setImportResult(null);
                // Preview immediately — there is no reason to make someone
                // press a second button before seeing what is wrong.
                if (f) runPreview(f);
              }}
            />
          </Field>

          {importBusy && !importResult && (
            <p className="text-sm text-gray-500">Checking the file…</p>
          )}

          {/* Preview — what WOULD happen. Nothing has been written yet. */}
          {preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral">{preview.totalRows} rows read</Badge>
                <Badge tone={preview.wouldCreate ? "success" : "neutral"}>
                  {preview.wouldCreate} ready to import
                </Badge>
                {preview.failed > 0 && (
                  <Badge tone="danger">{preview.failed} with problems</Badge>
                )}
              </div>
              {preview.failed > 0 && (
                <Alert tone="warning">
                  Rows with problems are listed below and will be skipped. Fix
                  them in the spreadsheet and upload again — the ones that are
                  ready can still be imported now.
                </Alert>
              )}
              {preview.errors.length > 0 && <RowErrors rows={preview.errors} />}
            </div>
          )}

          {/* Result — what actually happened. */}
          {importResult && (
            <div className="space-y-3">
              <Alert tone={importResult.created ? "success" : "warning"}>
                {importResult.created
                  ? `${importResult.created} employee${importResult.created === 1 ? "" : "s"} imported.`
                  : "Nothing was imported."}
                {importResult.failed > 0 &&
                  ` ${importResult.failed} row${importResult.failed === 1 ? "" : "s"} were skipped.`}
              </Alert>
              {importResult.errors.length > 0 && (
                <RowErrors rows={importResult.errors} />
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

/** Per-row problems, with the spreadsheet row number so they can be found. */
function RowErrors({
  rows,
}: {
  rows: { row: number; fullName: string; errors: string[] }[];
}) {
  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
      <Table>
        <THead>
          <Th className="w-16">Row</Th>
          <Th>Name</Th>
          <Th>Problem</Th>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.row}>
              <Td className="font-mono text-xs text-gray-500">{r.row}</Td>
              <Td className="text-gray-900">{r.fullName}</Td>
              <Td className="text-xs text-red-600">
                {r.errors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </Td>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/**
 * Ambulance crew, edited from the Employees list.
 *
 * A driver carries details an HR record does not — the seat they crew, their
 * licence, and whether they are still on the rolls — so they get their own
 * small form here rather than being pushed into the HR one or sent off to
 * another screen to be changed.
 *
 * Which provider or hospital operates them is deliberately absent: that
 * decides who a dispatch can be assigned to and who is billed for the shift,
 * and it belongs to Ambulance Operations. The server refuses it here too.
 */
function CrewEditModal({
  person,
  onClose,
  onSaved,
}: {
  person: PersonRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    mobileNumber: "",
    role: "driver",
    licenseNumber: "",
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!person) return;
    setError("");
    setLoading(true);
    ambulanceStaffApi
      .detail(person.sourceId)
      .then((res) => {
        const s = res.data?.staff || res.data?.item || {};
        setForm({
          fullName: s.fullName || person.name,
          mobileNumber: s.mobileNumber || person.phone || "",
          role: s.role || (person.type === "ambulance_attendant" ? "attendant" : "driver"),
          licenseNumber: s.licenseNumber || "",
          isActive: s.isActive !== false,
        });
      })
      .catch(() => {
        // Fall back to what the list already knows, so the form still opens.
        setForm({
          fullName: person.name,
          mobileNumber: person.phone || "",
          role: person.type === "ambulance_attendant" ? "attendant" : "driver",
          licenseNumber: "",
          isActive: person.status === "active",
        });
      })
      .finally(() => setLoading(false));
  }, [person]);

  const save = async () => {
    if (!person) return;
    if (!form.fullName.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await ambulanceStaffApi.update(person.sourceId, {
        fullName: form.fullName.trim(),
        mobileNumber: form.mobileNumber.trim(),
        role: form.role,
        licenseNumber: form.licenseNumber.trim(),
        isActive: form.isActive,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!person}
      onClose={onClose}
      title="Edit ambulance crew"
      subtitle={person?.name}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Name *">
            <Input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mobile">
              <Input
                value={form.mobileNumber}
                onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
              />
            </Field>
            <Field label="Crew role">
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="driver">Driver</option>
                <option value="attendant">Attendant</option>
              </Select>
            </Field>
          </div>
          <Field label="Licence number" hint="Required for drivers before they can be dispatched">
            <Input
              value={form.licenseNumber}
              onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
            />
          </Field>
          <Field
            label="Status"
            hint={
              form.isActive
                ? "On the rolls and available for dispatch."
                : "Off the rolls — they cannot be assigned to a dispatch or sign in to the crew app."
            }
          >
            <Select
              value={form.isActive ? "active" : "inactive"}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === "active" })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          <p className="text-xs text-gray-400">
            Vehicle, provider and duty assignment are managed in Ambulance
            Operations.
          </p>
        </div>
      )}
    </Modal>
  );
}

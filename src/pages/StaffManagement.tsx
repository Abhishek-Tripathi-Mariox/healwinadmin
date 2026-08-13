// src/pages/StaffManagement.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  X,
  Clock,
  Lock,
  Unlock,
  Key,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { staffApi, rolesApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  SearchInput,
  Select,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
  Badge,
  Card,
  Modal,
  Field,
  Input,
} from "../components/ui";

// Types
interface Role {
  _id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  staffCount: number;
  createdAt: string;
}

interface StaffMember {
  _id: string;
  name: string;
  fullName?: string;
  email: string;
  phone: string;
  avatar?: string;
  role: Role;
  roleId?: { _id: string; name: string; permissions: string[] };
  roleName?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  createdBy?: { fullName: string; email: string } | string;
  doctorProfile?: {
    speciality?: string;
    qualification?: string;
    experienceYears?: number;
    consultationFee?: number;
    hospital?: string;
    about?: string;
    teleconsult?: boolean;
    listInApp?: boolean;
  };
}

const StaffManagement: React.FC = () => {
  useAuth(); // For authentication check
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStaff, setTotalStaff] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Staff Modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    phone: "",
    roleId: "",
    password: "",
  });

  // Doctor display profile — shown only when the selected role is "Doctor".
  // This is the single source for the patient app's "Consult a Doctor" list.
  const emptyDoctor = {
    speciality: "",
    qualification: "",
    experienceYears: "",
    consultationFee: "",
    hospital: "",
    about: "",
    teleconsult: true,
    listInApp: true,
  };
  const [docForm, setDocForm] = useState({ ...emptyDoctor });
  const selectedRoleName = roles.find((r) => r._id === staffForm.roleId)?.name;
  const isDoctorRole = selectedRoleName === "Doctor";

  // Reset Password Modal
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordStaff, setResetPasswordStaff] =
    useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Auto-dismiss notifications
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [staffResponse, rolesResponse] = await Promise.all([
        staffApi.getAll({
          page: page as any,
          limit: limit as any,
          search: debouncedSearch || undefined,
          role: roleFilter === "ALL" ? undefined : roleFilter,
          status: statusFilter === "ALL" ? undefined : statusFilter.toLowerCase(),
        }),
        rolesApi.getAll(),
      ]);

      if (staffResponse.success) {
        // Map backend data to frontend format
        const mappedStaff = (staffResponse.data.staff || []).map((s: any) => ({
          ...s,
          name: s.fullName || s.name || "",
          role: s.roleId ||
            s.role || {
              _id: "",
              name: s.roleName || "Unknown",
              permissions: [],
            },
        }));
        setStaffMembers(mappedStaff);
        if (staffResponse.data.pagination) {
          setTotalPages(staffResponse.data.pagination.pages || 1);
          setTotalStaff(staffResponse.data.pagination.total || 0);
        }
      }
      if (rolesResponse.success) {
        setRoles(rolesResponse.data.roles || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounce search so we don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset to page 1 whenever a filter actually changes.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, roleFilter, statusFilter]);

  // Search/role/status are now applied server-side (see fetchData) so every
  // matching record is found across all pages, not just the currently
  // fetched page.
  const filteredStaff = staffMembers;

  const stats = useMemo(
    () => ({
      total: staffMembers.length,
      active: staffMembers.filter((s) => s.isActive).length,
      inactive: staffMembers.filter((s) => !s.isActive).length,
    }),
    [staffMembers],
  );

  const getTimeAgo = (dateString?: string) => {
    if (!dateString) return "Never";
    const now = Date.now();
    const date = new Date(dateString).getTime();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const generateRandomPassword = () => {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleSaveStaff = async () => {
    if (!staffForm.name || !staffForm.email || !staffForm.roleId) {
      setError("Please fill in all required fields");
      return;
    }
    if (staffForm.phone && !/^[6-9]\d{9}$/.test(staffForm.phone.trim())) {
      setError("Phone must be a valid 10-digit mobile number (starting 6-9).");
      return;
    }
    if (!editingStaff && !staffForm.password) {
      setError("Password is required for new staff member");
      return;
    }
    if (!editingStaff && staffForm.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    setError(null);
    // Build the doctor profile only for the Doctor role (numbers coerced).
    const doctorProfile = isDoctorRole
      ? {
          speciality: docForm.speciality,
          qualification: docForm.qualification,
          experienceYears: Number(docForm.experienceYears) || 0,
          consultationFee: Number(docForm.consultationFee) || 0,
          hospital: docForm.hospital,
          about: docForm.about,
          teleconsult: docForm.teleconsult,
          listInApp: docForm.listInApp,
        }
      : undefined;
    try {
      if (editingStaff) {
        await staffApi.update(editingStaff._id, {
          fullName: staffForm.name,
          email: staffForm.email,
          phone: staffForm.phone,
          roleId: staffForm.roleId,
          ...(doctorProfile ? { doctorProfile } : {}),
        });
        setSuccess("Staff member updated successfully");
      } else {
        await staffApi.create({
          fullName: staffForm.name,
          email: staffForm.email,
          phone: staffForm.phone,
          password: staffForm.password,
          roleId: staffForm.roleId,
          ...(doctorProfile ? { doctorProfile } : {}),
        });
        setSuccess("Staff member created successfully");
      }

      setShowStaffModal(false);
      setEditingStaff(null);
      setStaffForm({
        name: "",
        email: "",
        phone: "",
        roleId: "",
        password: "",
      });
      setDocForm({ ...emptyDoctor });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to save staff member");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordStaff) return;

    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await staffApi.resetPassword(resetPasswordStaff._id, newPassword);
      setSuccess(
        `Password reset successfully for ${resetPasswordStaff.name || resetPasswordStaff.fullName}`,
      );
      setShowResetPasswordModal(false);
      setResetPasswordStaff(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  const openResetPasswordModal = (staff: StaffMember) => {
    setResetPasswordStaff(staff);
    setNewPassword("");
    setConfirmPassword("");
    setShowResetPasswordModal(true);
  };

  const handleToggleStaffStatus = async (staffId: string) => {
    try {
      const response = await staffApi.toggleStatus(staffId);
      setSuccess(response.data?.message || "Staff status updated successfully");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to toggle staff status");
    }
  };

  const handleDeleteStaff = async (id: string) => {
    try {
      await staffApi.delete(id);
      setSuccess("Staff member deleted successfully");
      setDeleteConfirm(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to delete staff member");
    }
  };

  const openEditStaffModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setStaffForm({
      name: staff.name || staff.fullName || "",
      email: staff.email || "",
      phone: staff.phone || "",
      roleId: staff.role?._id || "",
      password: "",
    });
    const dp = staff.doctorProfile;
    setDocForm({
      speciality: dp?.speciality || "",
      qualification: dp?.qualification || "",
      experienceYears: dp?.experienceYears != null ? String(dp.experienceYears) : "",
      consultationFee: dp?.consultationFee != null ? String(dp.consultationFee) : "",
      hospital: dp?.hospital || "",
      about: dp?.about || "",
      teleconsult: dp?.teleconsult !== false,
      listInApp: dp?.listInApp !== false,
    });
    setShowStaffModal(true);
  };

  // Helper to get display name
  const getStaffDisplayName = (staff: StaffMember) => {
    return staff.name || staff.fullName || "Unknown";
  };

  const closeStaffModal = () => {
    setShowStaffModal(false);
    setEditingStaff(null);
    setStaffForm({
      name: "",
      email: "",
      phone: "",
      roleId: "",
      password: "",
    });
    setDocForm({ ...emptyDoctor });
  };

  const closeResetPasswordModal = () => {
    setShowResetPasswordModal(false);
    setResetPasswordStaff(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Success/Error Notifications */}
      {success && (
        <div className="fixed z-50 flex items-center gap-3 px-4 py-3 text-green-800 border border-green-200 shadow-lg top-4 right-4 bg-green-50 rounded-xl animate-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="font-medium">{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="ml-2 text-green-600 hover:text-green-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="fixed z-50 flex items-center gap-3 px-4 py-3 text-red-800 border border-red-200 shadow-lg top-4 right-4 bg-red-50 rounded-xl animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="font-medium">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Team Management"
        subtitle="Manage admin staff, roles, and permissions"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Staff</p>
              <p className="mt-1 text-2xl font-bold text-gray-800">
                {stats.total}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {stats.active}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Inactive</p>
              <p className="mt-1 text-2xl font-bold text-gray-600">
                {stats.inactive}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </Card>

      </div>

      {/* Staff list */}
      <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <SearchInput
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[200px]"
            />
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-auto"
            >
              <option value="ALL">All Roles</option>
              {roles.map((role) => (
                <option key={role._id} value={role._id}>
                  {role.name}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-auto"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingStaff(null);
                setStaffForm({
                  name: "",
                  email: "",
                  phone: "",
                  roleId: "",
                  password: "",
                });
                setDocForm({ ...emptyDoctor });
                setShowStaffModal(true);
              }}
            >
              Add Staff
            </Button>
          </div>

          {/* Staff Table */}
          <Table>
            <THead>
              <Th>Staff Member</Th>
              <Th>Role</Th>
              <Th>Contact</Th>
              <Th>Last Login</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </THead>
            <TBody>
              {loading ? (
                <TableState colSpan={6}>Loading...</TableState>
              ) : filteredStaff.length === 0 ? (
                <TableState colSpan={6}>No staff members found</TableState>
              ) : (
                filteredStaff.map((staff) => (
                  <TR key={staff._id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-healwin-100">
                          <span className="font-semibold text-healwin-600">
                            {getStaffDisplayName(staff)
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {getStaffDisplayName(staff)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {staff.email || "No email"}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={staff.role?.isSystem ? "accent" : "info"}>
                        {staff.role?.name || "No Role"}
                      </Badge>
                    </Td>
                    <Td>
                      <p className="text-sm text-gray-600">
                        {staff.phone || "-"}
                      </p>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {getTimeAgo(staff.lastLogin)}
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={staff.isActive ? "success" : "neutral"} dot>
                        {staff.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditStaffModal(staff)}
                          className="p-2 text-gray-400 rounded-lg hover:text-blue-600 hover:bg-blue-50"
                          title="Edit Staff"
                          aria-label="Edit Staff"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openResetPasswordModal(staff)}
                          className="p-2 text-gray-400 rounded-lg hover:text-purple-600 hover:bg-purple-50"
                          title="Reset Password"
                          aria-label="Reset Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStaffStatus(staff._id)}
                          className={`p-2 rounded-lg ${
                            staff.isActive
                              ? "text-gray-400 hover:text-orange-600 hover:bg-orange-50"
                              : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                          }`}
                          title={staff.isActive ? "Deactivate" : "Activate"}
                          aria-label={staff.isActive ? "Deactivate" : "Activate"}
                        >
                          {staff.isActive ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                        </button>
                        {!staff.role?.isSystem && (
                          <button
                            onClick={() =>
                              setDeleteConfirm(staff._id)
                            }
                            className="p-2 text-gray-400 rounded-lg hover:text-red-600 hover:bg-red-50"
                            title="Delete Staff"
                            aria-label="Delete Staff"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </Td>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
      </div>

      {/* Staff Modal */}
      <Modal
        open={showStaffModal}
        onClose={closeStaffModal}
        title={editingStaff ? "Edit Staff Member" : "Add Staff Member"}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeStaffModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveStaff}
              icon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : undefined}
              disabled={
                !staffForm.name ||
                !staffForm.email ||
                !staffForm.roleId ||
                saving ||
                (!editingStaff &&
                  (!staffForm.password || staffForm.password.length < 8))
              }
            >
              {editingStaff ? "Save Changes" : "Add Staff"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full Name *">
            <Input
              type="text"
              value={staffForm.name}
              onChange={(e) =>
                setStaffForm({ ...staffForm, name: e.target.value })
              }
              placeholder="Enter full name"
            />
          </Field>

          <Field label="Email *">
            <Input
              type="email"
              value={staffForm.email}
              onChange={(e) =>
                setStaffForm({ ...staffForm, email: e.target.value })
              }
              placeholder="email@healwin.com"
            />
          </Field>

          <Field label="Phone">
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={staffForm.phone}
              onChange={(e) =>
                setStaffForm({
                  ...staffForm,
                  phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                })
              }
              placeholder="10-digit mobile number"
            />
          </Field>

          <Field label="Role *">
            <Select
              value={staffForm.roleId}
              onChange={(e) =>
                setStaffForm({ ...staffForm, roleId: e.target.value })
              }
            >
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role._id} value={role._id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </Field>

          {/* Doctor profile — only for the Doctor role. This same record is the
              app's "Consult a Doctor" listing. */}
          {isDoctorRole && (
            <div className="rounded-xl border border-healwin-100 bg-healwin-50/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-healwin-700">
                Doctor profile (shown in patient app)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Speciality *">
                  <Input
                    value={docForm.speciality}
                    onChange={(e) => setDocForm({ ...docForm, speciality: e.target.value })}
                    placeholder="e.g. Cardiologist"
                  />
                </Field>
                <Field label="Qualification">
                  <Input
                    value={docForm.qualification}
                    onChange={(e) => setDocForm({ ...docForm, qualification: e.target.value })}
                    placeholder="MBBS, MD"
                  />
                </Field>
                <Field label="Experience (years)">
                  <Input
                    type="number"
                    value={docForm.experienceYears}
                    onChange={(e) => setDocForm({ ...docForm, experienceYears: e.target.value })}
                  />
                </Field>
                <Field label="Consultation Fee (₹)">
                  <Input
                    type="number"
                    value={docForm.consultationFee}
                    onChange={(e) => setDocForm({ ...docForm, consultationFee: e.target.value })}
                  />
                </Field>
                <Field label="Hospital">
                  <Input
                    value={docForm.hospital}
                    onChange={(e) => setDocForm({ ...docForm, hospital: e.target.value })}
                  />
                </Field>
                <Field label="About">
                  <Input
                    value={docForm.about}
                    onChange={(e) => setDocForm({ ...docForm, about: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={docForm.teleconsult}
                    onChange={(e) => setDocForm({ ...docForm, teleconsult: e.target.checked })}
                  />
                  Teleconsult available
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={docForm.listInApp}
                    onChange={(e) => setDocForm({ ...docForm, listInApp: e.target.checked })}
                  />
                  List in patient app
                </label>
              </div>
            </div>
          )}

          {!editingStaff && (
            <Field label="Password *">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={staffForm.password}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, password: e.target.value })
                  }
                  className="pr-12"
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const generated = generateRandomPassword();
                  setStaffForm({ ...staffForm, password: generated });
                  setShowPassword(true);
                }}
                className="flex items-center gap-1 mt-2 text-xs font-medium text-healwin-600 hover:text-healwin-700"
              >
                <RefreshCw className="w-3 h-3" />
                Generate Password
              </button>
            </Field>
          )}
        </div>
      </Modal>
      {/* Reset Password Modal */}
      <Modal
        open={showResetPasswordModal && !!resetPasswordStaff}
        onClose={closeResetPasswordModal}
        title="Reset Password"
        subtitle={
          resetPasswordStaff
            ? `Set a new password for ${getStaffDisplayName(resetPasswordStaff)}`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeResetPasswordModal}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              icon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : undefined}
              disabled={
                !newPassword ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword ||
                saving
              }
            >
              Reset Password
            </Button>
          </>
        }
      >
        {resetPasswordStaff && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-healwin-100">
                <span className="text-lg font-semibold text-healwin-600">
                  {getStaffDisplayName(resetPasswordStaff)
                    .charAt(0)
                    .toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-800">
                  {getStaffDisplayName(resetPasswordStaff)}
                </p>
                <p className="text-sm text-gray-500">
                  {resetPasswordStaff.email}
                </p>
              </div>
            </div>

            <Field label="New Password *">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </Field>

            <Field
              label="Confirm Password *"
              error={
                confirmPassword && newPassword !== confirmPassword
                  ? "Passwords do not match"
                  : undefined
              }
            >
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={
                  confirmPassword && newPassword !== confirmPassword
                    ? "border-red-300 bg-red-50"
                    : undefined
                }
              />
            </Field>

            <button
              type="button"
              onClick={() => {
                const generated = generateRandomPassword();
                setNewPassword(generated);
                setConfirmPassword(generated);
                setShowPassword(true);
              }}
              className="flex items-center gap-2 text-sm font-medium text-healwin-600 hover:text-healwin-700"
            >
              <RefreshCw className="w-4 h-4" />
              Generate Random Password
            </button>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                deleteConfirm && handleDeleteStaff(deleteConfirm)
              }
            >
              Delete
            </Button>
          </>
        }
      >
        {deleteConfirm && (
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-800">
              Delete Staff Member?
            </h3>
            <p className="mb-2 text-gray-500">
              This action cannot be undone. The staff member will lose access
              immediately.
            </p>
          </div>
        )}
      </Modal>

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
        <Pagination
          page={page}
          totalPages={totalPages}
          total={totalStaff}
          label="staff members"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};

export default StaffManagement;

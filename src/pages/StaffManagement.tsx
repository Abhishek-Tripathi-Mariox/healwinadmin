// src/pages/StaffManagement.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  X,
  Check,
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

// Permission modules - IDs must match backend PERMISSIONS format (using colons)
const PERMISSION_MODULES = [
  {
    module: "Dashboard",
    permissions: [
      {
        id: "dashboard:view",
        name: "View Dashboard",
        description: "Can view dashboard statistics",
      },
    ],
  },
  {
    module: "SOS Dashboard",
    permissions: [
      {
        id: "sos:view",
        name: "View SOS Alerts",
        description: "Can view SOS alerts",
      },
      {
        id: "sos:respond",
        name: "Respond to SOS",
        description: "Can respond to SOS alerts",
      },
      {
        id: "sos:resolve",
        name: "Resolve SOS",
        description: "Can resolve SOS alerts",
      },
    ],
  },
  {
    module: "Admin Management",
    permissions: [
      {
        id: "staff:view",
        name: "View Staff",
        description: "Can view staff members",
      },
      {
        id: "staff:create",
        name: "Create Staff",
        description: "Can add staff members",
      },
      {
        id: "staff:update",
        name: "Edit Staff",
        description: "Can edit staff members",
      },
      {
        id: "staff:delete",
        name: "Delete Staff",
        description: "Can remove staff members",
      },
      {
        id: "roles:view",
        name: "View Roles",
        description: "Can view roles",
      },
      {
        id: "roles:create",
        name: "Create Roles",
        description: "Can create roles",
      },
      {
        id: "roles:update",
        name: "Edit Roles",
        description: "Can edit roles",
      },
      {
        id: "roles:delete",
        name: "Delete Roles",
        description: "Can delete roles",
      },
    ],
  },
  {
    module: "Team Management",
    permissions: [
      {
        id: "team:view",
        name: "View Team Members",
        description: "Can view team members",
      },
      {
        id: "team:create",
        name: "Create Team Members",
        description: "Can add team members",
      },
      {
        id: "team:update",
        name: "Edit Team Members",
        description: "Can edit team members",
      },
      {
        id: "team:delete",
        name: "Delete Team Members",
        description: "Can remove team members",
      },
    ],
  },
  {
    module: "Careers",
    permissions: [
      {
        id: "careers:view",
        name: "View Job Listings",
        description: "Can view careers/job listings",
      },
      {
        id: "careers:create",
        name: "Create Job Listings",
        description: "Can create careers/job listings",
      },
      {
        id: "careers:update",
        name: "Edit Job Listings",
        description: "Can edit careers/job listings",
      },
      {
        id: "careers:delete",
        name: "Delete Job Listings",
        description: "Can delete careers/job listings",
      },
    ],
  },
  {
    module: "Applications",
    permissions: [
      {
        id: "applications:view",
        name: "View Applications",
        description: "Can view job applications",
      },
      {
        id: "applications:update",
        name: "Update Applications",
        description: "Can update application status/details",
      },
    ],
  },
  {
    module: "Services",
    permissions: [
      {
        id: "services:view",
        name: "View Services",
        description: "Can view services",
      },
      {
        id: "services:create",
        name: "Create Services",
        description: "Can create services",
      },
      {
        id: "services:update",
        name: "Edit Services",
        description: "Can edit services",
      },
      {
        id: "services:delete",
        name: "Delete Services",
        description: "Can delete services",
      },
    ],
  },
  {
    module: "Categories",
    permissions: [
      {
        id: "categories:view",
        name: "View Categories",
        description: "Can view service categories",
      },
      {
        id: "categories:create",
        name: "Create Categories",
        description: "Can create service categories",
      },
      {
        id: "categories:update",
        name: "Edit Categories",
        description: "Can edit service categories",
      },
      {
        id: "categories:delete",
        name: "Delete Categories",
        description: "Can delete service categories",
      },
    ],
  },
  {
    module: "States",
    permissions: [
      {
        id: "states:view",
        name: "View States",
        description: "Can view states",
      },
      {
        id: "states:create",
        name: "Create States",
        description: "Can create states",
      },
      {
        id: "states:update",
        name: "Edit States",
        description: "Can edit states",
      },
      {
        id: "states:delete",
        name: "Delete States",
        description: "Can delete states",
      },
    ],
  },
  {
    module: "Districts",
    permissions: [
      {
        id: "districts:view",
        name: "View Districts",
        description: "Can view districts",
      },
      {
        id: "districts:create",
        name: "Create Districts",
        description: "Can create districts",
      },
      {
        id: "districts:update",
        name: "Edit Districts",
        description: "Can edit districts",
      },
      {
        id: "districts:delete",
        name: "Delete Districts",
        description: "Can delete districts",
      },
    ],
  },
  {
    module: "Divisions",
    permissions: [
      {
        id: "divisions:view",
        name: "View Divisions",
        description: "Can view divisions",
      },
      {
        id: "divisions:create",
        name: "Create Divisions",
        description: "Can create divisions",
      },
      {
        id: "divisions:update",
        name: "Edit Divisions",
        description: "Can edit divisions",
      },
      {
        id: "divisions:delete",
        name: "Delete Divisions",
        description: "Can delete divisions",
      },
    ],
  },
  {
    module: "Centres",
    permissions: [
      {
        id: "centres:view",
        name: "View Centres",
        description: "Can view centres",
      },
      {
        id: "centres:create",
        name: "Create Centres",
        description: "Can create centres",
      },
      {
        id: "centres:update",
        name: "Edit Centres",
        description: "Can edit centres",
      },
      {
        id: "centres:delete",
        name: "Delete Centres",
        description: "Can delete centres",
      },
    ],
  },
  {
    module: "Service Types",
    permissions: [
      {
        id: "locator_types:view",
        name: "View Service Types",
        description: "Can view locator service types",
      },
      {
        id: "locator_types:create",
        name: "Create Service Types",
        description: "Can create locator service types",
      },
      {
        id: "locator_types:update",
        name: "Edit Service Types",
        description: "Can edit locator service types",
      },
      {
        id: "locator_types:delete",
        name: "Delete Service Types",
        description: "Can delete locator service types",
      },
    ],
  },
  {
    module: "Departments",
    permissions: [
      {
        id: "departments:view",
        name: "View Departments",
        description: "Can view departments",
      },
      {
        id: "departments:create",
        name: "Create Departments",
        description: "Can create departments",
      },
      {
        id: "departments:update",
        name: "Edit Departments",
        description: "Can edit departments",
      },
      {
        id: "departments:delete",
        name: "Delete Departments",
        description: "Can delete departments",
      },
    ],
  },
  {
    module: "Designations",
    permissions: [
      {
        id: "designations:view",
        name: "View Designations",
        description: "Can view designations",
      },
      {
        id: "designations:create",
        name: "Create Designations",
        description: "Can create designations",
      },
      {
        id: "designations:update",
        name: "Edit Designations",
        description: "Can edit designations",
      },
      {
        id: "designations:delete",
        name: "Delete Designations",
        description: "Can delete designations",
      },
    ],
  },
  {
    module: "Employment Types",
    permissions: [
      {
        id: "employment_types:view",
        name: "View Employment Types",
        description: "Can view employment types",
      },
      {
        id: "employment_types:create",
        name: "Create Employment Types",
        description: "Can create employment types",
      },
      {
        id: "employment_types:update",
        name: "Edit Employment Types",
        description: "Can edit employment types",
      },
      {
        id: "employment_types:delete",
        name: "Delete Employment Types",
        description: "Can delete employment types",
      },
    ],
  },
  {
    module: "Home Page",
    permissions: [
      {
        id: "home:view",
        name: "View Home Page",
        description: "Can view home page settings",
      },
      {
        id: "home:update",
        name: "Update Home Page",
        description: "Can update home page settings",
      },
    ],
  },
  {
    module: "About Page",
    permissions: [
      {
        id: "about:view",
        name: "View About Page",
        description: "Can view about page settings",
      },
      {
        id: "about:update",
        name: "Update About Page",
        description: "Can update about page settings",
      },
    ],
  },
  {
    module: "Contact Page",
    permissions: [
      {
        id: "contact:view",
        name: "View Contact Page",
        description: "Can view contact page settings",
      },
      {
        id: "contact:update",
        name: "Update Contact Page",
        description: "Can update contact page settings",
      },
    ],
  },
  {
    module: "CMS Pages",
    permissions: [
      {
        id: "cms:view",
        name: "View CMS Pages",
        description: "Can view CMS pages",
      },
      {
        id: "cms:create",
        name: "Create CMS Pages",
        description: "Can create CMS pages",
      },
      {
        id: "cms:update",
        name: "Edit CMS Pages",
        description: "Can edit CMS pages",
      },
      {
        id: "cms:delete",
        name: "Delete CMS Pages",
        description: "Can delete CMS pages",
      },
    ],
  },
  {
    module: "News Articles",
    permissions: [
      {
        id: "news:view",
        name: "View News",
        description: "Can view news articles",
      },
      {
        id: "news:create",
        name: "Create News",
        description: "Can create news articles",
      },
      {
        id: "news:update",
        name: "Edit News",
        description: "Can edit news articles",
      },
      {
        id: "news:delete",
        name: "Delete News",
        description: "Can delete news articles",
      },
    ],
  },
  {
    module: "Gallery",
    permissions: [
      {
        id: "gallery:view",
        name: "View Gallery",
        description: "Can view gallery items",
      },
      {
        id: "gallery:create",
        name: "Create Gallery Items",
        description: "Can create gallery items",
      },
      {
        id: "gallery:update",
        name: "Edit Gallery Items",
        description: "Can edit gallery items",
      },
      {
        id: "gallery:delete",
        name: "Delete Gallery Items",
        description: "Can delete gallery items",
      },
    ],
  },
  {
    module: "Submissions",
    permissions: [
      {
        id: "submissions:view",
        name: "View Submissions",
        description: "Can view article submissions",
      },
      {
        id: "submissions:update",
        name: "Update Submissions",
        description: "Can review/update article submissions",
      },
      {
        id: "submissions:delete",
        name: "Delete Submissions",
        description: "Can delete article submissions",
      },
    ],
  },
  {
    module: "Logo Management",
    permissions: [
      {
        id: "logo_settings:view",
        name: "View Logo Settings",
        description: "Can view logo settings",
      },
      {
        id: "logo_settings:update",
        name: "Update Logo Settings",
        description: "Can update logo settings",
      },
    ],
  },
  {
    module: "Email Templates",
    permissions: [
      {
        id: "email_templates:view",
        name: "View Email Templates",
        description: "Can view email templates",
      },
      {
        id: "email_templates:create",
        name: "Create Email Templates",
        description: "Can create email templates",
      },
      {
        id: "email_templates:update",
        name: "Edit Email Templates",
        description: "Can edit email templates",
      },
      {
        id: "email_templates:delete",
        name: "Delete Email Templates",
        description: "Can delete email templates",
      },
    ],
  },
  {
    module: "Activity Logs",
    permissions: [
      {
        id: "activity_logs:view",
        name: "View Activity Logs",
        description: "Can view admin activity logs",
      },
    ],
  },
  {
    module: "Reports",
    permissions: [
      {
        id: "reports:view",
        name: "View Reports",
        description: "Can view reports",
      },
      {
        id: "reports:export",
        name: "Export Reports",
        description: "Can export reports",
      },
    ],
  },
  {
    module: "HR — Dashboard",
    permissions: [
      {
        id: "hr_dashboard:view",
        name: "View HR Dashboard",
        description: "Can view the HR dashboard",
      },
    ],
  },
  {
    module: "HR — Employees",
    permissions: [
      { id: "employees:view", name: "View Employees", description: "Can view employees" },
      { id: "employees:create", name: "Create Employees", description: "Can add employees" },
      { id: "employees:update", name: "Edit Employees", description: "Can edit employees" },
      { id: "employees:delete", name: "Delete Employees", description: "Can remove employees" },
      { id: "salary_structure:view", name: "View Salary Structure", description: "Can view salary / CTC" },
      { id: "salary_structure:manage", name: "Manage Salary Structure", description: "Can edit salary / CTC" },
    ],
  },
  {
    module: "HR — Attendance",
    permissions: [
      { id: "attendance:view", name: "View Attendance", description: "Can view attendance" },
      { id: "attendance:manage", name: "Mark Attendance", description: "Can mark / edit attendance" },
    ],
  },
  {
    module: "HR — Leave",
    permissions: [
      { id: "leave:view", name: "View Leave", description: "Can view leave requests & types" },
      { id: "leave:manage", name: "Manage Leave", description: "Can create requests & leave types" },
      { id: "leave:approve", name: "Approve Leave", description: "Can approve / reject leave" },
    ],
  },
  {
    module: "HR — Holidays",
    permissions: [
      { id: "holidays:view", name: "View Holidays", description: "Can view the holiday calendar" },
      { id: "holidays:manage", name: "Manage Holidays", description: "Can add / edit holidays" },
    ],
  },
  {
    module: "HR — Payroll",
    permissions: [
      { id: "payroll:view", name: "View Payroll", description: "Can view payroll & payslips" },
      { id: "payroll:process", name: "Process Payroll", description: "Can generate payroll runs" },
      { id: "payroll:finalize", name: "Finalize Payroll", description: "Can finalize payroll runs" },
    ],
  },
];

const StaffManagement: React.FC = () => {
  useAuth(); // For authentication check
  const [activeTab, setActiveTab] = useState<"staff" | "roles">("staff");
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
  const [totalPages, setTotalPages] = useState(1);
  const [totalStaff, setTotalStaff] = useState(0);

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

  // Role Modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  });

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "staff" | "role";
    id: string;
  } | null>(null);

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
        staffApi.getAll({ page: page as any, limit: 20 as any }),
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
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredStaff = useMemo(() => {
    return staffMembers.filter((staff) => {
      const staffName = staff.name || staff.fullName || "";
      const matchesSearch =
        staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (staff.email || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole =
        roleFilter === "ALL" || staff.role?._id === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && staff.isActive) ||
        (statusFilter === "INACTIVE" && !staff.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staffMembers, searchQuery, roleFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: staffMembers.length,
      active: staffMembers.filter((s) => s.isActive).length,
      inactive: staffMembers.filter((s) => !s.isActive).length,
      roles: roles.length,
    }),
    [staffMembers, roles],
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

  const handleSaveRole = async () => {
    if (!roleForm.name || roleForm.permissions.length === 0) {
      setError("Please provide a role name and select at least one permission");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingRole) {
        await rolesApi.update(editingRole._id, {
          name: roleForm.name,
          description: roleForm.description,
          permissions: roleForm.permissions,
        });
        setSuccess("Role updated successfully");
      } else {
        await rolesApi.create({
          name: roleForm.name,
          description: roleForm.description,
          permissions: roleForm.permissions,
        });
        setSuccess("Role created successfully");
      }

      setShowRoleModal(false);
      setEditingRole(null);
      setRoleForm({ name: "", description: "", permissions: [] });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
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

  const handleDeleteRole = async (id: string) => {
    const role = roles.find((r) => r._id === id);
    if (role?.isSystem) {
      setError("Cannot delete system role");
      return;
    }
    if (role && role.staffCount > 0) {
      setError("Cannot delete role with assigned staff members");
      return;
    }
    try {
      await rolesApi.delete(id);
      setSuccess("Role deleted successfully");
      setDeleteConfirm(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to delete role");
    }
  };

  const togglePermission = (permissionId: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((p) => p !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const toggleModulePermissions = (module: string) => {
    const modulePerms =
      PERMISSION_MODULES.find((m) => m.module === module)?.permissions.map(
        (p) => p.id,
      ) || [];
    const allSelected = modulePerms.every((p) =>
      roleForm.permissions.includes(p),
    );

    if (allSelected) {
      setRoleForm((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((p) => !modulePerms.includes(p)),
      }));
    } else {
      setRoleForm((prev) => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...modulePerms])],
      }));
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

  const openEditRoleModal = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name || "",
      description: role.description || "",
      permissions: [...(role.permissions || [])],
    });
    setShowRoleModal(true);
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
        title="Admin Management"
        subtitle="Manage admin staff, roles, and permissions"
      />

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("staff")}
          className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "staff"
              ? "border-healwin-500 text-healwin-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users className="inline-block w-4 h-4 mr-2" />
          Admin Members ({stats.total})
        </button>
        <button
          onClick={() => setActiveTab("roles")}
          className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "roles"
              ? "border-healwin-500 text-healwin-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Key className="inline-block w-4 h-4 mr-2" />
          Roles & Permissions ({stats.roles})
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Roles</p>
              <p className="mt-1 text-2xl font-bold text-purple-600">
                {stats.roles}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl">
              <Key className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Staff Tab Content */}
      {activeTab === "staff" && (
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
                              setDeleteConfirm({
                                type: "staff",
                                id: staff._id,
                              })
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
      )}

      {/* Roles Tab Content */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingRole(null);
                setRoleForm({ name: "", description: "", permissions: [] });
                setShowRoleModal(true);
              }}
            >
              Create Role
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <Card
                key={role._id}
                className="p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        role.isSystem ? "bg-purple-100" : "bg-blue-100"
                      }`}
                    >
                      <Shield
                        className={`w-5 h-5 ${role.isSystem ? "text-purple-600" : "text-blue-600"}`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {role.name}
                      </h3>
                      {role.isSystem && (
                        <span className="text-xs font-medium text-purple-600">
                          System Role
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {/* Permissions are editable on every role; system role
                        names can't change (enforced in the modal + backend). */}
                    <button
                      onClick={() => openEditRoleModal(role)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      title={role.isSystem ? "Edit permissions" : "Edit"}
                      aria-label="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={() =>
                          setDeleteConfirm({ type: "role", id: role._id })
                        }
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="mb-4 text-sm text-gray-500">{role.description}</p>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    <Users className="inline-block w-4 h-4 mr-1" />
                    {role.staffCount} members
                  </span>
                  <span className="text-gray-500">
                    <Key className="inline-block w-4 h-4 mr-1" />
                    {role.permissions.length} permissions
                  </span>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100">
                  <p className="mb-2 text-xs text-gray-500">Permissions:</p>
                  <div className="flex flex-wrap gap-1">
                    {PERMISSION_MODULES.filter((m) =>
                      m.permissions.some((p) =>
                        role.permissions.includes(p.id),
                      ),
                    )
                      .slice(0, 4)
                      .map((m) => (
                        <span
                          key={m.module}
                          className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                        >
                          {m.module}
                        </span>
                      ))}
                    {PERMISSION_MODULES.filter((m) =>
                      m.permissions.some((p) =>
                        role.permissions.includes(p.id),
                      ),
                    ).length > 4 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        +
                        {PERMISSION_MODULES.filter((m) =>
                          m.permissions.some((p) =>
                            role.permissions.includes(p.id),
                          ),
                        ).length - 4}{" "}
                        more
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

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

      {/* Role Modal */}
      <Modal
        open={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={editingRole ? "Edit Role" : "Create New Role"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRoleModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRole}
              icon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : undefined}
              disabled={
                !roleForm.name || roleForm.permissions.length === 0 || saving
              }
            >
              {editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Role Name *"
              hint={
                editingRole?.isSystem
                  ? "System role name can't be changed — only its permissions."
                  : undefined
              }
            >
              <Input
                type="text"
                value={roleForm.name}
                onChange={(e) =>
                  setRoleForm({ ...roleForm, name: e.target.value })
                }
                placeholder="e.g. Support Manager"
                disabled={editingRole?.isSystem}
              />
            </Field>
            <Field label="Description">
              <Input
                type="text"
                value={roleForm.description}
                onChange={(e) =>
                  setRoleForm({ ...roleForm, description: e.target.value })
                }
                placeholder="Brief description of this role"
              />
            </Field>
          </div>

          <div>
            <h4 className="mb-4 font-medium text-gray-800">
              Permissions ({roleForm.permissions.length} selected)
            </h4>
            <div className="space-y-4">
              {PERMISSION_MODULES.map((module) => {
                const modulePerms = module.permissions.map((p) => p.id);
                const selectedCount = modulePerms.filter((p) =>
                  roleForm.permissions.includes(p),
                ).length;
                const allSelected = selectedCount === modulePerms.length;

                return (
                  <div
                    key={module.module}
                    className="overflow-hidden border border-gray-200 rounded-xl"
                  >
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer bg-gray-50"
                      onClick={() => toggleModulePermissions(module.module)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center ${
                            allSelected
                              ? "bg-healwin-500 border-healwin-500"
                              : selectedCount > 0
                                ? "bg-healwin-100 border-healwin-300"
                                : "border-gray-300"
                          }`}
                        >
                          {allSelected && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="font-medium text-gray-800">
                          {module.module}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {selectedCount}/{modulePerms.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
                      {module.permissions.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={roleForm.permissions.includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            className="w-4 h-4 rounded text-healwin-500 focus:ring-healwin-500"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              {perm.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {perm.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
                deleteConfirm &&
                (deleteConfirm.type === "staff"
                  ? handleDeleteStaff(deleteConfirm.id)
                  : handleDeleteRole(deleteConfirm.id))
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
              Delete {deleteConfirm.type === "staff" ? "Staff Member" : "Role"}?
            </h3>
            <p className="mb-2 text-gray-500">
              This action cannot be undone.
              {deleteConfirm.type === "staff"
                ? " The staff member will lose access immediately."
                : " Make sure no staff members are assigned to this role."}
            </p>
          </div>
        )}
      </Modal>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={totalStaff}
        label="staff members"
        onPageChange={setPage}
      />
    </div>
  );
};

export default StaffManagement;

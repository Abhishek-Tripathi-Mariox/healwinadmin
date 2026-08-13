import React, { useEffect, useState, useRef, useCallback } from "react";
import { teamApi, designationApi, divisionApi, departmentApi } from "../services/admin-api";
import { QRCodeSVG } from "qrcode.react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Pencil, Trash2 } from "lucide-react";
import Pagination from "../components/Pagination";
import SearchableSelect from "../components/SearchableSelect";
import type { FetchResult } from "../components/SearchableSelect";
import {
  PageHeader,
  Button,
  SearchInput,
  Select,
  Card,
  Badge,
  Modal,
  Field,
  Input,
  Textarea,
  Alert,
} from "../components/ui";

interface TeamMember {
  _id: string;
  name: string;
  uniqueId?: string;
  designation: string | { name: string };
  division: string | { name: string };
  department: string | { name: string };
  state: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  bio?: string;
  image?: string;
  highlights?: string[];
  sortOrder: number;
  isActive: boolean;
}

interface DropdownOption {
  _id: string;
  name: string;
}

const FRONTEND_URL = "https://healwin.in";

// Helper: create a cropped image blob from a source image + crop area
function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
      );
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
        0.92,
      );
    };
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = imageSrc;
  });
}

const emptyMember = {
  name: "",
  uniqueId: "",
  designation: "",
  division: "",
  department: "",
  state: "",
  email: "",
  phone: "",
  linkedin: "",
  bio: "",
  highlights: "",
  sortOrder: 0,
  isActive: true,
};

const TeamManagement: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [form, setForm] = useState({ ...emptyMember });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // QR modal state
  const [qrMember, setQrMember] = useState<TeamMember | null>(null);

  // Image crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Divisions still needed for filter dropdown
  const [divisions, setDivisions] = useState<DropdownOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.q = search.trim();
      if (divisionFilter !== "all") params.division = divisionFilter;
      params.page = String(page);
      params.limit = "20";
      const res = await teamApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setMembers(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setMembers(d || []);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load team members";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search, divisionFilter, page]);

  const loadDivisions = async () => {
    try {
      const res = await divisionApi.getAll({ status: "active", limit: "1000" });
      setDivisions(res.data?.items || res.data || []);
    } catch {
      // silently fail
    }
  };

  // Async fetch callbacks for SearchableSelect dropdowns
  const fetchDesignations = useCallback(
    async (params: { q: string; page: number; limit: number }): Promise<FetchResult> => {
      const res = await designationApi.getAll({
        status: "active",
        ...(params.q && { q: params.q }),
        page: String(params.page),
        limit: String(params.limit),
      });
      const items = res.data?.items || res.data || [];
      const totalPages = res.data?.pagination?.pages || 1;
      return { items, hasMore: params.page < totalPages };
    },
    []
  );

  const fetchDivisions = useCallback(
    async (params: { q: string; page: number; limit: number }): Promise<FetchResult> => {
      const res = await divisionApi.getAll({
        status: "active",
        ...(params.q && { q: params.q }),
        page: String(params.page),
        limit: String(params.limit),
      });
      const items = res.data?.items || res.data || [];
      const totalPages = res.data?.pagination?.pages || 1;
      return { items, hasMore: params.page < totalPages };
    },
    []
  );

  const fetchDepartments = useCallback(
    async (params: { q: string; page: number; limit: number }): Promise<FetchResult> => {
      const res = await departmentApi.getAll({
        status: "active",
        ...(params.q && { q: params.q }),
        page: String(params.page),
        limit: String(params.limit),
      });
      const items = res.data?.items || res.data || [];
      const totalPages = res.data?.pagination?.pages || 1;
      return { items, hasMore: params.page < totalPages };
    },
    []
  );

  const fetchStates = useCallback(
    async (params: { q: string; page: number; limit: number }): Promise<FetchResult> => {
      const res = await teamApi.getStates();
      // teamApi.getStates doesn't support pagination, filter client-side
      const all: DropdownOption[] = res.data || [];
      const filtered = params.q
        ? all.filter((s) => s.name.toLowerCase().includes(params.q.toLowerCase()))
        : all;
      const start = (params.page - 1) * params.limit;
      const items = filtered.slice(start, start + params.limit);
      return { items, hasMore: start + params.limit < filtered.length };
    },
    []
  );

  useEffect(() => {
    loadDivisions();
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, divisionFilter]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropSrc(reader.result as string);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = (_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels);
      const file = new File([blob], "cropped-photo.jpg", {
        type: "image/jpeg",
      });
      setImageFile(file);
      setImagePreview(URL.createObjectURL(blob));
    } catch {
      setError("Failed to crop image");
    } finally {
      setCropSrc(null);
    }
  };

  const handleCropCancel = () => {
    setCropSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Frontend validation
    if (
      !form.name.trim() ||
      !form.uniqueId.trim() ||
      !form.designation.trim()
    ) {
      setError("Name, Employee ID, and Designation are mandatory");
      return;
    }
    if (form.phone.trim() && !/^[6-9]\d{9}$/.test(form.phone.trim())) {
      setError("Phone must be a valid 10-digit mobile number (starting 6-9).");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("uniqueId", form.uniqueId);
      formData.append("designation", form.designation);
      formData.append("division", form.division);
      formData.append("department", form.department);
      formData.append("state", form.state);
      formData.append("email", form.email);
      formData.append("phone", form.phone);
      formData.append("linkedin", form.linkedin);
      formData.append("bio", form.bio);
      formData.append("sortOrder", String(form.sortOrder));
      formData.append("isActive", String(form.isActive));

      // Send highlights as separate entries
      const highlightsList = form.highlights
        .split("\n")
        .map((h) => h.trim())
        .filter(Boolean);
      highlightsList.forEach((h) => formData.append("highlights", h));

      if (imageFile) {
        formData.append("image", imageFile);
      }

      if (editingId) {
        await teamApi.update(editingId, formData);
      } else {
        await teamApi.create(formData);
      }

      setForm({ ...emptyMember });
      setEditingId(null);
      setShowForm(false);
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadMembers();
      await loadDivisions();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save team member";
      setError(message);
    }
  };

  const handleEdit = (member: TeamMember) => {
    setEditingId(member._id);
    setForm({
      name: member.name || "",
      uniqueId: member.uniqueId || "",
      designation:
        typeof member.designation === "object" && member.designation
          ? member.designation.name
          : member.designation || "",
      division:
        typeof member.division === "object" && member.division
          ? member.division.name
          : member.division || "",
      department:
        typeof member.department === "object" && member.department
          ? member.department.name
          : member.department || "",
      state: member.state || "",
      email: member.email || "",
      phone: member.phone || "",
      linkedin: member.linkedin || "",
      bio: member.bio || "",
      highlights: (member.highlights || []).join("\n"),
      sortOrder: member.sortOrder || 0,
      isActive: Boolean(member.isActive),
    });
    setImagePreview(member.image || null);
    setImageFile(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this team member?")) return;
    setError(null);
    try {
      await teamApi.remove(id);
      await loadMembers();
      await loadDivisions();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete team member";
      setError(message);
    }
  };

  const handleCancel = () => {
    setForm({ ...emptyMember });
    setEditingId(null);
    setShowForm(false);
    setImageFile(null);
    setImagePreview(null);
    setCropSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Website Team"
        subtitle={`${total || members.length} member${
          (total || members.length) !== 1 ? "s" : ""
        }`}
        actions={
          <Button onClick={() => setShowForm(true)}>+ Add Member</Button>
        }
      />

      {error && (
        <Alert className="mb-4" tone="danger">
          <span className="flex items-center justify-between gap-4">
            {error}
            <button onClick={() => setError(null)} className="font-bold">
              ×
            </button>
          </span>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadMembers()}
          placeholder="Search members..."
          className="flex-1 min-w-[200px]"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Select
          value={divisionFilter}
          onChange={(e) => setDivisionFilter(e.target.value)}
          className="w-auto"
        >
          <option value="all">All Divisions</option>
          {divisions.map((d) => (
            <option key={d._id} value={d.name}>
              {d.name}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={loadMembers}>
          Search
        </Button>
      </div>

      {/* Members List */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-400">Loading...</div>
      ) : members.length === 0 ? (
        <Card className="p-12 text-center text-gray-400">
          No team members found. Add one above!
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Card key={member._id} className="overflow-hidden">
              {/* Member Photo */}
              <div className="relative h-48 bg-gray-100">
                {member.image ? (
                  <img
                    src={member.image}
                    alt={member.name}
                    className="object-contain w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-gray-400">
                    <svg
                      className="w-16 h-16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                )}
                {/* Department badge */}
                <span className="absolute top-3 left-3">
                  <Badge tone="info">
                    {(typeof member.department === "object" && member.department
                      ? member.department.name
                      : member.department) ||
                      (typeof member.division === "object" && member.division
                        ? member.division.name
                        : member.division)}
                  </Badge>
                </span>
                {/* Status badge */}
                <span className="absolute top-3 right-3">
                  <Badge tone={member.isActive ? "success" : "danger"} dot>
                    {member.isActive ? "Active" : "Inactive"}
                  </Badge>
                </span>
              </div>

              {/* Member Info */}
              <div className="p-4">
                <h3 className="text-lg font-bold text-gray-800">
                  {member.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {typeof member.designation === "object" && member.designation
                    ? member.designation.name
                    : member.designation}
                </p>
                {member.uniqueId && (
                  <p className="mt-1 font-mono text-xs text-healwin-600">
                    ID: {member.uniqueId}
                  </p>
                )}

                {member.email && (
                  <p className="mt-2 text-xs text-gray-400 truncate">
                    {member.email}
                  </p>
                )}

                {/* Highlights */}
                {(member.highlights?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {member
                      .highlights!.slice(0, 3)
                      .map((h: string, i: number) => (
                        <Badge key={i} tone="info">
                          {h}
                        </Badge>
                      ))}
                    {member.highlights!.length > 3 && (
                      <Badge tone="neutral">
                        +{member.highlights!.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 mt-4 border-t">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 px-2"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => handleEdit(member)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {member.uniqueId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                      onClick={() => setQrMember(member)}
                    >
                      QR
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={() => handleDelete(member._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        label="team members"
        onPageChange={setPage}
      />

      {/* Add / Edit Modal */}
      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit Team Member" : "Add Team Member"}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? "Update Member" : "Add Member"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Name */}
            <Field label="Name *">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Dr. Rajesh Kumar"
                required
              />
            </Field>

            {/* Unique ID */}
            <Field label="Employee ID (Unique) *">
              <Input
                value={form.uniqueId}
                onChange={(e) => setForm({ ...form, uniqueId: e.target.value })}
                placeholder="e.g. HW-001"
                required
              />
            </Field>

            {/* Designation (global) */}
            <div>
              <SearchableSelect
                label="Designation"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e })}
                fetchOptions={fetchDesignations}
                placeholder="Search designation..."
                required
              />
            </div>

            {/* Division (global) */}
            <div>
              <SearchableSelect
                label="Division"
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e })}
                fetchOptions={fetchDivisions}
                placeholder="Search division..."
              />
            </div>

            {/* Department (global) */}
            <div>
              <SearchableSelect
                label="Department"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e })}
                fetchOptions={fetchDepartments}
                placeholder="Search department..."
              />
            </div>

            {/* State dropdown */}
            <div>
              <SearchableSelect
                label="State"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e })}
                fetchOptions={fetchStates}
                placeholder="Search state..."
              />
            </div>

            {/* Email */}
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@healwin.in"
              />
            </Field>

            {/* Phone */}
            <Field label="Phone">
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  })
                }
                placeholder="10-digit mobile number"
              />
            </Field>

            {/* LinkedIn */}
            <Field label="LinkedIn">
              <Input
                value={form.linkedin}
                onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                placeholder="https://linkedin.com/in/..."
              />
            </Field>

            {/* Sort Order */}
            <Field label="Sort Order">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) })
                }
              />
            </Field>

            {/* Photo Upload */}
            <Field label="Photo">
              <div className="flex items-center gap-3">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="object-cover w-12 h-12 border rounded-full"
                  />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="flex-1 px-3 py-1.5 border rounded-lg text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-healwin-50 file:text-healwin-700 file:font-medium file:cursor-pointer"
                />
              </div>
            </Field>

            {/* Active Toggle */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-healwin-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          {/* Bio */}
          <Field label="Bio">
            <Textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={3}
              placeholder="Brief biography..."
              className="resize-none"
            />
          </Field>

          {/* Highlights */}
          <Field label="Highlights / Tags (one per line)">
            <Textarea
              value={form.highlights}
              onChange={(e) => setForm({ ...form, highlights: e.target.value })}
              rows={3}
              placeholder={
                "20+ Years Experience\nHealthcare Visionary\nMD, AIIMS Delhi"
              }
              className="resize-none"
            />
          </Field>
        </form>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        open={!!qrMember}
        onClose={() => setQrMember(null)}
        title={qrMember?.name}
        subtitle="Scan to view profile"
        size="sm"
        footer={
          qrMember ? (
            <>
              <Button
                onClick={() => {
                  const svg = document.getElementById("qr-canvas");
                  if (!svg) return;
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const canvas = document.createElement("canvas");
                  canvas.width = 350;
                  canvas.height = 350;
                  const ctx = canvas.getContext("2d");
                  const img = new Image();
                  img.onload = () => {
                    ctx?.drawImage(img, 0, 0);
                    const a = document.createElement("a");
                    a.download = `QR-${qrMember.uniqueId}.png`;
                    a.href = canvas.toDataURL("image/png");
                    a.click();
                  };
                  img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
                }}
              >
                Download QR
              </Button>
              <Button
                variant="subtle"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${FRONTEND_URL}/team/verify/${qrMember.uniqueId}`,
                  );
                }}
              >
                Copy Link
              </Button>
              <Button variant="secondary" onClick={() => setQrMember(null)}>
                Close
              </Button>
            </>
          ) : null
        }
      >
        {qrMember && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <QRCodeSVG
                id="qr-canvas"
                value={`${FRONTEND_URL}/team/verify/${qrMember.uniqueId}`}
                size={300}
                level="H"
                includeMargin
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <p className="text-xs text-gray-400 break-all">
                {FRONTEND_URL}/team/verify/{qrMember.uniqueId}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${FRONTEND_URL}/team/verify/${qrMember.uniqueId}`,
                  );
                }}
                title="Copy link"
                className="shrink-0 p-1.5 text-gray-500 rounded-md hover:bg-gray-100 hover:text-healwin-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Image Crop Modal */}
      <Modal
        open={!!cropSrc}
        onClose={handleCropCancel}
        title="Crop Photo"
        subtitle="Drag to position, scroll to zoom"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCropCancel}>
              Cancel
            </Button>
            <Button onClick={handleCropConfirm}>Crop &amp; Use</Button>
          </>
        }
      >
        {cropSrc && (
          <>
            <div className="relative w-full" style={{ height: 350 }}>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="pt-4">
              <label className="text-xs text-gray-500">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default TeamManagement;

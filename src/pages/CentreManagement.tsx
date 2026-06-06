import React, { useEffect, useState, useCallback } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  centreApi,
  stateApi,
  districtApi,
  departmentApi,
  locatorServiceTypeApi,
} from "../services/admin-api";
import MapPicker from "../components/MapPicker";
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
  Spinner,
  cn,
} from "../components/ui";

interface CentreItem {
  _id: string;
  name: string;
  type: string;
  address: string;
  state: { _id: string; name: string } | null;
  district: { _id: string; name: string } | null;
  division: { _id: string; name: string } | null;
  location: { type: string; coordinates: number[] };
  phone: string;
  email: string;
  website: string;
  serviceTypes: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  services: string[];
  rating: number;
  timings: string;
  image: string;
  info: string;
  isActive: boolean;
}

const CENTRE_TYPES = [
  { value: "healwin_operated", label: "HealWin Operated" },
  { value: "healwin_approved", label: "HealWin Approved" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  name: "",
  type: "healwin_operated",
  address: "",
  state: "",
  district: "",
  division: "",
  phone: "",
  email: "",
  website: "",
  serviceTypes: [] as string[],
  departments: [] as string[],
  services: "",
  rating: 0,
  timings: "",
  info: "",
  isActive: true,
  lat: 0,
  lng: 0,
};

const CentreManagement: React.FC = () => {
  const [centres, setCentres] = useState<CentreItem[]>([]);
  const [stateOptions, setStateOptions] = useState<any[]>([]);
  const [, setDistrictOptions] = useState<any[]>([]);
  const [deptOptions, setDeptOptions] = useState<any[]>([]);
  const [serviceTypeOptions, setServiceTypeOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadOptions = async () => {
    try {
      const [statesRes, deptsRes, typesRes] = await Promise.all([
        stateApi.getAll({ status: "active", limit: "1000" }),
        departmentApi.getAll({ status: "active", limit: "1000" }),
        locatorServiceTypeApi.getAll({ status: "active", limit: "1000" }),
      ]);
      setStateOptions(statesRes.data?.items || statesRes.data || []);
      setDeptOptions(deptsRes.data?.items || deptsRes.data || []);
      setServiceTypeOptions(typesRes.data?.items || typesRes.data || []);
    } catch {}
  };

  const loadDistrictsForState = async (stateId: string) => {
    if (!stateId) {
      setDistrictOptions([]);
      return;
    }
    try {
      const res = await districtApi.getAll({
        state: stateId,
        status: "active",
      });
      setDistrictOptions(res.data?.items || res.data || []);
    } catch {}
  };

  const fetchStates = useCallback(
    async (params: { q: string; page: number; limit: number }): Promise<FetchResult> => {
      const res = await stateApi.getAll({
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

  const fetchDistricts = useCallback(
    async (params: { q: string; page: number; limit: number }): Promise<FetchResult> => {
      if (!form.state) return { items: [], hasMore: false };
      const res = await districtApi.getAll({
        state: form.state,
        status: "active",
        ...(params.q && { q: params.q }),
        page: String(params.page),
        limit: String(params.limit),
      });
      const items = res.data?.items || res.data || [];
      const totalPages = res.data?.pagination?.pages || 1;
      return { items, hasMore: params.page < totalPages };
    },
    [form.state]
  );

  const loadCentres = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (stateFilter) params.state = stateFilter;
      params.page = String(page);
      params.limit = "20";
      const res = await centreApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setCentres(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setCentres(d || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);
  useEffect(() => {
    loadCentres();
  }, [search, statusFilter, typeFilter, stateFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, stateFilter]);
  useEffect(() => {
    loadDistrictsForState(form.state);
  }, [form.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (
      !form.name.trim() ||
      !form.type.trim() ||
      !form.state.trim() ||
      !form.district.trim() ||
      !form.address.trim()
    ) {
      setError("Name, Type, State, District, and Address are required");
      return;
    }
    if (form.phone.trim() && !/^[6-9]\d{9}$/.test(form.phone.trim())) {
      setError("Phone must be a valid 10-digit mobile number (starting 6-9).");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("type", form.type);
      fd.append("address", form.address);
      fd.append("state", form.state);
      fd.append("district", form.district);
      if (form.division) fd.append("division", form.division);
      fd.append("phone", form.phone);
      fd.append("email", form.email);
      fd.append("website", form.website);
      fd.append("rating", String(form.rating));
      fd.append("timings", form.timings);
      fd.append("info", form.info);
      fd.append("isActive", String(form.isActive));
      fd.append("serviceTypes", JSON.stringify(form.serviceTypes));
      fd.append("departments", JSON.stringify(form.departments));
      fd.append(
        "services",
        JSON.stringify(
          form.services
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      );
      fd.append(
        "location",
        JSON.stringify({ type: "Point", coordinates: [form.lng, form.lat] }),
      );
      if (imageFile) fd.append("image", imageFile);

      if (editingId) await centreApi.update(editingId, fd);
      else await centreApi.create(fd);

      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      setImageFile(null);
      loadCentres();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (item: CentreItem) => {
    setForm({
      name: item.name,
      type: item.type,
      address: item.address,
      state: item.state?._id || "",
      district: item.district?._id || "",
      division: item.division?._id || "",
      phone: item.phone || "",
      email: item.email || "",
      website: item.website || "",
      serviceTypes: item.serviceTypes?.map((t) => t._id) || [],
      departments: item.departments?.map((d) => d._id) || [],
      services: item.services?.join(", ") || "",
      rating: item.rating || 0,
      timings: item.timings || "",
      info: item.info || "",
      isActive: item.isActive,
      lat: item.location?.coordinates?.[1] || 0,
      lng: item.location?.coordinates?.[0] || 0,
    });
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this centre?")) return;
    try {
      await centreApi.remove(id);
      loadCentres();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setImageFile(null);
  };

  const toggleServiceType = (id: string) => {
    setForm((prev) => ({
      ...prev,
      serviceTypes: prev.serviceTypes.includes(id)
        ? prev.serviceTypes.filter((t) => t !== id)
        : [...prev.serviceTypes, id],
    }));
  };

  const toggleDepartment = (id: string) => {
    setForm((prev) => ({
      ...prev,
      departments: prev.departments.includes(id)
        ? prev.departments.filter((d) => d !== id)
        : [...prev.departments, id],
    }));
  };

  const getTypeLabel = (type: string) =>
    CENTRE_TYPES.find((t) => t.value === type)?.label || type;
  const getTypeTone = (type: string): "info" | "success" | "neutral" => {
    switch (type) {
      case "healwin_operated":
        return "info";
      case "healwin_approved":
        return "success";
      default:
        return "neutral";
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Centre Management"
        subtitle={`${total || centres.length} centre(s)`}
        actions={
          <Button onClick={() => setShowForm(true)}>+ Add Centre</Button>
        }
      />

      {error && (
        <Alert className="mb-4" tone="danger">
          <span className="flex items-center justify-between gap-4">
            {error}
            <button onClick={() => setError("")} className="font-bold">
              ×
            </button>
          </span>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          placeholder="Search centres…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs"
        />
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-auto"
        >
          <option value="">All Types</option>
          {CENTRE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="w-auto"
        >
          <option value="">All States</option>
          {stateOptions.map((s: any) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : centres.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          No centres found
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {centres.map((c) => (
            <Card key={c._id} padded className="hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col items-start gap-1">
                  <h3 className="font-semibold text-gray-800 text-lg">
                    {c.name}
                  </h3>
                  <Badge tone={getTypeTone(c.type)}>{getTypeLabel(c.type)}</Badge>
                </div>
                <Badge tone={c.isActive ? "success" : "danger"} dot>
                  {c.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 mb-1">{c.address}</p>
              <p className="text-sm text-gray-400 mb-1">
                {c.state?.name || ""}
                {c.district ? `, ${c.district.name}` : ""}
              </p>
              {c.phone && <p className="text-sm text-gray-500">📞 {c.phone}</p>}
              {c.serviceTypes?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {c.serviceTypes.map((t) => (
                    <Badge key={t._id} tone="info">
                      {t.name}
                    </Badge>
                  ))}
                </div>
              )}
              {c.services?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.services.map((s, i) => (
                    <Badge key={i} tone="neutral">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-3 pt-3 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-2"
                  title="Edit"
                  aria-label="Edit"
                  onClick={() => handleEdit(c)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                  title="Delete"
                  aria-label="Delete"
                  onClick={() => handleDelete(c._id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        label="centres"
        onPageChange={setPage}
      />

      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit Centre" : "Add Centre"}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Name *">
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Type *">
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
              >
                {CENTRE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rating (0-5)">
              <Input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={form.rating}
                onChange={(e) =>
                  setForm({ ...form, rating: Number(e.target.value) })
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <SearchableSelect
                label="State"
                value={form.state}
                onChange={(e) =>
                  setForm({
                    ...form,
                    state: e,
                    district: "",
                    division: "",
                  })
                }
                fetchOptions={fetchStates}
                placeholder="Search state..."
                required
                valueField="_id"
                displayField="name"
              />
            </div>
            <div>
              <SearchableSelect
                label="District"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e })}
                fetchOptions={fetchDistricts}
                placeholder="Search district..."
                required
                disabled={!form.state}
                valueField="_id"
                displayField="name"
              />
            </div>
            <Field label="Timings">
              <Input
                type="text"
                value={form.timings}
                onChange={(e) => setForm({ ...form, timings: e.target.value })}
                placeholder="e.g. Mon-Sat 9AM-6PM"
              />
            </Field>
          </div>

          <Field label="Address *">
            <Textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              required
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Phone">
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  })
                }
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Website">
              <Input
                type="text"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Location (click on map, search an address, or use current location)">
            <MapPicker
              value={{ lat: form.lat, lng: form.lng, address: form.address }}
              onChange={(loc) =>
                setForm({
                  ...form,
                  lat: loc.lat,
                  lng: loc.lng,
                  address: loc.address || form.address,
                })
              }
            />
            <div className="grid grid-cols-2 gap-4 mt-2">
              <Field label="Latitude">
                <Input
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) =>
                    setForm({ ...form, lat: Number(e.target.value) })
                  }
                  className="bg-gray-50"
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) =>
                    setForm({ ...form, lng: Number(e.target.value) })
                  }
                  className="bg-gray-50"
                />
              </Field>
            </div>
          </Field>

          <Field label="Info / Description">
            <Textarea
              value={form.info}
              onChange={(e) => setForm({ ...form, info: e.target.value })}
              rows={2}
            />
          </Field>

          <Field label="Services (comma separated)">
            <Input
              type="text"
              value={form.services}
              onChange={(e) => setForm({ ...form, services: e.target.value })}
              placeholder="Emergency, ICU, OPD, Lab"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="mb-2 block text-xs font-medium text-gray-600">
                Service Types
              </span>
              <div className="flex flex-wrap gap-2">
                {serviceTypeOptions.map((t: any) => (
                  <button
                    key={t._id}
                    type="button"
                    onClick={() => toggleServiceType(t._id)}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm border",
                      form.serviceTypes.includes(t._id)
                        ? "bg-blue-100 border-blue-400 text-blue-700"
                        : "bg-gray-50 text-gray-600",
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-2 block text-xs font-medium text-gray-600">
                Departments
              </span>
              <div className="flex flex-wrap gap-2">
                {deptOptions.map((d: any) => (
                  <button
                    key={d._id}
                    type="button"
                    onClick={() => toggleDepartment(d._id)}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm border",
                      form.departments.includes(d._id)
                        ? "bg-purple-100 border-purple-400 text-purple-700"
                        : "bg-gray-50 text-gray-600",
                    )}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Field label="Image">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        </form>
      </Modal>
    </div>
  );
};

export default CentreManagement;

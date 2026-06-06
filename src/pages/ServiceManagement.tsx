import React, { useEffect, useState, useRef, useCallback } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { serviceApi, categoryApi } from "../services/admin-api";
import MapPicker from "../components/MapPicker";
import Pagination from "../components/Pagination";
import SearchableSelect from "../components/SearchableSelect";
import type { FetchResult } from "../components/SearchableSelect";
import {
  PageHeader,
  Button,
  SearchInput,
  Select,
  Input,
  Textarea,
  Field,
  Card,
  Badge,
  Alert,
  Modal,
  Spinner,
  EmptyState,
} from "../components/ui";

const ICON_OPTIONS = [
  "Ambulance",
  "Building2",
  "FlaskConical",
  "Wallet",
  "Heart",
  "Shield",
  "Stethoscope",
  "Activity",
  "Clock",
  "MapPin",
  "CheckCircle",
  "Sparkles",
  "Phone",
  "Star",
  "Zap",
  "Users",
  "Award",
  "Briefcase",
  "GraduationCap",
  "TrendingUp",
];

const GRADIENT_OPTIONS = [
  { label: "Red (Emergency)", value: "from-hw-sos to-red-600" },
  { label: "Blue (Primary)", value: "from-hw-primary to-hw-primary-dark" },
  { label: "Cyan (Accent)", value: "from-hw-accent to-cyan-600" },
  { label: "Purple (Highlight)", value: "from-hw-highlight to-purple-600" },
  { label: "Green", value: "from-green-500 to-emerald-600" },
  { label: "Orange", value: "from-orange-500 to-amber-600" },
  { label: "Indigo", value: "from-indigo-500 to-blue-600" },
  { label: "Teal", value: "from-teal-500 to-cyan-600" },
];

const LIGHT_GRADIENT_OPTIONS = [
  { label: "Red Light", value: "from-red-50 to-rose-50" },
  { label: "Blue Light", value: "from-blue-50 to-indigo-50" },
  { label: "Cyan Light", value: "from-cyan-50 to-teal-50" },
  { label: "Purple Light", value: "from-purple-50 to-violet-50" },
  { label: "Green Light", value: "from-green-50 to-emerald-50" },
  { label: "Orange Light", value: "from-orange-50 to-amber-50" },
  { label: "Indigo Light", value: "from-indigo-50 to-blue-50" },
  { label: "Teal Light", value: "from-teal-50 to-cyan-50" },
];

interface Feature {
  text: string;
  icon: string;
}

interface Stat {
  value: string;
  label: string;
}

const emptyService = {
  title: "",
  subtitle: "",
  description: "",
  icon: "Heart",
  gradient: "from-hw-primary to-hw-primary-dark",
  lightGradient: "from-blue-50 to-indigo-50",
  ctaText: "Learn More",
  ctaLink: "",
  isPriority: false,
  sortOrder: 0,
  isActive: true,
  category: "",
  ctaAction: "info",
};

const CTA_ACTION_TYPES = [
  { value: "booking", label: "Booking" },
  { value: "location", label: "Location (Map)" },
  { value: "link", label: "Link" },
  { value: "contact", label: "Contact" },
  { value: "info", label: "Info" },
];

const ServiceManagement: React.FC = () => {
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ ...emptyService });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadServices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.q = search.trim();
      params.page = String(page);
      params.limit = "20";
      const res = await serviceApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setServices(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setServices(d || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load services");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
    loadCategories();
  }, [statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const loadCategories = async () => {
    try {
      const res = await categoryApi.getAll({ status: "active", limit: "1000" });
      setCategories(res.data?.items || res.data || []);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const fetchCategories = useCallback(
    async (params: { q: string; page: number; limit: number }): Promise<FetchResult> => {
      const res = await categoryApi.getAll({
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !form.title.trim() ||
      !form.subtitle.trim() ||
      !form.description.trim()
    ) {
      setError("Title, Subtitle, and Description are required");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("subtitle", form.subtitle);
      formData.append("description", form.description);
      formData.append("icon", form.icon);
      formData.append("gradient", form.gradient);
      formData.append("lightGradient", form.lightGradient);
      formData.append("ctaText", form.ctaText);
      formData.append("ctaLink", form.ctaLink);
      formData.append("isPriority", String(form.isPriority));
      formData.append("sortOrder", String(form.sortOrder));
      formData.append("isActive", String(form.isActive));
      formData.append("features", JSON.stringify(features));
      formData.append("stats", JSON.stringify(stats));

      if (form.category) {
        formData.append("category", form.category);
      }
      formData.append("ctaAction", form.ctaAction);

      if (location && form.ctaAction === "location") {
        formData.append(
          "location",
          JSON.stringify({
            coordinates: [location.lng, location.lat],
            address: location.address,
          }),
        );
      }

      if (imageFile) {
        formData.append("image", imageFile);
      }

      if (editingId) {
        await serviceApi.update(editingId, formData);
      } else {
        await serviceApi.create(formData);
      }

      handleCancel();
      await loadServices();
    } catch (err: any) {
      setError(err.message || "Failed to save service");
    }
  };

  const handleEdit = (service: any) => {
    setEditingId(service._id);
    setForm({
      title: service.title || "",
      subtitle: service.subtitle || "",
      description: service.description || "",
      icon: service.icon || "Heart",
      gradient: service.gradient || "from-hw-primary to-hw-primary-dark",
      lightGradient: service.lightGradient || "from-blue-50 to-indigo-50",
      ctaText: service.ctaText || "Learn More",
      ctaLink: service.ctaLink || "",
      isPriority: Boolean(service.isPriority),
      sortOrder: service.sortOrder || 0,
      isActive: Boolean(service.isActive),
      category: service.category?._id || service.category || "",
      ctaAction: service.ctaAction || "info",
    });
    setFeatures(service.features || []);
    setStats(service.stats || []);
    setImagePreview(service.image || null);
    setImageFile(null);
    // Restore location if present
    if (service.location?.coordinates) {
      setLocation({
        lat: service.location.coordinates[1],
        lng: service.location.coordinates[0],
        address: service.location.address || "",
      });
    } else {
      setLocation(null);
    }
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this service?")) return;
    setError(null);
    try {
      await serviceApi.remove(id);
      await loadServices();
    } catch (err: any) {
      setError(err.message || "Failed to delete service");
    }
  };

  const handleCancel = () => {
    setForm({ ...emptyService });
    setEditingId(null);
    setImageFile(null);
    setImagePreview(null);
    setFeatures([]);
    setStats([]);
    setLocation(null);
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Feature helpers
  const addFeature = () =>
    setFeatures([...features, { text: "", icon: "CheckCircle" }]);
  const removeFeature = (i: number) =>
    setFeatures(features.filter((_, idx) => idx !== i));
  const updateFeature = (i: number, field: keyof Feature, value: string) => {
    const updated = [...features];
    updated[i] = { ...updated[i], [field]: value };
    setFeatures(updated);
  };

  // Stat helpers
  const addStat = () => setStats([...stats, { value: "", label: "" }]);
  const removeStat = (i: number) =>
    setStats(stats.filter((_, idx) => idx !== i));
  const updateStat = (i: number, field: keyof Stat, value: string) => {
    const updated = [...stats];
    updated[i] = { ...updated[i], [field]: value };
    setStats(updated);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Services"
        subtitle={`${total || services.length} service(s) configured`}
        actions={
          <Button onClick={() => setShowForm(true)}>+ Add Service</Button>
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
          onKeyDown={(e) => e.key === "Enter" && loadServices()}
          placeholder="Search services…"
          className="w-full max-w-xs"
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
        <Button variant="secondary" onClick={loadServices}>
          Search
        </Button>
      </div>

      {/* Service Cards */}
      {isLoading ? (
        <Card className="flex items-center justify-center py-16">
          <Spinner />
        </Card>
      ) : services.length === 0 ? (
        <Card>
          <EmptyState title="No services found." />
        </Card>
      ) : (
        <div className="space-y-4">
          {services.map((service) => (
            <Card key={service._id} className="overflow-hidden">
              <div className="flex flex-col md:flex-row">
                {/* Image */}
                {service.image && (
                  <div className="flex-shrink-0 h-40 md:w-48 md:h-auto">
                    <img
                      src={service.image}
                      alt={service.title}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-gray-800">
                          {service.title}
                        </h3>
                        {service.isPriority && (
                          <Badge tone="danger">Priority</Badge>
                        )}
                        <Badge
                          tone={service.isActive ? "success" : "neutral"}
                          dot
                        >
                          {service.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-blue-600">
                        {service.subtitle}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-2"
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => handleEdit(service)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                        title="Delete"
                        aria-label="Delete"
                        onClick={() => handleDelete(service._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="mb-3 text-sm text-gray-600 line-clamp-2">
                    {service.description}
                  </p>

                  {/* Features preview */}
                  {service.features?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {service.features.map((f: any, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg"
                        >
                          {f.text}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats preview */}
                  {service.stats?.length > 0 && (
                    <div className="flex gap-4">
                      {service.stats.map((s: any, i: number) => (
                        <div key={i} className="text-center">
                          <div className="text-sm font-bold text-gray-800">
                            {s.value}
                          </div>
                          <div className="text-xs text-gray-500">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-gray-400">
                    Sort: {service.sortOrder} | Icon: {service.icon} | CTA:{" "}
                    {service.ctaText}
                    {service.ctaLink ? ` → ${service.ctaLink}` : ""}
                    {service.category?.name
                      ? ` | Category: ${service.category.name}`
                      : ""}
                    {service.ctaAction ? ` | Action: ${service.ctaAction}` : ""}
                    {service.location?.address
                      ? ` | 📍 ${service.location.address.substring(0, 40)}...`
                      : ""}
                  </div>
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
        label="services"
        onPageChange={setPage}
      />

      {/* Add / Edit Form */}
      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit Service" : "Add Service"}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? "Update Service" : "Add Service"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Title */}
            <Field label="Title *">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Ambulance Booking"
                required
              />
            </Field>

            {/* Subtitle */}
            <Field label="Subtitle *">
              <Input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="e.g. Emergency Response"
                required
              />
            </Field>

            {/* Icon */}
            <Field label="Icon">
              <Select
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
              >
                {ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Gradient */}
            <Field label="Color Theme">
              <Select
                value={form.gradient}
                onChange={(e) => setForm({ ...form, gradient: e.target.value })}
              >
                {GRADIENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Light Gradient */}
            <Field label="Light Background">
              <Select
                value={form.lightGradient}
                onChange={(e) =>
                  setForm({ ...form, lightGradient: e.target.value })
                }
              >
                {LIGHT_GRADIENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </Field>

            {/* CTA Text */}
            <Field label="CTA Button Text">
              <Input
                value={form.ctaText}
                onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                placeholder="e.g. Book Now"
              />
            </Field>

            {/* CTA Link */}
            <Field label="CTA Link (optional)">
              <Input
                value={form.ctaLink}
                onChange={(e) => setForm({ ...form, ctaLink: e.target.value })}
                placeholder="e.g. /centre-locator"
              />
            </Field>

            {/* Category */}
            <div>
              <SearchableSelect
                label="Category"
                value={form.category}
                onChange={(catId) => {
                  setForm({ ...form, category: catId });
                  // Auto-set ctaAction from category's first ctaOption if available
                  const selectedCat = categories.find((c) => c._id === catId);
                  if (selectedCat?.ctaOptions?.length > 0) {
                    setForm((prev) => ({
                      ...prev,
                      category: catId,
                      ctaAction: selectedCat.ctaOptions[0].actionType,
                      ctaText: selectedCat.ctaOptions[0].label,
                    }));
                  }
                }}
                fetchOptions={fetchCategories}
                placeholder="Search category..."
                valueField="_id"
                displayField="name"
              />
            </div>

            {/* CTA Action Type */}
            <Field label="CTA Action Type">
              {(() => {
                const selectedCat = categories.find(
                  (c) => c._id === form.category,
                );
                const options =
                  selectedCat?.ctaOptions?.length > 0
                    ? selectedCat.ctaOptions.map((o: any) => ({
                        value: o.actionType,
                        label: `${o.label} (${o.actionType})`,
                      }))
                    : CTA_ACTION_TYPES;
                return (
                  <Select
                    value={form.ctaAction}
                    onChange={(e) => {
                      const action = e.target.value;
                      setForm({ ...form, ctaAction: action });
                      // Auto-update CTA text from category's matching ctaOption
                      if (selectedCat?.ctaOptions?.length > 0) {
                        const match = selectedCat.ctaOptions.find(
                          (o: any) => o.actionType === action,
                        );
                        if (match) {
                          setForm((prev) => ({
                            ...prev,
                            ctaAction: action,
                            ctaText: match.label,
                          }));
                        }
                      }
                    }}
                  >
                    {options.map((opt: any) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                );
              })()}
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

            {/* Image Upload */}
            <Field label="Image">
              <div className="flex items-center gap-3">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="object-cover w-16 h-12 border rounded-lg"
                  />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="flex-1 px-3 py-1.5 border rounded-lg text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium file:cursor-pointer"
                />
              </div>
            </Field>
          </div>

          {/* Toggles row */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPriority}
                onChange={(e) =>
                  setForm({ ...form, isPriority: e.target.checked })
                }
                className="w-4 h-4 text-red-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Emergency Priority Badge
              </span>
            </label>
          </div>

          {/* Description */}
          <Field label="Description *">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Full description of the service..."
              className="resize-none"
              required
            />
          </Field>

          {/* Map Location Picker (shown when ctaAction is "location") */}
          {form.ctaAction === "location" && (
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">
                📍 Service Location (Map)
              </label>
              <MapPicker
                value={location || undefined}
                onChange={(loc) => setLocation(loc)}
              />
            </div>
          )}

          {/* Features */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Features
              </label>
              <Button
                type="button"
                size="sm"
                variant="subtle"
                onClick={addFeature}
              >
                + Add Feature
              </Button>
            </div>
            {features.length === 0 && (
              <p className="text-sm italic text-gray-400">
                No features added yet. Click "Add Feature" to start.
              </p>
            )}
            <div className="space-y-2">
              {features.map((feat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={feat.icon}
                    onChange={(e) => updateFeature(i, "icon", e.target.value)}
                    className="w-36"
                  >
                    {ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={feat.text}
                    onChange={(e) => updateFeature(i, "text", e.target.value)}
                    placeholder="Feature description"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => removeFeature(i)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Stats (shown on image overlay)
              </label>
              <Button
                type="button"
                size="sm"
                variant="subtle"
                className="bg-green-50 text-green-700 hover:bg-green-100 focus-visible:ring-green-500"
                onClick={addStat}
              >
                + Add Stat
              </Button>
            </div>
            {stats.length === 0 && (
              <p className="text-sm italic text-gray-400">
                No stats added yet. Click "Add Stat" to start.
              </p>
            )}
            <div className="space-y-2">
              {stats.map((stat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={stat.value}
                    onChange={(e) => updateStat(i, "value", e.target.value)}
                    placeholder="e.g. 50+"
                    className="w-28"
                  />
                  <Input
                    value={stat.label}
                    onChange={(e) => updateStat(i, "label", e.target.value)}
                    placeholder="e.g. Ambulances"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => removeStat(i)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ServiceManagement;

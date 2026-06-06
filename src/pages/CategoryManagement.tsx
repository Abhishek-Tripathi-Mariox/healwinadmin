import React, { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { categoryApi } from "../services/admin-api";
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
  Modal,
  Field,
  Input,
  Textarea,
  Alert,
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

const CTA_ACTION_TYPES = [
  {
    value: "booking",
    label: "Booking",
    description: "Opens a booking/appointment flow",
  },
  {
    value: "location",
    label: "Location",
    description: "Shows nearby centres on map",
  },
  { value: "link", label: "Link", description: "Navigates to a URL" },
  {
    value: "contact",
    label: "Contact",
    description: "Opens contact/phone action",
  },
  { value: "info", label: "Info", description: "Shows more information" },
];

interface CtaOption {
  label: string;
  actionType: string;
}

const emptyCategory = {
  name: "",
  icon: "Heart",
  description: "",
  sortOrder: 0,
  isActive: true,
};

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ ...emptyCategory });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ctaOptions, setCtaOptions] = useState<CtaOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.q = search.trim();
      params.page = String(page);
      params.limit = "20";
      const res = await categoryApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setCategories(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setCategories(d || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Category name is required");
      return;
    }

    try {
      const payload = {
        ...form,
        ctaOptions: ctaOptions.filter((o) => o.label.trim()),
      };

      if (editingId) {
        await categoryApi.update(editingId, payload);
      } else {
        await categoryApi.create(payload);
      }

      handleCancel();
      await loadCategories();
    } catch (err: any) {
      setError(err.message || "Failed to save category");
    }
  };

  const handleEdit = (category: any) => {
    setEditingId(category._id);
    setForm({
      name: category.name || "",
      icon: category.icon || "Heart",
      description: category.description || "",
      sortOrder: category.sortOrder || 0,
      isActive: Boolean(category.isActive),
    });
    setCtaOptions(category.ctaOptions || []);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Delete this category? Services linked to it will be unlinked.",
      )
    )
      return;
    setError(null);
    try {
      await categoryApi.remove(id);
      await loadCategories();
    } catch (err: any) {
      setError(err.message || "Failed to delete category");
    }
  };

  const handleCancel = () => {
    setForm({ ...emptyCategory });
    setEditingId(null);
    setCtaOptions([]);
    setShowForm(false);
  };

  // CTA Option helpers
  const addCtaOption = () =>
    setCtaOptions([...ctaOptions, { label: "", actionType: "info" }]);
  const removeCtaOption = (i: number) =>
    setCtaOptions(ctaOptions.filter((_, idx) => idx !== i));
  const updateCtaOption = (
    i: number,
    field: keyof CtaOption,
    value: string,
  ) => {
    const updated = [...ctaOptions];
    updated[i] = { ...updated[i], [field]: value };
    setCtaOptions(updated);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Service Categories"
        subtitle={`${total || categories.length} categor${
          (total || categories.length) !== 1 ? "ies" : "y"
        }`}
        actions={
          <Button onClick={() => setShowForm(true)}>+ Add Category</Button>
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

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          placeholder="Search categories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadCategories()}
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
        <Button variant="secondary" onClick={loadCategories}>
          Search
        </Button>
      </div>

      <Table>
        <THead>
          <Th>Name</Th>
          <Th>Description</Th>
          <Th>CTA Actions</Th>
          <Th>Sort</Th>
          <Th>Icon</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {isLoading ? (
            <TableState colSpan={7}>Loading…</TableState>
          ) : categories.length === 0 ? (
            <TableState colSpan={7}>No categories found.</TableState>
          ) : (
            categories.map((category) => (
              <TR key={category._id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-healwin-50">
                      <span className="text-sm font-bold text-healwin-700">
                        {category.icon?.charAt(0) || "C"}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {category.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        /{category.slug}
                      </div>
                    </div>
                  </div>
                </Td>
                <Td className="max-w-xs text-gray-500">
                  {category.description || "—"}
                </Td>
                <Td>
                  {category.ctaOptions?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {category.ctaOptions.map((opt: any, i: number) => (
                        <Badge key={i} tone="accent">
                          <span className="capitalize">{opt.actionType}</span>
                          <span className="text-healwin-400">•</span>
                          {opt.label}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </Td>
                <Td className="text-gray-500">{category.sortOrder}</Td>
                <Td className="text-gray-500">{category.icon}</Td>
                <Td>
                  <Badge tone={category.isActive ? "success" : "neutral"} dot>
                    {category.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => handleEdit(category)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={() => handleDelete(category._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        label="categories"
        onPageChange={setPage}
      />

      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit Category" : "Add Category"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? "Update Category" : "Add Category"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Name *">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Ambulance"
                required
              />
            </Field>
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
            <Field label="Sort Order">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) })
                }
              />
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              placeholder="Brief description of this category..."
              className="resize-none"
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded text-healwin-600"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>

          {/* CTA Options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-gray-700">
                  CTA Button Options
                </span>
                <p className="text-xs text-gray-400">
                  Define what actions services in this category can offer
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="subtle"
                onClick={addCtaOption}
              >
                + Add CTA Option
              </Button>
            </div>
            {ctaOptions.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                No CTA options defined. Services in this category will use the
                default "Info" action.
              </p>
            )}
            <div className="space-y-2">
              {ctaOptions.map((opt, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      value={opt.label}
                      onChange={(e) =>
                        updateCtaOption(i, "label", e.target.value)
                      }
                      placeholder="Button label (e.g. Book Now, Find Centres)"
                    />
                  </div>
                  <div className="w-48">
                    <Select
                      value={opt.actionType}
                      onChange={(e) =>
                        updateCtaOption(i, "actionType", e.target.value)
                      }
                    >
                      {CTA_ACTION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label} — {type.description}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => removeCtaOption(i)}
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

export default CategoryManagement;

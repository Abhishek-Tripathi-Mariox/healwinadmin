import React, { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { locatorServiceTypeApi } from "../services/admin-api";
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

interface ServiceTypeItem {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  applicableTo: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyType = {
  name: "",
  description: "",
  icon: "Building2",
  applicableTo: "centre_locator",
  isActive: true,
  sortOrder: 0,
};

const APPLICABLE_OPTIONS = [
  { value: "centre_locator", label: "Centre Locator" },
  { value: "driving", label: "Driving" },
  { value: "both", label: "Both" },
];

const LocatorServiceTypeManagement: React.FC = () => {
  const [types, setTypes] = useState<ServiceTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(emptyType);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadTypes = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;
      params.page = String(page);
      params.limit = "20";
      const res = await locatorServiceTypeApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setTypes(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setTypes(d || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, [search, statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Service type name is required");
      return;
    }

    try {
      if (editingId) await locatorServiceTypeApi.update(editingId, form);
      else await locatorServiceTypeApi.create(form);
      setForm(emptyType);
      setEditingId(null);
      setShowForm(false);
      loadTypes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (item: ServiceTypeItem) => {
    setForm({
      name: item.name,
      description: item.description,
      icon: item.icon,
      applicableTo: item.applicableTo,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this service type?")) return;
    try {
      await locatorServiceTypeApi.remove(id);
      loadTypes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setForm(emptyType);
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Service Type Management"
        subtitle={`${total || types.length} service type(s) configured`}
        actions={
          <Button onClick={() => setShowForm(true)}>+ Add Service Type</Button>
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
          placeholder="Search service types…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs"
        />
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

      <Table>
        <THead>
          <Th>Name</Th>
          <Th>Slug</Th>
          <Th>Icon</Th>
          <Th>Applicable</Th>
          <Th>Order</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={7}>Loading…</TableState>
          ) : types.length === 0 ? (
            <TableState colSpan={7}>No service types found.</TableState>
          ) : (
            types.map((t) => (
              <TR key={t._id}>
                <Td className="font-medium text-gray-900">
                  {t.name}
                  {t.description && (
                    <span className="mt-0.5 block text-xs font-normal text-gray-400">
                      {t.description}
                    </span>
                  )}
                </Td>
                <Td className="text-gray-500">{t.slug}</Td>
                <Td className="text-gray-500">{t.icon}</Td>
                <Td>
                  <Badge tone="info">{t.applicableTo.replace("_", " ")}</Badge>
                </Td>
                <Td className="text-gray-500">{t.sortOrder}</Td>
                <Td>
                  <Badge tone={t.isActive ? "success" : "danger"} dot>
                    {t.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" className="px-2" title="Edit" aria-label="Edit" onClick={() => handleEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={() => handleDelete(t._id)}
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
        label="service types"
        onPageChange={setPage}
      />

      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit Service Type" : "Add Service Type"}
        size="lg"
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Name *">
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Applicable To">
              <Select
                value={form.applicableTo}
                onChange={(e) =>
                  setForm({ ...form, applicableTo: e.target.value })
                }
              >
                {APPLICABLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Icon">
              <Input
                type="text"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="e.g. Building2, Ambulance"
              />
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
            <Field label="Description" className="md:col-span-2">
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
              />
            </Field>
          </div>
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

export default LocatorServiceTypeManagement;

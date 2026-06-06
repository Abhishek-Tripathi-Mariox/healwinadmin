import React, { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { designationApi } from "../services/admin-api";
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
  Alert,
} from "../components/ui";

interface DesignationItem {
  _id: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyDesig = { name: "", description: "", isActive: true, sortOrder: 0 };

const DesignationManagement: React.FC = () => {
  const [designations, setDesignations] = useState<DesignationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(emptyDesig);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadDesignations = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;
      params.page = String(page);
      params.limit = "20";
      const res = await designationApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setDesignations(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setDesignations(d || []);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDesignations();
  }, [search, statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Designation name is required");
      return;
    }

    try {
      if (editingId) await designationApi.update(editingId, form);
      else await designationApi.create(form);
      setForm(emptyDesig);
      setEditingId(null);
      setShowForm(false);
      loadDesignations();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (item: DesignationItem) => {
    setForm({
      name: item.name,
      description: item.description,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this designation?")) return;
    try {
      await designationApi.remove(id);
      loadDesignations();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleCancel = () => {
    setForm(emptyDesig);
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Designation Management"
        subtitle={`${designations.length} designation(s) — used in Careers & Team sections`}
        actions={
          <Button onClick={() => setShowForm(true)}>+ Add Designation</Button>
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
          placeholder="Search designations…"
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
          <Th>Description</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={4}>Loading…</TableState>
          ) : designations.length === 0 ? (
            <TableState colSpan={4}>No designations found.</TableState>
          ) : (
            designations.map((d) => (
              <TR key={d._id}>
                <Td className="font-medium text-gray-900">{d.name}</Td>
                <Td className="text-gray-500">{d.description || "—"}</Td>
                <Td>
                  <Badge tone={d.isActive ? "success" : "danger"} dot>
                    {d.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => handleEdit(d)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={() => handleDelete(d._id)}
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
        label="designations"
        onPageChange={setPage}
      />

      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit Designation" : "Add Designation"}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Name *">
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Founder & CEO"
                required
              />
            </Field>
            <Field label="Description">
              <Input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
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

export default DesignationManagement;

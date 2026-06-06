import React, { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { stateApi } from "../services/admin-api";
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

interface StateItem {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyState: Omit<StateItem, "_id"> = {
  name: "",
  code: "",
  isActive: true,
  sortOrder: 0,
};

const StateManagement: React.FC = () => {
  const [states, setStates] = useState<StateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(emptyState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadStates = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;
      params.page = String(page);
      params.limit = "20";
      const res = await stateApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setStates(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setStates(d || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStates();
  }, [search, statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.code.trim()) {
      setError("State name and Code are required");
      return;
    }

    try {
      if (editingId) {
        await stateApi.update(editingId, form);
      } else {
        await stateApi.create(form);
      }
      setForm(emptyState);
      setEditingId(null);
      setShowForm(false);
      loadStates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (item: StateItem) => {
    setForm({
      name: item.name,
      code: item.code,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this state?")) return;
    try {
      await stateApi.remove(id);
      loadStates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setForm(emptyState);
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="States"
        subtitle={`${total || states.length} state(s) configured`}
        actions={
          <Button onClick={() => setShowForm(true)}>+ Add State</Button>
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
          placeholder="Search states…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      <Table>
        <THead>
          <Th>Name</Th>
          <Th>Code</Th>
          <Th>Order</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : states.length === 0 ? (
            <TableState colSpan={5}>No states found.</TableState>
          ) : (
            states.map((s) => (
              <TR key={s._id}>
                <Td className="font-medium text-gray-900">{s.name}</Td>
                <Td className="text-gray-500">{s.code}</Td>
                <Td className="text-gray-500">{s.sortOrder}</Td>
                <Td>
                  <Badge tone={s.isActive ? "success" : "neutral"} dot>
                    {s.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => handleEdit(s)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={() => handleDelete(s._id)}
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
        label="states"
        onPageChange={setPage}
      />

      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit State" : "Add State"}
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
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Code * (2–3 letter)">
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                maxLength={5}
                required
              />
            </Field>
            <Field label="Sort order">
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

export default StateManagement;

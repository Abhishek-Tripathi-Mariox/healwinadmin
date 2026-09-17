import React, { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { employmentTypeApi } from "../services/admin-api";
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
import { dialog } from "../services/dialog";

interface EmploymentTypeItem {
  _id: string;
  name: string;
  description: string;
  engagement?: "payroll" | "contract";
  isActive: boolean;
  sortOrder: number;
}

const emptyType = {
  name: "",
  description: "",
  engagement: "payroll" as "payroll" | "contract",
  isActive: true,
  sortOrder: 0,
};

const ENGAGEMENT_LABEL: Record<string, string> = {
  payroll: "On HealWin payroll",
  contract: "Contract basis",
};

const EmploymentTypeManagement: React.FC = () => {
  const [types, setTypes] = useState<EmploymentTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [engagementFilter, setEngagementFilter] = useState("");
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
      if (engagementFilter) params.engagement = engagementFilter;
      params.page = String(page);
      params.limit = "20";
      const res = await employmentTypeApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setTypes(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setTypes(d || []);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, [search, statusFilter, engagementFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, engagementFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Employment type name is required");
      return;
    }

    try {
      if (editingId) await employmentTypeApi.update(editingId, form);
      else await employmentTypeApi.create(form);
      setForm(emptyType);
      setEditingId(null);
      setShowForm(false);
      loadTypes();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (item: EmploymentTypeItem) => {
    setForm({
      name: item.name,
      description: item.description,
      engagement: item.engagement || "payroll",
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!await dialog.confirm({ message: "Delete this employment type?", confirmLabel: "Delete", tone: "danger" })) return;
    try {
      await employmentTypeApi.remove(id);
      loadTypes();
    } catch (err: unknown) {
      setError((err as Error).message);
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
        title="Employment Type Management"
        subtitle={`${total || types.length} type(s) · Full-time / Part-time etc., each marked as HealWin payroll or contract basis`}
        actions={
          <Button onClick={() => setShowForm(true)}>+ Add Type</Button>
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
          placeholder="Search employment types…"
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
        <Select
          value={engagementFilter}
          onChange={(e) => setEngagementFilter(e.target.value)}
          className="w-auto"
        >
          <option value="">All engagements</option>
          <option value="payroll">On HealWin payroll</option>
          <option value="contract">Contract basis</option>
        </Select>
      </div>

      <Table>
        <THead>
          <Th>Name</Th>
          <Th>Engagement</Th>
          <Th>Description</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : types.length === 0 ? (
            <TableState colSpan={5}>No employment types found.</TableState>
          ) : (
            types.map((t) => (
              <TR key={t._id}>
                <Td className="font-medium text-gray-900">{t.name}</Td>
                <Td>
                  <Badge tone={t.engagement === "contract" ? "warning" : "info"}>
                    {ENGAGEMENT_LABEL[t.engagement || "payroll"]}
                  </Badge>
                </Td>
                <Td className="text-gray-500">{t.description || "—"}</Td>
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
        label="employment types"
        onPageChange={setPage}
      />

      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit Employment Type" : "Add Employment Type"}
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
                placeholder="e.g. Full-time, Part-time, Contract"
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
          <Field
            label="Engagement *"
            hint="Whether people of this type are on HealWin's own payroll or engaged on a contract basis."
          >
            <Select
              value={form.engagement}
              onChange={(e) =>
                setForm({ ...form, engagement: e.target.value as "payroll" | "contract" })
              }
            >
              <option value="payroll">On HealWin payroll</option>
              <option value="contract">Contract basis</option>
            </Select>
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

export default EmploymentTypeManagement;

import React, { useEffect, useState, useCallback } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { districtApi, stateApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import SearchableSelect from "../components/SearchableSelect";
import type { FetchResult } from "../components/SearchableSelect";
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

interface DistrictItem {
  _id: string;
  name: string;
  state: { _id: string; name: string; code: string } | null;
  isActive: boolean;
  sortOrder: number;
}

interface StateOption {
  _id: string;
  name: string;
  code: string;
}

const emptyDistrict = { name: "", state: "", isActive: true, sortOrder: 0 };

const DistrictManagement: React.FC = () => {
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [stateOptions, setStateOptions] = useState<StateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [form, setForm] = useState(emptyDistrict);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadStates = async () => {
    try {
      const res = await stateApi.getAll({ status: "active", limit: "1000" });
      setStateOptions(res.data?.items || res.data || []);
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

  const loadDistricts = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;
      if (stateFilter) params.state = stateFilter;
      params.page = String(page);
      params.limit = "20";
      const res = await districtApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setDistricts(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setDistricts(d || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStates();
  }, []);
  useEffect(() => {
    loadDistricts();
  }, [search, statusFilter, stateFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, stateFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.state.trim()) {
      setError("District name and State are required");
      return;
    }

    try {
      if (editingId) {
        await districtApi.update(editingId, form);
      } else {
        await districtApi.create(form);
      }
      setForm(emptyDistrict);
      setEditingId(null);
      setShowForm(false);
      loadDistricts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (item: DistrictItem) => {
    setForm({
      name: item.name,
      state: item.state?._id || "",
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this district?")) return;
    try {
      await districtApi.remove(id);
      loadDistricts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setForm(emptyDistrict);
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="District Management"
        subtitle={`${total || districts.length} district(s) configured`}
        actions={
          <Button onClick={() => setShowForm(true)}>+ Add District</Button>
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
          placeholder="Search districts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs"
        />
        <Select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="w-auto"
        >
          <option value="">All States</option>
          {stateOptions.map((s) => (
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

      <Table>
        <THead>
          <Th>Name</Th>
          <Th>State</Th>
          <Th>Order</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : districts.length === 0 ? (
            <TableState colSpan={5}>No districts found.</TableState>
          ) : (
            districts.map((c) => (
              <TR key={c._id}>
                <Td className="font-medium text-gray-900">{c.name}</Td>
                <Td className="text-gray-500">{c.state?.name || "—"}</Td>
                <Td className="text-gray-500">{c.sortOrder}</Td>
                <Td>
                  <Badge tone={c.isActive ? "success" : "danger"} dot>
                    {c.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
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
        label="districts"
        onPageChange={setPage}
      />

      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit District" : "Add District"}
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
                required
              />
            </Field>
            <SearchableSelect
              label="State"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e })}
              fetchOptions={fetchStates}
              placeholder="Search state..."
              required
              valueField="_id"
              displayField="name"
            />
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

export default DistrictManagement;

import React, { useEffect, useState, useCallback } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { divisionApi, districtApi, stateApi } from "../services/admin-api";
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

interface DivisionItem {
  _id: string;
  name: string;
  district: {
    _id: string;
    name: string;
    state?: { _id: string; name: string; code: string };
  } | null;
  isActive: boolean;
  sortOrder: number;
}

const emptyDivision = { name: "", district: "", isActive: true, sortOrder: 0 };

const DivisionManagement: React.FC = () => {
  const [divisions, setDivisions] = useState<DivisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [districtFilter, _setDistrictFilter] = useState("");
  const [formStateFilter, setFormStateFilter] = useState("");
  const [form, setForm] = useState(emptyDivision);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

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
      if (!formStateFilter) return { items: [], hasMore: false };
      const res = await districtApi.getAll({
        state: formStateFilter,
        status: "active",
        ...(params.q && { q: params.q }),
        page: String(params.page),
        limit: String(params.limit),
      });
      const items = res.data?.items || res.data || [];
      const totalPages = res.data?.pagination?.pages || 1;
      return { items, hasMore: params.page < totalPages };
    },
    [formStateFilter]
  );

  const loadDivisions = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;
      if (districtFilter) params.district = districtFilter;
      params.page = String(page);
      params.limit = "20";
      const res = await divisionApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setDivisions(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setDivisions(d || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDivisions();
  }, [search, statusFilter, districtFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, districtFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.district.trim()) {
      setError("Division name and District are required");
      return;
    }

    try {
      if (editingId) await divisionApi.update(editingId, form);
      else await divisionApi.create(form);
      setForm(emptyDivision);
      setEditingId(null);
      setShowForm(false);
      setFormStateFilter("");
      loadDivisions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (item: DivisionItem) => {
    const stateId = item.district?.state?._id || "";
    setFormStateFilter(stateId);
    setForm({
      name: item.name,
      district: item.district?._id || "",
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
    setEditingId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this division?")) return;
    try {
      await divisionApi.remove(id);
      loadDivisions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setForm(emptyDivision);
    setEditingId(null);
    setShowForm(false);
    setFormStateFilter("");
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Division Management"
        subtitle={`${total || divisions.length} division(s) configured`}
        actions={
          <Button onClick={() => setShowForm(true)}>+ Add Division</Button>
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
          placeholder="Search divisions…"
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
          <Th>Division</Th>
          <Th>District</Th>
          <Th>State</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : divisions.length === 0 ? (
            <TableState colSpan={5}>No divisions found.</TableState>
          ) : (
            divisions.map((d) => (
              <TR key={d._id}>
                <Td className="font-medium text-gray-900">{d.name}</Td>
                <Td className="text-gray-500">{d.district?.name || "—"}</Td>
                <Td className="text-gray-500">
                  {d.district?.state?.name || "—"}
                </Td>
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
        label="divisions"
        onPageChange={setPage}
      />

      <Modal
        open={showForm}
        onClose={handleCancel}
        title={editingId ? "Edit Division" : "Add Division"}
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
            <div>
              <SearchableSelect
                label="State"
                value={formStateFilter}
                onChange={(e) => {
                  setFormStateFilter(e);
                  setForm({ ...form, district: "" });
                }}
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
                disabled={!formStateFilter}
                valueField="_id"
                displayField="name"
              />
            </div>
            <Field label="Division Name *">
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
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

export default DivisionManagement;

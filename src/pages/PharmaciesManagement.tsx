import { useEffect, useState, useCallback } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { pharmacyApi } from "../services/admin-api";
import MapPicker from "../components/MapPicker";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
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

interface Pharmacy {
  _id: string;
  name: string;
  ownerName?: string;
  phone: string;
  address: string;
  is24x7: boolean;
  status: "pending" | "approved" | "rejected";
  source: string;
  isActive: boolean;
  location?: { coordinates: [number, number] };
}

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
};

const emptyForm = {
  name: "",
  ownerName: "",
  licenseNumber: "",
  phone: "",
  email: "",
  address: "",
  timings: "",
  is24x7: false,
  services: "",
  lat: "",
  lng: "",
};

export default function PharmaciesManagement() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.PHARMACIES_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.PHARMACIES_UPDATE);
  const canApprove = hasPermission(PERMISSIONS.PHARMACIES_APPROVE);
  const canDelete = hasPermission(PERMISSIONS.PHARMACIES_DELETE);

  const [items, setItems] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const res = await pharmacyApi.list(params);
      setItems(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setShowForm(true);
  };

  const openEdit = (p: Pharmacy) => {
    setEditingId(p._id);
    setForm({
      ...emptyForm,
      name: p.name,
      ownerName: p.ownerName || "",
      phone: p.phone,
      address: p.address,
      is24x7: p.is24x7,
      lng: p.location?.coordinates?.[0]?.toString() || "",
      lat: p.location?.coordinates?.[1]?.toString() || "",
    });
    setError("");
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError("Name, phone and address are required.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) {
      setError("Phone must be a valid 10-digit mobile number (starting 6-9).");
      return;
    }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
    try {
      if (editingId) await pharmacyApi.update(editingId, fd);
      else await pharmacyApi.create(fd);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message || "Failed to save pharmacy");
    }
  };

  const approve = async (p: Pharmacy, ok: boolean) => {
    const reason = ok ? undefined : window.prompt("Rejection reason?") || "";
    await pharmacyApi.approve(p._id, ok, reason);
    load();
  };

  const remove = async (p: Pharmacy) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    await pharmacyApi.remove(p._id);
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Pharmacies"
        subtitle="Onboarding, verified listings & locator"
        actions={
          canCreate && <Button onClick={openCreate}>+ Add Pharmacy</Button>
        }
      />

      {error && !showForm && (
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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search by name / phone / address"
          className="w-full max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Button variant="secondary" onClick={load}>
          Search
        </Button>
      </div>

      <Table>
        <THead>
          <Th>Name</Th>
          <Th>Phone</Th>
          <Th>Address</Th>
          <Th>Source</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={6}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={6}>No pharmacies.</TableState>
          ) : (
            items.map((p) => (
              <TR key={p._id}>
                <Td className="font-medium text-gray-900">
                  {p.name}
                  {p.is24x7 && (
                    <Badge tone="info" className="ml-2">
                      24×7
                    </Badge>
                  )}
                </Td>
                <Td>{p.phone}</Td>
                <Td className="text-gray-500 max-w-xs truncate">{p.address}</Td>
                <Td className="capitalize text-gray-500">{p.source}</Td>
                <Td>
                  <Badge tone={statusTone[p.status] || "neutral"} dot>
                    {p.status}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {canApprove && p.status !== "approved" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-green-600 hover:bg-green-50 hover:text-green-700"
                      onClick={() => approve(p, true)}
                    >
                      Approve
                    </Button>
                  )}
                  {canApprove && p.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                      onClick={() => approve(p, false)}
                    >
                      Reject
                    </Button>
                  )}
                  {canUpdate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      title="Edit"
                      aria-label="Edit"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      title="Delete"
                      aria-label="Delete"
                      onClick={() => remove(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? "Edit Pharmacy" : "Add Pharmacy"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>{editingId ? "Update" : "Create"}</Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <Alert tone="danger">{error}</Alert>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Pharmacy name *">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Owner name">
              <Input
                value={form.ownerName}
                onChange={(e) =>
                  setForm({ ...form, ownerName: e.target.value })
                }
              />
            </Field>
            <Field label="Phone *">
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
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="License number">
              <Input
                value={form.licenseNumber}
                onChange={(e) =>
                  setForm({ ...form, licenseNumber: e.target.value })
                }
              />
            </Field>
            <Field label="Timings (e.g. 9am–9pm)">
              <Input
                value={form.timings}
                onChange={(e) => setForm({ ...form, timings: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Address *">
            <Textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="Services (comma separated)">
            <Input
              value={form.services}
              onChange={(e) => setForm({ ...form, services: e.target.value })}
            />
          </Field>

          <Field label="Location (search an address, click the map, or use current location)">
            <MapPicker
              value={{ lat: Number(form.lat) || 0, lng: Number(form.lng) || 0, address: form.address }}
              onChange={(loc) =>
                setForm({
                  ...form,
                  lat: String(loc.lat),
                  lng: String(loc.lng),
                  // Fill the address from the picked place if the field is empty.
                  address: form.address.trim() ? form.address : loc.address || form.address,
                })
              }
            />
            <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Latitude">
                <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="bg-gray-50" />
              </Field>
              <Field label="Longitude">
                <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="bg-gray-50" />
              </Field>
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is24x7}
              onChange={(e) => setForm({ ...form, is24x7: e.target.checked })}
            />
            Open 24×7
          </label>
        </form>
      </Modal>
    </div>
  );
}

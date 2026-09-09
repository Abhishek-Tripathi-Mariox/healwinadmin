// Attendance geofence locations (§4.2, §4.4). Replaces the single hardcoded
// 0.5 km radius: a hospital campus, a small centre and an ambulance bay are
// not the same size, and different staff report to different places.
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { geofenceApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import {
  PageHeader, Button, Card, Table, THead, TBody, TR, Th, Td, TableState,
  Badge, Modal, Field, Input, Alert,
} from "../../components/ui";
import { dialog } from "../../services/dialog";

interface Fence {
  _id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  employeeCategories: string[];
  isActive: boolean;
}

const blank = {
  name: "", address: "", lat: "", lng: "",
  radiusMeters: 500, employeeCategories: [] as string[], isActive: true,
};

export default function GeofenceManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.ATTENDANCE_MANAGE);

  const [items, setItems] = useState<Fence[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await geofenceApi.list();
      setItems(res.data?.items || []);
      setCategories(res.data?.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openForm = (f?: Fence) => {
    setModalErr("");
    if (f) {
      setEditing(f._id);
      setForm({
        name: f.name, address: f.address || "", lat: String(f.lat),
        lng: String(f.lng), radiusMeters: f.radiusMeters,
        employeeCategories: f.employeeCategories || [], isActive: f.isActive,
      });
    } else {
      setEditing(null);
      setForm({ ...blank });
    }
    setOpen(true);
  };

  const toggleCat = (c: string) =>
    setForm((f) => ({
      ...f,
      employeeCategories: f.employeeCategories.includes(c)
        ? f.employeeCategories.filter((x) => x !== c)
        : [...f.employeeCategories, c],
    }));

  const submit = async () => {
    setSaving(true);
    setModalErr("");
    try {
      await geofenceApi.save(
        { ...form, lat: Number(form.lat), lng: Number(form.lng) },
        editing || undefined,
      );
      setOpen(false);
      load();
    } catch (err: unknown) {
      const e = err as { data?: { hint?: string }; message?: string };
      setModalErr(e.data?.hint || e.message || "Failed to save the location");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (f: Fence) => {
    if (!await dialog.confirm({ message: `Delete the ${f.name} attendance location?`, confirmLabel: "Delete", tone: "danger" })) return;
    try {
      await geofenceApi.remove(f._id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Attendance Locations"
        subtitle="Where staff may mark attendance, and how far from each point still counts"
        actions={
          canManage && (
            <Button onClick={() => openForm()} icon={<Plus className="h-4 w-4" />}>
              New Location
            </Button>
          )
        }
      />
      {error && <Alert tone="danger">{error}</Alert>}

      <Alert tone="info">
        Geofencing records whether a punch was made on site — it never blocks
        attendance. Staff legitimately start a shift from the field, so the
        result is evidence for HR, not a gate on anyone's pay.
      </Alert>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Location</Th><Th>Coordinates</Th><Th className="text-right">Radius</Th>
            <Th>Applies to</Th><Th>Status</Th><Th></Th>
          </THead>
          <TBody>
            {loading ? (
              <TableState colSpan={6}>Loading…</TableState>
            ) : items.length === 0 ? (
              <TableState colSpan={6}>
                No locations configured. Until one exists, ambulance crew fall
                back to their assigned centre with a 500 m radius.
              </TableState>
            ) : (
              items.map((f) => (
                <TR key={f._id}>
                  <Td>
                    <span className="font-medium text-gray-900">{f.name}</span>
                    {f.address && <div className="text-xs text-gray-500">{f.address}</div>}
                  </Td>
                  <Td className="font-mono text-xs whitespace-nowrap">
                    {f.lat.toFixed(5)}, {f.lng.toFixed(5)}
                    <a
                      className="ml-2 inline-flex align-middle text-cyan-700"
                      href={`https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Open in Maps"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </a>
                  </Td>
                  <Td className="text-right whitespace-nowrap">{f.radiusMeters} m</Td>
                  <Td className="text-xs">
                    {f.employeeCategories.length === 0
                      ? "All categories"
                      : f.employeeCategories
                          .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
                          .join(", ")}
                  </Td>
                  <Td>
                    <Badge tone={f.isActive ? "success" : "neutral"} dot>
                      {f.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" className="px-2" title="Edit" aria-label="Edit" onClick={() => openForm(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="px-2 text-red-600 hover:bg-red-50" title="Delete" aria-label="Delete" onClick={() => remove(f)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit attendance location" : "New attendance location"}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save location"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {modalErr && <Alert tone="danger">{modalErr}</Alert>}
          <Field label="Name *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Healwin Centre, Lucknow" />
          </Field>
          <Field label="Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Latitude *">
              <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="26.8467" />
            </Field>
            <Field label="Longitude *">
              <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="80.9462" />
            </Field>
            <Field label="Radius (m) *" hint="Minimum 20 m — below that is inside GPS error.">
              <Input type="number" min="20" max="20000" value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Applies to" hint="Select none to apply to every employee category.">
            <div className="flex flex-wrap gap-2 pt-1">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCat(c)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                    form.employeeCategories.includes(c)
                      ? "border-cyan-600 bg-cyan-50 text-cyan-800"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Active">
            <label className="flex h-10 items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Used when validating attendance
            </label>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

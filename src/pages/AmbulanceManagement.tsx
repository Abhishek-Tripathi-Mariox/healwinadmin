import { useEffect, useState } from "react";
import { UserPlus, Pencil, Trash2, RotateCcw } from "lucide-react";
import {
  ambulanceApi,
  ambulanceStaffApi,
  providerApi,
  configApi,
} from "../services/admin-api";
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
} from "../components/ui";

type Ambulance = {
  _id: string;
  registrationNumber: string;
  ambulanceType: string;
  status: "available" | "on_dispatch" | "offline" | "maintenance";
  providerId: any;
  assignedDriverId?: any;
  assignedAttendantId?: any;
  lastLocationAt?: string;
};

const statusTone: Record<
  string,
  "success" | "warning" | "neutral" | "info"
> = {
  available: "success",
  on_dispatch: "warning",
  offline: "neutral",
  maintenance: "info",
};

export default function AmbulanceManagement() {
  const [items, setItems] = useState<Ambulance[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Ambulance | null>(null);
  const [form, setForm] = useState<any>({ ambulanceType: "BLS" });
  // Standard clinical types always available, plus any custom types added
  // on the "Types & Pricing" page (merged + de-duplicated).
  const [typeOptions, setTypeOptions] = useState<string[]>([
    "BLS",
    "ALS",
    "ICU",
    "PTV",
  ]);

  const [assignFor, setAssignFor] = useState<Ambulance | null>(null);
  const [staffOptions, setStaffOptions] = useState<{
    drivers: any[];
    attendants: any[];
  }>({ drivers: [], attendants: [] });
  const [assignForm, setAssignForm] = useState<{
    driverId?: string;
    attendantId?: string;
  }>({});
  const [assignError, setAssignError] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ambulanceApi.list(filters);
      setItems(res.data?.items || res.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    providerApi.list({ isActive: true }).then((r) =>
      setProviders(r.data?.items || r.items || []),
    );
    // Merge admin-managed vehicle types into the type dropdown.
    configApi
      .getVehicleTypes()
      .then((r) => {
        const names: string[] = (r.data?.vehicleTypes || [])
          .filter((v: any) => v.isActive && !v.isDeleted)
          .map((v: any) => v.name)
          .filter(Boolean);
        setTypeOptions((prev) => Array.from(new Set([...prev, ...names])));
      })
      .catch(() => {
        /* non-fatal — defaults remain */
      });
    load();
  }, []);

  const openAssign = async (a: Ambulance) => {
    setAssignError("");
    const providerId =
      typeof a.providerId === "object" ? a.providerId._id : a.providerId;
    const [drivers, attendants] = await Promise.all([
      ambulanceStaffApi.list({ providerId, role: "driver", isActive: true }),
      ambulanceStaffApi.list({ providerId, role: "attendant", isActive: true }),
    ]);
    setStaffOptions({
      drivers: drivers.data?.items || drivers.items || [],
      attendants: attendants.data?.items || attendants.items || [],
    });
    setAssignForm({
      driverId:
        a.assignedDriverId && typeof a.assignedDriverId === "object"
          ? a.assignedDriverId._id
          : a.assignedDriverId,
      attendantId:
        a.assignedAttendantId && typeof a.assignedAttendantId === "object"
          ? a.assignedAttendantId._id
          : a.assignedAttendantId,
    });
    setAssignFor(a);
  };

  const submitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignFor || assignSaving) return;
    setAssignError("");
    setAssignSaving(true);
    // The backend assigns ONE seat per call ({ staffId, role }) and clears a
    // seat via /unassign. Diff each seat against what the ambulance already
    // has so we only fire the calls that actually changed.
    const idOf = (v: any) =>
      v && typeof v === "object" ? v._id : v || "";
    const origDriver = idOf(assignFor.assignedDriverId);
    const origAttendant = idOf(assignFor.assignedAttendantId);
    const newDriver = assignForm.driverId || "";
    const newAttendant = assignForm.attendantId || "";
    try {
      // Backend derives the seat from each staff member's role — we just send
      // the staffId. (Driver/Attendant dropdowns are already role-filtered.)
      if (newDriver && newDriver !== origDriver)
        await ambulanceApi.assign(assignFor._id, newDriver);
      else if (!newDriver && origDriver)
        await ambulanceApi.unassign(assignFor._id, "driver");

      if (newAttendant && newAttendant !== origAttendant)
        await ambulanceApi.assign(assignFor._id, newAttendant);
      else if (!newAttendant && origAttendant)
        await ambulanceApi.unassign(assignFor._id, "attendant");

      setAssignFor(null);
      load();
    } catch (err: any) {
      setAssignError(err?.message || "Could not assign staff. Please try again.");
    } finally {
      setAssignSaving(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSaving) return;
    setFormError("");
    setFormSaving(true);
    try {
      if (editing) await ambulanceApi.update(editing._id, form);
      else await ambulanceApi.create(form);
      setShowForm(false);
      setEditing(null);
      setForm({ ambulanceType: "BLS" });
      load();
    } catch (err: any) {
      setFormError(err?.message || "Could not save ambulance. Please try again.");
    } finally {
      setFormSaving(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Ambulances"
        subtitle={`${items.length} ambulance(s)`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ ambulanceType: "BLS" });
              setFormError("");
              setShowForm(true);
            }}
          >
            + New Ambulance
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Select
          className="w-auto"
          value={filters.providerId || ""}
          onChange={(e) =>
            setFilters({ ...filters, providerId: e.target.value || undefined })
          }
        >
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-auto"
          value={filters.status || ""}
          onChange={(e) =>
            setFilters({ ...filters, status: e.target.value || undefined })
          }
        >
          <option value="">Any status</option>
          <option value="available">available</option>
          <option value="on_dispatch">on_dispatch</option>
          <option value="offline">offline</option>
          <option value="maintenance">maintenance</option>
        </Select>
        <Select
          className="w-auto"
          value={filters.ambulanceType || ""}
          onChange={(e) =>
            setFilters({ ...filters, ambulanceType: e.target.value || undefined })
          }
        >
          <option value="">Any type</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <SearchInput
          className="w-52"
          placeholder="Search reg no"
          value={filters.search || ""}
          onChange={(e) =>
            setFilters({ ...filters, search: e.target.value || undefined })
          }
        />
        <Button variant="secondary" onClick={load}>
          Apply
        </Button>
      </div>

      <Table>
        <THead>
          <Th>Reg No</Th>
          <Th>Provider</Th>
          <Th>Type</Th>
          <Th>Driver</Th>
          <Th>Attendant</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={7}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={7}>No ambulances found.</TableState>
          ) : (
            items.map((a) => (
              <TR key={a._id}>
                <Td className="font-mono text-gray-900">
                  {a.registrationNumber}
                </Td>
                <Td>
                  {typeof a.providerId === "object" ? a.providerId.name : "-"}
                </Td>
                <Td>{a.ambulanceType}</Td>
                <Td>
                  {a.assignedDriverId
                    ? typeof a.assignedDriverId === "object"
                      ? (
                          <div>
                            <div className="font-medium">
                              {a.assignedDriverId.fullName || "—"}
                            </div>
                            {a.assignedDriverId.mobileNumber && (
                              <div className="text-xs text-gray-500">
                                {a.assignedDriverId.mobileNumber}
                              </div>
                            )}
                          </div>
                        )
                      : "—"
                    : "—"}
                </Td>
                <Td>
                  {a.assignedAttendantId
                    ? typeof a.assignedAttendantId === "object"
                      ? (
                          <div>
                            <div className="font-medium">
                              {a.assignedAttendantId.fullName || "—"}
                            </div>
                            {a.assignedAttendantId.mobileNumber && (
                              <div className="text-xs text-gray-500">
                                {a.assignedAttendantId.mobileNumber}
                              </div>
                            )}
                          </div>
                        )
                      : "—"
                    : "—"}
                </Td>
                <Td>
                  <Badge tone={statusTone[a.status] || "neutral"} dot>
                    {a.status}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {a.status === "on_dispatch" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                      title="Free ambulance (cancel its dispatch)"
                      aria-label="Free ambulance"
                      onClick={async () => {
                        if (!confirm("Cancel this ambulance's active dispatch and free it?")) return;
                        await ambulanceApi.free(a._id);
                        load();
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title="Assign"
                    aria-label="Assign"
                    onClick={() => openAssign(a)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => {
                      setEditing(a);
                      setForm({
                        ...a,
                        providerId:
                          typeof a.providerId === "object"
                            ? a.providerId._id
                            : a.providerId,
                      });
                      setFormError("");
                      setShowForm(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={async () => {
                      if (!confirm("Delete ambulance?")) return;
                      await ambulanceApi.remove(a._id);
                      load();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Ambulance" : "New Ambulance"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={formSaving}>
              {formSaving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {formError && (
            <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {formError}
            </div>
          )}
          <Field label="Provider *">
            <Select
              required
              value={form.providerId || ""}
              onChange={(e) => setForm({ ...form, providerId: e.target.value })}
              disabled={!!editing}
            >
              <option value="">Select Provider</option>
              {providers.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Registration Number *">
            <Input
              required
              placeholder="Registration Number"
              value={form.registrationNumber || ""}
              onChange={(e) =>
                setForm({ ...form, registrationNumber: e.target.value })
              }
            />
          </Field>
          <Field label="Ambulance Type *">
            <Select
              required
              value={form.ambulanceType || "BLS"}
              onChange={(e) =>
                setForm({ ...form, ambulanceType: e.target.value })
              }
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Equipment (comma-separated)">
            <Input
              placeholder="Equipment (comma-separated)"
              value={(form.equipment || []).join(",")}
              onChange={(e) =>
                setForm({
                  ...form,
                  equipment: e.target.value
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label="Fuel Type">
            <Select
              value={form.fuelType || ""}
              onChange={(e) => setForm({ ...form, fuelType: e.target.value })}
            >
              <option value="">Fuel type (optional)</option>
              <option>Petrol</option>
              <option>Diesel</option>
              <option>CNG</option>
              <option>EV</option>
            </Select>
          </Field>
        </form>
      </Modal>

      <Modal
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        title={
          assignFor
            ? `Assign Staff — ${assignFor.registrationNumber}`
            : "Assign Staff"
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignFor(null)}>
              Cancel
            </Button>
            <Button onClick={submitAssign} disabled={assignSaving}>
              {assignSaving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form onSubmit={submitAssign} className="space-y-4">
          {assignError && (
            <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {assignError}
            </div>
          )}
          <Field label="Driver">
            <Select
              value={assignForm.driverId || ""}
              onChange={(e) =>
                setAssignForm({
                  ...assignForm,
                  driverId: e.target.value || undefined,
                })
              }
            >
              <option value="">No driver</option>
              {staffOptions.drivers.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.fullName} ({d.mobileNumber})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Attendant">
            <Select
              value={assignForm.attendantId || ""}
              onChange={(e) =>
                setAssignForm({
                  ...assignForm,
                  attendantId: e.target.value || undefined,
                })
              }
            >
              <option value="">No attendant</option>
              {staffOptions.attendants.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.fullName} ({a.mobileNumber})
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}

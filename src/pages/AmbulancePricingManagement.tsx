import React, { useEffect, useState } from "react";
import { Pencil, Power, Trash2 } from "lucide-react";
import { configApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Alert,
  Modal,
  Field,
  Input,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
} from "../components/ui";

interface VehicleType {
  _id: string;
  name: string;
  description?: string;
  maxWeightKg: number;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minDistanceKm: number;
  surgeMultiplier: number;
  cancellationFee: number;
  sortOrder: number;
  isActive: boolean;
  isDeleted?: boolean;
}

interface FareConfig {
  gstPercentage: number;
  platformFeePercentage: number;
  insuranceFee: number;
  minimumFare: number;
  waitingChargePerMin: number;
  freeWaitingMinutes: number;
  nightSurgeMultiplier: number;
}

const emptyType = {
  name: "",
  description: "",
  maxWeightKg: 0,
  baseFare: 0,
  perKmRate: 0,
  perMinuteRate: 0,
  minDistanceKm: 1,
  surgeMultiplier: 1,
  cancellationFee: 0,
  sortOrder: 0,
  isActive: true,
};

const fareFields: { key: keyof FareConfig; label: string; suffix?: string }[] = [
  { key: "gstPercentage", label: "GST", suffix: "%" },
  { key: "platformFeePercentage", label: "Platform Fee", suffix: "%" },
  { key: "minimumFare", label: "Minimum Fare", suffix: "₹" },
  { key: "insuranceFee", label: "Insurance Fee", suffix: "₹" },
  { key: "waitingChargePerMin", label: "Waiting Charge / min", suffix: "₹" },
  { key: "freeWaitingMinutes", label: "Free Waiting", suffix: "min" },
  { key: "nightSurgeMultiplier", label: "Night Surge", suffix: "×" },
];

const AmbulancePricingManagement: React.FC = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.AMBULANCE_CONFIG_MANAGE);

  const [types, setTypes] = useState<VehicleType[]>([]);
  const [fare, setFare] = useState<FareConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingFare, setSavingFare] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyType);

  const load = async () => {
    try {
      setLoading(true);
      const [vtRes, fareRes] = await Promise.all([
        configApi.getVehicleTypes(),
        configApi.getFareConfig(),
      ]);
      setTypes(vtRes.data?.vehicleTypes || []);
      setFare(fareRes.data?.config || null);
    } catch (err: any) {
      setError(err.message || "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 2500);
  };

  const openCreate = () => {
    setForm(emptyType);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (vt: VehicleType) => {
    setForm({
      name: vt.name,
      description: vt.description || "",
      maxWeightKg: vt.maxWeightKg,
      baseFare: vt.baseFare,
      perKmRate: vt.perKmRate,
      perMinuteRate: vt.perMinuteRate,
      minDistanceKm: vt.minDistanceKm,
      surgeMultiplier: vt.surgeMultiplier,
      cancellationFee: vt.cancellationFee,
      sortOrder: vt.sortOrder,
      isActive: vt.isActive,
    });
    setEditingId(vt._id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    try {
      if (editingId) await configApi.updateVehicleType(editingId, form);
      else await configApi.createVehicleType(form);
      setShowForm(false);
      flash("Vehicle type saved");
      load();
    } catch (err: any) {
      setError(err.message || "Failed to save vehicle type");
    }
  };

  const handleToggle = async (vt: VehicleType) => {
    try {
      await configApi.toggleVehicleType(vt._id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this vehicle type?")) return;
    try {
      await configApi.deleteVehicleType(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveFare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fare) return;
    try {
      setSavingFare(true);
      await configApi.updateFareConfig(fare as unknown as Record<string, unknown>);
      flash("Fare configuration saved");
    } catch (err: any) {
      setError(err.message || "Failed to save fare config");
    } finally {
      setSavingFare(false);
    }
  };

  const visibleTypes = types.filter((t) => !t.isDeleted);

  return (
    <div className="p-6">
      <PageHeader
        title="Ambulance Types & Pricing"
        subtitle="Manage ambulance vehicle types, their fares, and global fare settings"
        actions={canManage && <Button onClick={openCreate}>+ Add Vehicle Type</Button>}
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
      {success && (
        <Alert className="mb-4" tone="success">
          {success}
        </Alert>
      )}

      {/* Vehicle types */}
      <Table>
        <THead>
          <Th>Name</Th>
          <Th className="text-right">Base Fare</Th>
          <Th className="text-right">Per Km</Th>
          <Th className="text-right">Per Min</Th>
          <Th className="text-right">Surge</Th>
          <Th className="text-right">Cancellation</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={8}>Loading…</TableState>
          ) : visibleTypes.length === 0 ? (
            <TableState colSpan={8}>No vehicle types yet.</TableState>
          ) : (
            visibleTypes.map((vt) => (
              <TR key={vt._id}>
                <Td className="font-medium text-gray-900">
                  {vt.name}
                  {vt.description && (
                    <span className="block text-xs font-normal text-gray-400">
                      {vt.description}
                    </span>
                  )}
                </Td>
                <Td className="text-right">₹{vt.baseFare}</Td>
                <Td className="text-right">₹{vt.perKmRate}</Td>
                <Td className="text-right">₹{vt.perMinuteRate}</Td>
                <Td className="text-right">{vt.surgeMultiplier}×</Td>
                <Td className="text-right">₹{vt.cancellationFee}</Td>
                <Td>
                  <Badge tone={vt.isActive ? "success" : "neutral"} dot>
                    {vt.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" className="px-2" title="Edit" aria-label="Edit" onClick={() => openEdit(vt)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-2"
                        title={vt.isActive ? "Disable" : "Enable"}
                        aria-label={vt.isActive ? "Disable" : "Enable"}
                        onClick={() => handleToggle(vt)}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                        title="Delete"
                        aria-label="Delete"
                        onClick={() => handleDelete(vt._id)}
                      >
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

      {/* Global fare config */}
      <Card padded className="mt-8">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">
          Global Fare Settings
        </h3>
        <p className="mb-4 text-xs text-gray-500">
          Applied on top of each vehicle type's fare.
        </p>
        {fare ? (
          <form onSubmit={saveFare}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {fareFields.map((f) => (
                <Field key={f.key} label={`${f.label}${f.suffix ? ` (${f.suffix})` : ""}`}>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={fare[f.key] || ""}
                    disabled={!canManage}
                    onChange={(e) =>
                      setFare({ ...fare, [f.key]: Number(e.target.value) })
                    }
                  />
                </Field>
              ))}
            </div>
            {canManage && (
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={savingFare}>
                  {savingFare ? "Saving…" : "Save Fare Settings"}
                </Button>
              </div>
            )}
          </form>
        ) : (
          <p className="text-sm text-gray-400">
            {loading ? "Loading…" : "No fare configuration available."}
          </p>
        )}
      </Card>

      {/* Vehicle type modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? "Edit Vehicle Type" : "Add Vehicle Type"}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name *">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Basic Life Support"
                required
              />
            </Field>
            <Field label="Max Weight (kg)">
              <Input
                type="number"
                placeholder="0"
                value={form.maxWeightKg || ""}
                onChange={(e) =>
                  setForm({ ...form, maxWeightKg: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <Field label="Description">
            <Input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Short description"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Base Fare (₹)">
              <Input
                type="number"
                placeholder="0"
                value={form.baseFare || ""}
                onChange={(e) =>
                  setForm({ ...form, baseFare: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Per Km Rate (₹)">
              <Input
                type="number"
                placeholder="0"
                value={form.perKmRate || ""}
                onChange={(e) =>
                  setForm({ ...form, perKmRate: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Per Minute Rate (₹)">
              <Input
                type="number"
                placeholder="0"
                value={form.perMinuteRate || ""}
                onChange={(e) =>
                  setForm({ ...form, perMinuteRate: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Min Distance (km)">
              <Input
                type="number"
                placeholder="0"
                value={form.minDistanceKm || ""}
                onChange={(e) =>
                  setForm({ ...form, minDistanceKm: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Surge Multiplier (×)">
              <Input
                type="number"
                step="any"
                placeholder="1"
                value={form.surgeMultiplier || ""}
                onChange={(e) =>
                  setForm({ ...form, surgeMultiplier: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Cancellation Fee (₹)">
              <Input
                type="number"
                placeholder="0"
                value={form.cancellationFee || ""}
                onChange={(e) =>
                  setForm({ ...form, cancellationFee: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sort Order">
              <Input
                type="number"
                placeholder="0"
                value={form.sortOrder || ""}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) })
                }
              />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              Active
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AmbulancePricingManagement;

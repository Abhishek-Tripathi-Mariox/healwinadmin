import { useCallback, useEffect, useState } from "react";
import { promoApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";

interface PromoRow {
  _id: string;
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  maxDiscount?: number;
  minOrderValue: number;
  maxUsage: number;
  usedCount: number;
  perUserLimit: number;
  validFrom: string;
  validTo: string;
  serviceCategory: "LOGISTICS" | "AMBULANCE" | "ALL";
  isActive: boolean;
}

const CATEGORIES: { value: PromoRow["serviceCategory"]; label: string }[] = [
  { value: "AMBULANCE", label: "Ambulance rides" },
  { value: "LOGISTICS", label: "Logistics (goods)" },
  { value: "ALL", label: "All services" },
];

const categoryTone = (c: string): "info" | "warning" | "neutral" =>
  c === "AMBULANCE" ? "info" : c === "ALL" ? "warning" : "neutral";

// `<input type="date">` wants YYYY-MM-DD; the API stores full ISO timestamps.
const toDateInput = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

const empty = {
  code: "",
  description: "",
  serviceCategory: "AMBULANCE" as PromoRow["serviceCategory"],
  discountType: "PERCENTAGE" as PromoRow["discountType"],
  discountValue: "10",
  maxDiscount: "",
  minOrderValue: "0",
  maxUsage: "-1",
  perUserLimit: "1",
  validFrom: toDateInput(new Date().toISOString()),
  validTo: "",
  isActive: true,
};

export default function PromoCodesManagement() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.PROMOS_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.PROMOS_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.PROMOS_DELETE);

  const [items, setItems] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editing, setEditing] = useState<PromoRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await promoApi.list({ serviceCategory: categoryFilter, limit: "100" });
      setItems(res.data?.promos || []);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(empty); setError(""); setOpen(true); };
  const openEdit = (p: PromoRow) => {
    setEditing(p);
    setForm({
      code: p.code,
      description: p.description,
      serviceCategory: p.serviceCategory || "LOGISTICS",
      discountType: p.discountType,
      discountValue: String(p.discountValue),
      maxDiscount: p.maxDiscount != null ? String(p.maxDiscount) : "",
      minOrderValue: String(p.minOrderValue ?? 0),
      maxUsage: String(p.maxUsage ?? -1),
      perUserLimit: String(p.perUserLimit ?? 1),
      validFrom: toDateInput(p.validFrom),
      validTo: toDateInput(p.validTo),
      isActive: p.isActive,
    });
    setError("");
    setOpen(true);
  };

  const submit = async () => {
    if (saving) return;
    if (!editing && !form.code.trim()) { setError("Code is required."); return; }
    if (!form.description.trim()) { setError("Description is required."); return; }
    if (!form.validFrom || !form.validTo) { setError("Valid-from and valid-to dates are required."); return; }
    if (Number(form.discountValue) <= 0) { setError("Discount value must be greater than 0."); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        description: form.description.trim(),
        serviceCategory: form.serviceCategory,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxDiscount: form.maxDiscount !== "" ? Number(form.maxDiscount) : undefined,
        minOrderValue: Number(form.minOrderValue) || 0,
        maxUsage: Number(form.maxUsage),
        perUserLimit: Number(form.perUserLimit) || 1,
        validFrom: form.validFrom,
        validTo: form.validTo,
        isActive: form.isActive,
      };
      if (editing) {
        await promoApi.update(editing._id, payload);
      } else {
        await promoApi.create({ ...payload, code: form.code.trim().toUpperCase() });
      }
      setOpen(false);
      load();
    } catch (e: any) {
      setError(e.message || "Failed to save promo code");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: PromoRow) => { await promoApi.toggle(p._id); load(); };
  const remove = async (p: PromoRow) => {
    if (!window.confirm(`Delete promo code ${p.code}?`)) return;
    await promoApi.remove(p._id);
    load();
  };

  const discountLabel = (p: PromoRow) =>
    p.discountType === "PERCENTAGE"
      ? `${p.discountValue}%${p.maxDiscount ? ` (max ₹${p.maxDiscount})` : ""}`
      : `₹${p.discountValue}`;

  const expired = (p: PromoRow) => new Date(p.validTo) < new Date();

  return (
    <div className="p-6">
      <PageHeader
        title="Promo Codes"
        subtitle="Discount coupons for ambulance rides & logistics bookings"
        actions={canCreate && <Button onClick={openNew}>New Promo Code</Button>}
      />

      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-gray-500">Filter:</span>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <Table>
        <THead>
          <Th>Code</Th><Th>Category</Th><Th>Discount</Th><Th>Min order</Th>
          <Th>Usage</Th><Th>Validity</Th><Th>Status</Th><Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading && items.length === 0 ? (
            <TableState colSpan={8}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={8}>No promo codes yet.</TableState>
          ) : (
            items.map((p) => (
              <TR key={p._id}>
                <Td className="text-gray-900">
                  <div className="font-semibold">{p.code}</div>
                  <div className="text-xs text-gray-400">{p.description}</div>
                </Td>
                <Td><Badge tone={categoryTone(p.serviceCategory)}>{p.serviceCategory}</Badge></Td>
                <Td>{discountLabel(p)}</Td>
                <Td>{p.minOrderValue ? `₹${p.minOrderValue}` : "—"}</Td>
                <Td>
                  {p.usedCount}
                  {p.maxUsage !== -1 ? ` / ${p.maxUsage}` : ""}
                </Td>
                <Td className="text-xs text-gray-600">
                  {toDateInput(p.validFrom)} → {toDateInput(p.validTo)}
                </Td>
                <Td>
                  {!p.isActive ? (
                    <Badge tone="neutral">Inactive</Badge>
                  ) : expired(p) ? (
                    <Badge tone="danger">Expired</Badge>
                  ) : (
                    <Badge tone="success">Active</Badge>
                  )}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {canUpdate && <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>Edit</Button>}{" "}
                  {canUpdate && <Button size="sm" variant="ghost" onClick={() => toggle(p)}>{p.isActive ? "Disable" : "Enable"}</Button>}{" "}
                  {canDelete && <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(p)}>Delete</Button>}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.code}` : "New Promo Code"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SAVE20"
                disabled={!!editing}
              />
            </Field>
            <Field label="Service category">
              <select
                value={form.serviceCategory}
                onChange={(e) => setForm({ ...form, serviceCategory: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Flat 20% off ambulance rides" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount type">
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed (₹)</option>
              </select>
            </Field>
            <Field label={form.discountType === "PERCENTAGE" ? "Discount %" : "Discount ₹"}>
              <Input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
            </Field>
            {form.discountType === "PERCENTAGE" && (
              <Field label="Max discount ₹ (optional)">
                <Input type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} placeholder="No cap" />
              </Field>
            )}
            <Field label="Min order value ₹">
              <Input type="number" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max total uses (-1 = unlimited)">
              <Input type="number" value={form.maxUsage} onChange={(e) => setForm({ ...form, maxUsage: e.target.value })} />
            </Field>
            <Field label="Per-user limit">
              <Input type="number" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} />
            </Field>
            <Field label="Valid from">
              <Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
            </Field>
            <Field label="Valid to">
              <Input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
        </form>
      </Modal>
    </div>
  );
}

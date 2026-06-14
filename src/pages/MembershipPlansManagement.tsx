import { useCallback, useEffect, useState } from "react";
import { membershipPlanApi } from "../services/admin-api";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";

interface PlanRow {
  _id: string;
  tier: "silver" | "gold";
  name: string;
  price: number;
  durationMonths: number;
  concessionPercent?: number;
  bullets?: string[];
  sortOrder?: number;
  isActive: boolean;
  activeSubscribers?: number;
}

const empty = {
  tier: "silver",
  name: "",
  price: "",
  durationMonths: "12",
  concessionPercent: "",
  bullets: "",
  sortOrder: "0",
  isActive: true,
};

export default function MembershipPlansManagement() {
  const [items, setItems] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await membershipPlanApi.list();
      setItems(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setError("");
    setOpen(true);
  };

  const openEdit = (p: PlanRow) => {
    setEditing(p);
    setForm({
      tier: p.tier,
      name: p.name,
      price: String(p.price ?? ""),
      durationMonths: String(p.durationMonths ?? "12"),
      concessionPercent: p.concessionPercent != null ? String(p.concessionPercent) : "",
      bullets: (p.bullets || []).join("\n"),
      sortOrder: String(p.sortOrder ?? 0),
      isActive: p.isActive,
    });
    setError("");
    setOpen(true);
  };

  const submit = async () => {
    if (saving) return;
    if (!form.name.trim()) { setError("Plan name is required."); return; }
    setSaving(true);
    try {
      const payload = {
        tier: form.tier,
        name: form.name.trim(),
        price: Number(form.price) || 0,
        durationMonths: Number(form.durationMonths) || 12,
        concessionPercent: Number(form.concessionPercent) || 0,
        bullets: String(form.bullets).split("\n").map((s: string) => s.trim()).filter(Boolean),
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      if (editing) await membershipPlanApi.update(editing._id, payload);
      else await membershipPlanApi.create(payload);
      setOpen(false);
      load();
    } catch (e: any) {
      setError(e.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: PlanRow) => { await membershipPlanApi.toggle(p._id); load(); };
  const remove = async (p: PlanRow) => {
    if (!window.confirm(`Delete "${p.name}"? Existing subscribers keep their membership.`)) return;
    await membershipPlanApi.remove(p._id);
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Membership Plans"
        subtitle="Plans shown in the patient app's membership screen — edit pricing & benefits anytime"
        actions={<Button onClick={openNew}>New Plan</Button>}
      />

      <Table>
        <THead>
          <Th>Name</Th><Th>Tier</Th><Th>Price</Th><Th>Duration</Th><Th>Concession</Th><Th>Subscribers</Th><Th>Status</Th><Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading && items.length === 0 ? (
            <TableState colSpan={8}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={8}>No plans yet.</TableState>
          ) : (
            items.map((p) => (
              <TR key={p._id}>
                <Td className="font-medium text-gray-900">{p.name}</Td>
                <Td><Badge tone={p.tier === "gold" ? "warning" : "neutral"}>{p.tier}</Badge></Td>
                <Td>₹{p.price}</Td>
                <Td>{p.durationMonths} mo</Td>
                <Td>{p.concessionPercent ? `${p.concessionPercent}%` : "—"}</Td>
                <Td>{p.activeSubscribers ?? 0}</Td>
                <Td><Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge></Td>
                <Td className="text-right whitespace-nowrap">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>Edit</Button>{" "}
                  <Button size="sm" variant="ghost" onClick={() => toggle(p)}>{p.isActive ? "Disable" : "Enable"}</Button>{" "}
                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(p)}>Delete</Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Plan" : "New Plan"}
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
            <Field label="Plan name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Tier">
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
              </select>
            </Field>
            <Field label="Price (₹)"><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Duration (months)"><Input type="number" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} /></Field>
            <Field label="Concession (%)"><Input type="number" value={form.concessionPercent} onChange={(e) => setForm({ ...form, concessionPercent: e.target.value })} /></Field>
            <Field label="Sort order"><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></Field>
          </div>
          <Field label="Benefits (one per line)">
            <textarea
              value={form.bullets}
              onChange={(e) => setForm({ ...form, bullets: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              placeholder={"10% concession on all services\nOne free family health check-up per year"}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active (visible in app)
          </label>
        </form>
      </Modal>
    </div>
  );
}

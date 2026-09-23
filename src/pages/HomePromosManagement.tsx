import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { homePromoApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import Pagination from "../components/Pagination";
import {
  PageHeader, Button, Select, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";
import { dialog } from "../services/dialog";

interface PromoRow {
  _id: string;
  titleTop?: string;
  titleBold?: string[];
  cta?: string;
  target: string;
  image?: string;
  sortOrder?: number;
  isActive: boolean;
}

// The patient app only navigates to routes it knows — keep this list in sync
// with the app's RootStackParamList.
const TARGETS = [
  "AmbulanceTypes",
  "PlanAmbulance",
  "ServiceSelect",
  "Membership",
  "CentresList",
  "Pharmacy",
  "LabTests",
  "Sos",
];

const empty = { titleTop: "", titleBold: "", cta: "Book Now", target: "AmbulanceTypes", image: "", sortOrder: "0", isActive: true };

export default function HomePromosManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.HOME_PROMOS_MANAGE);

  const [items, setItems] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<PromoRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  // What's actually queried: typing shouldn't fire a request per keystroke.
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await homePromoApi.list(params);
      setItems(res.data?.items || []);
      setTotal(res.data?.pagination?.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [searchQuery, limit]);

  const openNew = () => { setEditing(null); setForm(empty); setError(""); setOpen(true); };
  const openEdit = (p: PromoRow) => {
    setEditing(p);
    setForm({
      titleTop: p.titleTop || "",
      titleBold: (p.titleBold || []).join("\n"),
      cta: p.cta || "Book Now",
      target: p.target,
      image: p.image || "",
      sortOrder: String(p.sortOrder ?? 0),
      isActive: p.isActive,
    });
    setError("");
    setOpen(true);
  };

  const submit = async () => {
    if (saving) return;
    if (!form.target) { setError("Target screen is required."); return; }
    setSaving(true);
    try {
      const payload = {
        titleTop: form.titleTop,
        titleBold: String(form.titleBold).split("\n").map((s: string) => s.trim()).filter(Boolean),
        cta: form.cta.trim() || "Book Now",
        target: form.target,
        image: form.image.trim() || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      if (editing) await homePromoApi.update(editing._id, payload);
      else await homePromoApi.create(payload);
      setOpen(false);
      load();
    } catch (e: any) {
      setError(e.message || "Failed to save promo");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: PromoRow) => { await homePromoApi.toggle(p._id); load(); };
  const remove = async (p: PromoRow) => {
    if (!await dialog.confirm({ message: "Delete this promo card?", confirmLabel: "Delete", tone: "danger" })) return;
    await homePromoApi.remove(p._id);
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Home Promos"
        subtitle="Swipeable promo shortcut cards on the patient app home screen"
        actions={canManage && <Button onClick={openNew}>New Promo</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="w-64 pl-9"
            placeholder="Title, CTA or target…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={String(limit)}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="w-32"
          aria-label="Rows per page"
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </Select>
        <span className="text-sm text-gray-500">{total} promo(s)</span>
      </div>

      <Table>
        <THead>
          <Th>Title</Th><Th>CTA</Th><Th>Target</Th><Th>Order</Th><Th>Status</Th><Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading && items.length === 0 ? (
            <TableState colSpan={6}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={6}>
              {searchQuery.trim() ? "No promos match this search." : "No promos yet."}
            </TableState>
          ) : (
            items.map((p) => (
              <TR key={p._id}>
                <Td className="text-gray-900">
                  <div className="text-xs text-gray-400">{p.titleTop}</div>
                  <div className="font-medium">{(p.titleBold || []).join(" ")}</div>
                </Td>
                <Td>{p.cta || "—"}</Td>
                <Td><Badge tone="info">{p.target}</Badge></Td>
                <Td>{p.sortOrder ?? 0}</Td>
                <Td><Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge></Td>
                <Td className="text-right whitespace-nowrap">
                  {canManage && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>Edit</Button>{" "}
                      <Button size="sm" variant="ghost" onClick={() => toggle(p)}>{p.isActive ? "Disable" : "Enable"}</Button>{" "}
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(p)}>Delete</Button>
                    </>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          label="promos"
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Promo" : "New Promo"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Top line (small)"><Input value={form.titleTop} onChange={(e) => setForm({ ...form, titleTop: e.target.value })} placeholder="Need help fast?" /></Field>
          <Field label="Bold lines (one per line)">
            <textarea
              value={form.titleBold}
              onChange={(e) => setForm({ ...form, titleBold: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              placeholder={"Book an\nAmbulance"}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CTA label"><Input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} /></Field>
            <Field label="Target screen">
              <select
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              >
                {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Image URL (optional)"><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></Field>
            <Field label="Sort order"><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active (visible in app)
          </label>
        </form>
      </Modal>
    </div>
  );
}

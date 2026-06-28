import { useCallback, useEffect, useState } from "react";
import { procurementApi } from "../services/admin-api";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";

type Tab = "orders" | "suppliers";
interface POItem { name: string; quantity: string; unitPrice: string }
const poTone: Record<string, "neutral" | "info" | "success" | "danger"> = {
  draft: "neutral", ordered: "info", received: "success", cancelled: "danger",
};

export default function ProcurementManagement() {
  const [tab, setTab] = useState<Tab>("orders");
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [supplierModal, setSupplierModal] = useState<any | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: "", contactPerson: "", phone: "", email: "", gstin: "", address: "" });
  const [poModal, setPoModal] = useState(false);
  const [poForm, setPoForm] = useState({ supplierId: "", expectedDate: "", notes: "" });
  const [poItems, setPoItems] = useState<POItem[]>([{ name: "", quantity: "1", unitPrice: "0" }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "suppliers") setSuppliers((await procurementApi.listSuppliers()).data?.items || []);
      else setOrders((await procurementApi.listPurchaseOrders()).data?.items || []);
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { procurementApi.listSuppliers().then((r) => setSuppliers(r.data?.items || [])).catch(() => {}); }, []);

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) { setError("Name required"); return; }
    setSaving(true); setError("");
    try {
      if (supplierModal?._id) await procurementApi.updateSupplier(supplierModal._id, supplierForm);
      else await procurementApi.createSupplier(supplierForm);
      setSupplierModal(null); load();
    } catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };

  const setItem = (i: number, patch: Partial<POItem>) => setPoItems((it) => it.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addItem = () => setPoItems((it) => [...it, { name: "", quantity: "1", unitPrice: "0" }]);
  const removeItem = (i: number) => setPoItems((it) => it.filter((_, idx) => idx !== i));
  const poTotal = poItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);

  const savePO = async () => {
    if (!poForm.supplierId) { setError("Select a supplier"); return; }
    const items = poItems.filter((it) => it.name.trim()).map((it) => ({ name: it.name, quantity: Number(it.quantity) || 0, unitPrice: Number(it.unitPrice) || 0 }));
    if (items.length === 0) { setError("Add at least one item"); return; }
    setSaving(true); setError("");
    try { await procurementApi.createPurchaseOrder({ ...poForm, items, status: "ordered" }); setPoModal(false); load(); }
    catch (e: any) { setError(e.message || "Failed"); } finally { setSaving(false); }
  };
  const advance = async (po: any, status: string) => { await procurementApi.updatePurchaseOrderStatus(po._id, status); load(); };

  return (
    <div className="p-6">
      <PageHeader title="Procurement" subtitle="Suppliers and purchase orders (mark Received = goods receipt)"
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>} />

      <div className="mb-4 flex gap-2">
        {(["orders", "suppliers"] as Tab[]).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "primary" : "secondary"} onClick={() => setTab(t)}>
            {t === "orders" ? "Purchase Orders" : "Suppliers"}
          </Button>
        ))}
        <div className="ml-auto">
          {tab === "suppliers" && <Button size="sm" onClick={() => { setSupplierForm({ name: "", contactPerson: "", phone: "", email: "", gstin: "", address: "" }); setError(""); setSupplierModal({}); }}>+ Supplier</Button>}
          {tab === "orders" && <Button size="sm" onClick={() => { setPoForm({ supplierId: "", expectedDate: "", notes: "" }); setPoItems([{ name: "", quantity: "1", unitPrice: "0" }]); setError(""); setPoModal(true); }}>+ Purchase Order</Button>}
        </div>
      </div>

      {tab === "suppliers" && (
        <Table>
          <THead><Th>Name</Th><Th>Contact</Th><Th>GSTIN</Th><Th>Status</Th><Th className="text-right">Actions</Th></THead>
          <TBody>
            {loading && suppliers.length === 0 ? <TableState colSpan={5}>Loading…</TableState>
              : suppliers.length === 0 ? <TableState colSpan={5}>No suppliers.</TableState>
              : suppliers.map((s) => (
                <TR key={s._id}>
                  <Td className="font-medium text-gray-900">{s.name}</Td>
                  <Td className="text-xs text-gray-500">{s.contactPerson || ""}{s.phone ? ` · ${s.phone}` : ""}</Td>
                  <Td className="text-gray-500">{s.gstin || "—"}</Td>
                  <Td><Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Active" : "Inactive"}</Badge></Td>
                  <Td className="text-right"><Button size="sm" variant="secondary" onClick={() => { setSupplierForm({ name: s.name, contactPerson: s.contactPerson || "", phone: s.phone || "", email: s.email || "", gstin: s.gstin || "", address: s.address || "" }); setError(""); setSupplierModal(s); }}>Edit</Button></Td>
                </TR>
              ))}
          </TBody>
        </Table>
      )}

      {tab === "orders" && (
        <Table>
          <THead><Th>PO #</Th><Th>Supplier</Th><Th>Items</Th><Th>Total</Th><Th>Status</Th><Th className="text-right">Actions</Th></THead>
          <TBody>
            {loading && orders.length === 0 ? <TableState colSpan={6}>Loading…</TableState>
              : orders.length === 0 ? <TableState colSpan={6}>No purchase orders.</TableState>
              : orders.map((po) => (
                <TR key={po._id}>
                  <Td className="font-medium text-gray-900">{po.poNumber}</Td>
                  <Td>{po.supplierId?.name || "—"}</Td>
                  <Td className="text-gray-500">{po.items?.length || 0}</Td>
                  <Td>₹{(po.total || 0).toLocaleString("en-IN")}</Td>
                  <Td><Badge tone={poTone[po.status] || "neutral"}>{po.status}</Badge></Td>
                  <Td className="text-right whitespace-nowrap">
                    {po.status === "ordered" && <Button size="sm" variant="secondary" onClick={() => advance(po, "received")}>Mark received</Button>}
                    {["draft", "ordered"].includes(po.status) && <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => advance(po, "cancelled")}>Cancel</Button>}
                  </Td>
                </TR>
              ))}
          </TBody>
        </Table>
      )}

      <Modal open={!!supplierModal} onClose={() => setSupplierModal(null)} title={supplierModal?._id ? "Edit Supplier" : "Add Supplier"}
        footer={<><Button variant="secondary" onClick={() => setSupplierModal(null)}>Cancel</Button><Button onClick={saveSupplier} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Name *"><Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact person"><Input value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} /></Field>
            <Field label="Phone"><Input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} /></Field>
            <Field label="GSTIN"><Input value={supplierForm.gstin} onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })} /></Field>
          </div>
          <Field label="Address"><Input value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={poModal} onClose={() => setPoModal(false)} title="New Purchase Order"
        footer={<><Button variant="secondary" onClick={() => setPoModal(false)}>Cancel</Button><Button onClick={savePO} disabled={saving}>{saving ? "Saving…" : "Create"}</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Supplier *">
            <select value={poForm.supplierId} onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— Select supplier —</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </Field>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Items</span>
              <Button size="sm" variant="secondary" onClick={addItem}>+ Item</Button>
            </div>
            <div className="space-y-2">
              {poItems.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input placeholder="Item" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm" />
                  <input type="number" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm" />
                  <input type="number" placeholder="Price" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: e.target.value })} className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm" />
                  <button onClick={() => removeItem(i)} className="text-red-600 hover:text-red-700 text-sm">✕</button>
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm font-semibold text-gray-700">Total: ₹{poTotal.toLocaleString("en-IN")}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expected date"><Input type="date" value={poForm.expectedDate} onChange={(e) => setPoForm({ ...poForm, expectedDate: e.target.value })} /></Field>
            <Field label="Notes"><Input value={poForm.notes} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

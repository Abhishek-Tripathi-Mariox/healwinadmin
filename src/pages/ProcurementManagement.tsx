import { useCallback, useEffect, useMemo, useState } from "react";
import { procurementApi, inventoryApi } from "../services/admin-api";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert, Card,
} from "../components/ui";
import Pagination from "../components/Pagination";

type Tab = "orders" | "suppliers";
interface POItem { itemId: string; name: string; quantity: string; unitPrice: string; batchNo: string; expiryDate: string }
interface CatalogItem { _id: string; name: string; unit?: string; category?: string; unitCost?: number }
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
  const emptyPoItem: POItem = { itemId: "", name: "", quantity: "1", unitPrice: "0", batchNo: "", expiryDate: "" };
  const [poItems, setPoItems] = useState<POItem[]>([{ ...emptyPoItem }]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const [perfSupplier, setPerfSupplier] = useState<any | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perf, setPerf] = useState<{
    totals: { orders: number; received: number; totalSpend: number; onTimeRate: number | null };
    priceHistory: { itemId: string; name: string; points: { date: string; unitPrice: number; quantity: number; poNumber: string }[] }[];
  } | null>(null);

  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierLimit, setSupplierLimit] = useState(20);
  const supplierTotalPages = Math.max(1, Math.ceil(suppliers.length / supplierLimit));
  const pageSuppliers = useMemo(
    () => suppliers.slice((supplierPage - 1) * supplierLimit, supplierPage * supplierLimit),
    [suppliers, supplierPage, supplierLimit],
  );
  const [orderPage, setOrderPage] = useState(1);
  const [orderLimit, setOrderLimit] = useState(20);
  const orderTotalPages = Math.max(1, Math.ceil(orders.length / orderLimit));
  const pageOrders = useMemo(
    () => orders.slice((orderPage - 1) * orderLimit, orderPage * orderLimit),
    [orders, orderPage, orderLimit],
  );

  const openPerformance = async (s: any) => {
    setPerfSupplier(s);
    setPerfLoading(true);
    try {
      const res: any = await procurementApi.supplierPerformance(s._id);
      setPerf(res.data ?? res.rData ?? null);
    } finally {
      setPerfLoading(false);
    }
  };

  useEffect(() => {
    inventoryApi.list({ limit: 100 }).then((r: any) => setCatalog(r.data?.items || r.rData?.items || [])).catch(() => {});
  }, []);

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
  const addItem = () => setPoItems((it) => [...it, { ...emptyPoItem }]);
  const removeItem = (i: number) => setPoItems((it) => it.filter((_, idx) => idx !== i));
  const pickCatalogItem = (i: number, itemId: string) => {
    const it = catalog.find((c) => c._id === itemId);
    setItem(i, { itemId, name: it?.name || "", unitPrice: it?.unitCost != null ? String(it.unitCost) : "0" });
  };
  const poTotal = poItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);

  const savePO = async () => {
    if (!poForm.supplierId) { setError("Select a supplier"); return; }
    const items = poItems
      .filter((it) => it.itemId)
      .map((it) => ({
        itemId: it.itemId,
        name: it.name,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        batchNo: it.batchNo || undefined,
        expiryDate: it.expiryDate || undefined,
      }));
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
          {tab === "orders" && <Button size="sm" onClick={() => { setPoForm({ supplierId: "", expectedDate: "", notes: "" }); setPoItems([{ ...emptyPoItem }]); setError(""); setPoModal(true); }}>+ Purchase Order</Button>}
        </div>
      </div>

      {tab === "suppliers" && (
        <Table>
          <THead><Th>Name</Th><Th>Contact</Th><Th>GSTIN</Th><Th>Status</Th><Th className="text-right">Actions</Th></THead>
          <TBody>
            {loading && suppliers.length === 0 ? <TableState colSpan={5}>Loading…</TableState>
              : suppliers.length === 0 ? <TableState colSpan={5}>No suppliers.</TableState>
              : pageSuppliers.map((s) => (
                <TR key={s._id}>
                  <Td className="font-medium text-gray-900">{s.name}</Td>
                  <Td className="text-xs text-gray-500">{s.contactPerson || ""}{s.phone ? ` · ${s.phone}` : ""}</Td>
                  <Td className="text-gray-500">{s.gstin || "—"}</Td>
                  <Td><Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Active" : "Inactive"}</Badge></Td>
                  <Td className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openPerformance(s)}>Performance</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setSupplierForm({ name: s.name, contactPerson: s.contactPerson || "", phone: s.phone || "", email: s.email || "", gstin: s.gstin || "", address: s.address || "" }); setError(""); setSupplierModal(s); }}>Edit</Button>
                  </Td>
                </TR>
              ))}
          </TBody>
        </Table>
      )}
      {tab === "suppliers" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Rows per page
            <select
              value={supplierLimit}
              onChange={(e) => { setSupplierLimit(Number(e.target.value)); setSupplierPage(1); }}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
            >
              {[5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <Pagination page={supplierPage} totalPages={supplierTotalPages} total={suppliers.length} label="suppliers" onPageChange={setSupplierPage} />
        </div>
      )}

      {tab === "orders" && (
        <Table>
          <THead><Th>PO #</Th><Th>Supplier</Th><Th>Items</Th><Th>Total</Th><Th>Status</Th><Th className="text-right">Actions</Th></THead>
          <TBody>
            {loading && orders.length === 0 ? <TableState colSpan={6}>Loading…</TableState>
              : orders.length === 0 ? <TableState colSpan={6}>No purchase orders.</TableState>
              : pageOrders.map((po) => (
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
      {tab === "orders" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Rows per page
            <select
              value={orderLimit}
              onChange={(e) => { setOrderLimit(Number(e.target.value)); setOrderPage(1); }}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
            >
              {[5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <Pagination page={orderPage} totalPages={orderTotalPages} total={orders.length} label="purchase orders" onPageChange={setOrderPage} />
        </div>
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
                <div key={i} className="space-y-1 rounded-lg border border-gray-100 p-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={it.itemId}
                      onChange={(e) => pickCatalogItem(i, e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-sky-500 focus:outline-none"
                    >
                      <option value="">— Select catalog item —</option>
                      {catalog.map((c) => (
                        <option key={c._id} value={c._id}>{c.name}{c.unit ? ` (${c.unit})` : ""}</option>
                      ))}
                    </select>
                    <input type="number" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm" />
                    <input type="number" placeholder="Price" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: e.target.value })} className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm" />
                    <button onClick={() => removeItem(i)} className="text-red-600 hover:text-red-700 text-sm">✕</button>
                  </div>
                  {it.itemId && (
                    <div className="flex items-center gap-2 pl-1">
                      <input
                        placeholder="Expected batch/lot no. (optional)"
                        value={it.batchNo}
                        onChange={(e) => setItem(i, { batchNo: e.target.value })}
                        className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                      />
                      <input
                        type="date"
                        title="Expected expiry"
                        value={it.expiryDate}
                        onChange={(e) => setItem(i, { expiryDate: e.target.value })}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Batch/lot + expiry become the received stock's InventoryBatch when this PO is marked received.
            </p>
            <div className="mt-2 text-right text-sm font-semibold text-gray-700">Total: ₹{poTotal.toLocaleString("en-IN")}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expected date"><Input type="date" value={poForm.expectedDate} onChange={(e) => setPoForm({ ...poForm, expectedDate: e.target.value })} /></Field>
            <Field label="Notes"><Input value={poForm.notes} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      {/* Supplier performance + price history */}
      <Modal
        open={!!perfSupplier}
        onClose={() => setPerfSupplier(null)}
        title={perfSupplier ? `Performance — ${perfSupplier.name}` : undefined}
        size="lg"
      >
        {perfLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : !perf ? (
          <p className="text-sm text-gray-500">Could not load performance.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-3 border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-600">Total orders</div>
                <div className="text-xl font-semibold text-gray-800">{perf.totals.orders}</div>
              </Card>
              <Card className="p-3 border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-600">Received</div>
                <div className="text-xl font-semibold text-gray-800">{perf.totals.received}</div>
              </Card>
              <Card className="p-3 border-healwin-200 bg-healwin-50">
                <div className="text-xs text-healwin-700">Total spend</div>
                <div className="text-xl font-semibold text-healwin-800">₹{perf.totals.totalSpend.toLocaleString("en-IN")}</div>
              </Card>
              <Card className={`p-3 ${perf.totals.onTimeRate != null && perf.totals.onTimeRate < 70 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
                <div className={perf.totals.onTimeRate != null && perf.totals.onTimeRate < 70 ? "text-xs text-red-700" : "text-xs text-green-700"}>On-time delivery</div>
                <div className={perf.totals.onTimeRate != null && perf.totals.onTimeRate < 70 ? "text-xl font-semibold text-red-800" : "text-xl font-semibold text-green-800"}>
                  {perf.totals.onTimeRate != null ? `${perf.totals.onTimeRate}%` : "—"}
                </div>
              </Card>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Price history by item</h4>
              {perf.priceHistory.length === 0 ? (
                <p className="text-sm text-gray-500">No received orders with linked items yet.</p>
              ) : (
                <div className="space-y-3">
                  {perf.priceHistory.map((h) => (
                    <div key={h.itemId} className="rounded-lg border border-gray-100 p-3">
                      <div className="mb-1 text-sm font-medium text-gray-900">{h.name}</div>
                      <div className="space-y-1">
                        {h.points.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-xs text-gray-500">
                            <span>{p.poNumber} · {new Date(p.date).toLocaleDateString()} · qty {p.quantity}</span>
                            <span className="font-medium text-gray-800">₹{p.unitPrice.toLocaleString("en-IN")}/unit</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { PackagePlus, Pencil, Trash2, Layers } from "lucide-react";
import { inventoryApi, procurementApi } from "../services/admin-api";
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
  Card,
  Modal,
  Field,
  Input,
  Alert,
} from "../components/ui";

interface Item {
  _id: string;
  name: string;
  sku: string;
  category: "consumable" | "medicine" | "equipment";
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  unitCost?: number;
  sellingPrice?: number;
  expiryDate?: string;
  maintenanceStatus?: string;
  location?: string;
  isActive: boolean;
}

interface Alerts {
  lowStock: Item[];
  expiringSoon: Item[];
  maintenanceDue: Item[];
  expiringBatches: {
    _id: string;
    itemId: string;
    itemName: string;
    sku: string;
    unit: string;
    batchNo: string | null;
    quantity: number;
    expiryDate: string;
  }[];
  wastage: { total: number; byReason: Record<string, number> };
  counts: { lowStock: number; expiringSoon: number; maintenanceDue: number };
}

interface Batch {
  _id: string;
  batchNo: string | null;
  expiryDate: string | null;
  quantity: number;
  unitCost: number | null;
  receivedAt: string;
  source: string;
  isDepleted: boolean;
}

const CATEGORIES = ["consumable", "medicine", "equipment"] as const;

const emptyForm = {
  name: "",
  sku: "",
  category: "consumable" as Item["category"],
  unit: "piece",
  currentStock: 0,
  reorderThreshold: 0,
  unitCost: "",
  sellingPrice: "",
  expiryDate: "",
  batchNo: "",
  maintenanceStatus: "operational",
  nextMaintenanceAt: "",
  location: "",
  notes: "",
};

export default function InventoryManagement() {
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.INVENTORY_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.INVENTORY_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.INVENTORY_DELETE);
  const canAdjust = hasPermission(PERMISSIONS.INVENTORY_ADJUST);
  const canApprove = hasPermission(PERMISSIONS.INVENTORY_APPROVE);

  const [items, setItems] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState("");

  const [adjItem, setAdjItem] = useState<Item | null>(null);
  const [adj, setAdj] = useState({
    type: "in",
    quantity: "",
    reason: "",
    batchNo: "",
    expiryDate: "",
    unitCost: "",
  });

  const [batchesItem, setBatchesItem] = useState<Item | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);

  // Barcode/SKU scan — a hardware scanner types the code + Enter, same as
  // fast keyboard input, so this is just a text field wired to the exact
  // by-sku lookup that jumps straight to that item's batches.
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);

  // Write off a specific batch (expired / damaged / lost).
  const [writeOffBatchRow, setWriteOffBatchRow] = useState<Batch | null>(null);
  const [writeOffQty, setWriteOffQty] = useState("1");
  const [writeOffReason, setWriteOffReason] = useState<"expired" | "damaged" | "lost" | "other">("expired");
  const [writeOffNotes, setWriteOffNotes] = useState("");
  const [writeOffError, setWriteOffError] = useState("");
  const [writeOffSaving, setWriteOffSaving] = useState(false);

  // Valuation report.
  const [valuationOpen, setValuationOpen] = useState(false);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuation, setValuation] = useState<{
    totalValue: number;
    byCategory: Record<string, { qty: number; value: number }>;
    items: { itemId: string; name: string; sku: string; category: string; unit: string; currentStock: number; avgCost: number; value: number }[];
  } | null>(null);

  const openValuation = async () => {
    setValuationOpen(true);
    setValuationLoading(true);
    try {
      const res: any = await inventoryApi.valuation();
      setValuation(res.data ?? res.rData ?? null);
    } finally {
      setValuationLoading(false);
    }
  };

  // Consumption trend report.
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const [consumptionLoading, setConsumptionLoading] = useState(false);
  const [consumption, setConsumption] = useState<{
    days: number;
    series: { date: string; quantity: number; value: number; wastageQuantity: number; wastageValue: number }[];
    topItems: { itemId: string; name: string; sku: string; unit: string; quantity: number; value: number }[];
  } | null>(null);

  const openConsumption = async () => {
    setConsumptionOpen(true);
    setConsumptionLoading(true);
    try {
      const res: any = await inventoryApi.consumptionReport(30);
      setConsumption(res.data ?? res.rData ?? null);
    } finally {
      setConsumptionLoading(false);
    }
  };

  // Stock aging report.
  const [agingOpen, setAgingOpen] = useState(false);
  const [agingLoading, setAgingLoading] = useState(false);
  const [aging, setAging] = useState<{
    buckets: { label: string; qty: number; value: number; count: number }[];
    oldest: { batchId: string; itemName: string; sku: string; unit: string; batchNo: string | null; quantity: number; value: number; receivedAt: string; expiryDate: string | null; ageDays: number }[];
  } | null>(null);

  const openAging = async () => {
    setAgingOpen(true);
    setAgingLoading(true);
    try {
      const res: any = await inventoryApi.agingReport();
      setAging(res.data ?? res.rData ?? null);
    } finally {
      setAgingLoading(false);
    }
  };

  // Generate a draft PO straight from the low-stock alerts.
  const [poGenOpen, setPoGenOpen] = useState(false);
  const [poGenSuppliers, setPoGenSuppliers] = useState<any[]>([]);
  const [poGenSupplierId, setPoGenSupplierId] = useState("");
  const [poGenLines, setPoGenLines] = useState<
    { itemId: string; name: string; unit: string; include: boolean; quantity: string; unitPrice: string }[]
  >([]);
  const [poGenError, setPoGenError] = useState("");
  const [poGenSaving, setPoGenSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = {};
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      if (lowOnly) params.lowStock = true;
      const [res, al] = await Promise.all([
        inventoryApi.list(params),
        inventoryApi.alerts(30),
      ]);
      setItems(res.data?.items || []);
      setAlerts(al.data || null);
    } finally {
      setLoading(false);
    }
  }, [search, category, lowOnly]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, lowOnly]);

  // Pending maker-checker approvals — poll a lightweight count so the badge
  // stays current even while this modal is closed.
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvals, setApprovals] = useState<
    {
      _id: string;
      itemName: string;
      unit: string;
      batchNo: string | null;
      type: "adjust_in" | "adjust_out" | "writeoff";
      quantity: number;
      reason: string | null;
      wastageReason: string | null;
      status: "pending" | "approved" | "rejected";
      requestedBy: string;
      requestedByAdminId: string;
      requestedAt: string;
      reviewNotes: string | null;
    }[]
  >([]);

  const loadApprovals = useCallback(async () => {
    if (!canApprove && !canAdjust) return;
    const res: any = await inventoryApi.adjustmentRequests("pending");
    setApprovals(res.data?.items ?? res.rData?.items ?? []);
  }, [canApprove, canAdjust]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const openApprovals = async () => {
    setApprovalsOpen(true);
    setApprovalsLoading(true);
    try {
      await loadApprovals();
    } finally {
      setApprovalsLoading(false);
    }
  };

  const decideApproval = async (id: string, decision: "approve" | "reject") => {
    try {
      if (decision === "approve") await inventoryApi.approveAdjustment(id);
      else await inventoryApi.rejectAdjustment(id);
      await loadApprovals();
      load();
    } catch (e: any) {
      alert(e.message || `Failed to ${decision}`);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setShowForm(true);
  };

  const openEdit = (it: Item) => {
    setEditingId(it._id);
    setForm({
      ...emptyForm,
      name: it.name,
      sku: it.sku,
      category: it.category,
      unit: it.unit,
      currentStock: it.currentStock,
      reorderThreshold: it.reorderThreshold,
      sellingPrice: it.sellingPrice != null ? String(it.sellingPrice) : "",
      expiryDate: it.expiryDate ? it.expiryDate.substring(0, 10) : "",
      maintenanceStatus: it.maintenanceStatus || "operational",
      location: it.location || "",
    });
    setError("");
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.sku.trim()) {
      setError("Name and SKU are required.");
      return;
    }
    try {
      if (editingId) await inventoryApi.update(editingId, form);
      else await inventoryApi.create(form);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    }
  };

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjItem) return;
    try {
      await inventoryApi.adjust(adjItem._id, {
        type: adj.type as "in" | "out",
        quantity: Number(adj.quantity),
        reason: adj.reason || undefined,
        ...(adj.type === "in"
          ? {
              batchNo: adj.batchNo || undefined,
              expiryDate: adj.expiryDate || undefined,
              unitCost: adj.unitCost ? Number(adj.unitCost) : undefined,
            }
          : {}),
      });
      setAdjItem(null);
      setAdj({ type: "in", quantity: "", reason: "", batchNo: "", expiryDate: "", unitCost: "" });
      alert("Submitted for approval — a different admin needs to approve this before stock updates.");
      loadApprovals();
    } catch (err: any) {
      alert(err.message || "Failed to adjust stock");
    }
  };

  const openBatches = async (it: Item) => {
    setBatchesItem(it);
    setBatchesLoading(true);
    try {
      const res: any = await inventoryApi.batches(it._id);
      setBatches(res.data?.batches ?? res.rData?.batches ?? []);
    } finally {
      setBatchesLoading(false);
    }
  };

  const handleScan = async () => {
    const sku = scanValue.trim();
    if (!sku || scanning) return;
    setScanning(true);
    setScanError("");
    try {
      const res: any = await inventoryApi.bySku(sku);
      const found: Item | null = res.data?.item ?? null;
      if (!found) {
        setScanError(`No item found for SKU "${sku}"`);
        return;
      }
      setScanValue("");
      setSearch(found.sku);
      await openBatches(found);
    } catch {
      setScanError(`No item found for SKU "${sku}"`);
    } finally {
      setScanning(false);
    }
  };

  const openWriteOff = (b: Batch) => {
    setWriteOffBatchRow(b);
    setWriteOffQty("1");
    setWriteOffReason("expired");
    setWriteOffNotes("");
    setWriteOffError("");
  };

  const submitWriteOff = async () => {
    if (!batchesItem || !writeOffBatchRow || writeOffSaving) return;
    const qty = Number(writeOffQty);
    if (!qty || qty <= 0) {
      setWriteOffError("Enter a valid quantity.");
      return;
    }
    setWriteOffSaving(true);
    setWriteOffError("");
    try {
      await inventoryApi.writeOffBatch(batchesItem._id, writeOffBatchRow._id, {
        quantity: qty,
        reason: writeOffReason,
        notes: writeOffNotes.trim() || undefined,
      });
      setWriteOffBatchRow(null);
      alert("Submitted for approval — a different admin needs to approve this before stock updates.");
      loadApprovals();
    } catch (e: any) {
      setWriteOffError(e.message || "Failed to write off stock");
    } finally {
      setWriteOffSaving(false);
    }
  };

  const openPoGen = async () => {
    if (!alerts) return;
    setPoGenError("");
    setPoGenSupplierId("");
    // Suggest restocking to 2× the reorder threshold — a simple, editable
    // starting point, not a real par-level calculation.
    setPoGenLines(
      alerts.lowStock.map((it) => ({
        itemId: it._id,
        name: it.name,
        unit: it.unit,
        include: true,
        quantity: String(Math.max(1, it.reorderThreshold * 2 - it.currentStock)),
        unitPrice: it.unitCost != null ? String(it.unitCost) : "0",
      })),
    );
    setPoGenOpen(true);
    if (poGenSuppliers.length === 0) {
      const res: any = await procurementApi.listSuppliers();
      setPoGenSuppliers(res.data?.items ?? res.rData?.items ?? []);
    }
  };

  const setPoGenLine = (i: number, patch: Partial<(typeof poGenLines)[number]>) =>
    setPoGenLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submitPoGen = async () => {
    if (poGenSaving) return;
    if (!poGenSupplierId) {
      setPoGenError("Select a supplier.");
      return;
    }
    const items = poGenLines
      .filter((l) => l.include && Number(l.quantity) > 0)
      .map((l) => ({ itemId: l.itemId, name: l.name, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) || 0 }));
    if (items.length === 0) {
      setPoGenError("Include at least one item with a quantity.");
      return;
    }
    setPoGenSaving(true);
    setPoGenError("");
    try {
      await procurementApi.createPurchaseOrder({ supplierId: poGenSupplierId, items, status: "draft" });
      setPoGenOpen(false);
    } catch (e: any) {
      setPoGenError(e.message || "Failed to create purchase order");
    } finally {
      setPoGenSaving(false);
    }
  };

  const onDelete = async (it: Item) => {
    if (!window.confirm(`Delete ${it.name}?`)) return;
    await inventoryApi.remove(it._id);
    load();
  };

  const isLow = (it: Item) => it.currentStock <= it.reorderThreshold;

  return (
    <div className="p-6">
      <PageHeader
        title="Inventory Management"
        subtitle="Supplies, consumables & equipment — Doctor Panel (HMS)"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openValuation}>Valuation</Button>
            <Button variant="secondary" onClick={openConsumption}>Consumption</Button>
            <Button variant="secondary" onClick={openAging}>Aging</Button>
            {(canApprove || canAdjust) && (
              <Button variant="secondary" onClick={openApprovals}>
                Approvals{approvals.length > 0 ? ` (${approvals.length})` : ""}
              </Button>
            )}
            {canCreate && <Button onClick={openCreate}>+ Add Item</Button>}
          </div>
        }
      />

      {/* Alerts */}
      {alerts &&
        (alerts.counts.lowStock > 0 ||
          alerts.counts.expiringSoon > 0 ||
          alerts.counts.maintenanceDue > 0 ||
          alerts.wastage.total > 0) && (
          <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-3 border-amber-200 bg-amber-50">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-amber-700">Low stock / reorder</div>
                  <div className="text-xl font-semibold text-amber-800">
                    {alerts.counts.lowStock}
                  </div>
                </div>
                {canUpdate && alerts.counts.lowStock > 0 && (
                  <Button size="sm" onClick={openPoGen}>Generate PO</Button>
                )}
              </div>
            </Card>
            <Card className="p-3 border-red-200 bg-red-50">
              <div className="text-xs text-red-700">Expiring ≤ 30 days</div>
              <div className="text-xl font-semibold text-red-800">
                {alerts.counts.expiringSoon}
              </div>
            </Card>
            <Card className="p-3 border-blue-200 bg-blue-50">
              <div className="text-xs text-blue-700">Maintenance due</div>
              <div className="text-xl font-semibold text-blue-800">
                {alerts.counts.maintenanceDue}
              </div>
            </Card>
            <Card className="p-3 border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-600">Wastage written off (30d)</div>
              <div className="text-xl font-semibold text-gray-800">{alerts.wastage.total}</div>
              {alerts.wastage.total > 0 && (
                <div className="mt-1 text-[11px] text-gray-400">
                  {Object.entries(alerts.wastage.byReason)
                    .map(([r, q]) => `${r}: ${q}`)
                    .join(" · ")}
                </div>
              )}
            </Card>
          </div>
        )}

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search by name or SKU"
          className="w-full max-w-xs"
        />
        <div className="flex flex-col">
          <SearchInput
            value={scanValue}
            onChange={(e) => {
              setScanValue(e.target.value);
              if (scanError) setScanError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="Scan barcode / SKU (Enter)"
            className="w-full max-w-xs"
            disabled={scanning}
          />
          {scanError && <div className="mt-1 text-xs text-red-600">{scanError}</div>}
        </div>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-auto capitalize"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 px-3 text-sm">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
          />
          Low stock only
        </label>
        <Button variant="secondary" onClick={load}>
          Search
        </Button>
      </div>

      <Table>
        <THead>
          <Th>Item</Th>
          <Th>SKU</Th>
          <Th>Category</Th>
          <Th className="text-right">Stock</Th>
          <Th>Expiry / Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={6}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={6}>No items.</TableState>
          ) : (
            items.map((it) => (
              <TR key={it._id}>
                <Td className="font-medium text-gray-900">{it.name}</Td>
                <Td className="font-mono text-xs">{it.sku}</Td>
                <Td className="capitalize">{it.category}</Td>
                <Td className="text-right">
                  <span className={isLow(it) ? "text-amber-700 font-semibold" : ""}>
                    {it.currentStock} {it.unit}
                  </span>
                  {isLow(it) && (
                    <Badge tone="warning" className="ml-2">
                      reorder
                    </Badge>
                  )}
                </Td>
                <Td className="text-xs text-gray-500">
                  {it.category === "equipment"
                    ? it.maintenanceStatus
                    : it.expiryDate
                      ? new Date(it.expiryDate).toLocaleDateString()
                      : "—"}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  {canAdjust && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2 text-healwin-700 hover:bg-healwin-50"
                      title="Adjust"
                      aria-label="Adjust"
                      onClick={() => setAdjItem(it)}
                    >
                      <PackagePlus className="h-4 w-4" />
                    </Button>
                  )}
                  {it.category !== "equipment" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      title="View batches"
                      aria-label="View batches"
                      onClick={() => openBatches(it)}
                    >
                      <Layers className="h-4 w-4" />
                    </Button>
                  )}
                  {canUpdate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      title="Edit"
                      aria-label="Edit"
                      onClick={() => openEdit(it)}
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
                      onClick={() => onDelete(it)}
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

      {/* Item form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? "Edit Item" : "Add Item"}
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
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="SKU *">
              <Input
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                disabled={!!editingId}
              />
            </Field>
            <Field label="Category">
              <Select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as any })
                }
                disabled={!!editingId}
                className="capitalize"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unit">
              <Input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </Field>
            {!editingId && (
              <Field label="Opening stock">
                <Input
                  type="number"
                  value={form.currentStock}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      currentStock: Number(e.target.value),
                    })
                  }
                />
              </Field>
            )}
            <Field label="Reorder threshold">
              <Input
                type="number"
                value={form.reorderThreshold}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reorderThreshold: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Selling price ₹ (patient billing)">
              <Input
                type="number"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
              />
            </Field>
            {form.category !== "equipment" && (
              <Field label="Expiry date">
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) =>
                    setForm({ ...form, expiryDate: e.target.value })
                  }
                />
              </Field>
            )}
            {form.category === "equipment" && (
              <Field label="Maintenance status">
                <Select
                  value={form.maintenanceStatus}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maintenanceStatus: e.target.value,
                    })
                  }
                >
                  <option value="operational">Operational</option>
                  <option value="under_maintenance">Under maintenance</option>
                  <option value="out_of_service">Out of service</option>
                </Select>
              </Field>
            )}
            <Field label="Location / ward">
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </Field>
          </div>
        </form>
      </Modal>

      {/* Stock adjust modal */}
      <Modal
        open={!!adjItem}
        onClose={() => setAdjItem(null)}
        title="Adjust stock"
        subtitle={
          adjItem
            ? `${adjItem.name} — current ${adjItem.currentStock} ${adjItem.unit}`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjItem(null)}>
              Cancel
            </Button>
            <Button onClick={submitAdjust}>Apply</Button>
          </>
        }
      >
        <form onSubmit={submitAdjust} className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdj({ ...adj, type: "in" })}
              className={`flex-1 py-2 rounded-lg border ${
                adj.type === "in"
                  ? "bg-green-50 border-green-300 text-green-700"
                  : "border-gray-300"
              }`}
            >
              Stock In
            </button>
            <button
              type="button"
              onClick={() => setAdj({ ...adj, type: "out" })}
              className={`flex-1 py-2 rounded-lg border ${
                adj.type === "out"
                  ? "bg-red-50 border-red-300 text-red-700"
                  : "border-gray-300"
              }`}
            >
              Issue / Out
            </button>
          </div>
          <Input
            type="number"
            placeholder="Quantity"
            value={adj.quantity}
            onChange={(e) => setAdj({ ...adj, quantity: e.target.value })}
          />
          <Input
            placeholder="Reason / issued to (optional)"
            value={adj.reason}
            onChange={(e) => setAdj({ ...adj, reason: e.target.value })}
          />
          {adj.type === "in" && adjItem?.category !== "equipment" && (
            <>
              <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Batch (optional — enables FEFO issuance)
              </p>
              <Input
                placeholder="Batch / lot number"
                value={adj.batchNo}
                onChange={(e) => setAdj({ ...adj, batchNo: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Expiry date">
                  <Input
                    type="date"
                    value={adj.expiryDate}
                    onChange={(e) => setAdj({ ...adj, expiryDate: e.target.value })}
                  />
                </Field>
                <Field label="Unit cost ₹">
                  <Input
                    type="number"
                    value={adj.unitCost}
                    onChange={(e) => setAdj({ ...adj, unitCost: e.target.value })}
                  />
                </Field>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* Batches viewer */}
      <Modal
        open={!!batchesItem}
        onClose={() => setBatchesItem(null)}
        title="Batches"
        subtitle={batchesItem ? `${batchesItem.name} · total ${batchesItem.currentStock} ${batchesItem.unit}` : undefined}
      >
        {batchesLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : batches.length === 0 ? (
          <p className="text-sm text-gray-500">
            No batches yet — stock on this item predates batch tracking, or was added without a batch number.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {batches.map((b) => (
              <div key={b._id} className={`flex items-center justify-between px-3 py-2 text-sm ${b.isDepleted ? "opacity-50" : ""}`}>
                <div>
                  <div className="text-gray-800">{b.batchNo || "— no batch no. —"}</div>
                  <div className="text-xs text-gray-400">
                    Received {new Date(b.receivedAt).toLocaleDateString()}
                    {b.expiryDate ? ` · Expires ${new Date(b.expiryDate).toLocaleDateString()}` : " · No expiry"}
                    {b.unitCost != null ? ` · ₹${b.unitCost}/unit` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{b.quantity}</div>
                    {b.isDepleted && <Badge tone="neutral">depleted</Badge>}
                  </div>
                  {!b.isDepleted && canAdjust && (
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => openWriteOff(b)}>
                      Write off
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Write off a batch */}
      <Modal
        open={!!writeOffBatchRow}
        onClose={() => setWriteOffBatchRow(null)}
        title="Write off stock"
        subtitle={writeOffBatchRow ? `${batchesItem?.name} — batch ${writeOffBatchRow.batchNo || "(no batch no.)"} · ${writeOffBatchRow.quantity} on hand` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setWriteOffBatchRow(null)}>Cancel</Button>
            <Button onClick={submitWriteOff} disabled={writeOffSaving}>{writeOffSaving ? "Saving…" : "Write off"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {writeOffError && <Alert tone="danger">{writeOffError}</Alert>}
          <Field label="Reason">
            <select
              value={writeOffReason}
              onChange={(e) => setWriteOffReason(e.target.value as typeof writeOffReason)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            >
              <option value="expired">Expired</option>
              <option value="damaged">Damaged</option>
              <option value="lost">Lost</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Quantity">
            <Input type="number" value={writeOffQty} onChange={(e) => setWriteOffQty(e.target.value)} />
          </Field>
          <Field label="Notes (optional)">
            <Input value={writeOffNotes} onChange={(e) => setWriteOffNotes(e.target.value)} placeholder="e.g. Found during weekly stock check" />
          </Field>
        </div>
      </Modal>

      {/* Generate PO from low-stock alerts */}
      <Modal
        open={poGenOpen}
        onClose={() => setPoGenOpen(false)}
        title="Generate purchase order"
        subtitle="Draft PO for the items currently at/under their reorder threshold"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPoGenOpen(false)}>Cancel</Button>
            <Button onClick={submitPoGen} disabled={poGenSaving}>{poGenSaving ? "Creating…" : "Create draft PO"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {poGenError && <Alert tone="danger">{poGenError}</Alert>}
          <Field label="Supplier *">
            <select
              value={poGenSupplierId}
              onChange={(e) => setPoGenSupplierId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            >
              <option value="">— Select supplier —</option>
              {poGenSuppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-[24px_1fr_84px_84px] items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span /><span>Item</span><span>Qty</span><span>Price</span>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {poGenLines.map((l, i) => (
              <div key={l.itemId} className="grid grid-cols-[24px_1fr_84px_84px] items-center gap-2">
                <input
                  type="checkbox"
                  checked={l.include}
                  onChange={(e) => setPoGenLine(i, { include: e.target.checked })}
                />
                <span className="truncate text-sm text-gray-800">{l.name} {l.unit ? <span className="text-gray-400">({l.unit})</span> : null}</span>
                <Input type="number" value={l.quantity} onChange={(e) => setPoGenLine(i, { quantity: e.target.value })} disabled={!l.include} />
                <Input type="number" value={l.unitPrice} onChange={(e) => setPoGenLine(i, { unitPrice: e.target.value })} disabled={!l.include} />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Quantities default to restocking up to 2× the reorder threshold — adjust freely before creating. The PO is saved as a draft; use Procurement to send/receive it.
          </p>
        </div>
      </Modal>

      {/* Stock valuation report */}
      <Modal
        open={valuationOpen}
        onClose={() => setValuationOpen(false)}
        title="Stock valuation"
        subtitle="Real value from actual batch costs, not just the latest purchase price"
        size="lg"
      >
        {valuationLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : !valuation ? (
          <p className="text-sm text-gray-500">Could not load valuation.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-3 border-healwin-200 bg-healwin-50">
                <div className="text-xs text-healwin-700">Total stock value</div>
                <div className="text-xl font-semibold text-healwin-800">₹{valuation.totalValue.toLocaleString("en-IN")}</div>
              </Card>
              {Object.entries(valuation.byCategory).map(([cat, v]) => (
                <Card key={cat} className="p-3 border-gray-200 bg-gray-50">
                  <div className="text-xs capitalize text-gray-600">{cat}</div>
                  <div className="text-xl font-semibold text-gray-800">₹{v.value.toLocaleString("en-IN")}</div>
                  <div className="text-[11px] text-gray-400">{v.qty} units</div>
                </Card>
              ))}
            </div>
            <Table>
              <THead>
                <Th>Item</Th>
                <Th className="text-right">Stock</Th>
                <Th className="text-right">Avg cost</Th>
                <Th className="text-right">Value</Th>
              </THead>
              <TBody>
                {valuation.items.length === 0 ? (
                  <TableState colSpan={4}>No stock on hand.</TableState>
                ) : (
                  valuation.items.map((it) => (
                    <TR key={it.itemId}>
                      <Td className="font-medium text-gray-900">{it.name}<span className="ml-2 font-mono text-xs text-gray-400">{it.sku}</span></Td>
                      <Td className="text-right">{it.currentStock} {it.unit}</Td>
                      <Td className="text-right text-gray-500">₹{it.avgCost.toLocaleString("en-IN")}</Td>
                      <Td className="text-right font-semibold text-gray-900">₹{it.value.toLocaleString("en-IN")}</Td>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        )}
      </Modal>

      {/* Consumption trend report */}
      <Modal
        open={consumptionOpen}
        onClose={() => setConsumptionOpen(false)}
        title="Consumption trend"
        subtitle={consumption ? `Last ${consumption.days} days — issuance vs wastage, and top-consumed items` : undefined}
        size="lg"
      >
        {consumptionLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : !consumption ? (
          <p className="text-sm text-gray-500">Could not load report.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Daily totals</h4>
              {consumption.series.length === 0 ? (
                <p className="text-sm text-gray-500">No consumption in this period.</p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {consumption.series.map((d) => (
                    <div key={d.date} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-xs">
                      <span className="text-gray-600">{d.date}</span>
                      <span>
                        <span className="text-gray-800">{d.quantity} units · ₹{d.value.toLocaleString("en-IN")}</span>
                        {d.wastageQuantity > 0 && (
                          <span className="ml-2 text-red-500">+{d.wastageQuantity} wastage · ₹{d.wastageValue.toLocaleString("en-IN")}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Top consumed items</h4>
              <Table>
                <THead>
                  <Th>Item</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Value</Th>
                </THead>
                <TBody>
                  {consumption.topItems.length === 0 ? (
                    <TableState colSpan={3}>No consumption in this period.</TableState>
                  ) : (
                    consumption.topItems.map((it) => (
                      <TR key={it.itemId}>
                        <Td className="font-medium text-gray-900">{it.name}</Td>
                        <Td className="text-right">{it.quantity} {it.unit}</Td>
                        <Td className="text-right font-semibold text-gray-900">₹{it.value.toLocaleString("en-IN")}</Td>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </div>
          </div>
        )}
      </Modal>

      {/* Stock aging report */}
      <Modal
        open={agingOpen}
        onClose={() => setAgingOpen(false)}
        title="Stock aging"
        subtitle="How long active batches have sat since receipt — spot slow-moving stock before it expires"
        size="lg"
      >
        {agingLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : !aging ? (
          <p className="text-sm text-gray-500">Could not load report.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {aging.buckets.map((b) => (
                <Card key={b.label} className={`p-3 ${b.label === "90+ days" ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
                  <div className={`text-xs ${b.label === "90+ days" ? "text-red-700" : "text-gray-600"}`}>{b.label}</div>
                  <div className={`text-xl font-semibold ${b.label === "90+ days" ? "text-red-800" : "text-gray-800"}`}>{b.count}</div>
                  <div className="text-[11px] text-gray-400">{b.qty} units · ₹{b.value.toLocaleString("en-IN")}</div>
                </Card>
              ))}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Oldest active batches</h4>
              <Table>
                <THead>
                  <Th>Item</Th>
                  <Th>Batch</Th>
                  <Th className="text-right">Age</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Value</Th>
                </THead>
                <TBody>
                  {aging.oldest.length === 0 ? (
                    <TableState colSpan={5}>No active batches.</TableState>
                  ) : (
                    aging.oldest.map((b) => (
                      <TR key={b.batchId}>
                        <Td className="font-medium text-gray-900">{b.itemName}</Td>
                        <Td className="text-xs text-gray-500">{b.batchNo || "—"}</Td>
                        <Td className="text-right">{b.ageDays}d</Td>
                        <Td className="text-right">{b.quantity} {b.unit}</Td>
                        <Td className="text-right font-semibold text-gray-900">₹{b.value.toLocaleString("en-IN")}</Td>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </div>
          </div>
        )}
      </Modal>

      {/* Maker-checker: pending adjustment/write-off approvals */}
      <Modal
        open={approvalsOpen}
        onClose={() => setApprovalsOpen(false)}
        title="Pending approvals"
        subtitle="Manual adjustments and write-offs wait here until a different admin approves them"
        size="lg"
      >
        {approvalsLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : approvals.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing pending.</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {approvals.map((a) => {
              const isOwnRequest = !!user && a.requestedByAdminId === user._id;
              return (
                <div key={a._id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                  <div>
                    <div className="text-gray-900">
                      <span className="font-medium">{a.itemName}</span>
                      {a.batchNo ? <span className="ml-1 text-xs text-gray-400">batch {a.batchNo}</span> : null}
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.type === "adjust_in" ? "Stock in" : a.type === "adjust_out" ? "Stock out" : `Write off (${a.wastageReason})`}
                      {" · "}{a.quantity} {a.unit}
                      {a.reason ? ` · ${a.reason}` : ""}
                    </div>
                    <div className="text-xs text-gray-400">
                      Requested by {a.requestedBy} · {new Date(a.requestedAt).toLocaleString()}
                    </div>
                  </div>
                  {canApprove ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => decideApproval(a._id, "reject")}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={isOwnRequest}
                        title={isOwnRequest ? "You can't approve your own request" : undefined}
                        onClick={() => decideApproval(a._id, "approve")}
                      >
                        Approve
                      </Button>
                    </div>
                  ) : (
                    <Badge tone="neutral">Awaiting review</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}

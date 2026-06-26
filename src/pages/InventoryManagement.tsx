import { useEffect, useState, useCallback } from "react";
import { PackagePlus, Pencil, Trash2 } from "lucide-react";
import { inventoryApi } from "../services/admin-api";
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
  counts: { lowStock: number; expiringSoon: number; maintenanceDue: number };
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
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.INVENTORY_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.INVENTORY_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.INVENTORY_DELETE);
  const canAdjust = hasPermission(PERMISSIONS.INVENTORY_ADJUST);

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
  const [adj, setAdj] = useState({ type: "in", quantity: "", reason: "" });

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
      });
      setAdjItem(null);
      setAdj({ type: "in", quantity: "", reason: "" });
      load();
    } catch (err: any) {
      alert(err.message || "Failed to adjust stock");
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
          canCreate ? (
            <Button onClick={openCreate}>+ Add Item</Button>
          ) : undefined
        }
      />

      {/* Alerts */}
      {alerts &&
        (alerts.counts.lowStock > 0 ||
          alerts.counts.expiringSoon > 0 ||
          alerts.counts.maintenanceDue > 0) && (
          <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-3">
            <Card className="p-3 border-amber-200 bg-amber-50">
              <div className="text-xs text-amber-700">Low stock / reorder</div>
              <div className="text-xl font-semibold text-amber-800">
                {alerts.counts.lowStock}
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
        </form>
      </Modal>
    </div>
  );
}

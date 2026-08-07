import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { catalogApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import Pagination from "../components/Pagination";
import {
  PageHeader, Button, SearchInput, Table, THead, TBody, TR, Th, Td,
  TableState, Badge, Modal, Field, Input, Select, Alert,
} from "../components/ui";

type FieldType = "text" | "number" | "bool" | "inventoryLink";
interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
}
interface TabDef {
  key: "products" | "labTests" | "procedures";
  label: string;
  resource: typeof catalogApi.products;
  columns: { key: string; label: string }[];
  fields: FieldDef[];
}

const TABS: TabDef[] = [
  {
    key: "products",
    label: "Pharmacy Products",
    resource: catalogApi.products,
    columns: [
      { key: "category", label: "Category" },
      { key: "price", label: "Price" },
      { key: "stock", label: "Stock" },
      { key: "linkedItemName", label: "Linked HMS item" },
    ],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "brand", label: "Brand" },
      { key: "category", label: "Category" },
      { key: "price", label: "Price", type: "number", required: true },
      { key: "mrp", label: "MRP", type: "number" },
      { key: "itemId", label: "Link to HMS inventory item", type: "inventoryLink" },
      { key: "stock", label: "Stock (manual — only used if not linked above)", type: "number" },
      { key: "prescriptionRequired", label: "Prescription required", type: "bool" },
      { key: "description", label: "Description" },
    ],
  },
  {
    key: "labTests",
    label: "Lab Tests",
    resource: catalogApi.labTests,
    columns: [
      { key: "category", label: "Category" },
      { key: "price", label: "Price" },
      { key: "sampleType", label: "Sample" },
    ],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "category", label: "Category" },
      { key: "price", label: "Price", type: "number", required: true },
      { key: "mrp", label: "MRP", type: "number" },
      { key: "sampleType", label: "Sample Type" },
      { key: "reportHours", label: "Report (hours)", type: "number" },
      { key: "homeCollection", label: "Home collection", type: "bool" },
      { key: "description", label: "Description" },
    ],
  },
  {
    key: "procedures",
    label: "Procedures",
    resource: catalogApi.procedures,
    columns: [
      { key: "category", label: "Category" },
      { key: "price", label: "Price" },
    ],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "category", label: "Category" },
      { key: "price", label: "Price", type: "number", required: true },
      { key: "description", label: "Description" },
    ],
  },
];

export default function CatalogManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.CATALOG_MANAGE);

  const [tabKey, setTabKey] = useState<TabDef["key"]>("products");
  const tab = TABS.find((t) => t.key === tabKey)!;

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [error, setError] = useState("");

  // Inventory items available to link a pharmacy product to (products tab only).
  const [invOptions, setInvOptions] = useState<{ _id: string; name: string; sku: string; currentStock: number; unit: string }[]>([]);
  useEffect(() => {
    if (tabKey !== "products") return;
    catalogApi.inventoryItems().then((res) => setInvOptions(res.data?.items || [])).catch(() => setInvOptions([]));
  }, [tabKey]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search.trim()) params.search = search.trim();
      const res = await tab.resource.list(params);
      const data = res.data || res;
      setItems(data.items || []);
      setTotal(data.pagination?.total ?? (data.items || []).length);
    } finally {
      setLoading(false);
    }
  }, [tab, search, page, limit]);

  useEffect(() => { setPage(1); }, [tabKey]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey, page, limit]);

  const openCreate = () => {
    setEditingId(null);
    setForm({});
    setError("");
    setShow(true);
  };
  const openEdit = (it: any) => {
    setEditingId(it._id);
    const f: Record<string, any> = {};
    tab.fields.forEach((fd) => (f[fd.key] = it[fd.key]));
    setForm(f);
    setError("");
    setShow(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const missing = tab.fields.find((fd) => fd.required && !String(form[fd.key] ?? "").trim());
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    // Coerce number fields.
    const payload: Record<string, any> = { ...form };
    tab.fields.forEach((fd) => {
      if (fd.type === "number" && payload[fd.key] !== undefined && payload[fd.key] !== "")
        payload[fd.key] = Number(payload[fd.key]);
      if (fd.type === "bool") payload[fd.key] = !!payload[fd.key];
    });
    try {
      if (editingId) await tab.resource.update(editingId, payload);
      else await tab.resource.create(payload);
      setShow(false);
      load();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    }
  };

  const onDelete = async (it: any) => {
    if (!window.confirm(`Delete "${it.name}"?`)) return;
    await tab.resource.remove(it._id);
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Pharmacy & Lab Catalog"
        subtitle="Pharmacy products & lab tests shown in the patient app (doctors are managed under Admin Management)"
        actions={canManage ? <Button onClick={openCreate}>+ Add {tab.label.replace(/s$/, "")}</Button> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={t.key === tabKey ? "primary" : "secondary"} onClick={() => setTabKey(t.key)}>
            {t.label}
          </Button>
        ))}
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (page === 1 ? load() : setPage(1))}
          placeholder="Search by name"
          className="ml-auto w-full max-w-xs"
        />
      </div>

      <Table>
        <THead>
          <Th>Name</Th>
          {tab.columns.map((c) => <Th key={c.key}>{c.label}</Th>)}
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={tab.columns.length + 3}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={tab.columns.length + 3}>No {tab.label.toLowerCase()}.</TableState>
          ) : (
            items.map((it) => (
              <TR key={it._id}>
                <Td className="font-medium text-gray-900">{it.name}</Td>
                {tab.columns.map((c) => (
                  <Td key={c.key}>{it[c.key] != null && it[c.key] !== "" ? String(it[c.key]) : "—"}</Td>
                ))}
                <Td><Badge tone={it.isActive === false ? "neutral" : "success"}>{it.isActive === false ? "inactive" : "active"}</Badge></Td>
                <Td className="text-right whitespace-nowrap">
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" className="px-2" aria-label="Edit" onClick={() => openEdit(it)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="px-2 text-red-600 hover:bg-red-50" aria-label="Delete" onClick={() => onDelete(it)}>
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Rows per page
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
          >
            {[5, 10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <Pagination page={page} totalPages={totalPages} total={total} label="items" onPageChange={setPage} />
      </div>

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title={`${editingId ? "Edit" : "Add"} ${tab.label.replace(/s$/, "")}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
            <Button onClick={submit}>{editingId ? "Update" : "Create"}</Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            {tab.fields.map((fd) =>
              fd.type === "bool" ? (
                <label key={fd.key} className="col-span-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!form[fd.key]}
                    onChange={(e) => setForm({ ...form, [fd.key]: e.target.checked })}
                  />
                  {fd.label}
                </label>
              ) : fd.type === "inventoryLink" ? (
                <Field key={fd.key} label={fd.label} className="col-span-2">
                  <Select
                    value={form[fd.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [fd.key]: e.target.value || undefined })}
                  >
                    <option value="">— Not linked (use manual stock below) —</option>
                    {invOptions.map((it) => (
                      <option key={it._id} value={it._id}>
                        {it.name} ({it.sku}) — {it.currentStock} {it.unit} in stock
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field key={fd.key} label={fd.required ? `${fd.label} *` : fd.label}>
                  <Input
                    type={fd.type === "number" ? "number" : "text"}
                    value={form[fd.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [fd.key]: e.target.value })}
                    disabled={fd.key === "stock" && tabKey === "products" && !!form.itemId}
                  />
                </Field>
              ),
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

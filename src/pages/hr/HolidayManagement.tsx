import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { holidayApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import {
  PageHeader, Button, Select, Table, THead, TBody, TR, Th, Td,
  TableState, Badge, Modal, Field, Input, Alert,
} from "../../components/ui";

interface Holiday {
  _id: string;
  name: string;
  date: string;
  year: number;
  type: "public" | "restricted" | "optional";
  isActive: boolean;
}

const TYPES = ["public", "restricted", "optional"] as const;
const thisYear = new Date().getFullYear();
const YEARS = [thisYear - 1, thisYear, thisYear + 1];

export default function HolidayManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.HOLIDAYS_MANAGE);

  const [year, setYear] = useState(thisYear);
  const [items, setItems] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", date: "", type: "public" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await holidayApi.list(year);
      setItems(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", date: "", type: "public" });
    setError("");
    setShow(true);
  };
  const openEdit = (h: Holiday) => {
    setEditingId(h._id);
    setForm({ name: h.name, date: h.date.substring(0, 10), type: h.type });
    setError("");
    setShow(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.date) {
      setError("Name and date are required.");
      return;
    }
    try {
      await holidayApi.save(form, editingId || undefined);
      setShow(false);
      load();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    }
  };

  const onDelete = async (h: Holiday) => {
    if (!window.confirm(`Delete holiday "${h.name}"?`)) return;
    await holidayApi.remove(h._id);
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Holiday Calendar"
        subtitle="Org holidays — excluded from absent / loss-of-pay calculations"
        actions={canManage ? <Button onClick={openCreate}>+ Add Holiday</Button> : undefined}
      />

      <div className="mb-4">
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-40">
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      </div>

      <Table>
        <THead>
          <Th>Holiday</Th>
          <Th>Date</Th>
          <Th>Type</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={4}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={4}>No holidays for {year}.</TableState>
          ) : (
            items.map((h) => (
              <TR key={h._id}>
                <Td className="font-medium text-gray-900">{h.name}</Td>
                <Td>{new Date(h.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</Td>
                <Td><Badge tone="info">{h.type}</Badge></Td>
                <Td className="text-right whitespace-nowrap">
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" className="px-2" onClick={() => openEdit(h)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="px-2 text-red-600 hover:bg-red-50" onClick={() => onDelete(h)} aria-label="Delete">
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

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title={editingId ? "Edit Holiday" : "Add Holiday"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
            <Button onClick={submit}>{editingId ? "Update" : "Create"}</Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Name *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="capitalize">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}

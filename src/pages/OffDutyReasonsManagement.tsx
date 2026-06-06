import { useEffect, useState } from "react";
import { Pencil, Power, Trash2 } from "lucide-react";
import { offDutyReasonsApi } from "../services/admin-api";
import {
  PageHeader,
  Button,
  SearchInput,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
  Badge,
  Modal,
  Field,
  Input,
} from "../components/ui";

type Reason = {
  _id: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: string;
};

export default function OffDutyReasonsManagement() {
  const [items, setItems] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reason | null>(null);
  const [form, setForm] = useState<{
    label: string;
    isActive: boolean;
    sortOrder: number;
  }>({ label: "", isActive: true, sortOrder: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      const res = await offDutyReasonsApi.list(params);
      setItems(res.data?.items || res.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ label: "", isActive: true, sortOrder: items.length });
    setShowForm(true);
  };

  const openEdit = (r: Reason) => {
    setEditing(r);
    setForm({
      label: r.label,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
    });
    setShowForm(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await offDutyReasonsApi.update(editing._id, form);
    else await offDutyReasonsApi.create(form);
    setShowForm(false);
    setEditing(null);
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Off-Duty Reasons"
        subtitle="Drivers must pick one of these when going off duty. Inactive reasons are hidden from the driver app but kept in audit history."
        actions={<Button onClick={openCreate}>+ New Reason</Button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          placeholder="Search by label"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs"
        />
        <Button variant="secondary" onClick={load}>
          Apply
        </Button>
      </div>

      <Table>
        <THead>
          <Th className="w-16">Order</Th>
          <Th>Label</Th>
          <Th className="w-24">Active</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={4}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={4}>
              No reasons configured yet. Click <b>New Reason</b> to add one, or
              run the seed script:{" "}
              <code>npx ts-node src/scripts/seed-off-duty-reasons.ts</code>
            </TableState>
          ) : (
            items.map((r) => (
              <TR key={r._id}>
                <Td className="font-mono text-gray-500">{r.sortOrder}</Td>
                <Td className="font-medium text-gray-900">{r.label}</Td>
                <Td>
                  <Badge tone={r.isActive ? "success" : "neutral"} dot>
                    {r.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => openEdit(r)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title={r.isActive ? "Deactivate" : "Activate"}
                    aria-label={r.isActive ? "Deactivate" : "Activate"}
                    onClick={async () => {
                      await offDutyReasonsApi.update(r._id, {
                        isActive: !r.isActive,
                      });
                      load();
                    }}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={async () => {
                      if (!confirm(`Delete "${r.label}"?`)) return;
                      await offDutyReasonsApi.remove(r._id);
                      load();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Off-Duty Reason" : "New Off-Duty Reason"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit}>Save</Button>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Label">
            <Input
              required
              maxLength={80}
              placeholder='e.g. "Vehicle maintenance"'
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </Field>
          <Field
            label="Sort order"
            hint="Lower numbers appear first in the driver app."
          >
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) =>
                setForm({ ...form, sortOrder: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span>Active (shown to drivers)</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}

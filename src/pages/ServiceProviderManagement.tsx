import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { providerApi, stateApi, districtApi } from "../services/admin-api";
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
  Select,
} from "../components/ui";

type Provider = {
  _id: string;
  name: string;
  contactPersonName: string;
  phone: string;
  email?: string;
  gstin?: string;
  isActive: boolean;
  state: string;
  district: string;
};

export default function ServiceProviderManagement() {
  const [items, setItems] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState<Partial<Provider>>({});
  const [allStates, setAllStates] = useState<any[]>([]);
  const [allDistricts, setAllDistricts] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await providerApi.list(search ? { search } : {});
      setItems(res.data?.items || res.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Load states + districts once so the form can offer name dropdowns
    // instead of asking ops to paste raw ObjectIds.
    (async () => {
      try {
        const [s, d] = await Promise.all([
          stateApi.getAll({ limit: "1000" }),
          districtApi.getAll({ limit: "1000" }),
        ]);
        setAllStates(s.data?.items || s.data || []);
        setAllDistricts(d.data?.items || d.data || []);
      } catch {
        /* non-fatal — dropdowns just stay empty */
      }
    })();
  }, []);

  // ObjectId of the currently selected state (handles both id-string and
  // populated-object shapes coming back from the API).
  const selectedStateId = String(
    (form.state as any)?._id || form.state || "",
  );
  const districtsForState = allDistricts.filter((d: any) => {
    if (!selectedStateId) return false;
    const sid = d.state?._id || d.state;
    return String(sid) === selectedStateId;
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test((form.phone || "").trim())) {
      alert("Please enter a valid 10-digit mobile number (starting 6-9).");
      return;
    }
    if (editing) await providerApi.update(editing._id, form as any);
    else await providerApi.create(form as any);
    setShowForm(false);
    setEditing(null);
    setForm({});
    load();
  };

  const handleCancel = () => setShowForm(false);

  return (
    <div className="p-6">
      <PageHeader
        title="Ambulance Service Providers"
        subtitle={`${items.length} provider(s)`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm({});
              setShowForm(true);
            }}
          >
            + New Provider
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <SearchInput
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="w-full max-w-xs"
        />
        <Button variant="secondary" onClick={load}>
          Search
        </Button>
      </div>

      <Table>
        <THead>
          <Th>Name</Th>
          <Th>Contact</Th>
          <Th>Phone</Th>
          <Th>Active</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={5}>No providers found.</TableState>
          ) : (
            items.map((p) => (
              <TR key={p._id}>
                <Td className="font-medium text-gray-900">{p.name}</Td>
                <Td className="text-gray-500">{p.contactPersonName}</Td>
                <Td className="text-gray-500">{p.phone}</Td>
                <Td>
                  <Badge tone={p.isActive ? "success" : "neutral"} dot>
                    {p.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => {
                      setEditing(p);
                      setForm(p);
                      setShowForm(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={async () => {
                      if (!confirm("Deactivate provider?")) return;
                      await providerApi.remove(p._id);
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
        onClose={handleCancel}
        title={editing ? "Edit Provider" : "New Provider"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={onSubmit}>Save</Button>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Name">
            <Input
              required
              placeholder="Name"
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Contact Person">
            <Input
              required
              placeholder="Contact Person"
              value={form.contactPersonName || ""}
              onChange={(e) =>
                setForm({ ...form, contactPersonName: e.target.value })
              }
            />
          </Field>
          <Field label="Phone (10-digit)">
            <Input
              required
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={form.phone || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                })
              }
            />
          </Field>
          <Field label="Email (optional)">
            <Input
              placeholder="Email (optional)"
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="State">
            <Select
              value={selectedStateId}
              onChange={(e) =>
                setForm({ ...form, state: e.target.value, district: "" })
              }
            >
              <option value="">Select state…</option>
              {allStates.map((s: any) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="District">
            <Select
              value={String((form.district as any)?._id || form.district || "")}
              onChange={(e) =>
                setForm({ ...form, district: e.target.value })
              }
              disabled={!selectedStateId}
            >
              <option value="">
                {selectedStateId ? "Select district…" : "Select state first"}
              </option>
              {districtsForState.map((d: any) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}

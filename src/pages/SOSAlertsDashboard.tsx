import { useEffect, useState } from "react";
import { sosAlertApi } from "../services/admin-api";
import DispatchPanel from "../components/DispatchPanel";
import {
  PageHeader,
  Button,
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

type Alert = {
  _id: string;
  status: "ACTIVE" | "RESPONDED" | "RESOLVED" | "FALSE_ALARM";
  address?: string;
  location: { coordinates: [number, number] };
  createdAt: string;
  userId?: { firstName?: string; lastName?: string; phone?: string };
};

export default function SOSAlertsDashboard() {
  const [items, setItems] = useState<Alert[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ lat: "", lng: "", address: "" });

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "ALL") params.status = statusFilter;
      const res: any = await sosAlertApi.list(params);
      setItems(res.data?.items || res.rData?.items || res.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || isNaN(lng)) return;
    await sosAlertApi.create({ lat, lng, address: form.address || undefined });
    setShowCreate(false);
    setForm({ lat: "", lng: "", address: "" });
    load();
  };

  const handleCancelCreate = () => {
    setShowCreate(false);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="SOS Alerts (Live)"
        subtitle={`${items.length} alert(s)`}
        actions={
          <Button onClick={() => setShowCreate(true)}>+ Create Test Alert</Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {["ACTIVE", "RESPONDED", "RESOLVED", "ALL"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "primary" : "secondary"}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      <Table>
        <THead>
          <Th>Created</Th>
          <Th>User</Th>
          <Th>Address</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={5}>No alerts found.</TableState>
          ) : (
            items.map((a) => {
              const user =
                a.userId && typeof a.userId === "object"
                  ? `${a.userId.firstName || ""} ${a.userId.lastName || ""}`.trim() ||
                    a.userId.phone ||
                    "-"
                  : "-";
              return (
                <TR key={a._id}>
                  <Td className="text-gray-500 whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString()}
                  </Td>
                  <Td className="font-medium text-gray-900">{user}</Td>
                  <Td className="text-gray-500">
                    {a.address ||
                      `${a.location.coordinates[1].toFixed(4)}, ${a.location.coordinates[0].toFixed(4)}`}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        a.status === "ACTIVE"
                          ? "danger"
                          : a.status === "RESPONDED"
                            ? "warning"
                            : "neutral"
                      }
                      dot
                    >
                      {a.status}
                    </Badge>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {(a.status === "ACTIVE" || a.status === "RESPONDED") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(a)}
                      >
                        Open Dispatch
                      </Button>
                    )}
                  </Td>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Dispatch for SOS — ${selected._id}` : undefined}
        size="xl"
      >
        {selected && <DispatchPanel sosId={selected._id} />}
      </Modal>

      <Modal
        open={showCreate}
        onClose={handleCancelCreate}
        title="Create Test SOS Alert"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancelCreate}>
              Cancel
            </Button>
            <Button type="submit" form="sos-create-form">
              Create
            </Button>
          </>
        }
      >
        <form id="sos-create-form" onSubmit={onCreate} className="space-y-4">
          <Field label="Latitude">
            <Input
              required
              type="number"
              step="any"
              placeholder="Latitude"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
            />
          </Field>
          <Field label="Longitude">
            <Input
              required
              type="number"
              step="any"
              placeholder="Longitude"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
            />
          </Field>
          <Field label="Address (optional)">
            <Input
              placeholder="Address (optional)"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

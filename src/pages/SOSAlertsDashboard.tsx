import { useEffect, useState } from "react";
import { sosAlertApi } from "../services/admin-api";
import { adminSocket } from "../services/socket";
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
  source?: "patient" | "crew";
  crewName?: string;
  crewPhone?: string;
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
    // Instant pop: a crew (or patient) SOS reloads the list immediately instead
    // of waiting for the 10s poll. Backend emits `sos-alert:new` to the admin room.
    adminSocket.connect();
    const off = adminSocket.on("sos-alert:new", load);
    return () => {
      clearInterval(t);
      off();
    };
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
          <Th>Source</Th>
          <Th>Who</Th>
          <Th>Location</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={6}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={6}>No alerts found.</TableState>
          ) : (
            items.map((a) => {
              const isCrew = a.source === "crew";
              const lat = a.location?.coordinates?.[1];
              const lng = a.location?.coordinates?.[0];
              const hasGps = !!lat && !!lng && !(lat === 0 && lng === 0);
              const who = isCrew
                ? a.crewName || "Crew member"
                : (a.userId && typeof a.userId === "object"
                    ? `${a.userId.firstName || ""} ${a.userId.lastName || ""}`.trim() || a.userId.phone || "-"
                    : "-");
              const phone = isCrew ? a.crewPhone : a.userId?.phone;
              const resolve = async () => {
                await sosAlertApi.updateStatus(a._id, "RESOLVED");
                load();
              };
              return (
                <TR key={a._id}>
                  <Td className="text-gray-500 whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString()}
                  </Td>
                  <Td>
                    <Badge tone={isCrew ? "warning" : "info"}>{isCrew ? "CREW" : "Patient"}</Badge>
                  </Td>
                  <Td className="font-medium text-gray-900">
                    {who}
                    {phone && <div className="text-xs text-gray-400">{phone}</div>}
                  </Td>
                  <Td className="text-gray-500">
                    {hasGps ? (
                      <a
                        className="text-sky-600 hover:underline"
                        href={`https://www.google.com/maps?q=${lat},${lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {a.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`} — Map
                      </a>
                    ) : (
                      a.address || "Location unavailable"
                    )}
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
                    {isCrew ? (
                      <>
                        {phone && (
                          <a href={`tel:${phone}`}>
                            <Button size="sm" variant="secondary">Call Crew</Button>
                          </a>
                        )}
                        {(a.status === "ACTIVE" || a.status === "RESPONDED") && (
                          <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50" onClick={resolve}>
                            Resolve
                          </Button>
                        )}
                      </>
                    ) : (
                      (a.status === "ACTIVE" || a.status === "RESPONDED") && (
                        <Button size="sm" variant="ghost" onClick={() => setSelected(a)}>
                          Open Dispatch
                        </Button>
                      )
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

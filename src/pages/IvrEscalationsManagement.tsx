import { useEffect, useState, useCallback } from "react";
import { ivrApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
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
  Alert,
} from "../components/ui";

interface Contact {
  tier: number;
  name?: string;
  phone: string;
  role?: string;
}
interface Attempt {
  tier: number;
  phone: string;
  provider: string;
  status: string;
  note?: string;
  at: string;
}
interface Escalation {
  _id: string;
  triggerReason?: string;
  contacts: Contact[];
  attempts: Attempt[];
  currentTier: number;
  status: string;
  acknowledgedByPhone?: string;
  createdAt: string;
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const statusTone: Record<string, BadgeTone> = {
  in_progress: "warning",
  acknowledged: "success",
  exhausted: "danger",
  cancelled: "neutral",
  pending: "neutral",
};

export default function IvrEscalationsManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.IVR_MANAGE);

  const [items, setItems] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Escalation | null>(null);
  const [showStart, setShowStart] = useState(false);
  const [reason, setReason] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([
    { tier: 1, name: "", phone: "", role: "" },
  ]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ivrApi.list();
      setItems(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshDetail = async (id: string) => {
    const res = await ivrApi.detail(id);
    setDetail(res.data?.escalation || null);
    load();
  };

  const startEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const valid = contacts.filter((c) => c.phone.trim());
    if (valid.length === 0) {
      setErr("Add at least one contact with a phone number.");
      return;
    }
    try {
      await ivrApi.start({
        triggerReason: reason || undefined,
        contacts: valid.map((c, i) => ({ ...c, tier: i + 1 })),
      });
      setShowStart(false);
      setReason("");
      setContacts([{ tier: 1, name: "", phone: "", role: "" }]);
      load();
    } catch (e2: any) {
      setErr(e2.message || "Failed to start escalation");
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="IVR Escalation"
        subtitle="Automated SOS phone-tree — calls a chain of contacts until acknowledged"
        actions={
          canManage && (
            <Button
              onClick={() => {
                setErr("");
                setShowStart(true);
              }}
            >
              + Start Escalation
            </Button>
          )
        }
      />

      <Table>
        <THead>
          <Th>Started</Th>
          <Th>Reason</Th>
          <Th>Tiers</Th>
          <Th>Attempts</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={6}>Loading…</TableState>
          ) : items.length === 0 ? (
            <TableState colSpan={6}>No escalations.</TableState>
          ) : (
            items.map((it) => (
              <TR key={it._id}>
                <Td className="text-gray-500">
                  {new Date(it.createdAt).toLocaleString()}
                </Td>
                <Td>{it.triggerReason || "—"}</Td>
                <Td>
                  {it.contacts.length} (on tier {it.currentTier})
                </Td>
                <Td>{it.attempts.length}</Td>
                <Td>
                  <Badge tone={statusTone[it.status] || "neutral"} dot>
                    {it.status.replace("_", " ")}
                  </Badge>
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => refreshDetail(it._id)}
                  >
                    Open
                  </Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      {/* Start modal */}
      <Modal
        open={showStart}
        onClose={() => setShowStart(false)}
        title="Start Escalation"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowStart(false)}>
              Cancel
            </Button>
            <Button onClick={startEscalation}>Start &amp; dial tier 1</Button>
          </>
        }
      >
        <form onSubmit={startEscalation} className="space-y-3">
          {err && <Alert tone="danger">{err}</Alert>}
          <Field label="Trigger reason">
            <Input
              placeholder="Trigger reason (e.g. SOS unacknowledged 5 min)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              Escalation chain (dialled in order)
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setContacts([
                  ...contacts,
                  { tier: contacts.length + 1, name: "", phone: "", role: "" },
                ])
              }
            >
              + Add tier
            </Button>
          </div>
          {contacts.map((c, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="flex items-center justify-center col-span-1 text-sm text-gray-400">
                {i + 1}
              </div>
              <Input
                placeholder="Name"
                value={c.name}
                onChange={(e) => {
                  const next = [...contacts];
                  next[i] = { ...c, name: e.target.value };
                  setContacts(next);
                }}
                className="col-span-4"
              />
              <Input
                placeholder="Phone"
                value={c.phone}
                onChange={(e) => {
                  const next = [...contacts];
                  next[i] = { ...c, phone: e.target.value };
                  setContacts(next);
                }}
                className="col-span-4"
              />
              <Input
                placeholder="Role"
                value={c.role}
                onChange={(e) => {
                  const next = [...contacts];
                  next[i] = { ...c, role: e.target.value };
                  setContacts(next);
                }}
                className="col-span-2"
              />
              <button
                type="button"
                onClick={() =>
                  setContacts(contacts.filter((_, idx) => idx !== i))
                }
                className="col-span-1 text-red-500"
              >
                ✕
              </button>
            </div>
          ))}
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Escalation"
        size="md"
        footer={
          canManage && detail && detail.status === "in_progress" ? (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  ivrApi.cancel(detail._id).then(() => refreshDetail(detail._id))
                }
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                className="text-amber-700 border-amber-200 hover:bg-amber-50"
                onClick={() =>
                  ivrApi.advance(detail._id).then(() => refreshDetail(detail._id))
                }
              >
                Dial next tier
              </Button>
              <Button
                onClick={() =>
                  ivrApi
                    .acknowledge(detail._id)
                    .then(() => refreshDetail(detail._id))
                }
              >
                Mark acknowledged
              </Button>
            </>
          ) : undefined
        }
      >
        {detail && (
          <div className="space-y-4">
            <Badge tone={statusTone[detail.status] || "neutral"} dot>
              {detail.status.replace("_", " ")}
            </Badge>
            {detail.triggerReason && (
              <p className="text-sm text-gray-600">{detail.triggerReason}</p>
            )}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Chain</h3>
              {detail.contacts.map((c) => (
                <div
                  key={c.tier}
                  className={`flex justify-between py-1 text-sm ${
                    c.tier === detail.currentTier ? "font-semibold" : ""
                  }`}
                >
                  <span>
                    Tier {c.tier}: {c.name || "—"} {c.role ? `(${c.role})` : ""}
                  </span>
                  <span className="text-gray-500">{c.phone}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                Call attempts
              </h3>
              {detail.attempts.length === 0 ? (
                <p className="text-sm text-gray-400">No attempts yet.</p>
              ) : (
                detail.attempts.map((a, i) => (
                  <div key={i} className="py-1 text-xs text-gray-600">
                    Tier {a.tier} · {a.phone} · {a.provider} ·{" "}
                    <span className="font-medium">{a.status}</span> ·{" "}
                    {new Date(a.at).toLocaleTimeString()}
                    {a.note ? ` · ${a.note}` : ""}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

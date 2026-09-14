// Calls & recordings (MyOperator). Every call MyOperator handles — inbound,
// IVR, missed and click-to-call — with its recording playable in place.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall, Search, Download,
} from "lucide-react";
import { callsApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import Pagination from "../components/Pagination";
import {
  PageHeader, Button, Card, Select, Input, Table, THead, TBody, TR, Th, Td,
  TableState, Badge, Modal, Alert, Textarea, Field,
} from "../components/ui";

interface Call {
  _id: string;
  provider: string;
  providerCallId?: string;
  direction: "inbound" | "outbound" | "click_to_call";
  status: string;
  customerNumber: string;
  agentNumber?: string;
  didNumber?: string;
  ivrFlow?: string;
  ivrInput?: string;
  agentName?: string;
  startedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  durationSeconds: number;
  ringSeconds: number;
  recordingUrl?: string;
  subjectType?: string;
  subjectLabel?: string;
  notes?: string;
  createdAt: string;
  placedByAdminId?: { fullName?: string; email?: string };
  rawPayloads?: unknown[];
}

type CallKind = "all" | "ivr" | "click_to_call" | "inbound";

/**
 * The tabs. IVR is matched on the flow/input the provider reports, not on
 * direction — an IVR call arrives as `inbound`, so direction alone cannot
 * separate it from an ordinary incoming call.
 */
const KIND_TABS: { key: CallKind; label: string; hint: string }[] = [
  { key: "all", label: "All calls", hint: "Every call MyOperator has handled" },
  { key: "ivr", label: "IVR", hint: "Callers who went through the menu" },
  { key: "click_to_call", label: "Click to Call", hint: "Calls placed from the panel by an agent" },
  { key: "inbound", label: "Direct inbound", hint: "Incoming calls that did not go through the IVR" },
];

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";
const statusTone: Record<string, Tone> = {
  completed: "success",
  answered: "success",
  initiated: "info",
  ringing: "info",
  missed: "danger",
  no_answer: "danger",
  busy: "warning",
  failed: "danger",
  cancelled: "neutral",
};

const dirIcon = (d: string) =>
  d === "inbound" ? PhoneIncoming : d === "click_to_call" ? PhoneCall : PhoneOutgoing;

const label = (s?: string) =>
  s ? s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ") : "—";

/** Seconds → "4m 07s", the way a call length is read. */
const dur = (s?: number) => {
  const n = Math.max(0, Math.round(s || 0));
  if (n < 60) return `${n}s`;
  return `${Math.floor(n / 60)}m ${String(n % 60).padStart(2, "0")}s`;
};

export default function CallLogs() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.CALLS_MANAGE);

  const [items, setItems] = useState<Call[]>([]);
  const [stats, setStats] = useState<{
    today: number; missedToday: number; recorded: number; total: number;
    byKind?: Record<CallKind, { calls: number; recordings: number }>;
    configured: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  /**
   * Which kind of call is on screen.
   *
   * IVR and click-to-call recordings are different things — one is a customer
   * working through the menu, the other an agent's own conversation — and in a
   * single list there is no way to tell them apart without opening each one.
   * Kept in the URL so a tab can be linked to and survives a refresh.
   */
  const [params, setParams] = useSearchParams();
  const kind = (params.get("kind") || "all") as CallKind;
  const setKind = (next: CallKind) => {
    const p = new URLSearchParams(params);
    if (next === "all") p.delete("kind");
    else p.set("kind", next);
    setParams(p, { replace: true });
    // The direction filter is hidden inside a kind tab; leaving a stale value
    // set would silently filter the tab with a control nobody can see.
    if (next !== "all") setDirection("");
  };

  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [hasRecording, setHasRecording] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Call | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { page, limit };
      if (kind !== "all") params.kind = kind;
      if (direction) params.direction = direction;
      if (status) params.status = status;
      if (hasRecording) params.hasRecording = "true";
      if (search.trim()) params.search = search.trim();
      const res = await callsApi.list(params);
      setItems(res.data?.items || []);
      setTotal(res.data?.pagination?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calls");
    } finally {
      setLoading(false);
    }
  }, [page, limit, kind, direction, status, hasRecording, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    callsApi.stats().then((r) => setStats(r.data)).catch(() => setStats(null));
  }, []);
  useEffect(() => { setPage(1); }, [kind, direction, status, hasRecording, search]);

  const filtered = !!(direction || status || hasRecording || search.trim());
  /**
   * An empty tab and an empty filter are different problems. Saying "no calls
   * yet" when a filter is hiding them sends someone to check the webhook for
   * a fault that is not there.
   */
  const emptyMessage = filtered
    ? "No calls match these filters. Clear them to see everything in this tab."
    : kind === "ivr"
      ? "No IVR calls yet. They appear here once a caller goes through the menu."
      : kind === "click_to_call"
        ? "No click-to-call calls yet. Use the Call button on a patient, request or application to place one."
        : kind === "inbound"
          ? "No direct inbound calls yet."
          : "No calls yet. Inbound and IVR calls appear here as soon as MyOperator posts to the webhook.";

  const openCall = async (c: Call) => {
    setNotes(c.notes || "");
    setOpen(c);
    // The list omits rawPayloads (they're large); fetch the full row for the
    // provider detail panel.
    try {
      const res = await callsApi.detail(c._id);
      if (res.data?.item) setOpen(res.data.item);
    } catch {
      /* the summary we already have is enough to show */
    }
  };

  const submitNotes = async () => {
    if (!open) return;
    setSavingNotes(true);
    try {
      await callsApi.saveNotes(open._id, notes);
      setOpen({ ...open, notes });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Calls & Recordings"
        subtitle="Every call MyOperator handles — inbound, IVR, missed and click-to-call"
      />

      {stats && !stats.configured && (
        <Alert tone="warning">
          MyOperator is not configured, so no new calls will arrive and
          click-to-call is disabled. Set <code>MYOPERATOR_API_KEY</code>,{" "}
          <code>MYOPERATOR_COMPANY_ID</code> and{" "}
          <code>MYOPERATOR_SECRET_TOKEN</code> in the backend environment.
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Calls today", stats.today],
            ["Missed today", stats.missedToday],
            ["With recording", stats.recorded],
            ["Total logged", stats.total],
          ].map(([k, v]) => (
            <Card key={String(k)} className="p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">{k}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{v}</p>
            </Card>
          ))}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {KIND_TABS.map((t) => {
          const active = kind === t.key;
          const counts = stats?.byKind?.[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setKind(t.key)}
              title={t.hint}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-healwin-600 text-healwin-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800"
              }`}
            >
              {t.label}
              {counts && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    active ? "bg-healwin-50 text-healwin-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {counts.calls}
                </span>
              )}
              {/* Recordings are the reason these are split apart, so each tab
                  says how many it holds rather than making you filter to find
                  out. */}
              {!!counts?.recordings && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <Download className="h-3 w-3" />
                  {counts.recordings}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {kind !== "all" && (
        <p className="-mt-1 text-xs text-gray-500">
          {KIND_TABS.find((t) => t.key === kind)?.hint}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="w-64 pl-9"
            placeholder="Number, name or agent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Only on the combined view. Inside a kind tab every row already has
            the same direction, so the filter can only ever narrow to nothing —
            an empty list with no visible reason for it. */}
        {kind === "all" && (
          <Select value={direction} onChange={(e) => setDirection(e.target.value)} className="w-44">
            <option value="">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="click_to_call">Click-to-call</option>
          </Select>
        )}
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          {["completed", "answered", "missed", "no_answer", "busy", "failed", "initiated"].map((s) => (
            <option key={s} value={s}>{label(s)}</option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={hasRecording} onChange={(e) => setHasRecording(e.target.checked)} />
          Recorded only
        </label>
        <span className="text-sm text-gray-500">{total} call(s)</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Th>When</Th>
              {/* In a kind tab the direction is the same on every row, so the
                  column is dead weight — the IVR menu path and the agent who
                  placed the call are what you are actually looking for. */}
              <Th>{kind === "ivr" ? "IVR flow" : kind === "click_to_call" ? "Placed by" : "Direction"}</Th>
              <Th>Customer</Th><Th>Agent</Th>
              <Th>About</Th><Th className="text-right">Ring</Th>
              <Th className="text-right">Duration</Th><Th>Status</Th><Th>Recording</Th>
            </THead>
            <TBody>
              {loading ? (
                <TableState colSpan={9}>Loading…</TableState>
              ) : items.length === 0 ? (
                <TableState colSpan={9}>{emptyMessage}</TableState>
              ) : (
                items.map((c) => {
                  const Icon = dirIcon(c.direction);
                  const missed = c.status === "missed" || c.status === "no_answer";
                  return (
                    <TR key={c._id}>
                      <Td className="whitespace-nowrap text-xs">
                        {new Date(c.startedAt || c.createdAt).toLocaleString("en-IN")}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {kind === "ivr" ? (
                          <span className="text-sm text-gray-700">
                            {c.ivrFlow || "—"}
                            {c.ivrInput && (
                              <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                                key {c.ivrInput}
                              </span>
                            )}
                          </span>
                        ) : kind === "click_to_call" ? (
                          <span className="text-sm text-gray-700">
                            {c.placedByAdminId?.fullName ||
                              c.placedByAdminId?.email ||
                              "—"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            {missed ? (
                              <PhoneMissed className="h-3.5 w-3.5 text-red-500" />
                            ) : (
                              <Icon className="h-3.5 w-3.5 text-gray-400" />
                            )}
                            {label(c.direction)}
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap font-medium text-gray-900">
                        {c.customerNumber}
                      </Td>
                      <Td className="whitespace-nowrap text-sm text-gray-600">
                        {c.agentName || c.agentNumber || "—"}
                      </Td>
                      <Td className="text-sm">
                        {c.subjectLabel || c.ivrFlow || "—"}
                        {c.ivrInput && (
                          <span className="ml-1 text-xs text-gray-400">key {c.ivrInput}</span>
                        )}
                      </Td>
                      <Td className="text-right text-xs text-gray-500">{dur(c.ringSeconds)}</Td>
                      <Td className="text-right">{dur(c.durationSeconds)}</Td>
                      <Td>
                        <Badge tone={statusTone[c.status] || "neutral"} dot>
                          {label(c.status)}
                        </Badge>
                      </Td>
                      <Td>
                        {c.recordingUrl ? (
                          // Playable in the row — the common case is "listen to
                          // this one call", and a modal for that is friction.
                          <audio
                            controls
                            preload="none"
                            src={c.recordingUrl}
                            className="h-8 w-56 max-w-full"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openCall(c)}>
                          Details
                        </Button>
                      </Td>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        onPageChange={setPage}
      />

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title="Call detail"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>
            {canManage && (
              <Button onClick={submitNotes} disabled={savingNotes}>
                {savingNotes ? "Saving…" : "Save notes"}
              </Button>
            )}
          </>
        }
      >
        {open && (
          <div className="space-y-4">
            {open.recordingUrl && (
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
                  Recording
                </p>
                <audio controls preload="none" src={open.recordingUrl} className="w-full" />
                <a
                  href={open.recordingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-700 hover:underline"
                >
                  <Download className="h-3 w-3" /> Open the original file
                </a>
              </div>
            )}

            <div className="grid grid-cols-2 gap-y-2 text-sm">
              {([
                ["Direction", label(open.direction)],
                ["Status", label(open.status)],
                ["Customer", open.customerNumber],
                ["Agent", open.agentName || open.agentNumber || "—"],
                ["Dialled number", open.didNumber || "—"],
                ["IVR flow", open.ivrFlow || "—"],
                ["IVR key pressed", open.ivrInput || "—"],
                ["Ring time", dur(open.ringSeconds)],
                ["Talk time", dur(open.durationSeconds)],
                ["Started", open.startedAt ? new Date(open.startedAt).toLocaleString("en-IN") : "—"],
                ["Answered", open.answeredAt ? new Date(open.answeredAt).toLocaleString("en-IN") : "—"],
                ["Ended", open.endedAt ? new Date(open.endedAt).toLocaleString("en-IN") : "—"],
                ["About", open.subjectLabel || "—"],
                ["Placed by", open.placedByAdminId?.fullName || "—"],
                ["Provider call id", open.providerCallId || "—"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <span className="text-gray-400">{k}: </span>
                  <span className="text-gray-800">{v}</span>
                </div>
              ))}
            </div>

            <Field label="Notes" hint="What came out of this call.">
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canManage}
              />
            </Field>

            {!!open.rawPayloads?.length && (
              <details className="rounded-lg border border-gray-200 p-3">
                <summary className="cursor-pointer text-xs uppercase tracking-wide text-gray-400">
                  Provider payloads ({open.rawPayloads.length})
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                  {JSON.stringify(open.rawPayloads, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

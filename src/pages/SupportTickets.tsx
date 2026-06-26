import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supportApi } from "../services/admin-api";
import { adminSocket } from "../services/socket";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
} from "../components/ui";

/**
 * Admin view of support tickets raised from the patient / driver apps
 * (POST /support/tickets). Lets ops read the thread, reply, and change status.
 */

interface Person { fullName?: string; mobileNumber?: string; role?: string }
interface Ticket {
  _id: string;
  ticketId: string;
  userId?: Person | string;
  driverId?: Person | string;
  staffId?: Person | string;
  category: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  resolution?: string;
  resolvedAt?: string;
  reopenReason?: string;
  reopenedAt?: string;
  createdAt?: string;
}
interface Message {
  _id: string;
  senderType: string;
  message: string;
  createdAt?: string;
}

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"];
const STATUS_FILTERS = ["", ...STATUSES];

const statusTone: Record<string, "warning" | "info" | "success" | "neutral" | "danger"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  WAITING_FOR_USER: "neutral",
  RESOLVED: "success",
  CLOSED: "neutral",
};
const priorityTone: Record<string, "warning" | "info" | "success" | "neutral" | "danger"> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
};

const who = (p?: Person | string) =>
  p && typeof p === "object" ? p.fullName || p.mobileNumber || "—" : "—";

// Which app raised the ticket — patient (userId), driver (driverId) or
// ambulance staff (staffId). Returns the name plus a human role label.
const requester = (t: Pick<Ticket, "userId" | "driverId" | "staffId">) => {
  if (who(t.userId) !== "—") return { name: who(t.userId), role: "Patient" };
  if (who(t.driverId) !== "—") return { name: who(t.driverId), role: "Driver" };
  if (who(t.staffId) !== "—") {
    const sub = typeof t.staffId === "object" ? t.staffId.role : "";
    return { name: who(t.staffId), role: sub ? `Staff · ${sub}` : "Staff" };
  }
  return { name: "—", role: "" };
};
const roleTone: Record<string, "info" | "warning" | "success" | "neutral"> = {
  Patient: "info",
  Driver: "warning",
  Staff: "success",
};
const fmt = (d?: string) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function SupportTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Keep the thread pinned to the newest message (on open + on every new reply).
  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, active?._id]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  // Status-change prompt (resolve/close/reopen) that captures a reason.
  const [prompt, setPrompt] = useState<{ status: string; label: string } | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supportApi.tickets(statusFilter ? { status: statusFilter } : undefined);
      setTickets(res.data?.tickets || []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Live: a patient/driver reply pushes `support:message` to the admin room —
  // refresh the list, and the open thread if it's the same ticket.
  useEffect(() => {
    adminSocket.connect();
    const off = adminSocket.on("support:message", (data: unknown) => {
      const d = (data || {}) as { ticketId?: string };
      load();
      if (active && d?.ticketId === active.ticketId) {
        supportApi.ticket(active.ticketId).then((res) => setMessages(res.data?.messages || []));
      }
    });
    return off;
  }, [load, active]);

  const openTicket = async (t: Ticket) => {
    setActive(t);
    setMessages([]);
    setReply("");
    setPrompt(null);
    setNote("");
    const res = await supportApi.ticket(t.ticketId);
    setMessages(res.data?.messages || []);
    if (res.data?.ticket) setActive(res.data.ticket);
  };

  // Deep-link: opening /admin/support-tickets?ticket=TKT… (e.g. from the bell
  // notification) auto-opens that ticket's chat window.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const tid = searchParams.get("ticket");
    if (!tid) return;
    void openTicket({ ticketId: tid } as Ticket);
    // Clear the param so it doesn't re-open on every refresh.
    searchParams.delete("ticket");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    setBusy(true);
    try {
      await supportApi.reply(active.ticketId, reply.trim());
      setReply("");
      const res = await supportApi.ticket(active.ticketId);
      setMessages(res.data?.messages || []);
    } finally {
      setBusy(false);
    }
  };

  // Direct status change (no reason needed) — for OPEN / IN_PROGRESS / WAITING.
  const changeStatus = async (status: string) => {
    if (!active) return;
    setBusy(true);
    try {
      await supportApi.setStatus(active.ticketId, status);
      setActive({ ...active, status });
      load();
    } finally {
      setBusy(false);
    }
  };

  // Status change WITH a reason — resolve, close, or reopen.
  const confirmPrompt = async () => {
    if (!active || !prompt || !note.trim()) return;
    setBusy(true);
    try {
      await supportApi.setStatus(active.ticketId, prompt.status, note.trim());
      setPrompt(null);
      setNote("");
      const res = await supportApi.ticket(active.ticketId);
      if (res.data?.ticket) setActive(res.data.ticket);
      setMessages(res.data?.messages || []);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Support Tickets"
        subtitle="Tickets raised from the patient & driver apps"
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <Button key={s || "all"} size="sm" variant={statusFilter === s ? "primary" : "secondary"} onClick={() => setStatusFilter(s)}>
            {s ? s.replace(/_/g, " ") : "All"}
          </Button>
        ))}
      </div>

      <Table>
        <THead>
          <Th>Ticket</Th><Th>From</Th><Th>Category</Th><Th>Subject</Th><Th>Priority</Th><Th>Status</Th><Th>Created</Th><Th className="text-right">Action</Th>
        </THead>
        <TBody>
          {loading && tickets.length === 0 ? (
            <TableState colSpan={8}>Loading…</TableState>
          ) : tickets.length === 0 ? (
            <TableState colSpan={8}>No support tickets.</TableState>
          ) : (
            tickets.map((t) => (
              <TR key={t._id} className="cursor-pointer hover:bg-gray-50" onClick={() => openTicket(t)}>
                <Td className="text-xs font-medium text-gray-700">{t.ticketId}</Td>
                <Td className="text-xs text-gray-600">
                  {(() => {
                    const r = requester(t);
                    return (
                      <div className="flex items-center gap-1.5">
                        <span>{r.name}</span>
                        {r.role && (
                          <Badge tone={roleTone[r.role.split(" ")[0]] || "neutral"}>{r.role}</Badge>
                        )}
                      </div>
                    );
                  })()}
                </Td>
                <Td className="text-xs text-gray-500">{t.category}</Td>
                <Td className="text-sm text-gray-800 max-w-xs truncate">{t.subject}</Td>
                <Td><Badge tone={priorityTone[t.priority] || "neutral"}>{t.priority}</Badge></Td>
                <Td><Badge tone={statusTone[t.status] || "neutral"}>{t.status.replace(/_/g, " ")}</Badge></Td>
                <Td className="text-xs text-gray-500">{fmt(t.createdAt)}</Td>
                <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="secondary" onClick={() => openTicket(t)}>
                    Open chat
                  </Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setActive(null)}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs text-gray-400">{active.ticketId} · {active.category}</p>
                <p className="truncate font-semibold text-gray-900">{active.subject}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <span>{requester(active).name}</span>
                  {requester(active).role && (
                    <Badge tone={roleTone[requester(active).role.split(" ")[0]] || "neutral"}>{requester(active).role}</Badge>
                  )}
                </p>
              </div>
              <button onClick={() => setActive(null)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100">✕</button>
            </div>

            <div className="border-b border-gray-100 px-5 py-3">
              <div className="flex flex-wrap items-center gap-1">
                <Badge tone={statusTone[active.status] || "neutral"}>{active.status.replace(/_/g, " ")}</Badge>
                <span className="mx-1 text-gray-300">|</span>
                {active.status === "RESOLVED" || active.status === "CLOSED" ? (
                  <Button size="sm" variant="secondary" onClick={() => { setPrompt({ status: "OPEN", label: "Reopen ticket" }); setNote(""); }}>
                    Reopen
                  </Button>
                ) : (
                  <>
                    {["OPEN", "IN_PROGRESS", "WAITING_FOR_USER"].map((s) => (
                      <Button key={s} size="sm" variant={active.status === s ? "primary" : "secondary"} onClick={() => changeStatus(s)}>
                        {s.replace(/_/g, " ")}
                      </Button>
                    ))}
                    <Button size="sm" variant="secondary" className="text-emerald-700" onClick={() => { setPrompt({ status: "RESOLVED", label: "Resolve ticket" }); setNote(""); }}>
                      Resolve
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => { setPrompt({ status: "CLOSED", label: "Close ticket" }); setNote(""); }}>
                      Close
                    </Button>
                  </>
                )}
              </div>

              {prompt && (
                <div className="mt-3 rounded-lg border border-gray-200 p-3">
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    {prompt.label} — reason {prompt.status === "OPEN" ? "(why reopen?)" : "(required)"}
                  </p>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder={prompt.status === "OPEN" ? "Why is this being reopened?" : "What was done / the resolution…"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setPrompt(null); setNote(""); }}>Cancel</Button>
                    <Button size="sm" onClick={confirmPrompt} disabled={busy || !note.trim()}>Confirm</Button>
                  </div>
                </div>
              )}
            </div>

            <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {active.description && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{active.description}</div>
              )}
              {active.resolution && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Resolution{active.resolvedAt ? ` · ${fmt(active.resolvedAt)}` : ""}</p>
                  {active.resolution}
                </div>
              )}
              {active.reopenReason && (
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600">Reopened{active.reopenedAt ? ` · ${fmt(active.reopenedAt)}` : ""}</p>
                  {active.reopenReason}
                </div>
              )}
              {messages.map((m) => (
                <div key={m._id} className={`max-w-[85%] rounded-lg p-3 text-sm ${m.senderType === "ADMIN" ? "ml-auto bg-sky-50 text-sky-900" : "bg-gray-100 text-gray-800"}`}>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">{m.senderType}</p>
                  {m.message}
                  <p className="mt-1 text-[10px] text-gray-400">{fmt(m.createdAt)}</p>
                </div>
              ))}
              {messages.length === 0 && !active.description && (
                <p className="text-center text-sm text-gray-400">No messages.</p>
              )}
            </div>

            <div className="border-t border-gray-100 p-3">
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendReply()}
                  placeholder="Type a reply…"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
                <Button onClick={sendReply} disabled={busy || !reply.trim()}>Send</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

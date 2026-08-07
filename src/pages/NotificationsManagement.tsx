import React, { useEffect, useMemo, useState } from "react";
import { notificationsApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Alert,
  Field,
  Input,
  Textarea,
  Select,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
  cn,
} from "../components/ui";

type Audience = "ALL" | "ANONYMOUS" | "PATIENTS" | "DRIVERS";
type NotifType = "BOOKING" | "PAYMENT" | "PROMO" | "SYSTEM" | "CHAT" | "REWARD";

interface Stats {
  totalDevices: number;
  anon: number;
  patients: number;
  drivers: number;
  totalNotifs: number;
}

interface UserHit {
  _id: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  fcmToken?: string;
}

interface HistoryItem {
  _id: string;
  title: string;
  body: string;
  type: NotifType;
  isRead: boolean;
  createdAt: string;
  userId?: { fullName?: string; email?: string; phoneNumber?: string } | null;
}

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: "ALL", label: "Everyone", hint: "Every installed app, including not-logged-in" },
  { value: "PATIENTS", label: "Logged-in patients", hint: "Authenticated patient apps only" },
  { value: "ANONYMOUS", label: "Not logged in", hint: "Anonymous installs only" },
  { value: "DRIVERS", label: "Drivers", hint: "Driver apps only" },
];

const TYPES: NotifType[] = [
  "SYSTEM",
  "PROMO",
  "BOOKING",
  "PAYMENT",
  "CHAT",
  "REWARD",
];

const NotificationsManagement: React.FC = () => {
  const [mode, setMode] = useState<"broadcast" | "user">("broadcast");

  // shared form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [route, setRoute] = useState("");
  const [type, setType] = useState<NotifType>("SYSTEM");

  // broadcast form
  const [audience, setAudience] = useState<Audience>("ALL");

  // user-targeted form
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserHit[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserHit | null>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadStats = async () => {
    try {
      const r = await notificationsApi.stats();
      setStats(r.data);
    } catch {
      // ignore — stats are non-critical
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const r = await notificationsApi.history({ page, limit });
      setHistory(r.data?.items || []);
      setTotal(r.data?.pagination?.total ?? (r.data?.items || []).length);
    } catch (e: any) {
      setError(e.message || "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  // Debounced user search
  useEffect(() => {
    if (mode !== "user") return;
    if (userQuery.trim().length < 2) {
      setUserResults([]);
      return;
    }
    let cancelled = false;
    setUserSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await notificationsApi.searchUsers(userQuery.trim());
        if (!cancelled) setUserResults(r.data || []);
      } catch {
        if (!cancelled) setUserResults([]);
      } finally {
        if (!cancelled) setUserSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [userQuery, mode]);

  const audienceCount = useMemo(() => {
    if (!stats) return null;
    switch (audience) {
      case "ALL":
        return stats.totalDevices;
      case "PATIENTS":
        return stats.patients;
      case "ANONYMOUS":
        return stats.anon;
      case "DRIVERS":
        return stats.drivers;
    }
  }, [audience, stats]);

  const reset = () => {
    setTitle("");
    setBody("");
    setRoute("");
    setType("SYSTEM");
    setSelectedUser(null);
    setUserQuery("");
    setUserResults([]);
  };

  const send = async () => {
    setError(null);
    setSuccess(null);
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    if (mode === "user" && !selectedUser) {
      setError("Pick a user to send the notification to.");
      return;
    }

    setSending(true);
    try {
      if (mode === "broadcast") {
        const r = await notificationsApi.broadcast({
          title: title.trim(),
          body: body.trim(),
          audience,
          route: route.trim() || undefined,
          type,
        });
        const d = r.data;
        setSuccess(
          `Sent to ${d.totalDevices} devices — ${d.successCount} delivered, ${d.failureCount} failed.`,
        );
      } else {
        const r = await notificationsApi.sendToUser({
          userId: selectedUser!._id,
          title: title.trim(),
          body: body.trim(),
          route: route.trim() || undefined,
          type,
        });
        const d = r.data;
        setSuccess(
          `Sent to ${selectedUser?.fullName || selectedUser?.phoneNumber} — ${d.successCount}/${d.devices} devices delivered.`,
        );
      }
      reset();
      loadHistory();
      loadStats();
    } catch (e: any) {
      setError(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Notifications"
        subtitle="Push messages to logged-in users, anonymous installs, drivers, or everyone — and review delivery history."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Total devices" value={stats?.totalDevices ?? "—"} />
        <Stat label="Patients" value={stats?.patients ?? "—"} />
        <Stat label="Anonymous" value={stats?.anon ?? "—"} />
        <Stat label="Drivers" value={stats?.drivers ?? "—"} />
        <Stat label="Sent (lifetime)" value={stats?.totalNotifs ?? "—"} />
      </div>

      {/* Composer */}
      <Card padded className="space-y-4 mb-6">
        <div className="flex items-center gap-2">
          <ModeButton
            active={mode === "broadcast"}
            onClick={() => setMode("broadcast")}
          >
            Broadcast
          </ModeButton>
          <ModeButton active={mode === "user"} onClick={() => setMode("user")}>
            Send to user
          </ModeButton>
        </div>

        {mode === "broadcast" && (
          <div>
            <label className="block text-sm font-medium mb-1">Audience</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudience(a.value)}
                  className={cn(
                    "text-left p-3 rounded-lg border transition-colors",
                    audience === a.value
                      ? "border-healwin-500 bg-healwin-50"
                      : "border-gray-200 hover:bg-gray-50",
                  )}
                >
                  <div className="font-medium text-sm">{a.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{a.hint}</div>
                </button>
              ))}
            </div>
            {audienceCount !== null && (
              <p className="text-xs text-gray-600 mt-2">
                Approx {audienceCount} device(s) match this audience.
              </p>
            )}
          </div>
        )}

        {mode === "user" && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Find user</label>
            <Input
              type="text"
              placeholder="Search by name, email, or phone…"
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                setSelectedUser(null);
              }}
            />
            {userSearching && (
              <div className="text-xs text-gray-500">Searching…</div>
            )}
            {selectedUser ? (
              <div className="flex items-center justify-between bg-healwin-50 border border-healwin-200 rounded-lg p-2 text-sm">
                <div>
                  <div className="font-medium">
                    {selectedUser.fullName || selectedUser.phoneNumber}
                  </div>
                  <div className="text-xs text-gray-600">
                    {selectedUser.email} · {selectedUser.phoneNumber}
                    {!selectedUser.fcmToken && (
                      <span className="ml-2 text-amber-600">
                        (no device — only inbox row will be saved)
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="text-xs text-healwin-700 hover:underline"
                >
                  change
                </button>
              </div>
            ) : (
              userResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-auto">
                  {userResults.map((u) => (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => setSelectedUser(u)}
                      className="w-full text-left p-2 hover:bg-gray-50 text-sm"
                    >
                      <div className="font-medium">
                        {u.fullName || u.phoneNumber || u.email}
                      </div>
                      <div className="text-xs text-gray-500">
                        {u.email} · {u.phoneNumber}
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Type">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as NotifType)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Deep-link route (optional)"
            hint="/notifications  or  /booking/123"
          >
            <Input
              type="text"
              placeholder="/notifications  or  /booking/123"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Title" hint={`${title.length}/80`}>
          <Input
            type="text"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Health camp this Sunday"
          />
        </Field>

        <Field label="Message" hint={`${body.length}/240`}>
          <Textarea
            value={body}
            rows={4}
            maxLength={240}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tap to view details…"
          />
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="secondary"
            type="button"
            onClick={reset}
            disabled={sending}
          >
            Reset
          </Button>
          <Button type="button" onClick={send} disabled={sending}>
            {sending
              ? "Sending…"
              : mode === "broadcast"
                ? "Send broadcast"
                : "Send to user"}
          </Button>
        </div>
      </Card>

      {/* History */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Recent notifications</h2>
        <Button size="sm" variant="ghost" type="button" onClick={loadHistory}>
          Refresh
        </Button>
      </div>
      <Table>
        <THead>
          <Th>When</Th>
          <Th>Type</Th>
          <Th>Recipient</Th>
          <Th>Title</Th>
          <Th>Body</Th>
        </THead>
        <TBody>
          {historyLoading ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : history.length === 0 ? (
            <TableState colSpan={5}>No notifications yet.</TableState>
          ) : (
            history.map((h) => (
              <TR key={h._id}>
                <Td className="whitespace-nowrap text-xs text-gray-500">
                  {new Date(h.createdAt).toLocaleString()}
                </Td>
                <Td>
                  <Badge tone="neutral">{h.type}</Badge>
                </Td>
                <Td className="text-xs">
                  {h.userId?.fullName ||
                    h.userId?.phoneNumber ||
                    h.userId?.email || (
                      <span className="text-gray-400">broadcast</span>
                    )}
                </Td>
                <Td className="font-medium text-gray-900">{h.title}</Td>
                <Td className="text-gray-700">{h.body}</Td>
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
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <Pagination page={page} totalPages={totalPages} total={total} label="notifications" onPageChange={setPage} />
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number | string }> = ({
  label,
  value,
}) => (
  <Card className="p-3">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="text-xl font-semibold mt-1">{value}</div>
  </Card>
);

const ModeButton: React.FC<
  React.PropsWithChildren<{ active: boolean; onClick: () => void }>
> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 text-sm rounded-lg border transition-colors",
      active
        ? "bg-healwin-600 text-white border-healwin-600"
        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
    )}
  >
    {children}
  </button>
);

export default NotificationsManagement;

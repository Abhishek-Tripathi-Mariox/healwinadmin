import React, { useEffect, useState } from "react";
import { Menu, Bell, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { alertsApi } from "../../services/admin-api";
import { adminSocket } from "../../services/socket";

interface HeaderProps {
  setIsMobileMenuOpen: (open: boolean) => void;
}

interface AlertItem {
  id: string;
  title: string;
  message: string;
  tone: "danger" | "warning" | "info";
  fingerprint: string;
}

interface ActivityItem {
  id: string;
  title: string;
  message: string;
  tone: "danger" | "warning" | "info" | "success";
  route: string;
  at: number;
}

const toneText: Record<string, string> = {
  danger: "text-red-600",
  warning: "text-amber-600",
  info: "text-blue-600",
  success: "text-green-600",
};

// Real-time admin activity feed: socket event → bell item + where it links.
const EVENTS: { event: string; title: string; route: string; tone: ActivityItem["tone"] }[] = [
  { event: "sos:new", title: "New SOS", route: "/admin/sos", tone: "danger" },
  { event: "ambulance-request:new", title: "New ambulance request", route: "/admin/ambulance-requests", tone: "danger" },
  { event: "consultation:new", title: "New consultation", route: "/admin/patient-orders", tone: "info" },
  { event: "lab-booking:new", title: "New lab booking", route: "/admin/patient-orders", tone: "info" },
  { event: "pharmacy-order:new", title: "New pharmacy order", route: "/admin/patient-orders", tone: "success" },
  { event: "leave:new", title: "New leave request", route: "/admin/leave", tone: "warning" },
  { event: "stock:new", title: "New stock request", route: "/admin/staff-records?tab=stock-requests", tone: "warning" },
  // Only patient/driver replies reach the admin room (emitToAdmin), so this
  // never fires for the admin's own replies.
  { event: "support:message", title: "Support ticket reply", route: "/admin/support-tickets", tone: "info" },
];

const msgFor = (event: string, d: any): string => {
  const name = d?.patientName || d?.doctorName;
  if (event === "pharmacy-order:new") return d?.totalAmount ? `Order · ₹${d.totalAmount}` : "New medicine order";
  if (event === "lab-booking:new") return d?.totalAmount ? `Tests · ₹${d.totalAmount}` : "New lab tests booking";
  if (event === "consultation:new") return name ? `Dr. ${name}` : "Doctor consultation requested";
  if (event === "leave:new") return d?.staffName ? `${d.staffName} · ${d.type || "leave"}` : "Staff leave request";
  if (event === "stock:new") return d?.staffName ? `${d.staffName} · stock request` : "Staff stock request";
  if (event === "support:message") return d?.message ? `${d.ticketId ? d.ticketId + " · " : ""}${String(d.message).slice(0, 40)}` : "New reply on a ticket";
  return name || "Tap to view";
};

const Header: React.FC<HeaderProps> = ({ setIsMobileMenuOpen }) => {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [items, setItems] = useState<AlertItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [unseen, setUnseen] = useState(0);
  // Clinical alerts that have already been seen (badge ignores these until a
  // genuinely new alert id appears). Without this, opening the bell cleared the
  // socket-activity count but the alert count kept the badge lit — so it looked
  // like notifications were never marked read.
  const [seenAlertIds, setSeenAlertIds] = useState<Set<string>>(new Set());

  // Alerts the admin explicitly dismissed (the "×" on a row) — persisted so a
  // reload doesn't bring them back. These are LIVE facts (e.g. low stock),
  // not one-time events, so dismissing one only hides it while the same
  // underlying condition holds; if the item's stock changes at all (restocked,
  // or drops further), it's treated as a fresh alert and reappears.
  const DISMISS_KEY = "healwin_admin_dismissed_alerts";
  const [dismissed, setDismissed] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(DISMISS_KEY) || "{}");
    } catch {
      return {};
    }
  });
  const dismissAlert = (id: string, fingerprint: string) => {
    setDismissed((prev) => {
      const next = { ...prev, [id]: fingerprint };
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Clinical alerts (low stock / expiry / follow-ups) — polled.
  useEffect(() => {
    let active = true;
    const fetchAlerts = () => {
      alertsApi
        .get()
        .then((res) => {
          if (!active) return;
          const d = res.data || {};
          const list: (AlertItem & { fingerprint: string })[] = [];
          (d.lowStock || []).forEach((x: any) =>
            list.push({ id: `ls-${x._id}`, title: "Low stock", message: `${x.name} — ${x.currentStock} left (reorder ≤ ${x.reorderThreshold})`, tone: "danger", fingerprint: String(x.currentStock) }),
          );
          (d.expiringSoon || []).forEach((x: any) =>
            list.push({ id: `ex-${x._id}`, title: "Expiring soon", message: `${x.name} — exp ${new Date(x.expiryDate).toLocaleDateString()}`, tone: "warning", fingerprint: String(x.currentStock) }),
          );
          (d.followUps || []).forEach((x: any) =>
            list.push({ id: `fu-${x._id}`, title: "Follow-up due", message: `${x.patientId?.fullName || "Patient"} — ${new Date(x.followUpAt).toLocaleDateString()}`, tone: "info", fingerprint: x.followUpAt }),
          );
          setItems(list);
          // Drop stale dismissals: either the alert is gone entirely (resolved)
          // or its fingerprint changed (stock moved) — either way it shouldn't
          // stay suppressed forever.
          setDismissed((prev) => {
            const next: Record<string, string> = {};
            let changed = false;
            for (const it of list) {
              if (prev[it.id] === it.fingerprint) next[it.id] = prev[it.id];
            }
            for (const k of Object.keys(prev)) {
              if (!(k in next)) changed = true;
            }
            if (!changed && Object.keys(next).length === Object.keys(prev).length) return prev;
            localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
            return next;
          });
        })
        .catch(() => {});
    };
    fetchAlerts();
    const t = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  // Real-time activity feed over the admin socket.
  useEffect(() => {
    adminSocket.connect();
    const offs = EVENTS.map((e) =>
      adminSocket.on(e.event, (d: any) => {
        setActivity((prev) =>
          [
            {
              id: `${e.event}-${(d && (d.id || d.requestId || d.sosId)) || Date.now()}`,
              title: e.title,
              message: msgFor(e.event, d),
              tone: e.tone,
              // For a support reply, deep-link to the exact ticket so clicking
              // the notification opens that chat window (not just the list).
              route:
                e.event === "support:message" && d?.ticketId
                  ? `/admin/support-tickets?ticket=${encodeURIComponent(d.ticketId)}`
                  : e.route,
              at: Date.now(),
            },
            ...prev,
          ].slice(0, 25),
        );
        setUnseen((n) => n + 1);
      }),
    );
    return () => offs.forEach((off) => off());
  }, []);

  const openItem = (route: string) => {
    setShowNotifications(false);
    navigate(route);
  };

  const visibleAlerts = items.filter((i) => dismissed[i.id] !== i.fingerprint);

  const toggle = () => {
    setShowNotifications((s) => {
      if (!s) {
        setUnseen(0); // opening clears the new-activity badge
        // …and marks every currently-shown alert as read, so the badge drops to
        // 0 on open and only re-lights when a brand-new alert arrives.
        setSeenAlertIds(new Set(visibleAlerts.map((i) => i.id)));
      }
      return !s;
    });
  };

  const unseenAlerts = visibleAlerts.filter((i) => !seenAlertIds.has(i.id)).length;
  const badge = unseen + unseenAlerts;

  return (
    <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center space-x-4">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600 lg:hidden hover:text-gray-800">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <button
              onClick={toggle}
              className="relative p-2 text-gray-600 transition-colors rounded-lg hover:text-gray-800 hover:bg-gray-100"
            >
              <Bell className="w-5 h-5" />
              {badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="animate-modal-in absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-100 bg-white py-2 shadow-lg">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">Notifications</h3>
                  <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-y-auto max-h-96">
                  {activity.length === 0 && visibleAlerts.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                      <Bell className="h-8 w-8 text-gray-300" />
                      <p className="text-sm font-medium text-gray-700">You're all caught up</p>
                      <p className="text-xs text-gray-400">New requests, orders and alerts appear here live.</p>
                    </div>
                  )}

                  {activity.length > 0 && (
                    <div className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Recent activity
                    </div>
                  )}
                  {activity.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => openItem(a.route)}
                      className="block w-full px-4 py-3 text-left border-b border-gray-50 last:border-0 hover:bg-gray-50"
                    >
                      <p className={`text-sm font-medium ${toneText[a.tone]}`}>{a.title}</p>
                      <p className="text-xs text-gray-500">{a.message}</p>
                    </button>
                  ))}

                  {visibleAlerts.length > 0 && (
                    <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Alerts
                    </div>
                  )}
                  {visibleAlerts.map((a) => (
                    <div key={a.id} className="group flex items-start gap-2 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${toneText[a.tone]}`}>{a.title}</p>
                        <p className="text-xs text-gray-500">{a.message}</p>
                      </div>
                      <button
                        onClick={() => dismissAlert(a.id, a.fingerprint)}
                        title="Dismiss"
                        className="shrink-0 rounded p-0.5 text-gray-300 opacity-0 hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 text-center border-t border-gray-100">
                  <span className="text-xs text-gray-400">Live · auto-updates</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

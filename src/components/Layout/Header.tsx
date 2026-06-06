import React, { useEffect, useState } from "react";
import { Menu, Bell, X } from "lucide-react";
import { alertsApi } from "../../services/admin-api";

interface HeaderProps {
  setIsMobileMenuOpen: (open: boolean) => void;
}

interface AlertItem {
  id: string;
  title: string;
  message: string;
  tone: "danger" | "warning" | "info";
}

const toneText: Record<AlertItem["tone"], string> = {
  danger: "text-red-600",
  warning: "text-amber-600",
  info: "text-blue-600",
};

const Header: React.FC<HeaderProps> = ({ setIsMobileMenuOpen }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [items, setItems] = useState<AlertItem[]>([]);

  useEffect(() => {
    let active = true;
    const fetchAlerts = () => {
      alertsApi
        .get()
        .then((res) => {
          if (!active) return;
          const d = res.data || {};
          const list: AlertItem[] = [];
          (d.lowStock || []).forEach((x: any) =>
            list.push({
              id: `ls-${x._id}`,
              title: "Low stock",
              message: `${x.name} — ${x.currentStock} left (reorder ≤ ${x.reorderThreshold})`,
              tone: "danger",
            }),
          );
          (d.expiringSoon || []).forEach((x: any) =>
            list.push({
              id: `ex-${x._id}`,
              title: "Expiring soon",
              message: `${x.name} — exp ${new Date(x.expiryDate).toLocaleDateString()}`,
              tone: "warning",
            }),
          );
          (d.followUps || []).forEach((x: any) =>
            list.push({
              id: `fu-${x._id}`,
              title: "Follow-up due",
              message: `${x.patientId?.fullName || "Patient"} — ${new Date(x.followUpAt).toLocaleDateString()}`,
              tone: "info",
            }),
          );
          setItems(list);
        })
        .catch(() => {
          /* alerts are best-effort */
        });
    };
    fetchAlerts();
    // Refresh every 5 minutes so the bell stays current.
    const t = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  const count = items.length;

  return (
    <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-gray-600 lg:hidden hover:text-gray-800"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center space-x-4">
          {/* Alerts */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-600 transition-colors rounded-lg hover:text-gray-800 hover:bg-gray-100"
            >
              <Bell className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="animate-modal-in absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-100 bg-white py-2 shadow-lg">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">Alerts</h3>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-y-auto max-h-96">
                  {count === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                      <Bell className="h-8 w-8 text-gray-300" />
                      <p className="text-sm font-medium text-gray-700">
                        You're all caught up
                      </p>
                      <p className="text-xs text-gray-400">
                        No low-stock, expiry or follow-up alerts.
                      </p>
                    </div>
                  )}
                  {items.map((a) => (
                    <div
                      key={a.id}
                      className="px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50"
                    >
                      <p className={`text-sm font-medium ${toneText[a.tone]}`}>
                        {a.title}
                      </p>
                      <p className="text-xs text-gray-500">{a.message}</p>
                    </div>
                  ))}
                </div>
                {count > 0 && (
                  <div className="px-4 py-2 text-center border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      Live HMS alerts · auto-updates
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

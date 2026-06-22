import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { CalendarClock, PackagePlus } from "lucide-react";
import { adminSocket } from "../services/socket";

/**
 * Non-blocking realtime toasts for ambulance-staff activity (leave requests,
 * stock requests). Unlike SosRealtime these are NOT emergencies, so they get a
 * quiet top-right toast that links to the relevant admin page rather than a
 * blocking alarm modal.
 */
export const StaffActivityRealtime: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    adminSocket.connect();

    const offLeave = adminSocket.on("leave:new", (raw) => {
      const d = (raw || {}) as { staffName?: string; type?: string };
      toast(
        (t) => (
          <button
            onClick={() => {
              toast.dismiss(t.id);
              navigate("/admin/staff-records");
            }}
            className="flex items-start gap-3 text-left"
          >
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <span>
              <span className="block font-semibold text-gray-900">New leave request</span>
              <span className="block text-sm text-gray-600">
                {d.staffName || "A staff member"} applied for {d.type || "leave"}.
              </span>
            </span>
          </button>
        ),
        { duration: 8000, icon: null },
      );
    });

    const offStock = adminSocket.on("stock:new", (raw) => {
      const d = (raw || {}) as { staffName?: string };
      toast(
        (t) => (
          <button
            onClick={() => {
              toast.dismiss(t.id);
              navigate("/admin/staff-records");
            }}
            className="flex items-start gap-3 text-left"
          >
            <PackagePlus className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <span>
              <span className="block font-semibold text-gray-900">New stock request</span>
              <span className="block text-sm text-gray-600">
                {d.staffName || "A staff member"} requested stock.
              </span>
            </span>
          </button>
        ),
        { duration: 8000, icon: null },
      );
    });

    return () => {
      offLeave();
      offStock();
    };
  }, [navigate]);

  return null;
};

export default StaffActivityRealtime;

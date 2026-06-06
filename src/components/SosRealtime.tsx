import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";
import { adminSocket } from "../services/socket";

/**
 * Mounts inside the authenticated admin shell. Connects the realtime socket and
 * raises a loud, clickable toast + alert chime whenever a patient triggers SOS
 * or a new ambulance request comes in — so dispatchers react immediately
 * instead of waiting for the polling interval.
 */

// Short attention chime via the Web Audio API (no asset to bundle).
// Reuse ONE AudioContext — browsers cap total contexts (~6); creating a new one
// per alert silently fails after a burst of SOS events, killing the chime.
let sharedCtx: AudioContext | null = null;
const chime = () => {
  try {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!sharedCtx) sharedCtx = new Ctx();
    const ctx = sharedCtx;
    // Autoplay policies suspend the context until a user gesture; nudge it.
    if (ctx.state === "suspended") void ctx.resume();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    beep(880, 0, 0.25);
    beep(660, 0.28, 0.3);
  } catch {
    /* audio not available */
  }
};

interface IncomingSos {
  requestId?: string;
  emergency?: boolean;
  patientName?: string | null;
  pickup?: { address?: string } | null;
}

export const SosRealtime: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    adminSocket.connect();

    const announce = (raw: unknown, emergency: boolean) => {
      const d = (raw || {}) as IncomingSos;
      const who = d.patientName || "A patient";
      const where = d.pickup?.address ? ` · ${d.pickup.address}` : "";
      chime();
      toast(
        (t) => (
          <div
            onClick={() => {
              toast.dismiss(t.id);
              navigate("/admin/ambulance-requests");
            }}
            style={{ cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}
          >
            <AlertTriangle
              size={22}
              color={emergency ? "#dc2626" : "#2563eb"}
              style={{ flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 700, color: emergency ? "#b91c1c" : "#1d4ed8" }}>
                {emergency ? "🚨 New SOS" : "New ambulance request"}
              </div>
              <div style={{ fontSize: 13, color: "#374151" }}>
                {who}
                {where} — tap to dispatch
              </div>
            </div>
          </div>
        ),
        { duration: 12000, style: { borderLeft: `4px solid ${emergency ? "#dc2626" : "#2563eb"}` } },
      );
    };

    const offSos = adminSocket.on("sos:new", (d) => announce(d, true));
    const offReq = adminSocket.on("ambulance-request:new", (d) => announce(d, false));

    return () => {
      offSos();
      offReq();
    };
  }, [navigate]);

  return null;
};

export default SosRealtime;

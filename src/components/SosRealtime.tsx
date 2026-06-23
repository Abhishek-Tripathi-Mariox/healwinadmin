import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Phone, MapPin, X } from "lucide-react";
import { adminSocket } from "../services/socket";

/**
 * Real-time emergency alerter. When a patient triggers SOS (or a new ambulance
 * request arrives), this raises a BLOCKING modal that keeps sounding an alarm
 * until the dispatcher acknowledges it — so an incoming emergency can never be
 * missed. "Dispatch" jumps straight to the SOS Dashboard.
 */

interface SosItem {
  id: string;
  emergency: boolean;
  patientName: string;
  address: string;
  at: number;
}

// One shared AudioContext (browsers cap the total count).
let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
};

/**
 * Browsers block audio until the user has interacted with the page. Call this
 * from a real user gesture (any click/keypress) to create + resume the
 * AudioContext — afterwards the alarm can sound on its own when an SOS arrives.
 */
export const unlockAlarmAudio = () => {
  const c = getCtx();
  if (c && c.state !== "running") void c.resume();
};

const beep = async () => {
  try {
    const c = getCtx();
    if (!c) return;
    // Browsers suspend the AudioContext after inactivity. AWAIT the resume so
    // tones are scheduled on a RUNNING context — scheduling on a suspended one
    // (the old fire-and-forget `void resume()`) produced no sound.
    // Cast to string so TS doesn't narrow `state` across the await (the union
    // has no "running" overlap otherwise, which fails the build).
    if ((c.state as string) !== "running") {
      await c.resume();
      if ((c.state as string) !== "running") return;
    }
    ctx = c;
    const tone = (freq: number, start: number, dur: number) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.connect(gain);
      gain.connect(ctx!.destination);
      osc.type = "square";
      osc.frequency.value = freq;
      const t0 = ctx!.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.6, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur);
    };
    // Louder two-tone "hi-lo" siren, repeated twice so each ring lasts ~1.3s
    // and is clearly audible across the room.
    tone(1000, 0, 0.28);
    tone(740, 0.3, 0.3);
    tone(1000, 0.65, 0.28);
    tone(740, 0.95, 0.3);
  } catch {
    /* audio unavailable */
  }
};

export const SosRealtime: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<SosItem[]>([]);
  const alarm = useRef<ReturnType<typeof setInterval> | null>(null);

  // Unlock audio on the dispatcher's first interaction with the page so the
  // alarm can sound by itself when an SOS arrives (browsers block autoplay
  // until a user gesture has happened).
  useEffect(() => {
    // Keep the audio context warm on EVERY interaction (not just the first) —
    // browsers re-suspend it after idle, and a one-shot unlock then went silent.
    const unlock = () => unlockAlarmAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Socket → push new alerts into the queue.
  useEffect(() => {
    adminSocket.connect();
    let seq = 0;
    const add = (raw: unknown, emergency: boolean) => {
      const d = (raw || {}) as {
        requestId?: string;
        sosId?: string;
        patientName?: string | null;
        pickup?: { address?: string } | null;
        address?: string;
      };
      seq += 1;
      const id = String(d.requestId || d.sosId || `sos-${seq}-${emergency}`);
      setItems((prev) =>
        prev.some((p) => p.id === id)
          ? prev
          : [
              ...prev,
              {
                id,
                emergency,
                patientName: d.patientName || "A patient",
                address: d.pickup?.address || d.address || "Location unavailable",
                at: seq,
              },
            ],
      );
    };
    const offSos = adminSocket.on("sos:new", (d) => add(d, true));
    const offReq = adminSocket.on("ambulance-request:new", (d) => add(d, false));
    return () => {
      offSos();
      offReq();
    };
  }, []);

  // Loop the alarm while any alert is unacknowledged.
  useEffect(() => {
    if (items.length > 0) {
      if (!alarm.current) {
        void beep();
        alarm.current = setInterval(() => void beep(), 1500);
      }
    } else if (alarm.current) {
      clearInterval(alarm.current);
      alarm.current = null;
    }
    return () => {
      if (items.length === 0 && alarm.current) {
        clearInterval(alarm.current);
        alarm.current = null;
      }
    };
  }, [items]);

  if (items.length === 0) return null;

  const dismiss = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));
  const dispatch = (id: string) => {
    dismiss(id);
    navigate("/admin/sos");
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="alertdialog"
      aria-live="assertive"
    >
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-2 ring-red-500">
        <div className="flex items-center gap-3 rounded-t-2xl bg-red-600 px-5 py-4 text-white">
          <AlertTriangle className="h-7 w-7 animate-pulse" />
          <div>
            <p className="text-lg font-bold leading-tight">🚨 Emergency SOS</p>
            <p className="text-sm text-red-100">
              {items.length} unacknowledged alert{items.length > 1 ? "s" : ""} — respond now
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {items.map((it) => (
            <div key={it.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    {it.emergency ? "🚨 " : ""}
                    {it.patientName}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">{it.address}</span>
                  </p>
                </div>
                <button
                  onClick={() => dismiss(it.id)}
                  className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  title="Acknowledge & silence"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => dispatch(it.id)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  <Phone className="h-4 w-4" /> Dispatch now
                </button>
                <button
                  onClick={() => dismiss(it.id)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SosRealtime;

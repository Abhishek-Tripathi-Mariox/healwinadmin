import { io, Socket } from "socket.io-client";

/**
 * Admin real-time socket. Connects with the admin JWT and joins the "admin"
 * broadcast room so the dashboard receives `sos:new` / `ambulance-request:new`
 * (and dispatch updates) the instant they happen — no polling lag.
 *
 * IMPORTANT: multiple components (SosRealtime, the Header bell,
 * StaffActivityRealtime, SupportTickets…) each call connect() + on() on this
 * singleton. To avoid a connect/subscribe RACE — where `socket?.on()` is a
 * silent no-op before the socket exists, or a later connect() disconnects the
 * socket an earlier listener was bound to (orphaning it, so e.g. the SOS popup
 * never fires) — we keep a listener registry and (re)bind everything on every
 * (re)connect. connect() also reuses the existing socket instead of recreating.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:9050/v1/api";
// Strip the trailing "/v1/api" to get the socket origin.
const SOCKET_URL = API_URL.replace(/\/v1\/api\/?$/, "");

let socket: Socket | null = null;
const listeners = new Map<string, Set<(data: unknown) => void>>();

const bindAll = () => {
  if (!socket) return;
  socket.emit("join:admin");
  listeners.forEach((cbs, event) =>
    cbs.forEach((cb) => {
      socket!.off(event, cb);
      socket!.on(event, cb);
    }),
  );
};

export const adminSocket = {
  get connected() {
    return !!socket?.connected;
  },

  connect() {
    const token = localStorage.getItem("adminToken");
    if (!token) return;
    if (socket) {
      if (!socket.connected) socket.connect();
      return;
    }
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 2000,
    });
    // Bind listeners registered before the socket existed, and re-bind on every
    // reconnect.
    socket.on("connect", bindAll);
    bindAll();
  },

  disconnect() {
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
    listeners.clear();
  },

  /** Subscribe to a server event; returns an unsubscribe fn. Safe to call
   *  before connect() resolves — the handler binds once the socket exists. */
  on(event: string, cb: (data: unknown) => void): () => void {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(cb);
    socket?.off(event, cb);
    socket?.on(event, cb);
    return () => {
      set?.delete(cb);
      socket?.off(event, cb);
    };
  },
};

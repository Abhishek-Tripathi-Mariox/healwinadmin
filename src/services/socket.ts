import { io, Socket } from "socket.io-client";

/**
 * Admin real-time socket. Connects with the admin JWT and joins the "admin"
 * broadcast room so the dashboard receives `sos:new` / `ambulance-request:new`
 * (and dispatch updates) the instant they happen — no polling lag.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:9050/v1/api";
// Strip the trailing "/v1/api" to get the socket origin.
const SOCKET_URL = API_URL.replace(/\/v1\/api\/?$/, "");

let socket: Socket | null = null;

export const adminSocket = {
  get connected() {
    return !!socket?.connected;
  },

  connect() {
    const token = localStorage.getItem("adminToken");
    if (!token) return;
    if (socket?.connected) return;
    socket?.disconnect();
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 2000,
    });
    socket.on("connect", () => socket?.emit("join:admin"));
  },

  disconnect() {
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
  },

  on(event: string, cb: (data: unknown) => void): () => void {
    socket?.on(event, cb);
    return () => socket?.off(event, cb);
  },
};

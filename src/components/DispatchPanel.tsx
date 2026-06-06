import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ambulanceDispatchApi } from "../services/admin-api";

// Fix default icon paths for Leaflet in Vite bundles
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface NearbyAmbulance {
  ambulanceId: string;
  providerName: string;
  registrationNumber: string;
  ambulanceType: string;
  driverName: string;
  attendantName: string;
  ambulanceLocation: { lat: number; lng: number };
  roadDistanceKm: number;
  etaMinutes: number;
}

export default function DispatchPanel({ sosId }: { sosId: string }) {
  const [data, setData] = useState<{
    patientLocation: { lat: number; lng: number };
    ambulances: NearbyAmbulance[];
  } | null>(null);
  const [current, setCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [n, c] = await Promise.all([
        ambulanceDispatchApi.nearby(sosId),
        ambulanceDispatchApi.current(sosId),
      ]);
      setData(n.data || n);
      setCurrent(c.data?.dispatch || c.dispatch || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [sosId]);

  const doDispatch = async (ambulanceId: string) => {
    if (!confirm("Dispatch this ambulance?")) return;
    setDispatching(ambulanceId);
    try {
      await ambulanceDispatchApi.dispatch(sosId, ambulanceId);
      await load();
    } catch (e: any) {
      alert(e.message || "Dispatch failed");
    } finally {
      setDispatching(null);
    }
  };

  // Manual override — free the current ambulance so ops can reassign.
  const doCancel = async () => {
    if (
      !confirm(
        "Cancel this dispatch? The ambulance will be freed and you can assign a different one.",
      )
    )
      return;
    setCancelling(true);
    try {
      await ambulanceDispatchApi.cancel(sosId);
      await load();
    } catch (e: any) {
      alert(e.message || "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !data) return <p className="p-4">Loading...</p>;
  if (!data) return <p className="p-4">No data</p>;

  const { patientLocation, ambulances } = data;
  const center: [number, number] = [patientLocation.lat, patientLocation.lng];

  return (
    <div className="grid grid-cols-2 gap-4 h-[70vh]">
      <div className="h-full">
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />
          <Marker position={center}>
            <Popup>Patient SOS</Popup>
          </Marker>
          {ambulances.map((a) => (
            <Marker
              key={a.ambulanceId}
              position={[a.ambulanceLocation.lat, a.ambulanceLocation.lng]}
            >
              <Popup>
                {a.registrationNumber} — {a.roadDistanceKm} km,{" "}
                {a.etaMinutes} min
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="overflow-y-auto">
        {current ? (
          <div className="border rounded p-3 bg-amber-50 mb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  Active dispatch — {current.status}
                </p>
                <p className="text-sm">
                  Ambulance {current.ambulanceId?.registrationNumber} · ETA{" "}
                  {current.etaMinutes} min
                </p>
              </div>
              {!["COMPLETED", "CANCELLED"].includes(current.status) && (
                <button
                  onClick={doCancel}
                  disabled={cancelling}
                  className="shrink-0 rounded border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {cancelling ? "Cancelling…" : "Cancel / Reassign"}
                </button>
              )}
            </div>
          </div>
        ) : null}
        <h3 className="font-semibold mb-2">
          Nearest available ({ambulances.length})
        </h3>
        {ambulances.length === 0 && (
          <p className="text-gray-500 text-sm">
            No ambulances currently available in range.
          </p>
        )}
        <ul className="space-y-2">
          {ambulances.map((a, i) => (
            <li
              key={a.ambulanceId}
              className="border rounded p-3 flex items-center justify-between"
            >
              <div>
                <p className="font-mono">
                  #{i + 1} {a.registrationNumber} ({a.ambulanceType})
                </p>
                <p className="text-sm text-gray-600">
                  {a.providerName} · Driver: {a.driverName}
                </p>
                <p className="text-sm">
                  {a.roadDistanceKm} km · ETA {a.etaMinutes} min
                </p>
              </div>
              <button
                disabled={!!current || dispatching === a.ambulanceId}
                onClick={() => doDispatch(a.ambulanceId)}
                className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
              >
                {dispatching === a.ambulanceId ? "..." : "Dispatch"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

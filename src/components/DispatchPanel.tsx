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
    // Backend sends the patient coords as `patient` (lat/lng/address). It's
    // null when the SOS has no GPS pin (reason: "no_location").
    patient?: { lat: number; lng: number; address?: string } | null;
    ambulances: NearbyAmbulance[];
    reason?: string;
  } | null>(null);
  const [current, setCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // `nearby` is the source of truth for the panel. `current` 404s whenever
      // the SOS hasn't been dispatched yet (the normal first-load case), so it
      // MUST be isolated — otherwise its rejection takes down the whole
      // Promise.all and the nearby-ambulance list never renders ("stuck
      // loading / no ambulances").
      const [n, c] = await Promise.all([
        ambulanceDispatchApi.nearby(sosId),
        ambulanceDispatchApi.current(sosId).catch(() => null),
      ]);
      setData(n?.data || n);
      setCurrent(c?.data?.dispatch || c?.dispatch || null);
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

  const { patient, ambulances } = data;
  // `current` is the SOS's MOST RECENT dispatch regardless of status, so a past
  // COMPLETED/CANCELLED one would otherwise keep every Dispatch button disabled
  // (and hide the Cancel button) — leaving the admin unable to re-dispatch. Only
  // a still-running dispatch should block dispatching.
  const activeDispatch =
    current && !["COMPLETED", "CANCELLED"].includes(current.status)
      ? current
      : null;
  // The patient marker (and map centre) needs a real GPS pin. Many SOS rows
  // come in without one (reason: "no_location") — guard so the panel still
  // shows the dispatchable ambulance list instead of crashing on the map.
  const hasPatientLoc =
    !!patient &&
    Number.isFinite(patient.lat) &&
    Number.isFinite(patient.lng) &&
    (patient.lat !== 0 || patient.lng !== 0);
  const center: [number, number] | null = hasPatientLoc
    ? [patient!.lat, patient!.lng]
    : null;

  return (
    <div className="grid grid-cols-2 gap-4 h-[70vh]">
      <div className="h-full">
        {center ? (
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
            {ambulances
              .filter(
                (a) =>
                  a.ambulanceLocation &&
                  (a.ambulanceLocation.lat !== 0 ||
                    a.ambulanceLocation.lng !== 0),
              )
              .map((a) => (
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
        ) : (
          <div className="h-full flex items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
            No GPS location on this SOS yet — map unavailable. You can still
            dispatch the nearest ambulance from the list.
          </div>
        )}
      </div>
      <div className="overflow-y-auto">
        {activeDispatch ? (
          <div className="border rounded p-3 bg-amber-50 mb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  Active dispatch — {activeDispatch.status}
                </p>
                <p className="text-sm">
                  Ambulance {activeDispatch.ambulanceId?.registrationNumber} · ETA{" "}
                  {activeDispatch.etaMinutes} min
                </p>
              </div>
              <button
                onClick={doCancel}
                disabled={cancelling}
                className="shrink-0 rounded border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel / Reassign"}
              </button>
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
                  {a.roadDistanceKm > 0
                    ? `${a.roadDistanceKm} km · ETA ${a.etaMinutes} min`
                    : "Location unavailable (GPS off)"}
                </p>
              </div>
              <button
                disabled={!!activeDispatch || dispatching === a.ambulanceId}
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

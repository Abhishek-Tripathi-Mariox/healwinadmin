import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Radio,
  Siren,
  User as UserIcon,
} from "lucide-react";
import { ambulanceStaffApi } from "../services/admin-api";
import {
  Card,
  Badge,
  Alert,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
} from "../components/ui";

// react-leaflet default icon paths break under Vite — point them at the
// CDN copy so markers render instead of showing as broken images.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface ProviderRef {
  _id: string;
  name?: string;
}

interface Staff {
  _id: string;
  fullName: string;
  mobileNumber: string;
  email?: string;
  role: "driver" | "attendant";
  providerId?: string | ProviderRef;
  hospitalId?: string | { _id: string; name?: string };
  licenseNumber?: string;
  certifications?: string[];
  isActive: boolean;
  isOnline: boolean;
  isDutyOn?: boolean;
  lastSeenAt?: string;
  lastLocationAttemptAt?: string;
  profilePhoto?: string;
  createdAt?: string;
}

interface AssignedAmbulance {
  _id: string;
  registrationNumber: string;
  ambulanceType?: string;
  status: string;
  isActive: boolean;
  currentLocation?: { type: "Point"; coordinates: [number, number] };
  lastLocationAt?: string;
  providerId?: ProviderRef;
}

interface DispatchRow {
  _id: string;
  status: string;
  dispatchedAt: string;
  roadDistanceKm?: number;
  etaMinutes?: number;
  ambulanceId?:
    | string
    | { _id: string; registrationNumber: string; ambulanceType?: string };
}

const ageStr = (iso?: string) => {
  if (!iso) return "never";
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
};

const STALE_MS = 5 * 60 * 1000;

const dispatchStatusTone = (
  s: string,
): "info" | "accent" | "warning" | "success" | "danger" | "neutral" => {
  switch (s) {
    case "DISPATCHED":
      return "info";
    case "ACKNOWLEDGED":
      return "accent";
    case "EN_ROUTE":
      return "warning";
    case "ON_SCENE":
      return "warning";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
};

export default function AmbulanceStaffDetail() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [ambulance, setAmbulance] = useState<AssignedAmbulance | null>(null);
  const [dispatches, setDispatches] = useState<DispatchRow[]>([]);

  const load = async () => {
    if (!id) return;
    try {
      const res = await ambulanceStaffApi.detail(id);
      const data = res?.data || res;
      setStaff(data?.staff || null);
      setAmbulance(data?.assignedAmbulance || null);
      setDispatches(data?.recentDispatches || []);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Initial load + 15s refresh so location + duty status stay live while
  // the admin is watching. Cheap query — single doc + one ambulance + 10
  // dispatches.
  useEffect(() => {
    setLoading(true);
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading && !staff) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-6 h-6 mr-2 animate-spin" />
        Loading driver details…
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="p-6">
        <Link
          to="/admin/ambulance-staff"
          className="inline-flex items-center gap-1 text-sm text-healwin-600 hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Drivers
        </Link>
        <Alert tone="danger">{error || "Driver not found."}</Alert>
      </div>
    );
  }

  // Pick whichever affiliation is actually set on this staff record —
  // they're mutually exclusive in the data model, so labelling by role
  // (driver → Provider, attendant → Hospital) is wrong for on-vehicle
  // attendants who belong to an ambulance company, not a hospital.
  const provider =
    staff.providerId && typeof staff.providerId === "object"
      ? staff.providerId
      : null;
  const hospital =
    staff.hospitalId && typeof staff.hospitalId === "object"
      ? staff.hospitalId
      : null;
  const affiliationLabel = provider ? "Provider" : hospital ? "Hospital" : "—";
  const affiliationName = provider?.name || hospital?.name || "—";

  const coords = ambulance?.currentLocation?.coordinates;
  const lat = coords?.[1];
  const lng = coords?.[0];
  const locStale =
    !ambulance?.lastLocationAt ||
    Date.now() - new Date(ambulance.lastLocationAt).getTime() > STALE_MS;

  return (
    <div className="p-6 space-y-6">
      <Link
        to="/admin/ambulance-staff"
        className="inline-flex items-center gap-1 text-sm text-healwin-600 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Drivers
      </Link>

      {/* Header */}
      <Card className="p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-healwin-100 flex items-center justify-center overflow-hidden shrink-0">
          {staff.profilePhoto ? (
            <img
              src={staff.profilePhoto}
              alt={staff.fullName}
              className="w-full h-full object-cover"
            />
          ) : (
            <UserIcon className="w-8 h-8 text-healwin-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {staff.fullName}
            </h1>
            <Badge tone="accent">{staff.role}</Badge>
            <Badge tone={staff.isOnline ? "success" : "neutral"} dot>
              {staff.isOnline ? "Online" : "Offline"}
            </Badge>
            <Badge tone={staff.isActive ? "info" : "danger"}>
              {staff.isActive ? "Active" : "Deactivated"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Last seen {ageStr(staff.lastSeenAt)} ·{" "}
            {staff.isDutyOn ? "On duty" : "Off duty"}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact / Profile */}
        <Card className="p-5 space-y-3">
          <h3 className="flex items-center gap-2 font-semibold text-gray-800">
            <UserIcon className="w-4 h-4 text-healwin-600" />
            Contact &amp; Profile
          </h3>
          <InfoRow label="Mobile" value={staff.mobileNumber} icon={Phone} />
          {staff.email && <InfoRow label="Email" value={staff.email} />}
          {staff.role === "driver" && (
            <InfoRow
              label="License Number"
              value={staff.licenseNumber || "—"}
            />
          )}
          {staff.role === "attendant" &&
            staff.certifications &&
            staff.certifications.length > 0 && (
              <InfoRow
                label="Certifications"
                value={staff.certifications.join(", ")}
              />
            )}
          <InfoRow
            label={affiliationLabel}
            value={affiliationName}
            icon={Briefcase}
          />
        </Card>

        {/* Live status */}
        <Card className="p-5 space-y-3">
          <h3 className="flex items-center gap-2 font-semibold text-gray-800">
            <Radio className="w-4 h-4 text-healwin-600" />
            Live Status
          </h3>
          <InfoRow
            label="Duty"
            value={staff.isDutyOn ? "On Duty" : "Off Duty"}
            icon={Clock}
          />
          <InfoRow
            label="Last API contact"
            value={ageStr(staff.lastSeenAt)}
          />
          <InfoRow
            label="App attempted location ping"
            value={ageStr(staff.lastLocationAttemptAt)}
            valueClass={
              !staff.lastLocationAttemptAt
                ? "text-red-600 font-medium"
                : "text-gray-800"
            }
          />
          {ambulance ? (
            <InfoRow
              label="Vehicle location updated"
              value={ageStr(ambulance.lastLocationAt)}
              icon={MapPin}
              valueClass={
                locStale ? "text-red-600 font-medium" : "text-green-700"
              }
            />
          ) : staff.role === "driver" ? (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
              Not linked to any ambulance — location pings have nowhere to land.
            </p>
          ) : null}
          {/* Diagnostic banner: if the app IS trying but the vehicle's
              location still isn't updating, something between the ping
              and the DB write is broken (most often: backend not yet
              restarted with the latest controller change). */}
          {staff.lastLocationAttemptAt &&
            ambulance &&
            new Date(staff.lastLocationAttemptAt).getTime() >
              new Date(ambulance.lastLocationAt || 0).getTime() + 60_000 && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                App is sending pings but the vehicle's GPS isn't refreshing.
                Restart the backend — the role/assignment filter may be
                dropping the writes.
              </p>
            )}
          {!staff.lastLocationAttemptAt && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
              No location ping ever received from this staff's device. Check
              app install (foreground service), location permission, and that
              duty is toggled ON.
            </p>
          )}
        </Card>

        {/* Assigned ambulance */}
        <Card className="p-5 space-y-3">
          <h3 className="flex items-center gap-2 font-semibold text-gray-800">
            <Siren className="w-4 h-4 text-healwin-600" />
            Assigned Ambulance
          </h3>
          {ambulance ? (
            <>
              <InfoRow
                label="Registration"
                value={ambulance.registrationNumber}
              />
              {ambulance.ambulanceType && (
                <InfoRow
                  label="Type"
                  value={ambulance.ambulanceType.toUpperCase()}
                />
              )}
              <InfoRow
                label="Vehicle Status"
                value={ambulance.status.replace("_", " ").toUpperCase()}
                valueClass={
                  ambulance.status === "available"
                    ? "text-green-700 font-medium"
                    : ambulance.status === "on_dispatch"
                      ? "text-orange-700 font-medium"
                      : "text-gray-600"
                }
              />
              <InfoRow
                label="Provider"
                value={ambulance.providerId?.name || "—"}
              />
            </>
          ) : (
            <p className="text-sm text-gray-500">
              {staff.role === "driver"
                ? "No vehicle assigned to this driver. Go to Ambulances → edit a vehicle and set this staff as the assigned driver."
                : "Not currently assigned to any vehicle."}
            </p>
          )}
        </Card>
      </div>

      {/* Map */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-gray-800">
            <MapPin className="w-4 h-4 text-healwin-600" />
            Current Location
          </h3>
          {ambulance?.lastLocationAt && (
            <span
              className={`text-xs ${
                locStale ? "text-red-600" : "text-green-700"
              }`}
            >
              Updated {ageStr(ambulance.lastLocationAt)}
            </span>
          )}
        </div>
        {lat != null && lng != null ? (
          <div className="h-80">
            <MapContainer
              center={[lat, lng]}
              zoom={14}
              style={{ height: "100%", width: "100%" }}
              key={`${lat}-${lng}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[lat, lng]}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold">
                      {ambulance?.registrationNumber}
                    </p>
                    <p className="text-gray-600">
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </p>
                    <p className="text-gray-400">
                      {ageStr(ambulance?.lastLocationAt)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        ) : (
          <div className="h-60 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <MapPin className="w-10 h-10 opacity-40 mb-2" />
            <p className="text-sm">No location reported yet.</p>
            {staff.role === "driver" && !ambulance && (
              <p className="text-xs mt-1 text-red-500">
                Assign this driver to an ambulance first.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Recent dispatches */}
      <div>
        <div className="mb-3 flex items-center gap-2 font-semibold text-gray-800">
          <Siren className="w-4 h-4 text-healwin-600" />
          Recent Dispatches ({dispatches.length})
        </div>
        {dispatches.length === 0 ? (
          <Card className="p-8 text-center text-gray-400">
            <CheckCircle className="w-10 h-10 mx-auto opacity-40 mb-2" />
            <p className="text-sm">No dispatches assigned yet.</p>
          </Card>
        ) : (
          <Table>
            <THead>
              <Th>When</Th>
              <Th>Ambulance</Th>
              <Th>Distance / ETA</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {dispatches.map((d) => {
                const amb =
                  typeof d.ambulanceId === "object" ? d.ambulanceId : null;
                return (
                  <TR key={d._id}>
                    <Td className="text-gray-700">
                      {new Date(d.dispatchedAt).toLocaleString()}
                      <div className="text-xs text-gray-400">
                        {ageStr(d.dispatchedAt)}
                      </div>
                    </Td>
                    <Td>
                      {amb ? (
                        <div>
                          <span className="font-mono">
                            {amb.registrationNumber}
                          </span>
                          {amb.ambulanceType && (
                            <span className="ml-2 text-xs uppercase text-gray-500">
                              {amb.ambulanceType}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </Td>
                    <Td className="text-gray-700">
                      {d.roadDistanceKm != null
                        ? `${d.roadDistanceKm} km · ${d.etaMinutes ?? "?"} min`
                        : "—"}
                    </Td>
                    <Td>
                      <Badge tone={dispatchStatusTone(d.status)}>
                        {d.status.replace("_", " ")}
                      </Badge>
                    </Td>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-gray-500 mt-0.5">{label}</span>
      <span
        className={`text-sm text-right flex items-center gap-1 ${
          valueClass || "text-gray-800"
        }`}
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-gray-400" />}
        {value}
      </span>
    </div>
  );
}

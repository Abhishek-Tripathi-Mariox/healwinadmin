import React, { useEffect, useMemo, useState } from "react";
import { Plus, Calendar, AlertCircle, Loader2 } from "lucide-react";
import {
  shiftApi,
  providerApi,
  ambulanceApi,
  ambulanceStaffApi,
} from "../services/admin-api";
import {
  PageHeader,
  Button,
  Select,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
  Badge,
  Modal,
  Field,
  Input,
  Textarea,
  Alert,
} from "../components/ui";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

// Status pill tones.
const statusTone: Record<string, BadgeTone> = {
  scheduled: "info",
  active: "success",
  completed: "neutral",
  cancelled: "danger",
  missed: "warning",
};

interface ShiftRow {
  _id: string;
  status: string;
  role: "driver" | "attendant";
  startAt: string;
  endAt: string;
  clockInAt?: string;
  clockOutAt?: string;
  notes?: string;
  ambulanceId?: { _id: string; registrationNumber: string; ambulanceType: string };
  staffId?: { _id: string; fullName: string; mobileNumber: string; role: string };
  providerId?: { _id: string; name: string };
}

interface Provider {
  _id: string;
  name: string;
}

interface AmbulanceRow {
  _id: string;
  registrationNumber: string;
  ambulanceType: string;
  providerId?: { _id: string; name: string } | string;
}

interface StaffRow {
  _id: string;
  fullName: string;
  mobileNumber: string;
  role: "driver" | "attendant";
  providerId?: { _id: string; name: string } | string;
}

interface ListResponse<T> {
  data?: { items?: T[]; total?: number };
  rData?: { items?: T[]; total?: number };
}

const unwrap = <T,>(res: ListResponse<T>): T[] =>
  res?.data?.items ?? res?.rData?.items ?? [];

// "2026-05-27T10:30" (datetime-local picker output) → ISO with local TZ.
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

// Date helpers for the display.
const formatRange = (startISO: string, endISO: string) => {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const sameDay =
    start.toDateString() === end.toDateString() ? true : false;
  const dt = (d: Date) =>
    d.toLocaleString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const t = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return sameDay
    ? `${dt(start)} – ${t(end)}`
    : `${dt(start)} → ${dt(end)}`;
};

const ShiftManagement: React.FC = () => {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [ambulances, setAmbulances] = useState<AmbulanceRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Assign / reassign staff to a shift.
  const [assignFor, setAssignFor] = useState<ShiftRow | null>(null);
  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignErr, setAssignErr] = useState("");

  const [filters, setFilters] = useState({
    providerId: "",
    ambulanceId: "",
    staffId: "",
    role: "",
    status: "",
  });

  const fetchShifts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const res = (await shiftApi.list(params)) as ListResponse<ShiftRow>;
      setShifts(unwrap(res));
    } catch (e: any) {
      setError(e?.message || "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  };

  // One-time load of the form picker data. Re-fetched only when the page
  // mounts — these collections change much less frequently than the shift
  // table itself.
  const fetchPickers = async () => {
    try {
      const [p, a, s] = await Promise.all([
        providerApi.list({ limit: 200 }),
        ambulanceApi.list({ limit: 200 }),
        ambulanceStaffApi.list({ limit: 500 }),
      ]);
      setProviders(unwrap(p as ListResponse<Provider>));
      setAmbulances(unwrap(a as ListResponse<AmbulanceRow>));
      setStaff(unwrap(s as ListResponse<StaffRow>));
    } catch {
      /* picker failures non-fatal — user can still see existing shifts */
    }
  };

  useEffect(() => {
    fetchPickers();
    fetchShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const cancelShift = async (id: string) => {
    if (!window.confirm("Cancel this shift?")) return;
    try {
      await shiftApi.cancel(id);
      await fetchShifts();
    } catch (e: any) {
      window.alert(e?.message || "Failed to cancel");
    }
  };

  const openAssign = (s: ShiftRow) => {
    setAssignFor(s);
    setAssignStaffId(s.staffId?._id || "");
    setAssignErr("");
  };
  const saveAssign = async () => {
    if (!assignFor || !assignStaffId || assignBusy) return;
    setAssignBusy(true);
    setAssignErr("");
    try {
      await shiftApi.assignStaff(assignFor._id, assignStaffId);
      setAssignFor(null);
      await fetchShifts();
    } catch (e: any) {
      setAssignErr(e?.message || "Failed to assign");
    } finally {
      setAssignBusy(false);
    }
  };
  const unassignShift = async (s: ShiftRow) => {
    if (!window.confirm("Unassign staff from this shift?")) return;
    try {
      await shiftApi.unassignStaff(s._id);
      await fetchShifts();
    } catch (e: any) {
      window.alert(e?.message || "Failed to unassign");
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Shifts"
        subtitle="Roster paramedics onto ambulances by time window. The state machine promotes scheduled → active → completed automatically."
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
            New Shift
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select
          value={filters.providerId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, providerId: e.target.value }))
          }
          className="w-auto"
        >
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.ambulanceId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, ambulanceId: e.target.value }))
          }
          className="w-auto"
        >
          <option value="">All ambulances</option>
          {ambulances.map((a) => (
            <option key={a._id} value={a._id}>
              {a.registrationNumber} ({a.ambulanceType})
            </option>
          ))}
        </Select>
        <Select
          value={filters.staffId}
          onChange={(e) => setFilters((f) => ({ ...f, staffId: e.target.value }))}
          className="w-auto"
        >
          <option value="">All staff</option>
          {staff.map((s) => (
            <option key={s._id} value={s._id}>
              {s.fullName} · {s.role}
            </option>
          ))}
        </Select>
        <Select
          value={filters.role}
          onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
          className="w-auto"
        >
          <option value="">Any role</option>
          <option value="driver">Driver</option>
          <option value="attendant">Attendant</option>
        </Select>
        <Select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="w-auto"
        >
          <option value="">Any status</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="missed">Missed</option>
        </Select>
      </div>

      {error && (
        <Alert className="mb-4" tone="danger">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </span>
        </Alert>
      )}

      <Table>
        <THead>
          <Th>Status</Th>
          <Th>When</Th>
          <Th>Ambulance</Th>
          <Th>Staff</Th>
          <Th>Role</Th>
          <Th>Provider</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading && shifts.length === 0 ? (
            <TableState colSpan={7}>
              <Loader2 className="w-5 h-5 mx-auto animate-spin text-gray-400" />
            </TableState>
          ) : shifts.length === 0 ? (
            <TableState colSpan={7}>
              <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No shifts match the current filters.
            </TableState>
          ) : (
            shifts.map((s) => (
              <TR key={s._id}>
                <Td>
                  <Badge tone={statusTone[s.status] || "neutral"}>
                    {s.status}
                  </Badge>
                </Td>
                <Td className="text-gray-800">{formatRange(s.startAt, s.endAt)}</Td>
                <Td>
                  {s.ambulanceId
                    ? `${s.ambulanceId.registrationNumber} (${s.ambulanceId.ambulanceType})`
                    : "—"}
                </Td>
                <Td>
                  {s.staffId?.fullName || "—"}
                  {s.staffId?.mobileNumber && (
                    <span className="block text-xs text-gray-500">
                      +91 {s.staffId.mobileNumber}
                    </span>
                  )}
                </Td>
                <Td className="capitalize">{s.role}</Td>
                <Td>{s.providerId?.name || "—"}</Td>
                <Td className="text-right whitespace-nowrap">
                  {s.status === "scheduled" || s.status === "active" ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => openAssign(s)}>
                        {s.staffId ? "Reassign" : "Assign"}
                      </Button>
                      {s.staffId && (
                        <Button size="sm" variant="ghost" onClick={() => unassignShift(s)}>
                          Unassign
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => cancelShift(s._id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      {showCreate && (
        <CreateShiftModal
          providers={providers}
          ambulances={ambulances}
          staff={staff}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await fetchShifts();
          }}
        />
      )}

      {/* Assign / reassign staff to a shift. Only same-role crew are offered —
          a shift's role (driver/attendant) is fixed at creation. */}
      <Modal
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        title={assignFor?.staffId ? "Reassign shift" : "Assign shift"}
        subtitle={assignFor ? formatRange(assignFor.startAt, assignFor.endAt) : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignFor(null)}>Cancel</Button>
            <Button onClick={saveAssign} disabled={assignBusy || !assignStaffId}>
              {assignBusy ? "Saving…" : "Assign"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {assignErr && <Alert tone="danger">{assignErr}</Alert>}
          <Field label={`Select ${assignFor?.role || "staff"}`}>
            <Select value={assignStaffId} onChange={(e) => setAssignStaffId(e.target.value)}>
              <option value="">— Select —</option>
              {staff
                .filter((m) => !assignFor || m.role === assignFor.role)
                .map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.fullName} · {m.mobileNumber}
                  </option>
                ))}
            </Select>
          </Field>
          <p className="text-xs text-gray-500">
            Only {assignFor?.role || "matching"}s are shown — a shift's role is fixed.
          </p>
        </div>
      </Modal>
    </div>
  );
};

interface CreateShiftModalProps {
  providers: Provider[];
  ambulances: AmbulanceRow[];
  staff: StaffRow[];
  onClose: () => void;
  onCreated: () => void;
}

const CreateShiftModal: React.FC<CreateShiftModalProps> = ({
  providers,
  ambulances,
  staff,
  onClose,
  onCreated,
}) => {
  const [providerId, setProviderId] = useState("");
  const [ambulanceId, setAmbulanceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [role, setRole] = useState<"driver" | "attendant">("driver");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Narrow the ambulance + staff lists once a provider is picked. Saves
  // the admin from having to scan a long dropdown.
  const filteredAmbulances = useMemo(() => {
    if (!providerId) return ambulances;
    return ambulances.filter((a) => {
      const pid =
        typeof a.providerId === "string" ? a.providerId : a.providerId?._id;
      return pid === providerId;
    });
  }, [providerId, ambulances]);

  const filteredStaff = useMemo(() => {
    const byProvider = providerId
      ? staff.filter((s) => {
          const pid =
            typeof s.providerId === "string" ? s.providerId : s.providerId?._id;
          return pid === providerId;
        })
      : staff;
    return byProvider.filter((s) => s.role === role);
  }, [providerId, role, staff]);

  // Pre-fill 8-hour window starting at the next round hour so the admin
  // can submit without touching the date picker for the common case.
  useEffect(() => {
    const next = new Date();
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    const end = new Date(next.getTime() + 8 * 60 * 60 * 1000);
    const toLocal = (d: Date) => {
      const off = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - off).toISOString().slice(0, 16);
    };
    setStartAt(toLocal(next));
    setEndAt(toLocal(end));
  }, []);

  const submit = async () => {
    if (!ambulanceId || !staffId || !role || !startAt || !endAt) {
      setErr("Please fill every field.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await shiftApi.create({
        ambulanceId,
        staffId,
        role,
        startAt: toIso(startAt),
        endAt: toIso(endAt),
        notes: notes || undefined,
      });
      onCreated();
    } catch (e: any) {
      // Surface the backend hint where present — "staff_overlap" vs
      // "ambulance_role_overlap" tell the admin exactly what to change.
      const raw = e?.message || "";
      const map: Record<string, string> = {
        staff_overlap:
          "This staff member already has a shift during this window.",
        ambulance_role_overlap: `This ambulance already has a ${role} shift during this window.`,
        staff_role_mismatch:
          "Selected staff member's role doesn't match the requested role.",
        staff_provider_mismatch:
          "Selected staff member belongs to a different provider than the ambulance.",
        end_before_start: "End time must be after start time.",
      };
      setErr(map[raw] || raw || "Could not create shift");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New Shift"
      size="md"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            onClick={submit}
          >
            Create shift
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider">
            <Select
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                setAmbulanceId("");
                setStaffId("");
              }}
            >
              <option value="">All providers</option>
              {providers.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Role">
            <Select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as "driver" | "attendant");
                setStaffId("");
              }}
            >
              <option value="driver">Driver</option>
              <option value="attendant">Attendant</option>
            </Select>
          </Field>
        </div>
        <Field label="Ambulance">
          <Select
            value={ambulanceId}
            onChange={(e) => setAmbulanceId(e.target.value)}
          >
            <option value="">Select an ambulance</option>
            {filteredAmbulances.map((a) => (
              <option key={a._id} value={a._id}>
                {a.registrationNumber} ({a.ambulanceType})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Staff member">
          <Select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            <option value="">Select a {role}</option>
            {filteredStaff.map((s) => (
              <option key={s._id} value={s._id}>
                {s.fullName} (+91 {s.mobileNumber})
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </Field>
          <Field label="End">
            <Input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Special instructions for the crew…"
          />
        </Field>
        {err && (
          <Alert tone="danger">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {err}
            </span>
          </Alert>
        )}
      </div>
    </Modal>
  );
};

export default ShiftManagement;

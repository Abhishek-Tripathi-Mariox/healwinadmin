import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Eye,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserPlus,
  Users,
  AlertCircle,
} from "lucide-react";
import {
  ambulanceApi,
  ambulanceStaffApi,
  hospitalApi,
  shiftApi,
} from "../services/admin-api";
import SearchableSelect from "../components/SearchableSelect";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  Button,
  Card,
  Badge,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
  Alert,
  Spinner,
} from "../components/ui";

interface Hospital {
  _id: string;
  name: string;
  type: string;
  address: string;
  phone?: string;
  state?: { _id: string; name: string };
  district?: { _id: string; name: string };
}

interface StaffRow {
  _id: string;
  fullName: string;
  mobileNumber: string;
  role: string;
  email?: string;
  gender?: string;
  isOnline: boolean;
  isDutyOn: boolean;
  providerId?: { _id: string; name: string } | string;
}

interface SingleResponse<T> {
  data?: T;
  rData?: T;
}

interface ListResponse<T> {
  data?: { items?: T[] };
  rData?: { items?: T[] };
}

const unwrapOne = <T,>(res: SingleResponse<T>): T | undefined =>
  res?.data ?? res?.rData;

const unwrapList = <T,>(res: ListResponse<T>): T[] =>
  res?.data?.items ?? res?.rData?.items ?? [];

interface ShiftRow {
  _id: string;
  status: string;
  role: string;
  startAt: string;
  endAt: string;
  ambulanceId?: { _id: string; registrationNumber: string; ambulanceType: string };
  staffId?: { _id: string; fullName: string };
}

interface AmbulanceOption {
  _id: string;
  registrationNumber: string;
  ambulanceType: string;
  providerId?: { _id: string; name: string } | string;
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const shiftStatusTone: Record<string, BadgeTone> = {
  scheduled: "info",
  active: "success",
  completed: "neutral",
  cancelled: "danger",
  missed: "warning",
};

const formatShiftRange = (startISO: string, endISO: string) => {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const sameDay = start.toDateString() === end.toDateString();
  const fmt = (d: Date) =>
    d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const time = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `${fmt(start)} – ${time(end)}` : `${fmt(start)} → ${fmt(end)}`;
};

const HospitalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreateStaff = hasPermission(PERMISSIONS.STAFF_CREATE);
  const canUpdateStaff = hasPermission(PERMISSIONS.STAFF_UPDATE);
  const canDeleteStaff = hasPermission(PERMISSIONS.STAFF_DELETE);
  const canManageShifts = hasPermission(PERMISSIONS.AMBULANCE_SHIFTS_MANAGE);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);
  // Drilling into a single staff row opens a drawer with their shifts +
  // a "Schedule shifts" action that supports bulk creation.
  const [openStaff, setOpenStaff] = useState<StaffRow | null>(null);
  const [editStaff, setEditStaff] = useState<StaffRow | null>(null);
  // Shift Assign / Edit overlays.
  const [assignShift, setAssignShift] = useState<ShiftRow | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = (await hospitalApi.detail(id)) as SingleResponse<{
        hospital: Hospital;
        staff: StaffRow[];
      }>;
      const d = unwrapOne(res);
      if (!d?.hospital) {
        setError("Hospital not found.");
        return;
      }
      setHospital(d.hospital);
      setStaff(d.staff ?? []);
      // Shifts load is best-effort; we don't want a shift-list failure to
      // hide the whole hospital page. Surface load issues only at the
      // shifts section if needed.
      try {
        const shiftRes = (await shiftApi.list({
          hospitalId: id,
          limit: 100,
        })) as ListResponse<ShiftRow>;
        setShifts(unwrapList(shiftRes));
      } catch {
        setShifts([]);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load hospital");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const removeStaff = async (staffId: string) => {
    if (!id) return;
    if (!window.confirm("Remove this person from the hospital?")) return;
    try {
      await hospitalApi.removeStaff(id, staffId);
      await load();
    } catch (e: any) {
      window.alert(e?.message || "Could not remove staff");
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Spinner className="mx-auto" />
      </div>
    );
  }

  if (error || !hospital) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center mb-4 text-sm text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>
        <Alert tone="danger">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error ?? "Hospital not found"}
          </span>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center mb-4 text-sm text-gray-600 hover:text-gray-800"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Hospitals
      </button>

      <Card padded className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start min-w-0 space-x-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-healwin-50 flex-shrink-0">
              <Building2 className="w-6 h-6 text-healwin-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-800 truncate">
                {hospital.name}
              </h1>
              <p className="flex items-center mt-1 text-sm text-gray-500">
                <MapPin className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                {[hospital.address, hospital.district?.name, hospital.state?.name]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {hospital.phone && (
                <p className="flex items-center mt-1 text-sm text-gray-500">
                  <Phone className="w-3.5 h-3.5 mr-1" />
                  {hospital.phone}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">
          Staff ({staff.length})
        </h2>
        {canCreateStaff && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAdd(true)}>
            Add Staff
          </Button>
        )}
      </div>

      <Card>
        {staff.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <UserPlus className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No staff assigned yet.</p>
            <p className="text-xs mt-1">
              Click "Add Staff" to register a paramedic or MT.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {staff.map((s) => (
              <li
                key={s._id}
                onClick={() => setOpenStaff(s)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="font-semibold text-gray-800 truncate">
                      {s.fullName}
                    </p>
                    <Badge tone={s.isOnline ? "success" : "neutral"} dot>
                      {s.isOnline ? "Online" : "Offline"}
                    </Badge>
                    {s.isDutyOn && <Badge tone="info">On duty</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    +91 {s.mobileNumber} · {s.role}
                    {s.email && ` · ${s.email}`}
                  </p>
                </div>
                <div className="flex items-center pl-3 space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenStaff(s);
                    }}
                    className="p-2 text-gray-500 rounded hover:bg-gray-100 hover:text-healwin-600"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canUpdateStaff && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditStaff(s);
                      }}
                      className="p-2 text-gray-500 rounded hover:bg-gray-100 hover:text-healwin-600"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canDeleteStaff && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStaff(s._id);
                      }}
                      className="p-2 text-red-500 rounded hover:bg-red-50"
                      title="Remove from hospital"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Shifts section. Lists every shift whose staff is employed by
          this hospital, regardless of which provider operates the
          ambulance. "Add shift" opens a modal scoped to this hospital's
          attendants — admin doesn't have to leave the hospital context
          to schedule a roster. */}
      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="text-lg font-semibold text-gray-800">
          Shifts ({shifts.length})
        </h2>
        {canManageShifts && (
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddShift(true)}
            disabled={staff.length === 0}
            title={
              staff.length === 0
                ? "Add at least one staff member first"
                : "Schedule a shift"
            }
          >
            Add Shift
          </Button>
        )}
      </div>

      <Card>
        {shifts.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No shifts scheduled.</p>
            <p className="text-xs mt-1">
              Click "Add Shift" to roster a paramedic onto an ambulance.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {shifts.map((s) => {
              const unassigned = !s.staffId;
              return (
                <li key={s._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <Badge tone={shiftStatusTone[s.status] || "neutral"}>
                          {s.status}
                        </Badge>
                        {unassigned ? (
                          <Badge tone="warning">Open slot</Badge>
                        ) : (
                          <p className="font-semibold text-gray-800 truncate">
                            {s.staffId?.fullName}
                          </p>
                        )}
                        <span className="text-xs text-gray-400 capitalize">
                          · {s.role}
                        </span>
                      </div>
                      <p className="flex items-center mt-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatShiftRange(s.startAt, s.endAt)}
                      </p>
                      {s.ambulanceId && (
                        <p className="mt-1 text-xs text-gray-500">
                          {s.ambulanceId.registrationNumber} (
                          {s.ambulanceId.ambulanceType})
                        </p>
                      )}
                    </div>
                    {unassigned && canManageShifts && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="ml-3"
                        icon={<Users className="w-3.5 h-3.5" />}
                        onClick={() => setAssignShift(s)}
                      >
                        Assign
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {showAdd && id && (
        <AddStaffModal
          hospitalId={id}
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await load();
          }}
        />
      )}

      {showAddShift && id && hospital && (
        <AddShiftModal
          hospitalId={id}
          hospitalName={hospital.name}
          attendants={staff.filter((s) => s.role === "attendant")}
          onClose={() => setShowAddShift(false)}
          onCreated={async () => {
            setShowAddShift(false);
            await load();
          }}
        />
      )}

      {openStaff && (
        <StaffShiftDrawer
          staff={openStaff}
          hospitalShifts={shifts}
          onClose={() => setOpenStaff(null)}
          onShiftsChanged={load}
          canManageShifts={canManageShifts}
        />
      )}

      {editStaff && (
        <EditStaffModal
          staff={editStaff}
          onClose={() => setEditStaff(null)}
          onSaved={async () => {
            setEditStaff(null);
            await load();
          }}
        />
      )}

      {assignShift && (
        <AssignShiftModal
          shift={assignShift}
          attendants={staff.filter((s) => s.role === "attendant")}
          onClose={() => setAssignShift(null)}
          onAssigned={async () => {
            setAssignShift(null);
            await load();
          }}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------

interface AddStaffModalProps {
  hospitalId: string;
  onClose: () => void;
  onCreated: () => void;
}

const AddStaffModal: React.FC<AddStaffModalProps> = ({
  hospitalId,
  onClose,
  onCreated,
}) => {
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Validate inline: name + a real 10-digit mobile. The backend forces
  // role=attendant and links to this hospital — no service-provider
  // picker is needed because hospital staff aren't tied to ambulance
  // operators.
  const canSubmit = useMemo(
    () =>
      fullName.trim().length > 0 &&
      /^[6-9]\d{9}$/.test(mobileNumber.trim()) &&
      !busy,
    [fullName, mobileNumber, busy],
  );

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await hospitalApi.createStaff(hospitalId, {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        email: email.trim() || undefined,
        gender: gender || undefined,
      });
      onCreated();
    } catch (e: any) {
      // 11000 duplicate-key on (mobileNumber, countryCode) is the common
      // case here — the staff member exists elsewhere and needs to be
      // moved via Assign, not created fresh.
      const raw = e?.message || "";
      setErr(
        raw.includes("duplicate")
          ? "A staff member with this mobile number already exists. Use the Assign action to move them here instead."
          : raw || "Could not create staff",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add staff to hospital"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            Add staff
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Full name">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Pooja Bhatt"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mobile (10 digit)">
            <Input
              inputMode="numeric"
              value={mobileNumber}
              onChange={(e) =>
                setMobileNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="9XXXXXXXXX"
            />
          </Field>
          <Field label="Gender">
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </Select>
          </Field>
        </div>
        <Field label="Email (optional)">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="paramedic@example.com"
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

// ----------------------------------------------------------------------

interface AddShiftModalProps {
  hospitalId: string;
  hospitalName: string;
  attendants: StaffRow[];
  onClose: () => void;
  onCreated: () => void;
}

const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

/**
 * Schedule a shift for a hospital attendant. Different from the global
 * ShiftManagement modal in two ways:
 *   1. The staff dropdown is scoped to this hospital — no risk of
 *      picking a paramedic who works at a different hospital.
 *   2. The ambulance dropdown spans every provider, because hospital
 *      attendants aren't tied to one ambulance fleet.
 */
const AddShiftModal: React.FC<AddShiftModalProps> = ({
  // hospitalId is part of the props interface but this modal scopes
  // ambulance + attendant selection to all-hospitals and the staff
  // table on the parent — the id isn't needed inside this component.
  hospitalId: _hospitalId,
  hospitalName,
  attendants,
  onClose,
  onCreated,
}) => {
  const [ambulances, setAmbulances] = useState<AmbulanceOption[]>([]);
  const [ambulanceId, setAmbulanceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Default the staff selection to the only attendant when there's just
  // one — the admin is most likely scheduling that person again.
  useEffect(() => {
    if (attendants.length === 1) setStaffId(attendants[0]._id);
  }, [attendants]);

  // Pre-fill an 8-hour window starting at the next round hour. Mirrors
  // the global ShiftManagement modal so the muscle memory is the same.
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

  useEffect(() => {
    (async () => {
      try {
        const res = (await ambulanceApi.list({
          limit: 500,
        })) as ListResponse<AmbulanceOption>;
        setAmbulances(unwrapList(res));
      } catch {
        /* user can refresh */
      }
    })();
  }, []);

  // Attendant is OPTIONAL — admin can leave the field blank to create
  // an "open slot" that gets assigned later via the row's Assign button.
  const canSubmit = useMemo(
    () =>
      ambulanceId.length > 0 &&
      startAt.length > 0 &&
      endAt.length > 0 &&
      !busy,
    [ambulanceId, startAt, endAt, busy],
  );

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await shiftApi.create({
        ambulanceId,
        staffId: staffId || undefined,
        role: "attendant",
        startAt: toIso(startAt),
        endAt: toIso(endAt),
        notes: notes || undefined,
      });
      onCreated();
    } catch (e: any) {
      const raw = e?.message || "";
      const map: Record<string, string> = {
        staff_overlap:
          "This attendant already has a shift during this window.",
        ambulance_role_overlap:
          "This ambulance already has an attendant scheduled for this window.",
        end_before_start: "End time must be after start time.",
      };
      setErr(map[raw] || raw || "Could not schedule shift");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Schedule shift"
      subtitle={`For staff at ${hospitalName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            Schedule shift
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {attendants.length === 0 && (
          <Alert tone="warning">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              No attendants in this hospital yet. Add staff first.
            </span>
          </Alert>
        )}
        <Field label="Attendant (optional — leave blank for an open slot)">
          <SearchableSelect
            value={staffId}
            onChange={setStaffId}
            placeholder="Leave blank to schedule an open slot"
            disabled={attendants.length === 0}
            valueField="_id"
            displayField="name"
            // Synthesise a search-friendly label "Name +91 mobile"
            // — the existing SearchableSelect filters by displayField,
            // so packing the mobile into the same field makes typing
            // either name or phone work.
            options={attendants.map((s) => ({
              _id: s._id,
              name: `${s.fullName} (+91 ${s.mobileNumber})`,
            }))}
          />
        </Field>
        <Field label="Ambulance">
          <SearchableSelect
            value={ambulanceId}
            onChange={setAmbulanceId}
            placeholder="Search ambulances…"
            valueField="_id"
            displayField="name"
            options={ambulances.map((a) => ({
              _id: a._id,
              name: `${a.registrationNumber} (${a.ambulanceType})`,
            }))}
          />
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

// ----------------------------------------------------------------------

interface StaffShiftDrawerProps {
  staff: StaffRow;
  hospitalShifts: ShiftRow[];
  onClose: () => void;
  onShiftsChanged: () => Promise<void> | void;
  canManageShifts: boolean;
}

/**
 * Side-drawer for one staff member. Lists THEIR shifts only (filtered
 * from the hospital's set) and opens a bulk-shift modal so admins can
 * roster, say, "Pooja for Mon/Wed/Fri 7-3" in a single submit instead
 * of three trips through the single-shift form.
 */
const StaffShiftDrawer: React.FC<StaffShiftDrawerProps> = ({
  staff,
  hospitalShifts,
  onClose,
  onShiftsChanged,
  canManageShifts,
}) => {
  const [showBulk, setShowBulk] = useState(false);

  const mine = useMemo(
    () =>
      hospitalShifts.filter(
        (s) => String(s.staffId?._id ?? "") === String(staff._id),
      ),
    [hospitalShifts, staff._id],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-gray-900/50 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {staff.fullName}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              +91 {staff.mobileNumber} · {staff.role}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">
            Shifts ({mine.length})
          </p>
          {canManageShifts && (
            <Button
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowBulk(true)}
            >
              Schedule shifts
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {mine.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No shifts scheduled.</p>
              <p className="mt-1 text-xs">
                Click "Schedule shifts" to roster this person.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {mine.map((s) => (
                <li key={s._id} className="p-4">
                  <div className="flex items-center space-x-2">
                    <Badge tone={shiftStatusTone[s.status] || "neutral"}>
                      {s.status}
                    </Badge>
                    {s.ambulanceId && (
                      <span className="text-xs text-gray-600">
                        {s.ambulanceId.registrationNumber}
                      </span>
                    )}
                  </div>
                  <p className="flex items-center mt-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatShiftRange(s.startAt, s.endAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showBulk && (
        <BulkShiftModal
          staff={staff}
          onClose={() => setShowBulk(false)}
          onCreated={async () => {
            setShowBulk(false);
            await onShiftsChanged();
          }}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------

interface BulkShiftRow {
  ambulanceId: string;
  startAt: string;
  endAt: string;
}

interface BulkShiftModalProps {
  staff: StaffRow;
  onClose: () => void;
  onCreated: () => void;
}

const toLocal = (d: Date) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

const makeRow = (offsetDays = 0): BulkShiftRow => {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
  return { ambulanceId: "", startAt: toLocal(start), endAt: toLocal(end) };
};

/**
 * Schedule N shifts for a single staff member in one submit. The rows
 * post sequentially so an early conflict failure surfaces the specific
 * row that broke — partial successes stay (we don't rollback) which is
 * the right call for shift rosters: if rows 1-3 saved and row 4 hit a
 * staff_overlap, the admin keeps 1-3 and fixes 4.
 */
const BulkShiftModal: React.FC<BulkShiftModalProps> = ({
  staff,
  onClose,
  onCreated,
}) => {
  const [ambulances, setAmbulances] = useState<AmbulanceOption[]>([]);
  const [rows, setRows] = useState<BulkShiftRow[]>([makeRow(0)]);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<number, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = (await ambulanceApi.list({
          limit: 500,
        })) as ListResponse<AmbulanceOption>;
        setAmbulances(unwrapList(res));
      } catch {
        /* user can refresh */
      }
    })();
  }, []);

  const ambulanceOptions = useMemo(
    () =>
      ambulances.map((a) => ({
        _id: a._id,
        name: `${a.registrationNumber} (${a.ambulanceType})`,
      })),
    [ambulances],
  );

  const updateRow = (idx: number, patch: Partial<BulkShiftRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    // Next row defaults to the day after the last row, so weekly
    // rosters fall in naturally without re-picking dates each time.
    setRows((prev) => [...prev, makeRow(prev.length)]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setErrs((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const canSubmit =
    !busy &&
    rows.length > 0 &&
    rows.every(
      (r) => r.ambulanceId && r.startAt && r.endAt,
    );

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErrs({});
    const newErrs: Record<number, string> = {};
    let succeeded = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        await shiftApi.create({
          ambulanceId: r.ambulanceId,
          staffId: staff._id,
          role: "attendant",
          startAt: new Date(r.startAt).toISOString(),
          endAt: new Date(r.endAt).toISOString(),
        });
        succeeded += 1;
      } catch (e: any) {
        const raw = e?.message || "";
        const map: Record<string, string> = {
          staff_overlap: "Attendant already has a shift in this window.",
          ambulance_role_overlap:
            "Ambulance already has an attendant in this window.",
          end_before_start: "End must be after start.",
        };
        newErrs[i] = map[raw] || raw || "Could not schedule";
      }
    }
    setBusy(false);
    setErrs(newErrs);
    // If every row succeeded, close. Otherwise stay open so the admin
    // can fix the rows that errored. Partial successes are NOT rolled
    // back — the admin keeps what they got.
    if (Object.keys(newErrs).length === 0 && succeeded > 0) {
      onCreated();
    } else if (succeeded > 0) {
      // Strip the rows that succeeded so the modal only shows what's
      // left to fix.
      setRows((prev) => prev.filter((_, i) => newErrs[i] !== undefined));
      const remapped: Record<number, string> = {};
      const failedIdxs = Object.keys(newErrs)
        .map(Number)
        .sort((a, b) => a - b);
      failedIdxs.forEach((origIdx, newIdx) => {
        remapped[newIdx] = newErrs[origIdx];
      });
      setErrs(remapped);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Schedule shifts"
      subtitle={`For ${staff.fullName} (${rows.length} ${rows.length === 1 ? "row" : "rows"})`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            Schedule {rows.length} {rows.length === 1 ? "shift" : "shifts"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`p-3 border rounded-lg ${errs[i] ? "border-red-300 bg-red-50" : "border-gray-200"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500">
                Shift {i + 1}
              </span>
              {rows.length > 1 && (
                <button
                  onClick={() => removeRow(i)}
                  className="p-1 text-red-500 rounded hover:bg-red-100"
                  title="Remove row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              <Field label="Ambulance">
                <SearchableSelect
                  value={r.ambulanceId}
                  onChange={(v) => updateRow(i, { ambulanceId: v })}
                  placeholder="Search ambulances…"
                  valueField="_id"
                  displayField="name"
                  options={ambulanceOptions}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start">
                  <Input
                    type="datetime-local"
                    value={r.startAt}
                    onChange={(e) => updateRow(i, { startAt: e.target.value })}
                  />
                </Field>
                <Field label="End">
                  <Input
                    type="datetime-local"
                    value={r.endAt}
                    onChange={(e) => updateRow(i, { endAt: e.target.value })}
                  />
                </Field>
              </div>
              {errs[i] && (
                <div className="flex items-center mt-2 text-xs text-red-700">
                  <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                  <span>{errs[i]}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        <button
          onClick={addRow}
          disabled={busy}
          className="flex items-center justify-center w-full py-2 space-x-2 text-sm text-healwin-600 border-2 border-dashed border-healwin-200 rounded-lg hover:bg-healwin-50"
        >
          <Plus className="w-4 h-4" />
          <span>Add another shift</span>
        </button>
      </div>
    </Modal>
  );
};

// ----------------------------------------------------------------------

interface EditStaffModalProps {
  staff: StaffRow;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edit a hospital staff member's editable fields. Hits the global
 * /admin/ambulance-staff/:id endpoint — the hospital-scoped controller
 * doesn't have an update verb because the field set is identical
 * across roles, so we reuse the canonical staff update.
 *
 * Mobile number is intentionally NOT editable here — changing the
 * primary identifier mid-session would orphan FCM tokens and break the
 * "Move staff" flow that uses mobile as the lookup key. Admin must
 * remove + re-add to change the number.
 */
const EditStaffModal: React.FC<EditStaffModalProps> = ({
  staff,
  onClose,
  onSaved,
}) => {
  const [fullName, setFullName] = useState(staff.fullName ?? "");
  const [email, setEmail] = useState(staff.email ?? "");
  const [gender, setGender] = useState(staff.gender ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => fullName.trim().length > 0 && !busy,
    [fullName, busy],
  );

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await ambulanceStaffApi.update(staff._id, {
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        gender: gender || undefined,
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit staff"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Full name">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </Field>
        <Field label="Mobile (read-only)">
          <Input value={`+91 ${staff.mobileNumber}`} disabled />
        </Field>
        <Field label="Email (optional)">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Gender">
          <Select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">—</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </Select>
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

// ----------------------------------------------------------------------

interface AssignShiftModalProps {
  shift: ShiftRow;
  attendants: StaffRow[];
  onClose: () => void;
  onAssigned: () => void;
}

/**
 * Quick "fill the open slot" overlay. Picks from this hospital's
 * attendants (filtered to the matching role of the shift). The backend
 * enforces conflict + role checks again so this UI only needs to
 * surface the result.
 */
const AssignShiftModal: React.FC<AssignShiftModalProps> = ({
  shift,
  attendants,
  onClose,
  onAssigned,
}) => {
  const [staffId, setStaffId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const options = useMemo(
    () =>
      attendants
        .filter((s) => s.role === shift.role)
        .map((s) => ({
          _id: s._id,
          name: `${s.fullName} (+91 ${s.mobileNumber})`,
        })),
    [attendants, shift.role],
  );

  const submit = async () => {
    if (!staffId) return;
    setBusy(true);
    setErr(null);
    try {
      await shiftApi.assignStaff(shift._id, staffId);
      onAssigned();
    } catch (e: any) {
      const raw = e?.message || "";
      const map: Record<string, string> = {
        staff_overlap:
          "This staff member already has a shift in this window.",
        staff_role_mismatch:
          "Selected staff member's role doesn't match the shift.",
        staff_provider_mismatch:
          "Driver belongs to a different service provider than the ambulance.",
        shift_terminal: "This shift can no longer be assigned (completed / cancelled / missed).",
      };
      setErr(map[raw] || raw || "Could not assign");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Assign attendant"
      subtitle={`${formatShiftRange(shift.startAt, shift.endAt)}${
        shift.ambulanceId ? ` · ${shift.ambulanceId.registrationNumber}` : ""
      }`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !staffId}
            icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
          >
            Assign
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {options.length === 0 ? (
          <Alert tone="warning">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              No {shift.role}s in this hospital. Add staff first.
            </span>
          </Alert>
        ) : (
          <Field label="Attendant">
            <SearchableSelect
              value={staffId}
              onChange={setStaffId}
              placeholder="Search attendants…"
              valueField="_id"
              displayField="name"
              options={options}
            />
          </Field>
        )}
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

export default HospitalDetail;

// An employee's own attendance — punch in, punch out, and see their record.
//
// Attendance for HR staff could previously only be entered by an admin, in
// bulk, after the fact — which makes the record a reconstruction rather than a
// measurement. Punching writes the same Attendance row HR and payroll already
// read, so it reaches the dashboard and the payslip with no separate pipeline.
import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, MapPin, Clock } from "lucide-react";
import { myAttendanceApi } from "../../services/admin-api";
import {
  PageHeader, Button, Card, Table, THead, TBody, TR, Th, Td, TableState,
  Badge, Alert,
} from "../../components/ui";

interface Row {
  _id: string;
  date: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  workedLabel?: string;
  overtimeLabel?: string;
  isLate?: boolean;
  checkInWithinGeofence?: boolean;
  remarks?: string;
}

interface Mine {
  linked: boolean;
  hint?: string;
  employee?: { employeeCode: string; fullName: string; department?: string; designation?: string };
  shift?: { name: string; startTime?: string; endTime?: string } | null;
  today?: Row | null;
  canPunchIn: boolean;
  canPunchOut: boolean;
  period?: { month: number; year: number; label: string };
  rows: Row[];
  summary?: {
    presentDays: number;
    absentDays: number;
    paidLeaveDays: number;
    lopDays: number;
    workedLabel: string;
    overtimeLabel: string;
  };
}

const statusTone: Record<string, "success" | "danger" | "warning" | "info" | "neutral"> = {
  present: "success",
  absent: "danger",
  half_day: "warning",
  leave: "info",
  holiday: "neutral",
  week_off: "neutral",
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

/**
 * Ask the browser where we are, but never hold up the punch for it.
 *
 * Location is recorded for HR, not enforced — so a denied permission, a slow
 * fix or a device without GPS must not stop someone marking the day they
 * actually worked.
 */
const getCoords = (): Promise<{ lat: number; lng: number } | undefined> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    const done = (v?: { lat: number; lng: number }) => resolve(v);
    const timer = setTimeout(() => done(undefined), 4000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        done({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        done(undefined);
      },
      { enableHighAccuracy: true, timeout: 4000 },
    );
  });

export default function MyAttendance() {
  const [data, setData] = useState<Mine | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await myAttendanceApi.mine();
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your attendance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // A live clock, so the time on the button is the time being recorded.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const punch = async (type: "in" | "out") => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const coords = await getCoords();
      const res = await myAttendanceApi.punch(type, coords);
      setNotice(
        res.data?.warning ||
          `Punched ${type} at ${res.data?.punchedAt}.` +
            (type === "out" && res.data?.workedLabel ? ` Worked ${res.data.workedLabel}.` : ""),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not punch ${type}.`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }

  // Someone whose login is not attached to an employee record — a pure system
  // account, say. Saying so beats an empty screen they cannot act on.
  if (data && !data.linked) {
    return (
      <div className="p-6">
        <PageHeader title="My Attendance" subtitle="Punch in and out, and see your own record" />
        <Alert tone="warning">{data.hint}</Alert>
      </div>
    );
  }

  const today = data?.today;

  return (
    <div className="p-6">
      <PageHeader
        title="My Attendance"
        subtitle={
          data?.employee
            ? `${data.employee.fullName} · ${data.employee.employeeCode}${data.employee.designation ? ` · ${data.employee.designation}` : ""}`
            : "Punch in and out, and see your own record"
        }
      />

      {error && <Alert className="mb-4">{error}</Alert>}
      {notice && <Alert tone="success" className="mb-4">{notice}</Alert>}

      {/* ── Today ─────────────────────────────────────────────────────────── */}
      <Card padded className="mb-6">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Now</p>
            <p className="text-3xl font-semibold tabular-nums text-gray-900">
              {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
            <p className="text-xs text-gray-500">
              {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>

          <div className="h-12 w-px bg-gray-200" />

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500">Punched in</span>
              <div className="font-medium text-gray-900">{today?.checkIn || "—"}</div>
            </div>
            <div>
              <span className="text-gray-500">Punched out</span>
              <div className="font-medium text-gray-900">{today?.checkOut || "—"}</div>
            </div>
            {data?.shift && (
              <div className="col-span-2 text-xs text-gray-500">
                <Clock className="mr-1 inline h-3 w-3" />
                {data.shift.name}
                {data.shift.startTime && ` · ${data.shift.startTime}–${data.shift.endTime}`}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {data?.canPunchIn && (
              <Button onClick={() => punch("in")} disabled={busy} icon={<LogIn className="h-4 w-4" />}>
                {busy ? "Recording…" : "Punch in"}
              </Button>
            )}
            {data?.canPunchOut && (
              <Button
                variant="danger"
                onClick={() => punch("out")}
                disabled={busy}
                icon={<LogOut className="h-4 w-4" />}
              >
                {busy ? "Recording…" : "Punch out"}
              </Button>
            )}
            {!data?.canPunchIn && !data?.canPunchOut && (
              <Badge tone="success">Day complete</Badge>
            )}
          </div>
        </div>

        {today?.checkInWithinGeofence === false && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
            <MapPin className="h-3.5 w-3.5" />
            Your punch-in was recorded away from a registered work location. HR
            can see this; it does not affect your attendance being counted.
          </p>
        )}
      </Card>

      {/* ── This period ───────────────────────────────────────────────────── */}
      {data?.summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Present", data.summary.presentDays],
            ["Leave", data.summary.paidLeaveDays],
            ["Absent", data.summary.absentDays],
            ["Loss of pay", data.summary.lopDays],
            ["Hours worked", data.summary.workedLabel],
          ].map(([k, v]) => (
            <Card key={String(k)} className="p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">{k}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{v}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-700">My record</h2>
        {data?.period && (
          <span className="text-xs text-gray-400">{data.period.label}</span>
        )}
      </div>

      <Table>
        <THead>
          <Th>Date</Th><Th>Status</Th><Th>In</Th><Th>Out</Th>
          <Th>Worked</Th><Th>Overtime</Th><Th>Notes</Th>
        </THead>
        <TBody>
          {!data?.rows?.length ? (
            <TableState colSpan={7}>
              Nothing recorded in this period yet. Punch in to start the day.
            </TableState>
          ) : (
            data.rows.map((r) => (
              <TR key={r._id}>
                <Td className="whitespace-nowrap text-gray-700">{fmtDay(r.date)}</Td>
                <Td>
                  <Badge tone={statusTone[r.status] || "neutral"}>
                    {r.status.replace("_", " ")}
                  </Badge>
                </Td>
                <Td className="text-gray-600">
                  {r.checkIn || "—"}
                  {r.isLate && (
                    <span className="ml-1.5 text-[11px] font-medium text-amber-600">late</span>
                  )}
                </Td>
                <Td className="text-gray-600">{r.checkOut || "—"}</Td>
                <Td className="text-gray-600">{r.workedLabel || "—"}</Td>
                <Td className="text-gray-600">{r.overtimeLabel || "—"}</Td>
                <Td className="text-xs text-gray-500">{r.remarks || "—"}</Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { doctorScheduleApi } from "../services/admin-api";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../components/ui";

interface DoctorRow {
  _id: string;
  fullName: string;
  speciality?: string;
  hasSchedule: boolean;
  windowCount: number;
  slotMinutes: number;
  isActive: boolean;
}
interface Window { weekday: number; start: string; end: string }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DoctorScheduleManagement() {
  const [rows, setRows] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [editFor, setEditFor] = useState<DoctorRow | null>(null);
  const [slotMinutes, setSlotMinutes] = useState(15);
  const [windows, setWindows] = useState<Window[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await doctorScheduleApi.listDoctors();
      setRows(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = async (d: DoctorRow) => {
    setEditFor(d);
    setError("");
    try {
      const res = await doctorScheduleApi.get(d._id);
      const s = res.data?.schedule;
      setSlotMinutes(s?.slotMinutes || 15);
      setWindows(Array.isArray(s?.windows) ? s.windows : []);
      setIsActive(s?.isActive !== false);
    } catch {
      setSlotMinutes(15);
      setWindows([]);
      setIsActive(true);
    }
  };

  const addWindow = () => setWindows((w) => [...w, { weekday: 1, start: "09:00", end: "13:00" }]);
  const setWindow = (i: number, patch: Partial<Window>) =>
    setWindows((w) => w.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeWindow = (i: number) => setWindows((w) => w.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!editFor || saving) return;
    for (const w of windows) {
      if (!w.start || !w.end || w.start >= w.end) {
        setError("Each window needs a start time earlier than its end time.");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await doctorScheduleApi.save(editFor._id, { slotMinutes, windows, isActive });
      setEditFor(null);
      load();
    } catch (e: any) {
      setError(e.message || "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Doctor Availability"
        subtitle="Set each doctor's weekly OPD hours — the patient app turns these into bookable slots (no double-booking, no out-of-hours bookings)"
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />

      <Table>
        <THead>
          <Th>Doctor</Th><Th>Speciality</Th><Th>Schedule</Th><Th>Slot</Th><Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading && rows.length === 0 ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : rows.length === 0 ? (
            <TableState colSpan={5}>No doctors found. Add doctor-role admins first.</TableState>
          ) : (
            rows.map((d) => (
              <TR key={d._id}>
                <Td className="font-medium text-gray-900">{d.fullName}</Td>
                <Td className="text-gray-500">{d.speciality || "—"}</Td>
                <Td>
                  {d.hasSchedule ? (
                    <Badge tone={d.isActive ? "success" : "neutral"}>
                      {d.windowCount} window{d.windowCount === 1 ? "" : "s"}{d.isActive ? "" : " (off)"}
                    </Badge>
                  ) : (
                    <Badge tone="warning">Not set</Badge>
                  )}
                </Td>
                <Td className="text-gray-500">{d.slotMinutes} min</Td>
                <Td className="text-right">
                  <Button size="sm" onClick={() => openEdit(d)}>{d.hasSchedule ? "Edit" : "Set hours"}</Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Modal
        open={!!editFor}
        onClose={() => setEditFor(null)}
        title={`Availability — ${editFor?.fullName || ""}`}
        subtitle="Weekly OPD hours"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditFor(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slot length (minutes)">
              <Input type="number" value={String(slotMinutes)} onChange={(e) => setSlotMinutes(Number(e.target.value) || 15)} />
            </Field>
            <Field label="Active">
              <select
                value={isActive ? "1" : "0"}
                onChange={(e) => setIsActive(e.target.value === "1")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="1">Yes — bookable</option>
                <option value="0">No — paused</option>
              </select>
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Weekly windows</span>
              <Button size="sm" variant="secondary" onClick={addWindow}>+ Add window</Button>
            </div>
            {windows.length === 0 && (
              <p className="text-xs text-gray-400">No windows yet. Add one (e.g. Mon 09:00–13:00).</p>
            )}
            <div className="space-y-2">
              {windows.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={w.weekday}
                    onChange={(e) => setWindow(i, { weekday: Number(e.target.value) })}
                    className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  >
                    {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                  </select>
                  <input
                    type="time"
                    value={w.start}
                    onChange={(e) => setWindow(i, { start: e.target.value })}
                    className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="time"
                    value={w.end}
                    onChange={(e) => setWindow(i, { end: e.target.value })}
                    className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  />
                  <button
                    onClick={() => removeWindow(i)}
                    className="ml-auto text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

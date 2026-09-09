// Shift master (§3) — defines the shifts themselves. The per-day roster of
// who works which shift lives in Employee Shifts.
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { workShiftApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import {
  PageHeader, Button, Card, Table, THead, TBody, TR, Th, Td, TableState,
  Badge, Modal, Field, Input, Alert,
} from "../../components/ui";
import { dialog } from "../../services/dialog";

interface Shift {
  _id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  fullDayMinutes: number;
  halfDayMinutes: number;
  overtimeAfterMinutes: number;
  isActive: boolean;
  lengthMinutes?: number;
  isOvernight?: boolean;
  departmentIds?: { _id: string; name: string }[];
}

const blank = {
  name: "", code: "", startTime: "09:00", endTime: "17:00",
  breakMinutes: 30, graceMinutes: 10, fullDayMinutes: 450,
  halfDayMinutes: 225, overtimeAfterMinutes: 30, isActive: true,
};

const hhmm = (m?: number) =>
  m == null ? "—" : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

export default function WorkShiftManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.SHIFTS_MANAGE);

  const [items, setItems] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await workShiftApi.list();
      setItems(res.data?.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openForm = (s?: Shift) => {
    setModalErr("");
    if (s) {
      setEditing(s._id);
      setForm({
        name: s.name, code: s.code, startTime: s.startTime, endTime: s.endTime,
        breakMinutes: s.breakMinutes, graceMinutes: s.graceMinutes,
        fullDayMinutes: s.fullDayMinutes, halfDayMinutes: s.halfDayMinutes,
        overtimeAfterMinutes: s.overtimeAfterMinutes, isActive: s.isActive,
      });
    } else {
      setEditing(null);
      setForm({ ...blank });
    }
    setOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    setModalErr("");
    try {
      await workShiftApi.save(form, editing || undefined);
      setOpen(false);
      load();
    } catch (err: unknown) {
      const e = err as { data?: { hint?: string }; message?: string };
      setModalErr(e.data?.hint || e.message || "Failed to save the shift");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Shift) => {
    if (!await dialog.confirm({ message: `Delete the ${s.name} shift?`, confirmLabel: "Delete", tone: "danger" })) return;
    try {
      const res = await workShiftApi.remove(s._id);
      // Shifts that days were worked against are deactivated, not deleted —
      // deleting would orphan the timings those hours were computed from.
      if (res.data?.deactivated) {
        void dialog.alert(
          `${s.name} is in use (${res.data.assigned} roster entries, ${res.data.defaulted} employees), so it was deactivated rather than deleted. Past hours stay intact.`,
        );
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Shift Master"
        subtitle="Shift definitions and timings — the roster assigns people to these"
        actions={
          canManage && (
            <Button onClick={() => openForm()} icon={<Plus className="h-4 w-4" />}>
              New Shift
            </Button>
          )
        }
      />
      {error && <Alert tone="danger">{error}</Alert>}

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Th>Shift</Th><Th>Code</Th><Th>Timing</Th><Th className="text-right">Paid Length</Th>
            <Th className="text-right">Full / Half Day</Th><Th className="text-right">Grace</Th>
            <Th className="text-right">OT After</Th><Th>Status</Th><Th></Th>
          </THead>
          <TBody>
            {loading ? (
              <TableState colSpan={9}>Loading…</TableState>
            ) : items.length === 0 ? (
              <TableState colSpan={9}>
                No shifts yet. Create the General, Morning, Evening and Night
                shifts your departments run.
              </TableState>
            ) : (
              items.map((s) => (
                <TR key={s._id}>
                  <Td className="font-medium text-gray-900">{s.name}</Td>
                  <Td className="font-mono text-xs">{s.code}</Td>
                  <Td className="whitespace-nowrap">
                    {s.startTime} – {s.endTime}
                    {s.isOvernight && (
                      <span className="ml-2 text-xs text-amber-600" title="Crosses midnight">
                        overnight
                      </span>
                    )}
                  </Td>
                  <Td className="text-right">{hhmm(s.lengthMinutes)}</Td>
                  <Td className="text-right text-xs">
                    {hhmm(s.fullDayMinutes)} / {hhmm(s.halfDayMinutes)}
                  </Td>
                  <Td className="text-right">{s.graceMinutes}m</Td>
                  <Td className="text-right">{s.overtimeAfterMinutes}m</Td>
                  <Td>
                    <Badge tone={s.isActive ? "success" : "neutral"} dot>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" className="px-2" title="Edit" aria-label="Edit" onClick={() => openForm(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="px-2 text-red-600 hover:bg-red-50" title="Delete" aria-label="Delete" onClick={() => remove(s)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit shift" : "New shift"}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save shift"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {modalErr && <Alert tone="danger">{modalErr}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Night Shift" />
            </Field>
            <Field label="Code *" hint="Short unique code, e.g. NGT">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="NGT" />
            </Field>
            <Field label="Start time *">
              <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </Field>
            <Field label="End time *" hint="Earlier than the start means it crosses midnight.">
              <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </Field>
            <Field label="Unpaid break (min)">
              <Input type="number" min="0" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Grace period (min)" hint="Late arrival tolerated before a day is flagged.">
              <Input type="number" min="0" value={form.graceMinutes} onChange={(e) => setForm({ ...form, graceMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Full day (min)" hint="Minutes worked that count as a full day.">
              <Input type="number" min="0" value={form.fullDayMinutes} onChange={(e) => setForm({ ...form, fullDayMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Half day (min)">
              <Input type="number" min="0" value={form.halfDayMinutes} onChange={(e) => setForm({ ...form, halfDayMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Overtime after (min)" hint="Overrun tolerated before overtime starts accruing.">
              <Input type="number" min="0" value={form.overtimeAfterMinutes} onChange={(e) => setForm({ ...form, overtimeAfterMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Active">
              <label className="flex h-10 items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Available for assignment
              </label>
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

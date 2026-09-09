import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { attendanceApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import {
  PageHeader, Button, Input, Table, THead, TBody, TR, Th, Td, TableState, Badge,
} from "../../components/ui";
import { dialog } from "../../services/dialog";

interface RosterRow {
  employee: { _id: string; fullName: string; employeeCode: string; departmentId?: { name: string } };
  attendance: { status: string } | null;
}

const STATUSES = [
  { value: "present", label: "P", tone: "success" as const },
  { value: "absent", label: "A", tone: "danger" as const },
  { value: "half_day", label: "½", tone: "warning" as const },
  { value: "leave", label: "L", tone: "info" as const },
  { value: "holiday", label: "H", tone: "neutral" as const },
  { value: "week_off", label: "WO", tone: "neutral" as const },
];

// Local calendar date. `toISOString()` converts to UTC first, which in IST
// rolls the date back a day for anything before 05:30.
const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function AttendanceManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.ATTENDANCE_MANAGE);

  /**
   * Date and status sit in the URL so the HR dashboard's "Present Today" /
   * "On Leave Today" cards can open this page already showing those people —
   * the same records the count on the card was made from.
   */
  const [params, setParams] = useSearchParams();
  const date = params.get("date") || today();
  const statusFilter = params.get("status") || "";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.byDate(date);
      const rows: RosterRow[] = res.data?.roster || [];
      setRoster(rows);
      const initial: Record<string, string> = {};
      rows.forEach((r) => {
        if (r.attendance?.status) initial[r.employee._id] = r.attendance.status;
      });
      setMarks(initial);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  // What the table is actually showing. A status filter must narrow the rows
  // AND everything that acts on them.
  const visible = useMemo(
    () =>
      statusFilter
        ? roster.filter((r) => (marks[r.employee._id] || r.attendance?.status) === statusFilter)
        : roster,
    [roster, marks, statusFilter],
  );

  const setAll = (status: string) => {
    // Only the visible rows. Marking people you cannot see — because a filter
    // is hiding them — would rewrite the day's register by accident.
    const next: Record<string, string> = { ...marks };
    visible.forEach((r) => (next[r.employee._id] = status));
    setMarks(next);
  };

  const save = async () => {
    const entries = Object.entries(marks).map(([employeeId, status]) => ({ employeeId, status }));
    if (entries.length === 0) return;
    setSaving(true);
    try {
      await attendanceApi.mark({ date, entries });
      await load();
    } catch (err: any) {
      void dialog.alert(err.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Attendance"
        subtitle="Mark daily attendance — feeds payroll loss-of-pay"
        actions={
          canManage ? (
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Attendance"}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setParam("date", e.target.value)}
          className="w-44"
        />
        {statusFilter && (
          <span className="inline-flex items-center gap-2 rounded-full bg-healwin-50 px-3 py-1 text-xs font-medium text-healwin-700">
            Showing {visible.length} marked “{statusFilter.replace("_", " ")}”
            <button
              type="button"
              onClick={() => setParam("status", "")}
              className="text-healwin-500 hover:text-healwin-800"
              aria-label="Show everyone"
            >
              ✕
            </button>
          </span>
        )}
        {canManage && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>Mark {statusFilter ? "shown" : "all"}:</span>
            {STATUSES.map((s) => (
              <Button key={s.value} size="sm" variant="secondary" onClick={() => setAll(s.value)}>
                {s.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <Table>
        <THead>
          <Th>Code</Th>
          <Th>Employee</Th>
          <Th>Department</Th>
          <Th>Status</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={4}>Loading…</TableState>
          ) : visible.length === 0 ? (
            <TableState colSpan={4}>
              {roster.length === 0
                ? "No employees."
                : `Nobody is marked “${statusFilter.replace("_", " ")}” on this date.`}
            </TableState>
          ) : (
            visible.map((r) => (
              <TR key={r.employee._id}>
                <Td className="font-mono text-xs">{r.employee.employeeCode}</Td>
                <Td className="font-medium text-gray-900">{r.employee.fullName}</Td>
                <Td className="text-gray-500">{r.employee.departmentId?.name || "—"}</Td>
                <Td>
                  {canManage ? (
                    <div className="flex flex-wrap gap-1">
                      {STATUSES.map((s) => {
                        const active = marks[r.employee._id] === s.value;
                        return (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setMarks({ ...marks, [r.employee._id]: s.value })}
                            className={`h-7 min-w-7 rounded-md border px-2 text-xs font-medium transition-colors ${
                              active
                                ? "border-healwin-500 bg-healwin-600 text-white"
                                : "border-gray-300 text-gray-600 hover:bg-gray-50"
                            }`}
                            title={s.value.replace("_", " ")}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : marks[r.employee._id] ? (
                    <Badge tone={STATUSES.find((s) => s.value === marks[r.employee._id])?.tone || "neutral"}>
                      {marks[r.employee._id].replace("_", " ")}
                    </Badge>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </div>
  );
}

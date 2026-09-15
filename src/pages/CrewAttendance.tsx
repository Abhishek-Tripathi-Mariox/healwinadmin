// Ambulance crew attendance — who was on duty on a given day, derived from the
// duty toggle in the crew app (which writes a central Attendance row, with the
// check-in selfie and geofence result).
//
// This page used to also carry a "Staff Directory" listing every person on the
// platform. That has moved into Employees, which now lists HR staff, ambulance
// crew, doctors, panel admins and ride drivers together — keeping a second
// roster here only meant two screens that could disagree about who works here.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { staffDirectoryApi } from "../services/admin-api";
import {
  PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge, Field, Input,
} from "../components/ui";

interface AttendanceRow {
  staffId: string;
  name: string;
  role: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  checkInPhoto?: string;
  checkInWithinGeofence?: boolean;
}

/** Local calendar date — `toISOString()` shifts the day back in IST. */
const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function CrewAttendance() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [meta, setMeta] = useState<{ present: number; total: number }>({ present: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await staffDirectoryApi.attendance(date);
      setRows(res.data?.items || []);
      setMeta({ present: res.data?.present || 0, total: res.data?.total || 0 });
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6">
      <PageHeader
        title="Ambulance Crew Attendance"
        subtitle="On-duty record from the crew app's duty toggle, with check-in selfie and geofence result"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/admin/employees?type=ambulance_driver")}>
              Crew records
            </Button>
            <Button variant="secondary" onClick={load}>Refresh</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Date" className="w-44">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayStr()} />
        </Field>
        <div className="pb-2">
          <Badge tone={meta.present ? "success" : "neutral"}>
            Present {meta.present}/{meta.total}
          </Badge>
        </div>
      </div>

      <Table>
        <THead>
          <Th>Name</Th><Th>Role</Th><Th>Status</Th>
          <Th>Check-in</Th><Th>Check-out</Th><Th>Check-in photo</Th>
        </THead>
        <TBody>
          {loading && rows.length === 0 ? (
            <TableState colSpan={6}>Loading…</TableState>
          ) : rows.length === 0 ? (
            <TableState colSpan={6}>
              No ambulance crew on the rolls. Add them under Employees.
            </TableState>
          ) : (
            rows.map((r) => (
              <TR key={r.staffId}>
                <Td className="font-medium text-gray-900">{r.name}</Td>
                <Td className="text-gray-600">{r.role}</Td>
                <Td>
                  <Badge tone={r.status === "present" ? "success" : "neutral"}>{r.status}</Badge>
                </Td>
                <Td className="text-gray-500">{r.checkIn || "—"}</Td>
                <Td className="text-gray-500">{r.checkOut || "—"}</Td>
                <Td>
                  {r.checkInPhoto ? (
                    <a href={r.checkInPhoto} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                      <img src={r.checkInPhoto} alt="Check-in selfie" className="h-8 w-8 rounded-full object-cover" />
                      {r.checkInWithinGeofence === false && (
                        <Badge tone="warning">Outside geofence</Badge>
                      )}
                    </a>
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

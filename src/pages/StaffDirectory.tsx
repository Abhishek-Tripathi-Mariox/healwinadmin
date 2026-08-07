import { useCallback, useEffect, useMemo, useState } from "react";
import { staffDirectoryApi } from "../services/admin-api";
import { PageHeader, Button, Table, THead, TBody, TR, Th, Td, TableState, Badge, Input } from "../components/ui";
import Pagination from "../components/Pagination";

interface Row { type: string; sourceId: string; name: string; contact: string; role: string; status: string }

const TYPES = [
  { key: "", label: "All" },
  { key: "doctor", label: "Doctors" },
  { key: "admin", label: "Admins" },
  { key: "hr_employee", label: "Employees" },
  { key: "ambulance_driver", label: "Drivers" },
  { key: "ambulance_attendant", label: "Attendants" },
  { key: "ride_driver", label: "Ride Drivers" },
];
const typeLabel: Record<string, string> = {
  doctor: "Doctor", admin: "Admin", hr_employee: "Employee",
  ambulance_driver: "Driver", ambulance_attendant: "Attendant", ride_driver: "Ride Driver",
};
const typeTone: Record<string, "info" | "neutral" | "success" | "warning"> = {
  doctor: "info", admin: "neutral", hr_employee: "success",
  ambulance_driver: "warning", ambulance_attendant: "warning", ride_driver: "neutral",
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function StaffDirectory() {
  const [tab, setTab] = useState<"directory" | "attendance">("directory");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Attendance tab
  const [attDate, setAttDate] = useState(todayStr());
  const [attRows, setAttRows] = useState<any[]>([]);
  const [attMeta, setAttMeta] = useState<{ present: number; total: number }>({ present: 0, total: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await staffDirectoryApi.list({ type: type || undefined, q: q || undefined });
      setRows(res.data?.items || []);
      setCounts(res.data?.counts || {});
    } finally {
      setLoading(false);
    }
  }, [type, q]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await staffDirectoryApi.attendance(attDate);
      setAttRows(res.data?.items || []);
      setAttMeta({ present: res.data?.present || 0, total: res.data?.total || 0 });
    } finally {
      setLoading(false);
    }
  }, [attDate]);

  useEffect(() => {
    if (tab === "attendance") { loadAttendance(); return; }
    const t = setTimeout(load, q ? 300 : 0); // debounce search
    return () => clearTimeout(t);
  }, [tab, load, q, loadAttendance]);

  useEffect(() => { setPage(1); }, [type, q]);
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageRows = useMemo(() => rows.slice((page - 1) * limit, page * limit), [rows, page, limit]);

  return (
    <div className="p-6">
      <PageHeader title="Staff Directory" subtitle="Every person across the platform — doctors, admins, HR employees, ambulance crew and drivers — in one place"
        actions={<Button variant="secondary" onClick={() => (tab === "attendance" ? loadAttendance() : load())}>Refresh</Button>} />

      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={tab === "directory" ? "primary" : "secondary"} onClick={() => setTab("directory")}>Directory</Button>
        <Button size="sm" variant={tab === "attendance" ? "primary" : "secondary"} onClick={() => setTab("attendance")}>Ambulance Attendance</Button>
      </div>

      {tab === "attendance" ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
            <Badge tone="success">Present {attMeta.present}/{attMeta.total}</Badge>
          </div>
          <Table>
            <THead><Th>Name</Th><Th>Role</Th><Th>Status</Th><Th>Check-in</Th><Th>Check-out</Th><Th>Check-in photo</Th></THead>
            <TBody>
              {loading && attRows.length === 0 ? <TableState colSpan={6}>Loading…</TableState>
                : attRows.length === 0 ? <TableState colSpan={6}>No ambulance crew.</TableState>
                : attRows.map((r) => (
                  <TR key={r.staffId}>
                    <Td className="font-medium text-gray-900">{r.name}</Td>
                    <Td className="text-gray-600">{r.role}</Td>
                    <Td><Badge tone={r.status === "present" ? "success" : "neutral"}>{r.status}</Badge></Td>
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
                ))}
            </TBody>
          </Table>
        </>
      ) : (
      <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <Button key={t.key || "all"} size="sm" variant={type === t.key ? "primary" : "secondary"} onClick={() => setType(t.key)}>
            {t.label}{t.key && counts[t.key] != null ? ` (${counts[t.key]})` : ""}
          </Button>
        ))}
        <div className="ml-auto w-60">
          <Input placeholder="Search name or contact…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <Table>
        <THead><Th>Name</Th><Th>Type</Th><Th>Role</Th><Th>Contact</Th><Th>Status</Th></THead>
        <TBody>
          {loading && rows.length === 0 ? <TableState colSpan={5}>Loading…</TableState>
            : rows.length === 0 ? <TableState colSpan={5}>No staff found.</TableState>
            : pageRows.map((r) => (
              <TR key={`${r.type}-${r.sourceId}`}>
                <Td className="font-medium text-gray-900">{r.name}</Td>
                <Td><Badge tone={typeTone[r.type] || "neutral"}>{typeLabel[r.type] || r.type}</Badge></Td>
                <Td className="text-gray-600">{r.role}</Td>
                <Td className="text-xs text-gray-500">{r.contact || "—"}</Td>
                <Td><Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge></Td>
              </TR>
            ))}
        </TBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Rows per page
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
          >
            {[5, 10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <Pagination page={page} totalPages={totalPages} total={rows.length} label="staff" onPageChange={setPage} />
      </div>
      </>
      )}
    </div>
  );
}

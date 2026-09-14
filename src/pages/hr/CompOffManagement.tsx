// Compensatory off — the days a hospital owes staff who worked a holiday.
//
// The hospital cannot close for a public holiday, so a holiday is not time
// off: wards run and the people rostered on them are owed a day back. HR
// grants those by hand, because only HR knows who actually turned up — someone
// on leave that week is on the roster but earned nothing.
import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Check } from "lucide-react";
import { compOffApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import { dialog } from "../../services/dialog";
import {
  PageHeader, Button, Card, Table, THead, TBody, TR, Th, Td, TableState,
  Badge, Field, Input, Alert, Select,
} from "../../components/ui";
import Pagination from "../../components/Pagination";

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

interface WorkedRow {
  employeeId: string;
  fullName: string;
  employeeCode: string;
  status: string;
  workedMinutes: number;
  suggestedDays: number;
  alreadyCredited: number | null;
}

interface LedgerRow {
  _id: string;
  employeeId?: { fullName?: string; employeeCode?: string };
  workedOn: string;
  days: number;
  used: number;
  status: string;
  reason?: string;
  grantedByAdminId?: { fullName?: string; email?: string };
  createdAt: string;
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function CompOffManagement() {
  const { hasPermission } = useAuth();
  const canGrant = hasPermission(PERMISSIONS.LEAVE_APPROVE);

  const [date, setDate] = useState(today());
  const [worked, setWorked] = useState<WorkedRow[]>([]);
  const [holiday, setHoliday] = useState<{ name: string; isWorkingDay?: boolean } | null>(null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [loadingWorked, setLoadingWorked] = useState(false);
  const [granting, setGranting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadWorked = useCallback(async () => {
    setLoadingWorked(true);
    setError("");
    try {
      const res = await compOffApi.worked(date);
      setWorked(res.data?.items || []);
      setHoliday(res.data?.holiday || null);
      setPicked({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that day.");
      setWorked([]);
    } finally {
      setLoadingWorked(false);
    }
  }, [date]);

  const loadLedger = useCallback(async () => {
    const res = await compOffApi.list({
      page,
      limit,
      ...(statusFilter ? { status: statusFilter } : {}),
    });
    setLedger(res.data?.items || []);
    setTotal(res.data?.pagination?.total ?? 0);
  }, [page, statusFilter]);

  useEffect(() => { loadWorked(); }, [loadWorked]);
  useEffect(() => { loadLedger(); }, [loadLedger]);

  const toggle = (r: WorkedRow) => {
    setPicked((p) => {
      const next = { ...p };
      if (next[r.employeeId] !== undefined) delete next[r.employeeId];
      else next[r.employeeId] = r.suggestedDays;
      return next;
    });
  };

  const selectAll = () => {
    const next: Record<string, number> = {};
    // Anyone already credited is skipped — granting twice for the same day is
    // the mistake this screen exists to prevent.
    worked
      .filter((r) => r.alreadyCredited === null)
      .forEach((r) => (next[r.employeeId] = r.suggestedDays));
    setPicked(next);
  };

  const grant = async () => {
    const entries = Object.entries(picked).map(([employeeId, days]) => ({
      employeeId,
      days,
    }));
    if (!entries.length) return;
    if (
      !(await dialog.confirm({
        title: `Grant ${entries.length} compensatory off${entries.length === 1 ? "" : "s"}?`,
        message: `For work done on ${fmtDate(date)}${holiday ? ` (${holiday.name})` : ""}.`,
        confirmLabel: "Grant",
      }))
    )
      return;

    setGranting(true);
    setError("");
    setMessage("");
    try {
      const res = await compOffApi.grant({ workedOn: date, entries });
      const skipped = res.data?.skipped?.length || 0;
      setMessage(
        `${res.data?.granted || 0} compensatory off${res.data?.granted === 1 ? "" : "s"} granted` +
          (skipped ? `, ${skipped} skipped (already credited).` : "."),
      );
      await Promise.all([loadWorked(), loadLedger()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grant.");
    } finally {
      setGranting(false);
    }
  };

  const cancel = async (row: LedgerRow) => {
    if (
      !(await dialog.confirm({
        message: `Cancel the compensatory off granted to ${row.employeeId?.fullName || "this employee"} for ${fmtDate(row.workedOn)}?`,
        confirmLabel: "Cancel it",
        cancelLabel: "Keep it",
        tone: "danger",
      }))
    )
      return;
    try {
      await compOffApi.cancel(row._id);
      await loadLedger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel.");
    }
  };

  const pickedCount = Object.keys(picked).length;
  const pickedDays = Object.values(picked).reduce((s, d) => s + d, 0);

  return (
    <div className="p-6">
      <PageHeader
        title="Compensatory Off"
        subtitle="Days owed to staff who worked a holiday — the hospital does not close, so it grants time back instead"
      />

      {error && <Alert className="mb-4">{error}</Alert>}
      {message && <Alert tone="success" className="mb-4">{message}</Alert>}

      <Card padded className="mb-6">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field label="Who worked on" className="w-48">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today()} />
          </Field>
          {holiday && (
            <div className="pb-2">
              <Badge tone={holiday.isWorkingDay === false ? "neutral" : "warning"}>
                {holiday.name}
                {holiday.isWorkingDay === false ? " · office closed" : " · working holiday"}
              </Badge>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {canGrant && worked.some((r) => r.alreadyCredited === null) && (
              <Button variant="secondary" onClick={selectAll}>Select all uncredited</Button>
            )}
            {canGrant && (
              <Button
                onClick={grant}
                disabled={!pickedCount || granting}
                icon={<CalendarPlus className="h-4 w-4" />}
              >
                {granting
                  ? "Granting…"
                  : pickedCount
                    ? `Grant ${pickedDays} day${pickedDays === 1 ? "" : "s"} to ${pickedCount}`
                    : "Grant comp-off"}
              </Button>
            )}
          </div>
        </div>

        <Table>
          <THead>
            <Th className="w-10"> </Th>
            <Th>Employee</Th>
            <Th>Attendance</Th>
            <Th className="text-right">Days</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {loadingWorked ? (
              <TableState colSpan={5}>Loading…</TableState>
            ) : worked.length === 0 ? (
              <TableState colSpan={5}>
                Nobody is marked present on this date. Mark attendance first —
                comp-off is granted against a day someone actually worked.
              </TableState>
            ) : (
              worked.map((r) => {
                const credited = r.alreadyCredited !== null;
                const selected = picked[r.employeeId] !== undefined;
                return (
                  <TR key={r.employeeId}>
                    <Td>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={credited || !canGrant}
                        onChange={() => toggle(r)}
                        aria-label={`Select ${r.fullName}`}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </Td>
                    <Td className="font-medium text-gray-900">
                      {r.fullName}
                      <div className="text-xs text-gray-400">{r.employeeCode}</div>
                    </Td>
                    <Td className="text-gray-500 capitalize">{r.status.replace("_", " ")}</Td>
                    <Td className="text-right">
                      {credited ? (
                        r.alreadyCredited
                      ) : (
                        <Select
                          value={picked[r.employeeId] ?? r.suggestedDays}
                          disabled={!selected}
                          onChange={(e) =>
                            setPicked((p) => ({ ...p, [r.employeeId]: Number(e.target.value) }))
                          }
                          className="w-20"
                        >
                          <option value={0.5}>0.5</option>
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                        </Select>
                      )}
                    </Td>
                    <Td>
                      {credited ? (
                        <Badge tone="success">
                          <Check className="mr-1 inline h-3 w-3" />
                          Credited
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Not credited</Badge>
                      )}
                    </Td>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </Card>

      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Granted comp-off</h2>
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="ml-auto w-44 capitalize"
        >
          <option value="">All</option>
          <option value="available">Available</option>
          <option value="used">Used</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      <Table>
        <THead>
          <Th>Employee</Th>
          <Th>Worked on</Th>
          <Th className="text-right">Days</Th>
          <Th className="text-right">Used</Th>
          <Th>Status</Th>
          <Th>Granted by</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {ledger.length === 0 ? (
            <TableState colSpan={7}>No compensatory off granted yet.</TableState>
          ) : (
            ledger.map((r) => (
              <TR key={r._id}>
                <Td className="font-medium text-gray-900">
                  {r.employeeId?.fullName || "—"}
                  <div className="text-xs text-gray-400">{r.employeeId?.employeeCode}</div>
                </Td>
                <Td className="text-gray-500">{fmtDate(r.workedOn)}</Td>
                <Td className="text-right">{r.days}</Td>
                <Td className="text-right text-gray-500">{r.used || 0}</Td>
                <Td>
                  <Badge
                    tone={
                      r.status === "available" ? "success"
                        : r.status === "used" ? "neutral"
                        : "danger"
                    }
                  >
                    {r.status}
                  </Badge>
                </Td>
                <Td className="text-xs text-gray-500">{r.grantedByAdminId?.fullName || "—"}</Td>
                <Td className="text-right">
                  {canGrant && r.status === "available" && !r.used && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => cancel(r)}
                    >
                      Cancel
                    </Button>
                  )}
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        label="credits"
        onPageChange={setPage}
      />
    </div>
  );
}

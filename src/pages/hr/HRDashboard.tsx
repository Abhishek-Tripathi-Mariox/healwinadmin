import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Users, UserCheck, CalendarOff, Clock, Wallet, ArrowRight } from "lucide-react";
import { hrDashboardApi, departmentApi } from "../../services/admin-api";
import {
  PageHeader, Card, Table, THead, TBody, TR, Th, Td, TableState, Select,
} from "../../components/ui";

interface Summary {
  headcount: number;
  activeCount: number;
  presentToday: number;
  onLeaveToday: number;
  pendingLeaves: number;
  byDepartment: { _id: string | null; name: string; count: number }[];
  latestRun: {
    month: number;
    year: number;
    totalNet: number;
    employeeCount: number;
    status: string;
  } | null;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

/** Today in the local calendar. `toISOString` would shift the date in IST. */
const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function HRDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);

  /**
   * Department scope, kept in the URL so a department head can bookmark their
   * own view and so the drill-through links below stay consistent with it.
   */
  const [params, setParams] = useSearchParams();
  const departmentId = params.get("departmentId") || "";

  const setDepartment = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("departmentId", value);
    else next.delete("departmentId");
    setParams(next, { replace: true });
  };

  const load = useCallback(() => {
    setLoading(true);
    hrDashboardApi
      .summary({ departmentId: departmentId || undefined })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [departmentId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    departmentApi
      .getAll({ status: "active" })
      .then((r) => setDepartments(r.data?.items || r.data || []))
      .catch(() => undefined);
  }, []);

  /**
   * Carry the department into a drill-through link.
   *
   * Only used for the Employees list, which honours `departmentId`. The
   * attendance and leave screens filter by date and status but not department,
   * so appending it there would produce a link that silently ignores the scope
   * the number was counted under — worse than not passing it at all.
   */
  const withDept = (path: string) =>
    departmentId
      ? `${path}${path.includes("?") ? "&" : "?"}departmentId=${departmentId}`
      : path;

  /**
   * Every card drills into the list its number came from, carrying the same
   * filter the count was made with — so the page you land on shows those exact
   * records, not a full unfiltered list you then have to narrow by hand.
   */
  const cards = [
    {
      label: "Total Employees",
      value: data?.headcount ?? "—",
      icon: Users,
      tone: "bg-blue-50 text-blue-700",
      to: withDept("/admin/employees"),
    },
    {
      label: "Active",
      value: data?.activeCount ?? "—",
      icon: UserCheck,
      tone: "bg-emerald-50 text-emerald-700",
      to: withDept("/admin/employees?status=active"),
    },
    {
      label: "Present Today",
      value: data?.presentToday ?? "—",
      icon: Clock,
      tone: "bg-healwin-50 text-healwin-700",
      to: `/admin/attendance?date=${today()}&status=present`,
    },
    {
      // Counted from today's attendance register, so it drills into that —
      // not the leave list, which counts requests over a date range and would
      // show a different number.
      label: "On Leave Today",
      value: data?.onLeaveToday ?? "—",
      icon: CalendarOff,
      tone: "bg-amber-50 text-amber-700",
      to: `/admin/attendance?date=${today()}&status=leave`,
    },
    {
      label: "Pending Leave Requests",
      value: data?.pendingLeaves ?? "—",
      icon: CalendarOff,
      tone: "bg-red-50 text-red-700",
      to: "/admin/leave?status=pending",
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="HR Dashboard"
        subtitle="Workforce, attendance & payroll at a glance"
        actions={
          <Select
            value={departmentId}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-56"
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            <option value="none">Unassigned</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              to={c.to}
              className="group rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-healwin-500"
              aria-label={`${c.label} — view the list`}
            >
              <Card className="h-full p-4 transition-shadow group-hover:shadow-[0_14px_36px_-12px_rgba(30,64,175,0.32)]">
                <div className="flex items-start justify-between">
                  <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-healwin-600" />
                </div>
                <div className="text-2xl font-semibold text-gray-900">{loading ? "…" : c.value}</div>
                <div className="text-xs text-gray-500">{c.label}</div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Wallet className="h-4 w-4" /> Latest Payroll Run
          </div>
          {data?.latestRun ? (
            // Opens payroll already showing this run's month, rather than
            // whatever month happens to be current.
            <Link
              to={`/admin/payroll?month=${data.latestRun.month}&year=${data.latestRun.year}`}
              className="group block space-y-1 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-gray-900">
                  {inr(data.latestRun.totalNet)}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-healwin-600" />
              </div>
              <div className="text-gray-500 group-hover:text-gray-700">
                {MONTHS[data.latestRun.month - 1]} {data.latestRun.year} ·{" "}
                {data.latestRun.employeeCount} employees ·{" "}
                <span className="capitalize">{data.latestRun.status}</span>
              </div>
            </Link>
          ) : (
            <p className="text-sm text-gray-400">No payroll run yet.</p>
          )}
        </Card>

        <Card>
          <div className="px-5 pt-5 pb-2 text-sm font-semibold text-gray-700">
            Headcount by Department
          </div>
          <Table>
            <THead>
              <Th>Department</Th>
              <Th className="text-right">Employees</Th>
            </THead>
            <TBody>
              {loading ? (
                <TableState colSpan={2}>Loading…</TableState>
              ) : !data?.byDepartment?.length ? (
                <TableState colSpan={2}>No data.</TableState>
              ) : (
                data.byDepartment.map((d) => (
                  <TR key={String(d._id)}>
                    <Td className="font-medium text-gray-900">
                      {/* Employees with no department are grouped as
                          "Unassigned" — `none` is what the API accepts for
                          that, since an empty value reads as "no filter". */}
                      <Link
                        to={`/admin/employees?departmentId=${d._id ? String(d._id) : "none"}`}
                        className="hover:text-healwin-700 hover:underline"
                      >
                        {d.name}
                      </Link>
                    </Td>
                    <Td className="text-right">{d.count}</Td>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

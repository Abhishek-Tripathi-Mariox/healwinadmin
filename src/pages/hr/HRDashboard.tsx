// HR dashboard — the day's attendance, work waiting for approval, who is
// joining and leaving, and how the workforce is made up.
//
// Every figure is filterable by department, designation, category, employment
// type and pay period, and every card drills into the list it was counted
// from, so a number on screen can always be traced to the records behind it.
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Users, UserCheck, CalendarOff, Clock, Wallet, ArrowRight, AlarmClock,
  MapPinOff, UserPlus, UserMinus, Cake, PartyPopper, FileClock, CircleHelp,
} from "lucide-react";
import {
  hrDashboardApi, departmentApi, designationApi, employmentTypeApi,
} from "../../services/admin-api";
import {
  PageHeader, Card, Table, THead, TBody, TR, Th, Td, TableState, Select,
} from "../../components/ui";

interface Ref { _id: string; name: string }
interface Slice { name: string; count: number }

interface Summary {
  filters: Record<string, string | number | undefined>;
  period: { month: number; year: number; label: string };
  headcount: number;
  activeCount: number;
  onLeaveStatus: number;
  today: {
    present: number; absent: number; onLeave: number; halfDay: number;
    late: number; offSite: number; marked: number; notMarked: number;
  };
  pendingLeaves: number | null;
  pending: {
    leaveRequests: number | null;
    regularizations: number;
    compOffAvailable: number;
  };
  movement: { joiners: number; exits: number; attritionPercent: number };
  celebrations: {
    birthdays: { _id: string; fullName: string; employeeCode?: string }[];
    anniversaries: { _id: string; fullName: string; years?: number }[];
  };
  breakdown: {
    byDepartment: Slice[]; byDesignation: Slice[];
    byEmploymentType: Slice[]; byCategory: Slice[]; byGender: Slice[];
  };
  trend: { date: string; present: number; absent: number; leave: number }[];
  latestRun: {
    month: number; year: number; totalNet: number;
    employeeCount: number; status: string; periodLabel?: string;
  } | null;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CATEGORIES = ["clinical","field","ambulance","security","support","administrative"];

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
  const [departments, setDepartments] = useState<Ref[]>([]);
  const [designations, setDesignations] = useState<Ref[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<Ref[]>([]);

  /** Filters live in the URL, so a view can be bookmarked and shared. */
  const [params, setParams] = useSearchParams();
  const departmentId = params.get("departmentId") || "";
  const designationId = params.get("designationId") || "";
  const category = params.get("category") || "";
  const employmentTypeId = params.get("employmentTypeId") || "";
  const month = params.get("month") || "";
  const year = params.get("year") || "";

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const filtered = !!(departmentId || designationId || category || employmentTypeId || month);

  const load = useCallback(() => {
    setLoading(true);
    hrDashboardApi
      .summary({
        departmentId: departmentId || undefined,
        designationId: designationId || undefined,
        category: category || undefined,
        employmentTypeId: employmentTypeId || undefined,
        month: month ? Number(month) : undefined,
        year: year ? Number(year) : undefined,
      })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [departmentId, designationId, category, employmentTypeId, month, year]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    departmentApi.getAll({ status: "active" })
      .then((r) => setDepartments(r.data?.items || r.data || [])).catch(() => undefined);
    designationApi.getAll({ status: "active" })
      .then((r) => setDesignations(r.data?.items || r.data || [])).catch(() => undefined);
    employmentTypeApi.getAll({ status: "active" })
      .then((r) => setEmploymentTypes(r.data?.items || r.data || [])).catch(() => undefined);
  }, []);

  // Only carried where the destination honours it — appending a filter a page
  // ignores produces a link that silently shows something else.
  const withDept = (path: string) =>
    departmentId ? `${path}${path.includes("?") ? "&" : "?"}departmentId=${departmentId}` : path;

  const t = data?.today;
  const cards = [
    { label: "Total Employees", value: data?.headcount ?? "—", icon: Users,
      tone: "bg-blue-50 text-blue-700", to: withDept("/admin/employees") },
    { label: "Active", value: data?.activeCount ?? "—", icon: UserCheck,
      tone: "bg-emerald-50 text-emerald-700", to: withDept("/admin/employees?status=active") },
    { label: "Present Today", value: t?.present ?? "—", icon: Clock,
      tone: "bg-healwin-50 text-healwin-700", to: `/admin/attendance?date=${today()}&status=present` },
    { label: "On Leave Today", value: t?.onLeave ?? "—", icon: CalendarOff,
      tone: "bg-amber-50 text-amber-700", to: `/admin/attendance?date=${today()}&status=leave` },
    { label: "Absent Today", value: t?.absent ?? "—", icon: CalendarOff,
      tone: "bg-red-50 text-red-700", to: `/admin/attendance?date=${today()}&status=absent` },
  ];

  // Things that need a person to act, rather than just be aware.
  const attention = [
    { label: "Not marked yet", value: t?.notMarked ?? 0, icon: CircleHelp,
      hint: "Active staff with no attendance recorded for today",
      to: `/admin/attendance?date=${today()}` },
    { label: "Late today", value: t?.late ?? 0, icon: AlarmClock,
      hint: "Punched in after their shift started", to: `/admin/attendance?date=${today()}` },
    { label: "Off-site punches", value: t?.offSite ?? 0, icon: MapPinOff,
      hint: "Punched in away from a registered work location",
      to: `/admin/attendance?date=${today()}` },
    { label: "Leave to approve", value: data?.pending.leaveRequests ?? 0, icon: CalendarOff,
      hint: "Leave requests waiting on a decision", to: "/admin/leave?status=pending" },
    { label: "Regularizations", value: data?.pending.regularizations ?? 0, icon: FileClock,
      hint: "Attendance corrections requested by staff",
      to: "/admin/attendance-regularization" },
  ];

  const trendMax = Math.max(1, ...(data?.trend || []).map((d) => d.present));

  return (
    <div className="p-6">
      <PageHeader
        title="HR Dashboard"
        subtitle={
          data?.period
            ? `Workforce, attendance & payroll · ${data.period.label}`
            : "Workforce, attendance & payroll at a glance"
        }
      />

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <Card padded className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Department</span>
            <Select value={departmentId} onChange={(e) => setFilter("departmentId", e.target.value)} className="w-48">
              <option value="">All departments</option>
              <option value="none">Unassigned</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Designation</span>
            <Select value={designationId} onChange={(e) => setFilter("designationId", e.target.value)} className="w-48">
              <option value="">All designations</option>
              <option value="none">Unassigned</option>
              {designations.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Category</span>
            <Select value={category} onChange={(e) => setFilter("category", e.target.value)} className="w-40 capitalize">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Employment type</span>
            <Select value={employmentTypeId} onChange={(e) => setFilter("employmentTypeId", e.target.value)} className="w-44">
              <option value="">All types</option>
              {employmentTypes.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Pay period</span>
            <Select
              value={month}
              onChange={(e) => {
                setFilter("month", e.target.value);
                if (e.target.value && !year) setFilter("year", String(new Date().getFullYear()));
              }}
              className="w-40"
            >
              <option value="">Current period</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
          </label>
          {filtered && (
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="pb-2 text-sm text-healwin-600 hover:underline"
            >
              Clear filters
            </button>
          )}
          {loading && <span className="pb-2 text-xs text-gray-400">Loading…</span>}
        </div>
      </Card>

      {/* ── Headline ──────────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} to={c.to} className="group rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-healwin-500">
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

      {/* ── Needs attention ───────────────────────────────────────────────── */}
      <h2 className="mb-2 text-sm font-semibold text-gray-700">Needs attention today</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {attention.map((a) => {
          const Icon = a.icon;
          const idle = !a.value;
          return (
            <Link key={a.label} to={a.to} title={a.hint} className="group rounded-2xl">
              <Card className={`h-full p-4 transition-shadow group-hover:shadow-md ${idle ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${idle ? "text-gray-300" : "text-amber-500"}`} />
                  <span className={`text-xl font-semibold ${idle ? "text-gray-400" : "text-gray-900"}`}>
                    {loading ? "…" : a.value}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{a.label}</div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Attendance trend ────────────────────────────────────────────── */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Attendance — last 7 days</h3>
            <span className="text-xs text-gray-400">present per day</span>
          </div>
          {!data?.trend?.length ? (
            <p className="text-sm text-gray-400">No attendance recorded yet.</p>
          ) : (
            <div className="flex h-36 items-end gap-2">
              {data.trend.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] font-medium text-gray-500">{d.present}</span>
                  <div
                    className="w-full rounded-t bg-healwin-500/80"
                    // Bars are scaled to the busiest day, so a quiet week is
                    // still readable instead of a row of slivers.
                    style={{ height: `${Math.max(4, (d.present / trendMax) * 100)}%` }}
                    title={`${d.present} present · ${d.leave} on leave · ${d.absent} absent`}
                  />
                  <span className="text-[10px] text-gray-400">
                    {new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Movement + celebrations ─────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">This period</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-600">
                  <UserPlus className="h-4 w-4 text-emerald-500" /> Joined
                </span>
                <span className="font-semibold text-gray-900">{data?.movement.joiners ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-600">
                  <UserMinus className="h-4 w-4 text-red-500" /> Left
                </span>
                <span className="font-semibold text-gray-900">{data?.movement.exits ?? 0}</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                <span className="text-gray-500">Attrition</span>
                <span className="font-semibold text-gray-900">
                  {data?.movement.attritionPercent ?? 0}%
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Today</h3>
            {!data?.celebrations.birthdays.length && !data?.celebrations.anniversaries.length ? (
              <p className="text-sm text-gray-400">No birthdays or work anniversaries.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data?.celebrations.birthdays.map((b) => (
                  <li key={`b-${b._id}`} className="flex items-center gap-2">
                    <Cake className="h-4 w-4 shrink-0 text-pink-500" />
                    <span className="text-gray-900">{b.fullName}</span>
                    <span className="text-xs text-gray-400">birthday</span>
                  </li>
                ))}
                {data?.celebrations.anniversaries.map((a) => (
                  <li key={`a-${a._id}`} className="flex items-center gap-2">
                    <PartyPopper className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="text-gray-900">{a.fullName}</span>
                    <span className="text-xs text-gray-400">
                      {a.years} year{a.years === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* ── Payroll + breakdowns ──────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Wallet className="h-4 w-4" /> Latest Payroll Run
          </div>
          {data?.latestRun ? (
            <Link
              to={`/admin/payroll?month=${data.latestRun.month}&year=${data.latestRun.year}`}
              className="group block space-y-1 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-gray-900">{inr(data.latestRun.totalNet)}</span>
                <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-healwin-600" />
              </div>
              <div className="text-gray-500 group-hover:text-gray-700">
                {data.latestRun.periodLabel ||
                  `${MONTHS[data.latestRun.month - 1]} ${data.latestRun.year}`}{" "}
                · {data.latestRun.employeeCount} employees ·{" "}
                <span className="capitalize">{data.latestRun.status}</span>
              </div>
            </Link>
          ) : (
            <p className="text-sm text-gray-400">No payroll run yet.</p>
          )}
        </Card>

        <BreakdownCard
          title="Headcount by department"
          rows={data?.breakdown.byDepartment || []}
          loading={loading}
          linkFor={(i) => {
            const id = (data?.breakdown.byDepartment as any[])?.[i]?._id;
            return `/admin/employees?departmentId=${id ? String(id) : "none"}`;
          }}
        />
        <BreakdownCard title="By designation" rows={data?.breakdown.byDesignation || []} loading={loading} />
        <BreakdownCard title="By employment type" rows={data?.breakdown.byEmploymentType || []} loading={loading} />
        <BreakdownCard title="By category" rows={data?.breakdown.byCategory || []} loading={loading} />
        <BreakdownCard title="By gender" rows={data?.breakdown.byGender || []} loading={loading} />
      </div>
    </div>
  );
}

/** One headcount breakdown, with a share bar so proportions read at a glance. */
function BreakdownCard({
  title,
  rows,
  loading,
  linkFor,
}: {
  title: string;
  rows: Slice[];
  loading: boolean;
  linkFor?: (index: number) => string;
}) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <Card>
      <div className="px-5 pt-5 pb-2 text-sm font-semibold text-gray-700">{title}</div>
      <Table>
        <THead>
          <Th>Name</Th>
          <Th className="text-right">Employees</Th>
          <Th className="w-28">Share</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={3}>Loading…</TableState>
          ) : !rows.length ? (
            <TableState colSpan={3}>No data.</TableState>
          ) : (
            rows.map((r, i) => (
              <TR key={`${r.name}-${i}`}>
                <Td className="font-medium capitalize text-gray-900">
                  {linkFor ? (
                    <Link to={linkFor(i)} className="hover:text-healwin-700 hover:underline">
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </Td>
                <Td className="text-right">{r.count}</Td>
                <Td>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-healwin-500"
                      style={{ width: `${Math.round((r.count / total) * 100)}%` }}
                    />
                  </div>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </Card>
  );
}

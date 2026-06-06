import { useEffect, useState } from "react";
import { Users, UserCheck, CalendarOff, Clock, Wallet } from "lucide-react";
import { hrDashboardApi } from "../../services/admin-api";
import { PageHeader, Card, Table, THead, TBody, TR, Th, Td, TableState } from "../../components/ui";

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

export default function HRDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hrDashboardApi
      .summary()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Total Employees", value: data?.headcount ?? "—", icon: Users, tone: "bg-blue-50 text-blue-700" },
    { label: "Active", value: data?.activeCount ?? "—", icon: UserCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Present Today", value: data?.presentToday ?? "—", icon: Clock, tone: "bg-healwin-50 text-healwin-700" },
    { label: "On Leave Today", value: data?.onLeaveToday ?? "—", icon: CalendarOff, tone: "bg-amber-50 text-amber-700" },
    { label: "Pending Leave Requests", value: data?.pendingLeaves ?? "—", icon: CalendarOff, tone: "bg-red-50 text-red-700" },
  ];

  return (
    <div className="p-6">
      <PageHeader title="HR Dashboard" subtitle="Workforce, attendance & payroll at a glance" />

      <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="p-4">
              <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-2xl font-semibold text-gray-900">{loading ? "…" : c.value}</div>
              <div className="text-xs text-gray-500">{c.label}</div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Wallet className="h-4 w-4" /> Latest Payroll Run
          </div>
          {data?.latestRun ? (
            <div className="space-y-1 text-sm">
              <div className="text-2xl font-semibold text-gray-900">
                {inr(data.latestRun.totalNet)}
              </div>
              <div className="text-gray-500">
                {MONTHS[data.latestRun.month - 1]} {data.latestRun.year} ·{" "}
                {data.latestRun.employeeCount} employees ·{" "}
                <span className="capitalize">{data.latestRun.status}</span>
              </div>
            </div>
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
                    <Td className="font-medium text-gray-900">{d.name}</Td>
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

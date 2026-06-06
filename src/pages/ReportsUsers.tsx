import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Users as UsersIcon, UserPlus } from "lucide-react";
import { reportsApi } from "../services/admin-api";
import {
  PageHeader,
  Alert,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
} from "../components/ui";
import {
  ReportRangeBar,
  StatCard,
  ChartCard,
  fmtCurrency,
  fmtNumber,
  daysAgo,
  toISODate,
} from "../components/ReportKit";

interface GrowthRow {
  _id: string;
  count: number;
}
interface TopUserRow {
  _id: string;
  bookingCount: number;
  totalSpent: number;
  user?: { fullName?: string; email?: string; mobileNumber?: string };
}

const ReportsUsers: React.FC = () => {
  // User growth defaults to a wider, 1-year window.
  const [dateFrom, setDateFrom] = useState(daysAgo(365));
  const [dateTo, setDateTo] = useState(toISODate(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [growth, setGrowth] = useState<GrowthRow[]>([]);
  const [topUsers, setTopUsers] = useState<TopUserRow[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await reportsApi.users(dateFrom, dateTo);
        if (!active) return;
        const d = res.data || {};
        setGrowth(d.growth || []);
        setTopUsers(d.topUsers || []);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load user report");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dateFrom, dateTo]);

  const totals = useMemo(() => {
    const newUsers = growth.reduce((s, r) => s + (r.count || 0), 0);
    const spent = topUsers.reduce((s, r) => s + (r.totalSpent || 0), 0);
    return { newUsers, months: growth.length, spent };
  }, [growth, topUsers]);

  return (
    <div className="p-6">
      <PageHeader
        title="Users Report"
        subtitle="New-user growth over time and your top customers by spend"
      />

      {error && (
        <Alert className="mb-4" tone="danger">
          {error}
        </Alert>
      )}

      <ReportRangeBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        loading={loading}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="New Users"
          value={fmtNumber(totals.newUsers)}
          hint="in selected range"
          icon={<UserPlus className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Active Months"
          value={fmtNumber(totals.months)}
          icon={<UsersIcon className="h-5 w-5" />}
          tone="violet"
        />
        <StatCard
          label="Top-10 Spend"
          value={fmtCurrency(totals.spent)}
          hint="by top customers"
          tone="emerald"
        />
      </div>

      <div className="space-y-6">
        <ChartCard title="User growth" subtitle="New registrations per month">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={growth} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#2196F3" radius={[4, 4, 0, 0]} name="New users" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Top customers
          </h3>
          <Table>
            <THead>
              <Th className="w-12">#</Th>
              <Th>Customer</Th>
              <Th>Contact</Th>
              <Th className="text-right">Bookings</Th>
              <Th className="text-right">Total spent</Th>
            </THead>
            <TBody>
              {loading ? (
                <TableState colSpan={5}>Loading…</TableState>
              ) : topUsers.length === 0 ? (
                <TableState colSpan={5}>No customers found.</TableState>
              ) : (
                topUsers.map((u, i) => (
                  <TR key={u._id}>
                    <Td className="text-gray-400">{i + 1}</Td>
                    <Td className="font-medium text-gray-900">
                      {u.user?.fullName || "Unknown"}
                    </Td>
                    <Td className="text-gray-500">
                      {u.user?.mobileNumber || u.user?.email || "—"}
                    </Td>
                    <Td className="text-right text-gray-500">
                      {fmtNumber(u.bookingCount)}
                    </Td>
                    <Td className="text-right font-medium text-gray-900">
                      {fmtCurrency(u.totalSpent)}
                    </Td>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default ReportsUsers;

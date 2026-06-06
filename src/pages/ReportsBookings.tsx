import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { CalendarCheck, CheckCircle2, XCircle, IndianRupee } from "lucide-react";
import { reportsApi } from "../services/admin-api";
import { PageHeader, Alert, EmptyState } from "../components/ui";
import {
  ReportRangeBar,
  StatCard,
  ChartCard,
  REPORT_COLORS,
  fmtCurrency,
  fmtNumber,
  daysAgo,
  toISODate,
} from "../components/ReportKit";

interface TrendRow {
  _id: { date: string; status: string };
  count: number;
  revenue: number;
}
interface VehicleRow {
  _id: string | null;
  count: number;
  revenue: number;
}

const ReportsBookings: React.FC = () => {
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(toISODate(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await reportsApi.bookings(dateFrom, dateTo);
        if (!active) return;
        const d = res.data || {};
        setTrend(d.bookingTrend || []);
        setVehicles(d.vehicleTypeBreakdown || []);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load booking report");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dateFrom, dateTo]);

  // Pivot the (date, status) rows into a per-date series and status totals.
  const byDate = useMemo(() => {
    const m = new Map<string, { date: string; bookings: number; revenue: number }>();
    for (const r of trend) {
      const e = m.get(r._id.date) || { date: r._id.date, bookings: 0, revenue: 0 };
      e.bookings += r.count;
      e.revenue += r.revenue || 0;
      m.set(r._id.date, e);
    }
    return [...m.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [trend]);

  const statusTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of trend) {
      const s = r._id.status || "UNKNOWN";
      m.set(s, (m.get(s) || 0) + r.count);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [trend]);

  const totals = useMemo(() => {
    const bookings = byDate.reduce((s, r) => s + r.bookings, 0);
    const revenue = byDate.reduce((s, r) => s + r.revenue, 0);
    const completed = statusTotals.find((s) => s.name === "COMPLETED")?.value || 0;
    const cancelled = statusTotals.find((s) => s.name === "CANCELLED")?.value || 0;
    return { bookings, revenue, completed, cancelled };
  }, [byDate, statusTotals]);

  const hasData = trend.length > 0;

  return (
    <div className="p-6">
      <PageHeader
        title="Bookings Report"
        subtitle="Booking volume, status mix and vehicle-type breakdown over time"
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Bookings"
          value={fmtNumber(totals.bookings)}
          icon={<CalendarCheck className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Completed"
          value={fmtNumber(totals.completed)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Cancelled"
          value={fmtNumber(totals.cancelled)}
          icon={<XCircle className="h-5 w-5" />}
          tone="red"
        />
        <StatCard
          label="Revenue"
          value={fmtCurrency(totals.revenue)}
          icon={<IndianRupee className="h-5 w-5" />}
          tone="violet"
        />
      </div>

      {!loading && !hasData ? (
        <EmptyState
          title="No bookings in this range"
          description="Try widening the date range."
        />
      ) : (
        <div className="space-y-6">
          <ChartCard
            title="Booking trend"
            subtitle="Bookings created per day"
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={byDate} margin={{ left: -10, right: 8 }}>
                <defs>
                  <linearGradient id="bk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2196F3" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2196F3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="bookings"
                  stroke="#2196F3"
                  strokeWidth={2}
                  fill="url(#bk)"
                  name="Bookings"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Status breakdown" subtitle="By booking status">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusTotals}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(e: any) => `${e.name}: ${e.value}`}
                    labelLine={false}
                  >
                    {statusTotals.map((_, i) => (
                      <Cell key={i} fill={REPORT_COLORS[i % REPORT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="By vehicle type" subtitle="Bookings per vehicle type">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={vehicles.map((v) => ({
                    name: v._id || "Unknown",
                    count: v.count,
                  }))}
                  margin={{ left: -10, right: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2196F3" radius={[4, 4, 0, 0]} name="Bookings" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsBookings;

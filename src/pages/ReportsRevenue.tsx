import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { IndianRupee, Receipt, TicketPercent, Calculator } from "lucide-react";
import { reportsApi } from "../services/admin-api";
import {
  PageHeader,
  Alert,
  EmptyState,
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
  REPORT_COLORS,
  fmtCurrency,
  fmtNumber,
  daysAgo,
  toISODate,
} from "../components/ReportKit";

interface DailyRow {
  _id: string;
  totalRevenue: number;
  totalGST: number;
  totalDiscount: number;
  bookingCount: number;
  avgFare: number;
}
interface PaymentRow {
  _id: string | null;
  count: number;
  total: number;
}

const ReportsRevenue: React.FC = () => {
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(toISODate(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [byPayment, setByPayment] = useState<PaymentRow[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await reportsApi.revenue(dateFrom, dateTo);
        if (!active) return;
        const d = res.data || {};
        setDaily(d.daily || []);
        setByPayment(d.byPaymentMethod || []);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load revenue report");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dateFrom, dateTo]);

  const totals = useMemo(() => {
    const revenue = daily.reduce((s, r) => s + (r.totalRevenue || 0), 0);
    const gst = daily.reduce((s, r) => s + (r.totalGST || 0), 0);
    const discount = daily.reduce((s, r) => s + (r.totalDiscount || 0), 0);
    const bookings = daily.reduce((s, r) => s + (r.bookingCount || 0), 0);
    return { revenue, gst, discount, avgFare: bookings ? revenue / bookings : 0 };
  }, [daily]);

  const hasData = daily.length > 0;

  return (
    <div className="p-6">
      <PageHeader
        title="Revenue Report"
        subtitle="Daily collections, taxes, discounts and payment-method split"
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
          label="Total Revenue"
          value={fmtCurrency(totals.revenue)}
          icon={<IndianRupee className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="GST Collected"
          value={fmtCurrency(totals.gst)}
          icon={<Receipt className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Discounts"
          value={fmtCurrency(totals.discount)}
          icon={<TicketPercent className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Avg Fare"
          value={fmtCurrency(totals.avgFare)}
          icon={<Calculator className="h-5 w-5" />}
          tone="violet"
        />
      </div>

      {!loading && !hasData ? (
        <EmptyState
          title="No revenue in this range"
          description="Completed bookings will show up here."
        />
      ) : (
        <div className="space-y-6">
          <ChartCard title="Revenue trend" subtitle="Collected revenue per day">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={daily} margin={{ left: 4, right: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={(v) => `₹${fmtNumber(v)}`}
                  width={70}
                />
                <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="totalRevenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#rev)"
                  name="Revenue"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="By payment method" subtitle="Revenue share">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={byPayment.map((p) => ({
                      name: p._id || "Unknown",
                      value: p.total,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(e: any) => e.name}
                    labelLine={false}
                  >
                    {byPayment.map((_, i) => (
                      <Cell key={i} fill={REPORT_COLORS[i % REPORT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <Table>
              <THead>
                <Th>Payment method</Th>
                <Th className="text-right">Bookings</Th>
                <Th className="text-right">Total</Th>
              </THead>
              <TBody>
                {loading ? (
                  <TableState colSpan={3}>Loading…</TableState>
                ) : byPayment.length === 0 ? (
                  <TableState colSpan={3}>No payments found.</TableState>
                ) : (
                  byPayment.map((p) => (
                    <TR key={p._id || "unknown"}>
                      <Td className="font-medium capitalize text-gray-900">
                        {p._id || "Unknown"}
                      </Td>
                      <Td className="text-right text-gray-500">
                        {fmtNumber(p.count)}
                      </Td>
                      <Td className="text-right font-medium text-gray-900">
                        {fmtCurrency(p.total)}
                      </Td>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsRevenue;

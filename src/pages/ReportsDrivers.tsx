import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { Car, Star, IndianRupee } from "lucide-react";
import { reportsApi } from "../services/admin-api";
import {
  PageHeader,
  Alert,
  Badge,
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

interface TopDriverRow {
  _id: string;
  tripCount: number;
  totalEarnings: number;
  avgRating: number | null;
  driver?: { fullName?: string; mobileNumber?: string; status?: string };
}
interface StatusRow {
  _id: string | null;
  count: number;
}

const statusTone = (
  status: string,
): "success" | "warning" | "danger" | "neutral" | "info" => {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
    case "suspended":
      return "danger";
    case "under_verification":
    case "documents_uploaded":
      return "warning";
    default:
      return "neutral";
  }
};

const ReportsDrivers: React.FC = () => {
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(toISODate(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [topDrivers, setTopDrivers] = useState<TopDriverRow[]>([]);
  const [statusDist, setStatusDist] = useState<StatusRow[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await reportsApi.drivers(dateFrom, dateTo);
        if (!active) return;
        const d = res.data || {};
        setTopDrivers(d.topDrivers || []);
        setStatusDist(d.statusDistribution || []);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load driver report");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dateFrom, dateTo]);

  const totals = useMemo(() => {
    const drivers = statusDist.reduce((s, r) => s + (r.count || 0), 0);
    const approved = statusDist.find((s) => s._id === "approved")?.count || 0;
    const earnings = topDrivers.reduce((s, r) => s + (r.totalEarnings || 0), 0);
    return { drivers, approved, earnings };
  }, [statusDist, topDrivers]);

  return (
    <div className="p-6">
      <PageHeader
        title="Drivers Report"
        subtitle="Top earners, trip volume and driver status distribution"
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
          label="Total Drivers"
          value={fmtNumber(totals.drivers)}
          icon={<Car className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Approved"
          value={fmtNumber(totals.approved)}
          icon={<Star className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Top-10 Earnings"
          value={fmtCurrency(totals.earnings)}
          hint="in selected range"
          icon={<IndianRupee className="h-5 w-5" />}
          tone="violet"
        />
      </div>

      <div className="space-y-6">
        <ChartCard
          title="Driver status distribution"
          subtitle="All active drivers by verification status"
        >
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={statusDist.map((s) => ({
                  name: (s._id || "unknown").replace(/_/g, " "),
                  value: s.count,
                }))}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(e: any) => `${e.name}: ${e.value}`}
                labelLine={false}
              >
                {statusDist.map((_, i) => (
                  <Cell key={i} fill={REPORT_COLORS[i % REPORT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Top drivers by earnings
          </h3>
          <Table>
            <THead>
              <Th className="w-12">#</Th>
              <Th>Driver</Th>
              <Th>Contact</Th>
              <Th className="text-right">Trips</Th>
              <Th className="text-right">Rating</Th>
              <Th className="text-right">Earnings</Th>
            </THead>
            <TBody>
              {loading ? (
                <TableState colSpan={6}>Loading…</TableState>
              ) : topDrivers.length === 0 ? (
                <TableState colSpan={6}>No drivers found.</TableState>
              ) : (
                topDrivers.map((dRow, i) => (
                  <TR key={dRow._id}>
                    <Td className="text-gray-400">{i + 1}</Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {dRow.driver?.fullName || "Unknown"}
                        </span>
                        {dRow.driver?.status && (
                          <Badge tone={statusTone(dRow.driver.status)}>
                            {dRow.driver.status.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </span>
                    </Td>
                    <Td className="text-gray-500">
                      {dRow.driver?.mobileNumber || "—"}
                    </Td>
                    <Td className="text-right text-gray-500">
                      {fmtNumber(dRow.tripCount)}
                    </Td>
                    <Td className="text-right text-gray-500">
                      {dRow.avgRating ? dRow.avgRating.toFixed(1) : "—"}
                    </Td>
                    <Td className="text-right font-medium text-gray-900">
                      {fmtCurrency(dRow.totalEarnings)}
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

export default ReportsDrivers;

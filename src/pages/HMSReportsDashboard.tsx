import { useCallback, useEffect, useState } from "react";
import { hmsReportsApi } from "../services/admin-api";
import { PageHeader, Button, Badge } from "../components/ui";

const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;
const titleCase = (s: string) => (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone || "text-gray-900"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.length === 0 && <p className="text-sm text-gray-400">No data.</p>}
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-xs text-gray-600">{titleCase(d.label)}</div>
          <div className="h-3 flex-1 rounded-full bg-gray-100">
            <div className="h-3 rounded-full bg-sky-500" style={{ width: `${Math.round((d.value / max) * 100)}%` }} />
          </div>
          <div className="w-20 shrink-0 text-right text-xs font-medium text-gray-700">{d.value.toLocaleString("en-IN")}</div>
        </div>
      ))}
    </div>
  );
}

export default function HMSReportsDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hmsReportsApi.summary();
      setData(res.data || res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const opd = data?.opd, ipd = data?.ipd, revenue = data?.revenue, diag = data?.diagnostics, trends = data?.trends;

  return (
    <div className="p-6">
      <PageHeader title="Hospital MIS" subtitle="Operational & financial snapshot across OPD, IPD, billing and diagnostics"
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>} />

      {loading && !data ? (
        <p className="text-gray-500">Loading…</p>
      ) : !data ? (
        <p className="text-gray-500">No data.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="OPD today" value={opd?.today ?? 0} sub="appointments" />
            <Stat label="Admitted now" value={ipd?.admittedNow ?? 0} sub={`${ipd?.totalBeds ?? 0} beds total`} />
            <Stat label="Bed occupancy" value={`${ipd?.occupancyPct ?? 0}%`} sub={`${ipd?.occupiedBeds ?? 0} occupied · ${ipd?.availableBeds ?? 0} free`}
              tone={(ipd?.occupancyPct ?? 0) >= 85 ? "text-red-600" : "text-gray-900"} />
            <Stat label="Avg length of stay" value={`${ipd?.alosDays ?? 0}d`} sub="recent discharges" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Stat label="Total billed" value={inr(revenue?.billed)} />
            <Stat label="Collected" value={inr(revenue?.paid)} tone="text-green-600" />
            <Stat label="Outstanding" value={inr(revenue?.outstanding)} tone="text-red-600" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Revenue by section</h3>
              <Bars data={(revenue?.bySection || []).map((r: any) => ({ label: r.section, value: r.amount }))} />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">OPD by status</h3>
              <Bars data={Object.entries(opd?.byStatus || {}).map(([k, v]) => ({ label: k, value: v as number }))} />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Diagnostics by status</h3>
              <Bars data={Object.entries(diag || {}).map(([k, v]) => ({ label: k, value: v as number }))} />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Admissions vs discharges (30d)</h3>
              <div className="flex items-center gap-4 text-sm">
                <Badge tone="info">Admissions: {(trends?.admissions || []).reduce((s: number, t: any) => s + t.count, 0)}</Badge>
                <Badge tone="success">Discharges: {(trends?.discharges || []).reduce((s: number, t: any) => s + t.count, 0)}</Badge>
              </div>
              <div className="mt-3">
                <Bars data={(trends?.admissions || []).slice(-10).map((t: any) => ({ label: t.date.slice(5), value: t.count }))} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { fleetHealthApi } from "../services/admin-api";
import { PageHeader, Button, Badge } from "../components/ui";

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone || "text-gray-900"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export default function FleetHealthDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fleetHealthApi.summary(); setData(r.data || r); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // live-ish refresh
    return () => clearInterval(t);
  }, [load]);

  const f = data?.fleet, c = data?.crew, l = data?.load, resp = data?.response;

  return (
    <div className="p-6">
      <PageHeader title="Fleet System Health" subtitle="Live operational pulse — ambulance availability, crew, dispatch load & response time"
        actions={<Button variant="secondary" onClick={load}>Refresh</Button>} />

      {loading && !data ? (
        <p className="text-gray-500">Loading…</p>
      ) : !data ? (
        <p className="text-gray-500">No data.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Ambulances" value={f?.total ?? 0} sub="active fleet" />
            <Stat label="Available" value={f?.available ?? 0} sub={`${f?.availabilityPct ?? 0}% availability`}
              tone={(f?.availabilityPct ?? 0) < 20 ? "text-red-600" : "text-green-600"} />
            <Stat label="On dispatch" value={f?.onDispatch ?? 0} />
            <Stat label="Offline / Maint." value={`${f?.offline ?? 0} / ${f?.maintenance ?? 0}`} />
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="On-duty crew" value={c?.onDuty ?? 0} />
            <Stat label="Active dispatches" value={l?.activeDispatches ?? 0} />
            <Stat label="Active requests" value={l?.activeRequests ?? 0} />
            <Stat label="Active SOS" value={l?.activeSos ?? 0} tone={(l?.activeSos ?? 0) > 0 ? "text-red-600" : "text-gray-900"} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Response time</h3>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-gray-900">{resp?.avgAcknowledgeMinutes ?? 0} min</div>
              <div className="text-sm text-gray-500">
                avg dispatch → crew acknowledge
                <div className="mt-1"><Badge tone="info">{resp?.sampleSize ?? 0} dispatches · last {resp?.windowHours ?? 24}h</Badge></div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">Auto-refreshes every 20s.</p>
        </div>
      )}
    </div>
  );
}

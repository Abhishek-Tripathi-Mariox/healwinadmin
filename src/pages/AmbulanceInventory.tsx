import { useEffect, useState } from "react";
import { ambulanceStockApi } from "../services/admin-api";
import {
  PageHeader,
  Button,
  Table,
  THead,
  TBody,
  TR,
  Th,
  Td,
  TableState,
  Badge,
  Modal,
} from "../components/ui";

type AmbRow = {
  ambulanceId: string;
  registrationNumber: string;
  type?: string;
  onHandLines: number;
  onHandQty: number;
  consumedValue: number;
  consumedQty: number;
};
type PatientRow = {
  patientId: string | null;
  patientName: string;
  totalSpend: number;
  items: number;
  lastAt?: string;
};
type StockItem = {
  itemId: string;
  name: string;
  unit?: string;
  category?: string;
  quantity: number;
  sellingPrice: number;
  onHandValue: number;
};
type Txn = {
  _id: string;
  itemName: string;
  type: "in" | "out";
  quantity: number;
  balanceAfter: number;
  amount: number | null;
  reason: string;
  patientName: string | null;
  at: string;
};

const money = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

export default function AmbulanceInventory() {
  const [byAmbulance, setByAmbulance] = useState<AmbRow[]>([]);
  const [byPatient, setByPatient] = useState<PatientRow[]>([]);
  const [totals, setTotals] = useState<{ consumedValue: number }>({ consumedValue: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ambulances" | "patients">("ambulances");

  const [detail, setDetail] = useState<{ reg: string; items: StockItem[]; recent: Txn[]; onHandValue: number } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await ambulanceStockApi.reports();
      const d = res.data ?? res.rData ?? res;
      setByAmbulance(d.byAmbulance || []);
      setByPatient(d.byPatient || []);
      setTotals(d.totals || { consumedValue: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAmbulance = async (row: AmbRow) => {
    setDetailLoading(true);
    setDetail({ reg: row.registrationNumber, items: [], recent: [], onHandValue: 0 });
    try {
      const res: any = await ambulanceStockApi.ambulance(row.ambulanceId);
      const d = res.data ?? res.rData ?? res;
      setDetail({
        reg: d.ambulance?.registrationNumber || row.registrationNumber,
        items: d.items || [],
        recent: d.recent || [],
        onHandValue: d.onHandValue || 0,
      });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Ambulance Inventory"
        subtitle="Per-vehicle stock, consumption & spend"
        actions={<Button variant="secondary" size="sm" onClick={load}>Refresh</Button>}
      />

      {/* Summary tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-gray-500">Total supplies spend</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{money(totals.consumedValue)}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-gray-500">Ambulances stocked</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{byAmbulance.filter((a) => a.onHandQty > 0).length}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-gray-500">Patients billed</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{byPatient.length}</div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {(["ambulances", "patients"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "primary" : "secondary"} onClick={() => setTab(t)}>
            {t === "ambulances" ? "By Ambulance" : "By Patient"}
          </Button>
        ))}
      </div>

      {tab === "ambulances" ? (
        <Table>
          <THead>
            <Th>Ambulance</Th>
            <Th>On-hand items</Th>
            <Th>On-hand qty</Th>
            <Th>Consumed qty</Th>
            <Th className="text-right">Supplies spend</Th>
            <Th className="text-right">Actions</Th>
          </THead>
          <TBody>
            {loading ? (
              <TableState colSpan={6}>Loading…</TableState>
            ) : byAmbulance.length === 0 ? (
              <TableState colSpan={6}>No ambulance stock yet.</TableState>
            ) : (
              byAmbulance.map((a) => (
                <TR key={a.ambulanceId}>
                  <Td className="font-medium text-gray-900">
                    {a.registrationNumber}
                    {a.type && <span className="ml-2 text-xs text-gray-400">{a.type}</span>}
                  </Td>
                  <Td>{a.onHandLines}</Td>
                  <Td>{a.onHandQty}</Td>
                  <Td>{a.consumedQty}</Td>
                  <Td className="text-right font-semibold text-gray-900">{money(a.consumedValue)}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openAmbulance(a)}>View stock</Button>
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      ) : (
        <Table>
          <THead>
            <Th>Patient</Th>
            <Th>Items used</Th>
            <Th>Last used</Th>
            <Th className="text-right">Spend</Th>
          </THead>
          <TBody>
            {loading ? (
              <TableState colSpan={4}>Loading…</TableState>
            ) : byPatient.length === 0 ? (
              <TableState colSpan={4}>No patient consumption yet.</TableState>
            ) : (
              byPatient.map((p) => (
                <TR key={p.patientId || p.patientName}>
                  <Td className="font-medium text-gray-900">{p.patientName}</Td>
                  <Td>{p.items}</Td>
                  <Td className="text-gray-500">{p.lastAt ? new Date(p.lastAt).toLocaleString() : "—"}</Td>
                  <Td className="text-right font-semibold text-gray-900">{money(p.totalSpend)}</Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Stock — ${detail.reg}` : undefined}
        size="lg"
      >
        {detailLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : detail ? (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">On-hand stock</h4>
                <Badge tone="info">On-hand value {money(detail.onHandValue)}</Badge>
              </div>
              {detail.items.length === 0 ? (
                <p className="text-sm text-gray-500">No stock loaded.</p>
              ) : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {detail.items.map((i) => (
                    <div key={i.itemId} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-gray-800">{i.name}{i.unit ? ` (${i.unit})` : ""}</span>
                      <span className="font-medium text-gray-900">{i.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Recent movements</h4>
              {detail.recent.length === 0 ? (
                <p className="text-sm text-gray-500">No movements yet.</p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {detail.recent.map((t) => (
                    <div key={t._id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-xs">
                      <span>
                        <Badge tone={t.type === "in" ? "success" : "warning"}>{t.type === "in" ? "Restock" : "Used"}</Badge>
                        <span className="ml-2 text-gray-800">{t.itemName} × {t.quantity}</span>
                        {t.patientName && <span className="ml-1 text-gray-400">· {t.patientName}</span>}
                      </span>
                      <span className="text-gray-400">
                        {t.amount ? `${money(t.amount)} · ` : ""}
                        {new Date(t.at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

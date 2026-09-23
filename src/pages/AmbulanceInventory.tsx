import { useCallback, useEffect, useState } from "react";
import { ambulanceStockApi } from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  Select,
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

/** Stock lines per page inside the detail modal — it has no filter row. */
const DETAIL_LIMIT = 20;

type Totals = { consumedValue: number; ambulancesStocked: number; patientsBilled: number };
const EMPTY_TOTALS: Totals = { consumedValue: 0, ambulancesStocked: 0, patientsBilled: 0 };

export default function AmbulanceInventory() {
  const [byAmbulance, setByAmbulance] = useState<AmbRow[]>([]);
  const [byPatient, setByPatient] = useState<PatientRow[]>([]);
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ambulances" | "patients">("ambulances");
  // The two tables page independently on the backend, so they do here too.
  const [ambPage, setAmbPage] = useState(1);
  const [patientPage, setPatientPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const [detail, setDetail] = useState<{ ambulanceId: string; reg: string; items: StockItem[]; recent: Txn[]; onHandValue: number } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [itemPage, setItemPage] = useState(1);
  const [itemTotal, setItemTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // `tab` matters: the backend only pages the table being shown and
      // returns the other one empty.
      const res: any = await ambulanceStockApi.reports({
        tab,
        page: tab === "ambulances" ? ambPage : patientPage,
        limit,
      });
      const d = res.data ?? res.rData ?? res;
      setByAmbulance(d.byAmbulance || []);
      setByPatient(d.byPatient || []);
      setTotals({ ...EMPTY_TOTALS, ...(d.totals || {}) });
      setTotal(d.pagination?.total || 0);
    } finally {
      setLoading(false);
    }
  }, [tab, ambPage, patientPage, limit]);

  const loadDetail = useCallback(async (ambulanceId: string, reg: string, p: number) => {
    const res: any = await ambulanceStockApi.ambulance(ambulanceId, { page: p, limit: DETAIL_LIMIT });
    const d = res.data ?? res.rData ?? res;
    setDetail({
      ambulanceId,
      reg: d.ambulance?.registrationNumber || reg,
      items: d.items || [],
      recent: d.recent || [],
      onHandValue: d.onHandValue || 0,
    });
    setItemTotal(d.pagination?.total || 0);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setAmbPage(1);
    setPatientPage(1);
  }, [limit]);

  const openAmbulance = async (row: AmbRow) => {
    setDetailLoading(true);
    setItemPage(1);
    setDetail({ ambulanceId: row.ambulanceId, reg: row.registrationNumber, items: [], recent: [], onHandValue: 0 });
    try {
      await loadDetail(row.ambulanceId, row.registrationNumber, 1);
    } finally {
      setDetailLoading(false);
    }
  };

  const goItemPage = async (p: number) => {
    if (!detail) return;
    setItemPage(p);
    await loadDetail(detail.ambulanceId, detail.reg, p);
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
          {/* Fleet-wide, from the server — counting the rows on screen would
              only ever report this page's worth. */}
          <div className="mt-1 text-2xl font-bold text-gray-900">{totals.ambulancesStocked}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-gray-500">Patients billed</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{totals.patientsBilled}</div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {(["ambulances", "patients"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "primary" : "secondary"} onClick={() => setTab(t)}>
            {t === "ambulances" ? "By Ambulance" : "By Patient"}
          </Button>
        ))}
        <Select
          value={String(limit)}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="w-32"
          aria-label="Rows per page"
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </Select>
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

      <div className="mt-4">
        <Pagination
          page={tab === "ambulances" ? ambPage : patientPage}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          label={tab === "ambulances" ? "ambulances" : "patients"}
          onPageChange={tab === "ambulances" ? setAmbPage : setPatientPage}
        />
      </div>

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
              <div className="mt-3">
                <Pagination
                  page={itemPage}
                  totalPages={Math.max(1, Math.ceil(itemTotal / DETAIL_LIMIT))}
                  total={itemTotal}
                  label="items"
                  onPageChange={goItemPage}
                />
              </div>
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

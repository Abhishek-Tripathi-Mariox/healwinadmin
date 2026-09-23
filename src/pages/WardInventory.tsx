import { useCallback, useEffect, useState } from "react";
import { wardStockApi } from "../services/admin-api";
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
  Field,
  Input,
  Alert,
} from "../components/ui";

type WardRow = {
  wardId: string;
  name: string;
  onHandLines: number;
  onHandQty: number;
  consumedQty: number;
};
type StockItem = {
  itemId: string;
  name: string;
  unit?: string;
  category?: string;
  quantity: number;
  centralStock: number | null;
};
type Txn = {
  _id: string;
  itemName: string;
  type: "in" | "out";
  quantity: number;
  balanceAfter: number;
  reason: string;
  transferWardName: string | null;
  notes: string | null;
  at: string;
};
type CatalogItem = {
  itemId?: string;
  _id?: string;
  name: string;
  unit?: string;
  currentStock?: number;
};
type IssueLine = { itemId: string; name: string; qty: string };

/** Ward stock lines per page inside the detail modal — it has no filter row. */
const DETAIL_LIMIT = 20;

export default function WardInventory() {
  const [wards, setWards] = useState<WardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  // What's actually queried: typing shouldn't fire a request per keystroke.
  const [searchQuery, setSearchQuery] = useState("");
  // Destination wards for the transfer picker. Fetched apart from the table
  // because the table is paged, and you must be able to transfer to any ward,
  // not just the ones on screen.
  const [wardOptions, setWardOptions] = useState<WardRow[]>([]);

  const [detailWard, setDetailWard] = useState<{ wardId: string; name: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [items, setItems] = useState<StockItem[]>([]);
  const [itemPage, setItemPage] = useState(1);
  const [itemTotal, setItemTotal] = useState(0);
  const [recent, setRecent] = useState<Txn[]>([]);

  // Issue-stock modal.
  const [issueOpen, setIssueOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [issueLines, setIssueLines] = useState<IssueLine[]>([{ itemId: "", name: "", qty: "1" }]);
  const [issueError, setIssueError] = useState("");
  const [issuing, setIssuing] = useState(false);

  // Adjust (log usage / correction) modal.
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState("1");
  const [adjustDirection, setAdjustDirection] = useState<"in" | "out">("out");
  const [adjustReason, setAdjustReason] = useState<"consumption" | "adjustment">("consumption");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustError, setAdjustError] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Transfer-to-another-ward modal.
  const [transferItem, setTransferItem] = useState<StockItem | null>(null);
  const [transferToWardId, setTransferToWardId] = useState("");
  const [transferQty, setTransferQty] = useState("1");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferring, setTransferring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res: any = await wardStockApi.reports(params);
      const d = res.data ?? res.rData ?? res;
      setWards(d.byWard || []);
      setTotal(d.pagination?.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery]);

  // Explicit limit — the picker fetch must not inherit the backend's default
  // page size or most wards become untransferable-to.
  const loadWardOptions = useCallback(async () => {
    try {
      const res: any = await wardStockApi.reports({ limit: 100 });
      const d = res.data ?? res.rData ?? res;
      setWardOptions(d.byWard || []);
    } catch {
      setWardOptions([]);
    }
  }, []);

  const loadDetail = useCallback(async (wardId: string, p: number) => {
    const res: any = await wardStockApi.ward(wardId, { page: p, limit: DETAIL_LIMIT });
    const d = res.data ?? res.rData ?? res;
    setItems(d.items || []);
    setItemTotal(d.pagination?.total || 0);
    setRecent(d.recent || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadWardOptions();
  }, [loadWardOptions]);
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [searchQuery, limit]);

  const openWard = async (row: WardRow) => {
    setDetailWard({ wardId: row.wardId, name: row.name });
    setItemPage(1);
    setDetailLoading(true);
    try {
      await loadDetail(row.wardId, 1);
    } finally {
      setDetailLoading(false);
    }
  };

  const goItemPage = async (p: number) => {
    if (!detailWard) return;
    setItemPage(p);
    await loadDetail(detailWard.wardId, p);
  };

  const refreshDetail = async () => {
    if (!detailWard) return;
    await loadDetail(detailWard.wardId, itemPage);
    load();
  };

  const openIssue = async () => {
    setIssueError("");
    setIssueLines([{ itemId: "", name: "", qty: "1" }]);
    setIssueOpen(true);
    const res: any = await wardStockApi.catalogItems();
    const d = res.data ?? res.rData ?? res;
    setCatalog((d.items || []).map((i: any) => ({ ...i, itemId: i._id || i.itemId })));
  };

  const addIssueLine = () => setIssueLines((ls) => [...ls, { itemId: "", name: "", qty: "1" }]);
  const removeIssueLine = (i: number) => setIssueLines((ls) => ls.filter((_, idx) => idx !== i));
  const updateIssueLine = (i: number, patch: Partial<IssueLine>) =>
    setIssueLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const pickCatalogItem = (i: number, itemId: string) => {
    const it = catalog.find((c) => c.itemId === itemId);
    updateIssueLine(i, { itemId, name: it?.name || "" });
  };

  const submitIssue = async () => {
    if (!detailWard || issuing) return;
    const lines = issueLines
      .filter((l) => l.itemId && Number(l.qty) > 0)
      .map((l) => ({ itemId: l.itemId, qty: Number(l.qty) }));
    if (lines.length === 0) {
      setIssueError("Pick at least one item and quantity.");
      return;
    }
    setIssuing(true);
    setIssueError("");
    try {
      const res: any = await wardStockApi.issue(detailWard.wardId, lines);
      const d = res.data ?? res.rData ?? res;
      if (d?.skipped?.length) {
        setIssueError(`Skipped (insufficient central stock): ${d.skipped.join(", ")}`);
      } else {
        setIssueOpen(false);
      }
      await refreshDetail();
    } catch (e: any) {
      setIssueError(e.message || "Failed to issue stock");
    } finally {
      setIssuing(false);
    }
  };

  const openAdjust = (item: StockItem) => {
    setAdjustItem(item);
    setAdjustQty("1");
    setAdjustDirection("out");
    setAdjustReason("consumption");
    setAdjustNotes("");
    setAdjustError("");
  };

  const submitAdjust = async () => {
    if (!detailWard || !adjustItem || adjusting) return;
    const qty = Number(adjustQty);
    if (!qty || qty <= 0) {
      setAdjustError("Enter a valid quantity.");
      return;
    }
    setAdjusting(true);
    setAdjustError("");
    try {
      await wardStockApi.adjust(detailWard.wardId, {
        itemId: adjustItem.itemId,
        quantity: qty,
        direction: adjustDirection,
        reason: adjustReason,
        notes: adjustNotes.trim() || undefined,
      });
      setAdjustItem(null);
      await refreshDetail();
    } catch (e: any) {
      setAdjustError(e.message || "Failed to log movement");
    } finally {
      setAdjusting(false);
    }
  };

  const openTransfer = (item: StockItem) => {
    setTransferItem(item);
    setTransferToWardId("");
    setTransferQty("1");
    setTransferNotes("");
    setTransferError("");
  };

  const submitTransfer = async () => {
    if (!detailWard || !transferItem || transferring) return;
    const qty = Number(transferQty);
    if (!transferToWardId) {
      setTransferError("Pick a destination ward.");
      return;
    }
    if (!qty || qty <= 0) {
      setTransferError("Enter a valid quantity.");
      return;
    }
    setTransferring(true);
    setTransferError("");
    try {
      await wardStockApi.transfer(detailWard.wardId, {
        toWardId: transferToWardId,
        itemId: transferItem.itemId,
        quantity: qty,
        notes: transferNotes.trim() || undefined,
      });
      setTransferItem(null);
      await refreshDetail();
    } catch (e: any) {
      setTransferError(e.message || "Failed to transfer stock");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Ward Inventory"
        subtitle="Per-ward stock, issued from central inventory, with usage/wastage logging"
        actions={<Button variant="secondary" size="sm" onClick={load}>Refresh</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="w-64"
          placeholder="Search ward…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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

      <Table>
        <THead>
          <Th>Ward</Th>
          <Th>On-hand items</Th>
          <Th>On-hand qty</Th>
          <Th>Consumed qty</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={5}>Loading…</TableState>
          ) : wards.length === 0 ? (
            <TableState colSpan={5}>
              {searchQuery.trim()
                ? "No wards match that search."
                : "No wards found — add wards first in IPD Management, then issue stock to them here."}
            </TableState>
          ) : (
            wards.map((w) => (
              <TR key={w.wardId}>
                <Td className="font-medium text-gray-900">{w.name}</Td>
                <Td>{w.onHandLines}</Td>
                <Td>{w.onHandQty}</Td>
                <Td>{w.consumedQty}</Td>
                <Td className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => openWard(w)}>View stock</Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          label="wards"
          onPageChange={setPage}
        />
      </div>

      {/* Ward stock detail */}
      <Modal
        open={!!detailWard}
        onClose={() => setDetailWard(null)}
        title={detailWard ? `Stock — ${detailWard.name}` : undefined}
        size="lg"
      >
        {detailLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">On-hand stock</h4>
                <Button size="sm" onClick={openIssue}>+ Issue stock from store</Button>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-gray-500">No stock issued to this ward yet.</p>
              ) : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {items.map((i) => (
                    <div key={i.itemId} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-gray-800">{i.name}{i.unit ? ` (${i.unit})` : ""}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{i.quantity}</span>
                        <Button size="sm" variant="ghost" onClick={() => openTransfer(i)}>Transfer</Button>
                        <Button size="sm" variant="ghost" onClick={() => openAdjust(i)}>Log usage</Button>
                      </div>
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
              {recent.length === 0 ? (
                <p className="text-sm text-gray-500">No movements yet.</p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {recent.map((t) => (
                    <div key={t._id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-xs">
                      <span>
                        <Badge tone={t.type === "in" ? "success" : "warning"}>
                          {t.reason === "restock"
                            ? "Issued"
                            : t.reason === "transfer"
                              ? (t.type === "out" ? "Transferred out" : "Transferred in")
                              : t.reason === "adjustment"
                                ? "Adjusted"
                                : "Used"}
                        </Badge>
                        <span className="ml-2 text-gray-800">{t.itemName} × {t.quantity}</span>
                        {t.reason === "transfer" && t.transferWardName && (
                          <span className="ml-1 text-gray-400">
                            · {t.type === "out" ? `to ${t.transferWardName}` : `from ${t.transferWardName}`}
                          </span>
                        )}
                        {t.notes && <span className="ml-1 text-gray-400">· {t.notes}</span>}
                      </span>
                      <span className="text-gray-400">{new Date(t.at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Issue stock from central store */}
      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title={`Issue stock — ${detailWard?.name || ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button onClick={submitIssue} disabled={issuing}>{issuing ? "Issuing…" : "Issue"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {issueError && <Alert tone="danger">{issueError}</Alert>}
          <div className="grid grid-cols-[1fr_84px_28px] items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>Item</span><span>Qty</span><span />
          </div>
          {issueLines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_84px_28px] items-center gap-2">
              <select
                value={l.itemId}
                onChange={(e) => pickCatalogItem(i, e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="">— Select item —</option>
                {catalog.map((c) => (
                  <option key={c.itemId} value={c.itemId}>
                    {c.name}{c.currentStock != null ? ` · ${c.currentStock} in store` : ""}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                value={l.qty}
                onChange={(e) => updateIssueLine(i, { qty: e.target.value })}
              />
              <button
                type="button"
                className="text-gray-400 hover:text-red-600"
                onClick={() => removeIssueLine(i)}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={addIssueLine}>+ Add item</Button>
        </div>
      </Modal>

      {/* Log usage / adjustment for one item */}
      <Modal
        open={!!adjustItem}
        onClose={() => setAdjustItem(null)}
        title={adjustItem ? `Log movement — ${adjustItem.name}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustItem(null)}>Cancel</Button>
            <Button onClick={submitAdjust} disabled={adjusting}>{adjusting ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {adjustError && <Alert tone="danger">{adjustError}</Alert>}
          <Field label="Direction">
            <select
              value={adjustDirection}
              onChange={(e) => setAdjustDirection(e.target.value as "in" | "out")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            >
              <option value="out">Used / removed from ward (–)</option>
              <option value="in">Found / returned to ward (+)</option>
            </select>
          </Field>
          <Field label="Reason">
            <select
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value as "consumption" | "adjustment")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            >
              <option value="consumption">Consumption (used on a patient)</option>
              <option value="adjustment">Correction (count mismatch, wastage, etc.)</option>
            </select>
          </Field>
          <Field label="Quantity">
            <Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
          </Field>
          <Field label="Notes (optional)">
            <Input value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} placeholder="e.g. Patient bed 4, or damaged in transit" />
          </Field>
        </div>
      </Modal>

      {/* Transfer to another ward */}
      <Modal
        open={!!transferItem}
        onClose={() => setTransferItem(null)}
        title={transferItem ? `Transfer — ${transferItem.name}` : undefined}
        subtitle={detailWard ? `From ${detailWard.name}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTransferItem(null)}>Cancel</Button>
            <Button onClick={submitTransfer} disabled={transferring}>{transferring ? "Transferring…" : "Transfer"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {transferError && <Alert tone="danger">{transferError}</Alert>}
          <Field label="Destination ward">
            <select
              value={transferToWardId}
              onChange={(e) => setTransferToWardId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            >
              <option value="">— Select ward —</option>
              {/* The only filtering left on the client: a ward cannot be its
                  own transfer destination, which the backend has no filter for. */}
              {wardOptions
                .filter((w) => w.wardId !== detailWard?.wardId)
                .map((w) => (
                  <option key={w.wardId} value={w.wardId}>{w.name}</option>
                ))}
            </select>
          </Field>
          <Field label="Quantity">
            <Input type="number" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} />
            {transferItem && (
              <p className="mt-1 text-xs text-gray-400">{transferItem.quantity} available in {detailWard?.name}</p>
            )}
          </Field>
          <Field label="Notes (optional)">
            <Input value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} placeholder="e.g. ICU running low" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

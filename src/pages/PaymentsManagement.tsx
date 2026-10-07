// Payments. Every rupee the gateway has actually taken, and the refunds sent
// back against it. Before the generic payment ledger existed this view was not
// possible: each domain kept its own payment columns and a "refund" was a
// status change with no money behind it.
import { useCallback, useEffect, useState } from "react";
import { IndianRupee, RotateCcw, Search, Wallet } from "lucide-react";

import { paymentApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import { dialog } from "../services/dialog";
import Pagination from "../components/Pagination";
import {
  PageHeader, Button, Card, Select, Input, Table, THead, TBody, TR, Th, Td,
  TableState, Badge, Modal, Alert,
} from "../components/ui";

interface Refund {
  refundId: string;
  amount: number;
  status: string;
  reason?: string;
  at: string;
}

interface Payment {
  _id: string;
  purpose: string;
  refId?: string;
  description: string;
  amount: number;
  currency: string;
  receipt?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  method?: string;
  status: "CREATED" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  paidAt?: string;
  fulfilledAt?: string;
  failureReason?: string;
  refundedAmount: number;
  refunds: Refund[];
  createdAt: string;
  userId?: { _id: string; fullName?: string; mobileNumber?: string; email?: string };
}

interface Totals {
  collected: number;
  refunded: number;
  net: number;
  count: number;
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const statusTone: Record<string, Tone> = {
  PAID: "success",
  CREATED: "info",
  FAILED: "danger",
  REFUNDED: "warning",
  PARTIALLY_REFUNDED: "warning",
};

const PURPOSES: { value: string; label: string }[] = [
  { value: "", label: "All purposes" },
  { value: "ambulance_booking", label: "Ambulance booking (prepaid)" },
  { value: "ambulance_ride", label: "Ambulance trip" },
  { value: "ambulance_cancellation", label: "Cancellation charge" },
  { value: "consultation", label: "Doctor consultation" },
  { value: "lab_booking", label: "Lab tests" },
  { value: "pharmacy_order", label: "Pharmacy order" },
  { value: "membership", label: "Membership" },
  { value: "wallet_topup", label: "Wallet top-up" },
];

const purposeLabel = (p: string) =>
  PURPOSES.find((x) => x.value === p)?.label ||
  p.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const money = (n?: number) =>
  `₹${(Math.round((n || 0) * 100) / 100).toLocaleString("en-IN")}`;

const when = (s?: string) =>
  s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function PaymentsManagement() {
  const { hasPermission } = useAuth();
  const canRefund = hasPermission(PERMISSIONS.PAYMENTS_REFUND);

  const [items, setItems] = useState<Payment[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");
  const [search, setSearch] = useState("");
  // What's actually queried: typing shouldn't fire a request per keystroke.
  const [searchQuery, setSearchQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [open, setOpen] = useState<Payment | null>(null);
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string | number> = { page, limit };
      if (status) params.status = status;
      if (purpose) params.purpose = purpose;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await paymentApi.list(params);
      setItems(res.data?.items || []);
      setTotal(res.data?.pagination?.total || 0);
      setTotals(res.data?.totals || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [page, limit, status, purpose, searchQuery, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [status, purpose, searchQuery, from, to, limit]);

  const filtered = !!(status || purpose || searchQuery.trim() || from || to);
  const clearFilters = () => {
    setStatus("");
    setPurpose("");
    setSearch("");
    setFrom("");
    setTo("");
  };

  const refundable = (p: Payment) =>
    (p.status === "PAID" || p.status === "PARTIALLY_REFUNDED") &&
    p.amount - (p.refundedAmount || 0) > 0;

  /**
   * Refund.
   *
   * Defaults to the whole remaining balance, which is what "refund this"
   * means nearly every time, and leaves the operator free to type a smaller
   * figure for a part-refund. Real money leaves the account, so the amount is
   * confirmed rather than assumed.
   */
  const doRefund = async (p: Payment) => {
    const remaining = Math.round((p.amount - (p.refundedAmount || 0)) * 100) / 100;
    const entered = await dialog.prompt({
      title: `Refund ${money(remaining)}?`,
      message:
        `This sends a real refund to ${p.userId?.fullName || "the customer"} through Razorpay. ` +
        `It reaches their account in 5–7 working days and cannot be undone. ` +
        `Change the amount below for a part-refund.`,
      defaultValue: String(remaining),
      inputType: "number",
      confirmLabel: "Send refund",
      tone: "danger",
    });
    if (entered === null) return;
    const amount = Number(entered);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      setError(`Enter an amount between ₹0.01 and ${money(remaining)}.`);
      return;
    }
    const reason = await dialog.prompt({
      title: "Why is this being refunded?",
      message: "Recorded against the payment so the finance trail explains itself later.",
      placeholder: "e.g. trip cancelled after payment",
      confirmLabel: "Refund",
    });
    if (reason === null) return;

    setRefunding(true);
    setError("");
    try {
      const res = await paymentApi.refund(p._id, { amount, reason: reason || undefined });
      setNotice(res.message || `Refunded ${money(amount)}.`);
      setOpen(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The refund could not be sent.");
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        subtitle="Money collected through the gateway, and refunds sent back against it"
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {totals && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              <IndianRupee className="h-4 w-4" /> Collected
            </div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{money(totals.collected)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              <RotateCcw className="h-4 w-4" /> Refunded
            </div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">{money(totals.refunded)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              <Wallet className="h-4 w-4" /> Net
            </div>
            <div className="mt-1 text-2xl font-semibold text-green-700">{money(totals.net)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Payments</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{totals.count}</div>
            {/* The figures above follow the filters, not the page — a per-page
                total is a number nobody can act on. */}
            <div className="mt-0.5 text-[11px] text-gray-400">matching these filters</div>
          </Card>
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payment id, order id or description"
              className="pl-9"
            />
          </div>
          <Select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-56">
            {PURPOSES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="">Paid &amp; refunded</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_REFUNDED">Partly refunded</option>
            <option value="REFUNDED">Refunded</option>
            <option value="FAILED">Failed</option>
            <option value="CREATED">Abandoned</option>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          <Select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-28"
          >
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </Select>
          {filtered && (
            <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>
          )}
        </div>
      </Card>

      <Card>
        <Table>
          <THead>
            <TR>
              <Th>When</Th>
              <Th>Customer</Th>
              <Th>For</Th>
              <Th>Amount</Th>
              <Th>Method</Th>
              <Th>Status</Th>
              <Th>Gateway id</Th>
              <Th />
            </TR>
          </THead>
          <TBody>
            {loading && <TableState colSpan={8}>Loading…</TableState>}
            {!loading && items.length === 0 && (
              <TableState colSpan={8}>
                {filtered
                  ? "No payments match these filters. Clear them to see everything."
                  : "No payments yet. They appear here as soon as the first one is collected."}
              </TableState>
            )}
            {!loading &&
              items.map((p) => (
                <TR key={p._id} className="cursor-pointer" onClick={() => setOpen(p)}>
                  <Td className="whitespace-nowrap text-xs text-gray-500">
                    {when(p.paidAt || p.createdAt)}
                  </Td>
                  <Td>
                    <div className="font-medium text-gray-800">
                      {p.userId?.fullName || "—"}
                    </div>
                    <div className="text-xs text-gray-500">{p.userId?.mobileNumber || ""}</div>
                  </Td>
                  <Td>
                    <div className="text-sm text-gray-800">{purposeLabel(p.purpose)}</div>
                    <div className="text-xs text-gray-500">{p.description}</div>
                  </Td>
                  <Td className="whitespace-nowrap font-medium">
                    {money(p.amount)}
                    {p.refundedAmount > 0 && (
                      <div className="text-xs font-normal text-amber-600">
                        −{money(p.refundedAmount)} refunded
                      </div>
                    )}
                  </Td>
                  <Td className="text-xs text-gray-600">
                    {p.method === "wallet_internal" ? "HealWin wallet" : p.method || "—"}
                  </Td>
                  <Td>
                    <Badge tone={statusTone[p.status] || "neutral"}>
                      {p.status === "PARTIALLY_REFUNDED"
                        ? "Part refunded"
                        : p.status === "CREATED"
                          ? "Abandoned"
                          : p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                    </Badge>
                  </Td>
                  <Td className="font-mono text-[11px] text-gray-500">
                    {p.gatewayPaymentId || p.gatewayOrderId || "—"}
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    {canRefund && refundable(p) && (
                      <Button size="sm" variant="ghost" onClick={() => doRefund(p)}>
                        Refund
                      </Button>
                    )}
                  </Td>
                </TR>
              ))}
          </TBody>
        </Table>
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          label="payments"
          onPageChange={setPage}
        />
      </Card>

      <Modal open={!!open} onClose={() => setOpen(null)} title="Payment detail" size="lg">
        {open && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <Row label="Customer" value={open.userId?.fullName || "—"} />
              <Row label="Phone" value={open.userId?.mobileNumber || "—"} />
              <Row label="For" value={purposeLabel(open.purpose)} />
              <Row label="Description" value={open.description} />
              <Row label="Amount" value={money(open.amount)} />
              <Row label="Method" value={open.method === "wallet_internal" ? "HealWin wallet" : open.method || "—"} />
              <Row label="Status" value={open.status} />
              <Row label="Paid at" value={when(open.paidAt)} />
              <Row label="Gateway order" value={open.gatewayOrderId || "—"} mono />
              <Row label="Gateway payment" value={open.gatewayPaymentId || "—"} mono />
              <Row label="Receipt" value={open.receipt || "—"} mono />
              <Row label="Linked record" value={open.refId || "—"} mono />
            </div>

            {open.status === "PAID" && !open.fulfilledAt && (
              <Alert tone="warning">
                This payment was collected but the thing it paid for has not been
                applied yet. It retries automatically — if it stays this way,
                flag it rather than taking the money again.
              </Alert>
            )}
            {open.failureReason && (
              <Alert tone="danger">{open.failureReason}</Alert>
            )}

            {open.refunds.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Refunds
                </div>
                <div className="space-y-1">
                  {open.refunds.map((r) => (
                    <div
                      key={r.refundId}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                    >
                      <span>
                        <span className="font-medium">{money(r.amount)}</span>{" "}
                        <span className="text-xs text-gray-500">{r.reason || "no reason given"}</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        {r.status} · {when(r.at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canRefund && refundable(open) && (
              <div className="flex justify-end">
                <Button variant="danger" disabled={refunding} onClick={() => doRefund(open)}>
                  {refunding ? "Refunding…" : `Refund ${money(open.amount - open.refundedAmount)}`}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
    <div className={mono ? "break-all font-mono text-xs text-gray-700" : "text-gray-800"}>
      {value}
    </div>
  </div>
);

import { useEffect, useState, useCallback } from "react";
import { Eye } from "lucide-react";
import { billingApi, hospitalPatientApi } from "../services/admin-api";
import type { InvoiceLineItem } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import {
  PageHeader,
  Button,
  Select,
  Input,
  Card,
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
  Alert,
  cn,
} from "../components/ui";

interface InvoiceRow {
  _id: string;
  invoiceNo: string;
  patientId?: { patientId?: string; fullName?: string; phone?: string };
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  createdAt: string;
}

const SECTIONS: InvoiceLineItem["section"][] = [
  "consultation",
  "procedure",
  "nursing",
  "room",
  "bed",
  "pharmacy",
  "diagnostics",
  "other",
];
const METHODS = ["cash", "card", "upi", "insurance", "wallet"];

const statusTone: Record<
  string,
  "success" | "warning" | "danger" | "accent" | "neutral"
> = {
  paid: "success",
  partial: "warning",
  unpaid: "danger",
  refunded: "accent",
  draft: "neutral",
  cancelled: "neutral",
};

export default function BillingManagement() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.BILLING_CREATE);
  const canPay = hasPermission(PERMISSIONS.BILLING_PAYMENT);
  const canRefund = hasPermission(PERMISSIONS.BILLING_REFUND);
  const canReports = hasPermission(PERMISSIONS.BILLING_REPORTS);

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState<"invoices" | "reports">("invoices");

  // Create invoice
  const [showCreate, setShowCreate] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { section: "consultation", description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [createErr, setCreateErr] = useState("");

  // Detail / payment
  const [detail, setDetail] = useState<any>(null);
  const [pay, setPay] = useState({ method: "cash", amount: "", reference: "" });

  // Reports
  const [report, setReport] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await billingApi.list(params);
      setRows(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "reports" && canReports && !report) {
      billingApi.reports().then((r) => setReport(r.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const searchPatients = async (q: string) => {
    setPatientSearch(q);
    if (q.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    const res = await hospitalPatientApi.list({ search: q.trim(), limit: 8 });
    setPatientResults(res.data?.items || []);
  };

  const lineTotal = (li: InvoiceLineItem) =>
    (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0);
  const subtotal = lineItems.reduce((s, li) => s + lineTotal(li), 0);
  const grandTotal = subtotal + (subtotal * taxPercent) / 100 - discount;

  const resetCreate = () => {
    setSelectedPatient(null);
    setPatientSearch("");
    setPatientResults([]);
    setLineItems([
      { section: "consultation", description: "", quantity: 1, unitPrice: 0 },
    ]);
    setTaxPercent(0);
    setDiscount(0);
    setCreateErr("");
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErr("");
    if (!selectedPatient) {
      setCreateErr("Select a patient.");
      return;
    }
    const items = lineItems.filter((li) => li.description.trim());
    if (items.length === 0) {
      setCreateErr("Add at least one line item.");
      return;
    }
    try {
      await billingApi.create({
        patientId: selectedPatient._id,
        lineItems: items,
        taxPercent,
        discount,
      });
      setShowCreate(false);
      resetCreate();
      load();
    } catch (err: any) {
      setCreateErr(err.message || "Failed to create invoice");
    }
  };

  const openDetail = async (id: string) => {
    const res = await billingApi.detail(id);
    setDetail(res.data?.invoice);
    setPay({ method: "cash", amount: "", reference: "" });
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    try {
      const res = await billingApi.recordPayment(detail._id, {
        method: pay.method,
        amount: Number(pay.amount),
        reference: pay.reference || undefined,
      });
      setDetail(res.data?.invoice);
      setPay({ method: "cash", amount: "", reference: "" });
      load();
    } catch (err: any) {
      alert(err.message || "Failed to record payment");
    }
  };

  const submitRefund = async () => {
    if (!detail) return;
    const amount = window.prompt("Refund amount? (refunds to original method)");
    if (!amount) return;
    try {
      const res = await billingApi.refund(detail._id, { amount: Number(amount) });
      setDetail(res.data?.invoice);
      load();
    } catch (err: any) {
      alert(err.message || "Failed to refund");
    }
  };

  const submitAdvance = async () => {
    if (!detail) return;
    const amount = window.prompt("Advance deposit amount?");
    if (!amount) return;
    const method = window.prompt("Method (cash/card/upi/insurance/wallet)?", "cash") || "cash";
    try {
      const res = await billingApi.advance(detail._id, { amount: Number(amount), method });
      setDetail(res.data?.invoice);
      load();
    } catch (err: any) {
      alert(err.message || "Failed to record advance");
    }
  };

  // Open a clean, printable GST tax invoice / receipt in a new window.
  const printInvoice = (inv: any) => {
    if (!inv) return;
    const fmt = (n: number) => `Rs ${(n || 0).toFixed(2)}`;
    const half = (inv.taxPercent || 0) / 2;
    const rows = (inv.lineItems || [])
      .map(
        (li: any) =>
          `<tr><td style="text-transform:capitalize">${li.section}</td><td>${li.description || ""}</td><td style="text-align:right">${li.quantity}</td><td style="text-align:right">${fmt(li.unitPrice)}</td><td style="text-align:right">${fmt(li.amount)}</td></tr>`,
      )
      .join("");
    const pays = (inv.payments || [])
      .map(
        (p: any) =>
          `<div>${p.isRefund ? "Refund " : ""}${p.method} ${fmt(p.amount)} &middot; ${new Date(p.paidAt).toLocaleDateString()}${p.reference ? " &middot; " + p.reference : ""}</div>`,
      )
      .join("");
    const html = `<!doctype html><html><head><title>${inv.invoiceNo}</title><meta charset="utf-8"/>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:24px;max-width:720px;margin:auto}
h1{font-size:20px;margin:0}.muted{color:#666;font-size:12px}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
th,td{padding:6px 8px;border-bottom:1px solid #eee}th{text-align:left;background:#f7f7f7}
.totals{margin-top:12px;text-align:right;font-size:13px}.totals .grand{font-size:16px;font-weight:700;margin-top:4px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px}
</style></head><body>
<div class="hdr">
<div><h1>HealWin Hospital</h1><div class="muted">Tax Invoice / Receipt</div>${inv.gstin ? `<div class="muted">GSTIN: ${inv.gstin}</div>` : ""}</div>
<div style="text-align:right"><div><b>${inv.invoiceNo}</b></div><div class="muted">${new Date(inv.createdAt || Date.now()).toLocaleString()}</div><div class="muted">Status: ${inv.status}</div></div>
</div>
<div style="margin-top:12px;font-size:13px"><b>Patient:</b> ${inv.patientId?.fullName || "-"} ${inv.patientId?.patientId ? `(${inv.patientId.patientId})` : ""}<br/>${inv.patientId?.mobileNumber || inv.patientId?.phone || ""}</div>
<table><thead><tr><th>Section</th><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals">
<div>Subtotal: ${fmt(inv.subtotal)}</div>
${inv.taxAmount > 0 ? `<div>CGST (${half}%): ${fmt(inv.cgstAmount ?? inv.taxAmount / 2)}</div><div>SGST (${half}%): ${fmt(inv.sgstAmount ?? inv.taxAmount / 2)}</div>` : ""}
${inv.discount ? `<div>Discount: -${fmt(inv.discount)}</div>` : ""}
<div class="grand">Total: ${fmt(inv.total)}</div>
<div style="color:#15803d">Paid: ${fmt(inv.amountPaid)}</div>
<div style="color:#b91c1c">Balance Due: ${fmt(inv.balanceDue)}</div>
</div>
${pays ? `<div style="margin-top:16px;font-size:12px;color:#444"><b>Payments</b>${pays}</div>` : ""}
<p class="muted" style="margin-top:24px">This is a computer-generated invoice.</p>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) {
      alert("Please allow pop-ups to print the invoice.");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Billing Management"
        subtitle="Invoices, payments & financial reports — Doctor Panel (HMS)"
        actions={
          canCreate && tab === "invoices" ? (
            <Button
              onClick={() => {
                resetCreate();
                setShowCreate(true);
              }}
            >
              + New Invoice
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-4 mb-4 border-b border-gray-200">
        <button
          onClick={() => setTab("invoices")}
          className={cn(
            "pb-2 text-sm",
            tab === "invoices"
              ? "border-b-2 border-healwin-600 text-healwin-700 font-medium"
              : "text-gray-500",
          )}
        >
          Invoices
        </button>
        {canReports && (
          <button
            onClick={() => setTab("reports")}
            className={cn(
              "pb-2 text-sm",
              tab === "reports"
                ? "border-b-2 border-healwin-600 text-healwin-700 font-medium"
                : "text-gray-500",
            )}
          >
            Financial Reports
          </button>
        )}
      </div>

      {tab === "invoices" ? (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-auto"
            >
              <option value="">All statuses</option>
              {["unpaid", "partial", "paid", "refunded", "draft", "cancelled"].map(
                (s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ),
              )}
            </Select>
          </div>

          <Table>
            <THead>
              <Th>Invoice</Th>
              <Th>Patient</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Paid</Th>
              <Th className="text-right">Due</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </THead>
            <TBody>
              {loading ? (
                <TableState colSpan={7}>Loading…</TableState>
              ) : rows.length === 0 ? (
                <TableState colSpan={7}>No invoices.</TableState>
              ) : (
                rows.map((r) => (
                  <TR key={r._id}>
                    <Td className="font-mono text-xs">{r.invoiceNo}</Td>
                    <Td>{r.patientId?.fullName || "—"}</Td>
                    <Td className="text-right">₹{r.total.toFixed(2)}</Td>
                    <Td className="text-right">₹{r.amountPaid.toFixed(2)}</Td>
                    <Td className="text-right">₹{r.balanceDue.toFixed(2)}</Td>
                    <Td>
                      <Badge tone={statusTone[r.status] || "neutral"} dot>
                        {r.status}
                      </Badge>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-2"
                        title="View"
                        aria-label="View"
                        onClick={() => openDetail(r._id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Td>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </>
      ) : (
        <ReportsPanel report={report} />
      )}

      {/* Create invoice modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Invoice"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={submitCreate}>Create Invoice</Button>
          </>
        }
      >
        <form onSubmit={submitCreate} className="space-y-4">
          {createErr && <Alert tone="danger">{createErr}</Alert>}

          {/* Patient picker */}
          {selectedPatient ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span>
                {selectedPatient.fullName}{" "}
                <span className="font-mono text-xs text-gray-500">
                  {selectedPatient.patientId}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setSelectedPatient(null)}
              >
                Change
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                value={patientSearch}
                onChange={(e) => searchPatients(e.target.value)}
                placeholder="Search patient by name / ID / phone"
              />
              {patientResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow">
                  {patientResults.map((p) => (
                    <button
                      type="button"
                      key={p._id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientResults([]);
                      }}
                      className="block w-full px-3 py-2 text-left hover:bg-gray-50"
                    >
                      {p.fullName}{" "}
                      <span className="font-mono text-xs text-gray-400">
                        {p.patientId}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Line Items</h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setLineItems([
                    ...lineItems,
                    {
                      section: "other",
                      description: "",
                      quantity: 1,
                      unitPrice: 0,
                    },
                  ])
                }
              >
                + Add line
              </Button>
            </div>
            {lineItems.map((li, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <Select
                  value={li.section}
                  onChange={(e) => {
                    const next = [...lineItems];
                    next[i] = { ...li, section: e.target.value as any };
                    setLineItems(next);
                  }}
                  className="col-span-3 capitalize"
                >
                  {SECTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
                <Input
                  placeholder="Description"
                  value={li.description}
                  onChange={(e) => {
                    const next = [...lineItems];
                    next[i] = { ...li, description: e.target.value };
                    setLineItems(next);
                  }}
                  className="col-span-4"
                />
                <Input
                  type="number"
                  placeholder="Qty"
                  value={li.quantity}
                  onChange={(e) => {
                    const next = [...lineItems];
                    next[i] = { ...li, quantity: Number(e.target.value) };
                    setLineItems(next);
                  }}
                  className="col-span-2"
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={li.unitPrice}
                  onChange={(e) => {
                    const next = [...lineItems];
                    next[i] = { ...li, unitPrice: Number(e.target.value) };
                    setLineItems(next);
                  }}
                  className="col-span-2"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="col-span-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                  onClick={() =>
                    setLineItems(lineItems.filter((_, idx) => idx !== i))
                  }
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tax %">
              <Input
                type="number"
                value={taxPercent}
                onChange={(e) => setTaxPercent(Number(e.target.value))}
              />
            </Field>
            <Field label="Discount ₹">
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="text-right text-sm text-gray-600">
            Subtotal ₹{subtotal.toFixed(2)} · Total{" "}
            <span className="text-lg font-semibold text-gray-900">
              ₹{grandTotal.toFixed(2)}
            </span>
          </div>
        </form>
      </Modal>

      {/* Detail / payment modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.invoiceNo}
        subtitle={detail?.patientId?.fullName}
        size="md"
        footer={
          <>
            {canRefund && detail?.amountPaid > 0 && (
              <Button
                variant="ghost"
                className="mr-auto text-red-600 border border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={submitRefund}
              >
                Refund
              </Button>
            )}
            <Button variant="secondary" onClick={() => billingApi.downloadPdf(detail._id, "pdf").catch((e: any) => alert(e.message))}>
              Invoice PDF
            </Button>
            <Button variant="secondary" onClick={() => billingApi.downloadPdf(detail._id, "receipt").catch((e: any) => alert(e.message))}>
              Receipt
            </Button>
            <Button variant="secondary" onClick={submitAdvance}>
              + Advance
            </Button>
            <Button variant="secondary" onClick={() => printInvoice(detail)}>
              Print
            </Button>
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Close
            </Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-3">
            <table className="w-full text-sm">
              <tbody>
                {detail.lineItems?.map((li: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 capitalize">{li.section}</td>
                    <td className="py-1">{li.description}</td>
                    <td className="py-1 text-right">
                      {li.quantity}×₹{li.unitPrice}
                    </td>
                    <td className="py-1 text-right">₹{li.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-sm text-right text-gray-600">
              {detail.gstin && (
                <div className="text-xs text-gray-400">GSTIN: {detail.gstin}</div>
              )}
              <div>Subtotal: ₹{detail.subtotal?.toFixed(2)}</div>
              {detail.taxAmount > 0 && (
                <>
                  <div>
                    CGST ({(detail.taxPercent / 2).toFixed(2)}%): ₹
                    {(detail.cgstAmount ?? detail.taxAmount / 2).toFixed(2)}
                  </div>
                  <div>
                    SGST ({(detail.taxPercent / 2).toFixed(2)}%): ₹
                    {(detail.sgstAmount ?? detail.taxAmount / 2).toFixed(2)}
                  </div>
                </>
              )}
              <div>Discount: ₹{detail.discount?.toFixed(2)}</div>
              <div className="font-semibold text-gray-900">
                Total: ₹{detail.total?.toFixed(2)}
              </div>
              <div className="text-green-700">
                Paid: ₹{detail.amountPaid?.toFixed(2)}
              </div>
              <div className="font-semibold text-red-700">
                Due: ₹{detail.balanceDue?.toFixed(2)}
              </div>
            </div>

            {detail.payments?.length > 0 && (
              <div className="text-xs text-gray-500">
                <div className="mb-1 font-semibold">Payments</div>
                {detail.payments.map((p: any, i: number) => (
                  <div key={i}>
                    {p.isRefund ? "↩ Refund " : ""}
                    {p.method} ₹{p.amount} ·{" "}
                    {new Date(p.paidAt).toLocaleDateString()}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </div>
                ))}
              </div>
            )}

            {canPay && detail.balanceDue > 0 && (
              <form onSubmit={submitPayment} className="flex gap-2 pt-2 border-t border-gray-200">
                <Select
                  value={pay.method}
                  onChange={(e) => setPay({ ...pay, method: e.target.value })}
                  className="w-auto capitalize"
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m} className="capitalize">
                      {m}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  placeholder="Amount"
                  value={pay.amount}
                  onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="Ref"
                  value={pay.reference}
                  onChange={(e) => setPay({ ...pay, reference: e.target.value })}
                  className="w-20"
                />
                <Button type="submit">Pay</Button>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ReportsPanel({ report }: { report: any }) {
  if (!report) return <div className="text-gray-400">Loading report…</div>;
  const s = report.summary;
  const card = (label: string, value: string, cls: string) => (
    <Card padded className={cls}>
      <div className="text-xs">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </Card>
  );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {card("Invoices", String(s.invoiceCount), "")}
        {card("Billed", `₹${s.totalBilled.toFixed(0)}`, "")}
        {card(
          "Collected",
          `₹${s.totalCollected.toFixed(0)}`,
          "border-green-200 bg-green-50 text-green-800",
        )}
        {card(
          "Outstanding",
          `₹${s.totalOutstanding.toFixed(0)}`,
          "border-red-200 bg-red-50 text-red-800",
        )}
      </div>
      {report.taxSummary && (
        <Card padded>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">GST tax summary</h3>
          <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
            <div className="flex justify-between"><span className="text-gray-600">Taxable</span><span>₹{report.taxSummary.taxableValue.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">CGST</span><span>₹{report.taxSummary.cgst.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">SGST</span><span>₹{report.taxSummary.sgst.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold"><span className="text-gray-600">Total GST</span><span>₹{report.taxSummary.totalTax.toFixed(2)}</span></div>
          </div>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card padded>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Revenue by section (service-wise)
          </h3>
          {Object.entries(report.sectionRevenue || {}).map(([k, v]) => (
            <div key={k} className="flex justify-between py-1 text-sm">
              <span className="capitalize text-gray-600">{k}</span>
              <span>₹{(v as number).toFixed(2)}</span>
            </div>
          ))}
        </Card>
        <Card padded>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Collections by method
          </h3>
          {Object.entries(report.methodCollections || {}).map(([k, v]) => (
            <div key={k} className="flex justify-between py-1 text-sm">
              <span className="capitalize text-gray-600">{k}</span>
              <span>₹{(v as number).toFixed(2)}</span>
            </div>
          ))}
        </Card>
        <Card padded>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Doctor-wise revenue</h3>
          {(report.doctorRevenue || []).length === 0 ? (
            <div className="text-sm text-gray-400">No doctor-tagged invoices.</div>
          ) : (
            (report.doctorRevenue || []).map((d: any) => (
              <div key={d.doctorId} className="flex justify-between py-1 text-sm">
                <span className="text-gray-600">{d.name}</span>
                <span>₹{d.amount.toFixed(2)}</span>
              </div>
            ))
          )}
        </Card>
        <Card padded>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Department-wise revenue</h3>
          {(report.departmentRevenue || []).length === 0 ? (
            <div className="text-sm text-gray-400">No department-tagged invoices.</div>
          ) : (
            (report.departmentRevenue || []).map((d: any) => (
              <div key={d.departmentId} className="flex justify-between py-1 text-sm">
                <span className="text-gray-600">{d.name}</span>
                <span>₹{d.amount.toFixed(2)}</span>
              </div>
            ))
          )}
        </Card>
      </div>
      <Card padded>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Daily collections
        </h3>
        {(report.dailyCollections || []).map((d: any) => (
          <div key={d.date} className="flex justify-between py-1 text-sm">
            <span className="text-gray-600">{d.date}</span>
            <span>₹{d.amount.toFixed(2)}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

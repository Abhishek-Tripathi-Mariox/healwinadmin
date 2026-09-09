import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Lock, Play, ArrowLeft } from "lucide-react";
import { payrollApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import {
  PageHeader, Button, Select, Card, Table, THead, TBody, TR, Th, Td, TableState, Badge,
} from "../../components/ui";
import { dialog } from "../../services/dialog";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

interface Run {
  _id: string; month: number; year: number; status: string;
  employeeCount: number; totalGross: number; totalDeductions: number; totalNet: number;
  totalOvertimeAmount?: number;
  verifiedAt?: string;
}
/** Employees paid for days nobody marked — reported back by the generate call. */
interface UnmarkedWarning {
  name: string;
  unmarkedDays: number;
  serviceDays: number;
}
interface Payslip {
  _id: string; employeeCode: string; employeeName: string; month: number; year: number;
  paidDays: number; lopDays: number; serviceDays?: number; totalDays?: number; unmarkedDays?: number;
  earnings: { gross: number }; deductions: { total: number }; netPay: number;
}

const now = new Date();

export default function PayrollManagement() {
  const { hasPermission } = useAuth();
  const canProcess = hasPermission(PERMISSIONS.PAYROLL_PROCESS);
  const canFinalize = hasPermission(PERMISSIONS.PAYROLL_FINALIZE);
  const canVerify = hasPermission(PERMISSIONS.PAYROLL_VERIFY);

  // The dashboard's payroll card links here with the month of the latest run,
  // which is often not the current one. Reading them from the URL means the
  // page opens on the run you clicked rather than on today's month.
  const [searchParams] = useSearchParams();
  const monthParam = Number(searchParams.get("month"));
  const yearParam = Number(searchParams.get("year"));
  const [month, setMonth] = useState(
    monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1,
  );
  const [year, setYear] = useState(
    yearParam >= 2000 && yearParam <= 2200 ? yearParam : now.getFullYear(),
  );
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [openRun, setOpenRun] = useState<Run | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payrollApi.runs();
      setRuns(res.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const generate = async (acknowledgeUnmarked = false) => {
    setGenerating(true);
    try {
      const res = await payrollApi.generate({ month, year, acknowledgeUnmarked });
      await loadRuns();
      const warn: UnmarkedWarning[] = res.data?.unmarkedWarnings || [];
      if (warn.length) {
        // Paid on assumption rather than on record — say so before HR finalises.
        const lines = warn
          .slice(0, 10)
          .map((w) => `• ${w.name}: ${w.unmarkedDays} of ${w.serviceDays} days unmarked`)
          .join("\n");
        void dialog.alert(
          `Payroll generated, but attendance is incomplete.\n\n${lines}` +
            (warn.length > 10 ? `\n…and ${warn.length - 10} more` : "") +
            "\n\nUnmarked days are paid as worked. Mark attendance and re-generate if that is wrong.",
        );
      }
      if (res.data?.run) viewRun(res.data.run);
    } catch (err: any) {
      // The month has no attendance at all — everyone would be paid in full.
      if (err?.data?.unmarkedMonth && !acknowledgeUnmarked) {
        if (await dialog.confirm(`${err.data.hint}\n\nGenerate anyway?`)) {
          return generate(true);
        }
        return;
      }
      void dialog.alert(err?.data?.hint || err.message || "Failed to generate payroll");
    } finally {
      setGenerating(false);
    }
  };

  // HR signs the sheet off before it can be locked (§8). Re-generating clears
  // the sign-off, because the figures being approved have changed.
  const verify = async (run: Run) => {
    if (
      !(await dialog.confirm({
        title: `Verify the ${MONTHS[run.month - 1]} ${run.year} payroll?`,
        message:
          "This records that you have checked the figures. The run can then be finalized.",
        confirmLabel: "Verify",
      }))
    )
      return;
    try {
      await payrollApi.verify(run._id);
      await loadRuns();
      const res = await payrollApi.runDetail(run._id);
      setOpenRun(res.data?.run || null);
      setPayslips(res.data?.payslips || []);
    } catch (err: unknown) {
      const e = err as { data?: { hint?: string }; message?: string };
      void dialog.alert(e.data?.hint || e.message || "Failed to verify the run");
    }
  };

  const viewRun = async (run: Run) => {
    const res = await payrollApi.runDetail(run._id);
    setOpenRun(res.data?.run || run);
    setPayslips(res.data?.payslips || []);
  };

  const finalize = async () => {
    if (!openRun) return;
    if (!await dialog.confirm({ message: "Finalize this payroll run? It can no longer be re-generated.", confirmLabel: "Finalize", tone: "danger" })) return;
    try {
      const res = await payrollApi.finalize(openRun._id);
      setOpenRun(res.data?.run || openRun);
      loadRuns();
    } catch (err: unknown) {
      // The server refuses to finalize an unverified run — say why.
      const e = err as { data?: { hint?: string }; message?: string };
      void dialog.alert(e.data?.hint || e.message || "Failed to finalize");
    }
  };

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  // ---------- Run detail view ----------
  if (openRun) {
    return (
      <div className="p-6">
        <button onClick={() => setOpenRun(null)} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> Back to Runs
        </button>
        <PageHeader
          title={`Payroll — ${MONTHS[openRun.month - 1]} ${openRun.year}`}
          subtitle={`${openRun.employeeCount} employees`}
          actions={
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  openRun.status === "finalized"
                    ? "success"
                    : openRun.status === "verified"
                      ? "info"
                      : "warning"
                }
              >
                {openRun.status}
              </Badge>
              {canVerify && openRun.status === "draft" && (
                <Button variant="secondary" onClick={() => verify(openRun)}>
                  Verify
                </Button>
              )}
              {canFinalize && openRun.status !== "finalized" && (
                <Button
                  onClick={finalize}
                  disabled={openRun.status !== "verified"}
                  title={
                    openRun.status !== "verified"
                      ? "Verify the run before finalizing it"
                      : undefined
                  }
                  icon={<Lock className="h-4 w-4" />}
                >
                  Finalize
                </Button>
              )}
            </div>
          }
        />

        <div className="mb-4 grid grid-cols-3 gap-3">
          <Card className="p-4"><div className="text-xs text-gray-500">Gross</div><div className="text-xl font-semibold">{inr(openRun.totalGross)}</div></Card>
          <Card className="p-4"><div className="text-xs text-gray-500">Deductions</div><div className="text-xl font-semibold">{inr(openRun.totalDeductions)}</div></Card>
          <Card className="p-4 border-healwin-200 bg-healwin-50"><div className="text-xs text-healwin-700">Net Payable</div><div className="text-xl font-semibold text-healwin-800">{inr(openRun.totalNet)}</div></Card>
        </div>

        <Table>
          <THead>
            <Th>Code</Th><Th>Employee</Th><Th className="text-right">Paid Days</Th><Th className="text-right">Gross</Th>
            <Th className="text-right">Deductions</Th><Th className="text-right">Net Pay</Th><Th></Th>
          </THead>
          <TBody>
            {payslips.length === 0 ? (
              <TableState colSpan={7}>No payslips.</TableState>
            ) : (
              payslips.map((p) => (
                <TR key={p._id}>
                  <Td className="font-mono text-xs">{p.employeeCode}</Td>
                  <Td className="font-medium text-gray-900">{p.employeeName}</Td>
                  <Td className="text-right">
                    {p.paidDays}
                    {p.lopDays ? <span className="text-red-500"> (-{p.lopDays})</span> : null}
                    {/* Part-month employment — makes a small net pay explicable. */}
                    {!!p.serviceDays && !!p.totalDays && p.serviceDays < p.totalDays ? (
                      <span className="ml-1 text-xs text-gray-400" title="Part month — joined or left mid-cycle">
                        of {p.serviceDays}
                      </span>
                    ) : null}
                    {p.unmarkedDays ? (
                      <span
                        className="ml-1 text-xs text-amber-600"
                        title={`${p.unmarkedDays} day(s) had no attendance marked and were paid as worked`}
                      >
                        ⚠{p.unmarkedDays}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-right">{inr(p.earnings.gross)}</Td>
                  <Td className="text-right">{inr(p.deductions.total)}</Td>
                  <Td className="text-right font-semibold">{inr(p.netPay)}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" className="px-2" title="Download payslip" aria-label="Download"
                      onClick={() => payrollApi.downloadPayslip(p._id, `payslip-${p.employeeCode}-${p.month}-${p.year}.pdf`)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </Td>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>
    );
  }

  // ---------- Runs list view ----------
  return (
    <div className="p-6">
      <PageHeader title="Payroll & Salary Slips" subtitle="Generate monthly payroll and download payslips" />

      {canProcess && (
        <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Month</label>
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-40">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Year</label>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
          <Button onClick={() => generate()} disabled={generating} icon={<Play className="h-4 w-4" />}>
            {generating ? "Generating…" : "Generate Payroll"}
          </Button>
        </Card>
      )}

      <Table>
        <THead>
          <Th>Period</Th><Th className="text-right">Employees</Th><Th className="text-right">Gross</Th>
          <Th className="text-right">Net Payable</Th><Th>Status</Th><Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {loading ? (
            <TableState colSpan={6}>Loading…</TableState>
          ) : runs.length === 0 ? (
            <TableState colSpan={6}>No payroll runs yet.</TableState>
          ) : (
            runs.map((r) => (
              <TR key={r._id} clickable onClick={() => viewRun(r)}>
                <Td className="font-medium text-gray-900">{MONTHS[r.month - 1]} {r.year}</Td>
                <Td className="text-right">{r.employeeCount}</Td>
                <Td className="text-right">{inr(r.totalGross)}</Td>
                <Td className="text-right font-semibold">{inr(r.totalNet)}</Td>
                <Td><Badge tone={r.status === "finalized" ? "success" : "warning"}>{r.status}</Badge></Td>
                <Td className="text-right">
                  <Button size="sm" variant="ghost" onClick={(ev) => { ev.stopPropagation(); viewRun(r); }}>View</Button>
                </Td>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </div>
  );
}

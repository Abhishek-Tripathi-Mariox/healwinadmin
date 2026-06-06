import { useCallback, useEffect, useState } from "react";
import { Download, Lock, Play, ArrowLeft } from "lucide-react";
import { payrollApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import {
  PageHeader, Button, Select, Card, Table, THead, TBody, TR, Th, Td, TableState, Badge,
} from "../../components/ui";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

interface Run {
  _id: string; month: number; year: number; status: string;
  employeeCount: number; totalGross: number; totalDeductions: number; totalNet: number;
}
interface Payslip {
  _id: string; employeeCode: string; employeeName: string; month: number; year: number;
  paidDays: number; lopDays: number; earnings: { gross: number }; deductions: { total: number }; netPay: number;
}

const now = new Date();

export default function PayrollManagement() {
  const { hasPermission } = useAuth();
  const canProcess = hasPermission(PERMISSIONS.PAYROLL_PROCESS);
  const canFinalize = hasPermission(PERMISSIONS.PAYROLL_FINALIZE);

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
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

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await payrollApi.generate({ month, year });
      await loadRuns();
      if (res.data?.run) viewRun(res.data.run);
    } catch (err: any) {
      alert(err.message || "Failed to generate payroll");
    } finally {
      setGenerating(false);
    }
  };

  const viewRun = async (run: Run) => {
    const res = await payrollApi.runDetail(run._id);
    setOpenRun(res.data?.run || run);
    setPayslips(res.data?.payslips || []);
  };

  const finalize = async () => {
    if (!openRun) return;
    if (!window.confirm("Finalize this payroll run? It can no longer be re-generated.")) return;
    const res = await payrollApi.finalize(openRun._id);
    setOpenRun(res.data?.run || openRun);
    loadRuns();
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
              <Badge tone={openRun.status === "finalized" ? "success" : "warning"}>{openRun.status}</Badge>
              {canFinalize && openRun.status !== "finalized" && (
                <Button onClick={finalize} icon={<Lock className="h-4 w-4" />}>Finalize</Button>
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
                  <Td className="text-right">{p.paidDays}{p.lopDays ? <span className="text-red-500"> (-{p.lopDays})</span> : null}</Td>
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
          <Button onClick={generate} disabled={generating} icon={<Play className="h-4 w-4" />}>
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

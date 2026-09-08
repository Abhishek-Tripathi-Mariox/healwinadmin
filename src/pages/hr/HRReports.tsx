// HR reports (§13). Every report returns { title, columns, rows }, so this one
// screen renders all of them and the CSV is built from the same payload the
// table shows — the export can never drift from what was on screen.
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { hrReportsApi } from "../../services/admin-api";
import {
  PageHeader, Button, Card, Select, Table, THead, TBody, TR, Th, Td,
  TableState, Alert,
} from "../../components/ui";

interface Column { key: string; label: string }
interface Report {
  title: string;
  columns: Column[];
  rows: Record<string, string | number>[];
  run?: {
    status: string; employeeCount: number; totalGross: number;
    totalDeductions: number; totalNet: number; totalOvertimeAmount: number;
  };
}

const REPORTS = [
  { id: "employees", label: "Employee Master", period: "none" },
  { id: "attendance", label: "Attendance", period: "month" },
  { id: "shifts", label: "Shift Roster", period: "date" },
  { id: "leave", label: "Leave Register", period: "year" },
  { id: "leave-balances", label: "Leave Balances", period: "year" },
  { id: "holidays", label: "Holiday Calendar", period: "year" },
  { id: "payroll", label: "Payroll Sheet", period: "month" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const now = new Date();
const inr = (n: number) => `₹ ${Number(n || 0).toLocaleString("en-IN")}`;

/** RFC-4180 quoting: values containing a comma, quote or newline are quoted. */
const csvCell = (v: string | number) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function HRReports() {
  const [kind, setKind] = useState("attendance");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [date, setDate] = useState(now.toISOString().slice(0, 10));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const spec = REPORTS.find((r) => r.id === kind)!;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const params: Record<string, string | number> = {};
      if (spec.period === "month") { params.month = month; params.year = year; }
      if (spec.period === "year") params.year = year;
      if (spec.period === "date") params.date = date;
      const res = await hrReportsApi.get(kind, params);
      setReport(res.data);
    } catch (err: unknown) {
      const e = err as { data?: { hint?: string }; message?: string };
      setError(e.data?.hint || e.message || "Failed to load the report");
    } finally {
      setLoading(false);
    }
  }, [kind, month, year, date, spec.period]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!report || report.rows.length === 0) return;
    const header = report.columns.map((c) => csvCell(c.label)).join(",");
    const body = report.rows
      .map((r) => report.columns.map((c) => csvCell(r[c.key])).join(","))
      .join("\n");
    // BOM so Excel opens ₹ and Indian names in UTF-8 rather than mojibake.
    const blob = new Blob(["﻿" + header + "\n" + body], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[^\w]+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="HR Reports"
        subtitle="Employee, attendance, shift, leave, holiday and payroll data — on screen and as CSV"
        actions={
          <Button
            onClick={exportCsv}
            disabled={!report || report.rows.length === 0}
            icon={<Download className="h-4 w-4" />}
          >
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-56">
          {REPORTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </Select>
        {spec.period === "month" && (
          <Select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} className="w-40">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        )}
        {(spec.period === "month" || spec.period === "year") && (
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
            {[0, 1, 2, 3].map((d) => {
              const y = now.getFullYear() - d;
              return <option key={y} value={y}>{y}</option>;
            })}
          </Select>
        )}
        {spec.period === "date" && (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
          />
        )}
        {report && (
          <span className="text-sm text-gray-500">{report.rows.length} row(s)</span>
        )}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {report?.run && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Status", report.run.status],
            ["Employees", report.run.employeeCount],
            ["Gross", inr(report.run.totalGross)],
            ["Overtime", inr(report.run.totalOvertimeAmount)],
            ["Net Pay", inr(report.run.totalNet)],
          ].map(([k, v]) => (
            <Card key={String(k)} className="p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">{k}</p>
              <p className="mt-1 font-semibold text-gray-900">{v}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              {(report?.columns || []).map((c) => (
                <Th key={c.key} className="whitespace-nowrap">{c.label}</Th>
              ))}
              {!report && <Th>Report</Th>}
            </THead>
            <TBody>
              {loading ? (
                <TableState colSpan={report?.columns.length || 1}>Loading…</TableState>
              ) : !report || report.rows.length === 0 ? (
                <TableState colSpan={report?.columns.length || 1}>
                  Nothing to show for this selection.
                </TableState>
              ) : (
                report.rows.map((row, i) => (
                  <TR key={i}>
                    {report.columns.map((c) => (
                      <Td key={c.key} className="whitespace-nowrap">
                        {row[c.key] === "" || row[c.key] == null ? "—" : row[c.key]}
                      </Td>
                    ))}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

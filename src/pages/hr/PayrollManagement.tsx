import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Lock, Play, ArrowLeft, Search } from "lucide-react";
import { payrollApi } from "../../services/admin-api";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";
import Pagination from "../../components/Pagination";
import {
  PageHeader, Button, Select, Card, Table, THead, TBody, TR, Th, Td, TableState, Badge,
  Modal, Field, Input, Alert,
} from "../../components/ui";
import { dialog } from "../../services/dialog";
import WeekOffPicker, { describeWeekOff } from "../../components/WeekOffPicker";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

interface Run {
  _id: string; month: number; year: number; status: string;
  /** e.g. "16 Sep 2026 – 15 Oct 2026" — the days this run actually paid. */
  periodLabel?: string;
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

/** What GET/PUT /hr/payroll/settings carries — the working calendar. */
interface PayrollSettings {
  cycleStartDay: number;
  /** 0 = Sunday … 6 = Saturday. */
  defaultWeekOffDays?: number[];
  /** Which Saturdays of the month are off, e.g. [2, 4]. */
  defaultWeekOffSaturdays?: number[];
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

  // The payroll calendar. Shown next to the month picker so it is obvious
  // which days a run will cover before it is generated.
  const [cycle, setCycle] = useState<PayrollSettings | null>(null);
  const [cycleOpen, setCycleOpen] = useState(false);

  const loadCycle = useCallback(() => {
    payrollApi
      .settings()
      .then((r) => setCycle(r.data))
      .catch(() => undefined);
  }, []);
  useEffect(() => { loadCycle(); }, [loadCycle]);

  /**
   * The period the selected month/year would produce, computed here so the
   * label updates as the pickers change without a round trip.
   */
  const periodPreview = (() => {
    const day = cycle?.cycleStartDay ?? 1;
    const fmt = (d: Date) =>
      `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
    if (day <= 1) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return `${fmt(start)} – ${fmt(end)}`;
    }
    const lastOf = (m: number, y: number) => new Date(y, m, 0).getDate();
    const start = new Date(year, month - 1, Math.min(day, lastOf(month, year)));
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    const nextStart = new Date(ny, nm - 1, Math.min(day, lastOf(nm, ny)));
    const end = new Date(nextStart.getTime() - 86400000);
    return `${fmt(start)} – ${fmt(end)}`;
  })();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const [openRun, setOpenRun] = useState<Run | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  // The payslips inside a run are paged separately from the runs list — a
  // single run holds one row per employee.
  const [slipPage, setSlipPage] = useState(1);
  const [slipLimit, setSlipLimit] = useState(25);
  const [slipTotal, setSlipTotal] = useState(0);
  const [slipsLoading, setSlipsLoading] = useState(false);
  const [slipSearch, setSlipSearch] = useState("");
  // What's actually queried: typing shouldn't fire a request per keystroke.
  const [slipSearchQuery, setSlipSearchQuery] = useState("");

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payrollApi.runs({ page, limit });
      setRuns(res.data?.items || []);
      setTotal(res.data?.pagination?.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);
  useEffect(() => { setPage(1); }, [limit]);

  const runId = openRun?._id;
  const loadRunDetail = useCallback(async () => {
    if (!runId) return;
    setSlipsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: slipPage,
        limit: slipLimit,
      };
      if (slipSearchQuery.trim()) params.search = slipSearchQuery.trim();
      const res = await payrollApi.runDetail(runId, params);
      // The run totals come back with every page, so the header stays right
      // however deep into the payslips you are.
      if (res.data?.run) setOpenRun(res.data.run);
      setPayslips(res.data?.payslips || []);
      setSlipTotal(res.data?.pagination?.total || 0);
    } finally {
      setSlipsLoading(false);
    }
  }, [runId, slipPage, slipLimit, slipSearchQuery]);

  useEffect(() => { loadRunDetail(); }, [loadRunDetail]);
  useEffect(() => {
    const t = setTimeout(() => setSlipSearchQuery(slipSearch), 300);
    return () => clearTimeout(t);
  }, [slipSearch]);
  useEffect(() => { setSlipPage(1); }, [slipSearchQuery, slipLimit]);

  const generate = async (acknowledgeUnmarked = false) => {
    setGenerating(true);
    try {
      const res = await payrollApi.generate({ month, year, acknowledgeUnmarked });
      await loadRuns();
      // Left out for want of a salary — usually a panel user whose HR record
      // was created automatically and never completed. Reported first, because
      // it explains a payslip count lower than the headcount.
      const skipped: { name: string; employeeCode: string }[] =
        res.data?.skippedNoSalary || [];
      if (skipped.length) {
        const names = skipped
          .slice(0, 10)
          .map((s) => `• ${s.name}${s.employeeCode ? ` (${s.employeeCode})` : ""}`)
          .join("\n");
        void dialog.alert({
          title: `${skipped.length} employee${skipped.length === 1 ? " was" : "s were"} left out`,
          message:
            `No salary is set for them, so no payslip was produced:\n\n${names}` +
            (skipped.length > 10 ? `\n…and ${skipped.length - 10} more` : "") +
            "\n\nAdd their salary under Employees and re-generate to include them.",
        });
      }

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
      await loadRunDetail();
    } catch (err: unknown) {
      const e = err as { data?: { hint?: string }; message?: string };
      void dialog.alert(e.data?.hint || e.message || "Failed to verify the run");
    }
  };

  const viewRun = (run: Run) => {
    setOpenRun(run);
    setPayslips([]);
    setSlipPage(1);
    setSlipSearch("");
    setSlipSearchQuery("");
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
          // With a 16th-to-15th cycle the month name alone does not say which
          // days were paid, so the period is shown beside it.
          subtitle={
            openRun.periodLabel
              ? `${openRun.periodLabel} · ${openRun.employeeCount} employees`
              : `${openRun.employeeCount} employees`
          }
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

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="w-64 pl-9"
              placeholder="Employee name or code…"
              value={slipSearch}
              onChange={(e) => setSlipSearch(e.target.value)}
            />
          </div>
          <Select
            value={String(slipLimit)}
            onChange={(e) => setSlipLimit(Number(e.target.value))}
            className="w-32"
            aria-label="Rows per page"
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </Select>
          <span className="text-sm text-gray-500">{slipTotal} payslip(s)</span>
        </div>

        <Table>
          <THead>
            <Th>Code</Th><Th>Employee</Th><Th className="text-right">Paid Days</Th><Th className="text-right">Gross</Th>
            <Th className="text-right">Deductions</Th><Th className="text-right">Net Pay</Th><Th></Th>
          </THead>
          <TBody>
            {slipsLoading && payslips.length === 0 ? (
              <TableState colSpan={7}>Loading…</TableState>
            ) : payslips.length === 0 ? (
              <TableState colSpan={7}>
                {slipSearchQuery.trim()
                  ? "No payslips match this search."
                  : "No payslips."}
              </TableState>
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

        <div className="mt-4">
          <Pagination
            page={slipPage}
            totalPages={Math.max(1, Math.ceil(slipTotal / slipLimit))}
            total={slipTotal}
            label="payslips"
            onPageChange={setSlipPage}
          />
        </div>
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

          {/* Which days this run will actually cover. On a 16th-to-15th cycle
              the month name alone is not enough to know that. */}
          {cycle && (
            <div className="ml-auto text-right">
              <div className="text-xs font-medium text-gray-600">
                This run covers
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {periodPreview || "—"}
              </div>
              <button
                type="button"
                onClick={() => setCycleOpen(true)}
                className="mt-0.5 text-xs text-healwin-600 hover:underline"
              >
                Cycle starts on day {cycle.cycleStartDay} · off{" "}
                {describeWeekOff(
                  cycle.defaultWeekOffDays || [],
                  cycle.defaultWeekOffSaturdays || [],
                )}{" "}
                — change
              </button>
            </div>
          )}
        </Card>
      )}

      <CycleModal
        open={cycleOpen}
        current={cycle}
        onClose={() => setCycleOpen(false)}
        onSaved={(saved) => {
          setCycle((c) => (c ? { ...c, ...saved } : saved));
          setCycleOpen(false);
          loadCycle();
        }}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
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
        <span className="text-sm text-gray-500">{total} run(s)</span>
      </div>

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

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / limit))}
          total={total}
          label="runs"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

/**
 * The working calendar.
 *
 * Changing the cycle moves every future run's period, so it states what the
 * new cycle means in plain dates before saving, and the server keeps already
 * finalized runs on the period they were actually run under. The week-off
 * default lives here because it shapes the same calendar: which days a person
 * is expected to work at all.
 */
function CycleModal({
  open,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  current: PayrollSettings | null;
  onClose: () => void;
  onSaved: (saved: PayrollSettings) => void;
}) {
  const currentDay = current?.cycleStartDay ?? 16;
  const [day, setDay] = useState(currentDay);
  const [weekOffDays, setWeekOffDays] = useState<number[]>([]);
  const [weekOffSaturdays, setWeekOffSaturdays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setDay(currentDay);
      setWeekOffDays(current?.defaultWeekOffDays || []);
      setWeekOffSaturdays(current?.defaultWeekOffSaturdays || []);
      setError("");
      setNote("");
    }
  }, [open, current, currentDay]);

  const changed =
    day !== currentDay ||
    weekOffDays.join() !== (current?.defaultWeekOffDays || []).join() ||
    weekOffSaturdays.join() !== (current?.defaultWeekOffSaturdays || []).join();

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await payrollApi.updateSettings({
        cycleStartDay: day,
        defaultWeekOffDays: weekOffDays,
        defaultWeekOffSaturdays: weekOffSaturdays,
      });
      setNote(res.data?.note || "");
      onSaved({
        cycleStartDay: res.data?.cycleStartDay ?? day,
        defaultWeekOffDays: res.data?.defaultWeekOffDays ?? weekOffDays,
        defaultWeekOffSaturdays:
          res.data?.defaultWeekOffSaturdays ?? weekOffSaturdays,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save the working calendar.",
      );
    } finally {
      setSaving(false);
    }
  };

  const example =
    day <= 1
      ? "1st to the last day of the month (a calendar month)"
      : `${day}${day === 2 ? "nd" : day === 3 ? "rd" : "th"} of the month to the ${
          day - 1 === 1 ? "1st" : `${day - 1}th`
        } of the next`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Working calendar"
      subtitle="When a pay period begins, and which days are off by default"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !changed}>
            {saving ? "Saving…" : "Save calendar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert>{error}</Alert>}
        {note && <Alert tone="info">{note}</Alert>}
        <Field label="Cycle starts on day" hint="1 gives an ordinary calendar month">
          <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <p className="text-sm text-gray-600">
          Each run will cover the <strong>{example}</strong>, and is named after
          the month it starts in.
        </p>
        <p className="text-xs text-gray-400">
          Runs that are already finalized keep the period they were run under.
        </p>

        <div className="border-t border-gray-100 pt-3">
          <WeekOffPicker
            label="Default week offs"
            days={weekOffDays}
            saturdays={weekOffSaturdays}
            onChange={(d, sat) => { setWeekOffDays(d); setWeekOffSaturdays(sat); }}
            hint="Used for everyone who has no week-off pattern of their own on their employee record."
          />
        </div>
      </div>
    </Modal>
  );
}

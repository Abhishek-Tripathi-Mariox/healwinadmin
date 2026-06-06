import React from "react";
import { Button, Field, Input, Spinner, Card, cn } from "./ui";

/**
 * Shared building blocks for the Reports section — a date-range bar with
 * quick presets, an Indian-locale currency/number formatter, a consistent
 * chart palette, and a titled chart card. Keeps the four report pages
 * (Bookings / Revenue / Users / Drivers) visually consistent.
 */

export const REPORT_COLORS = [
  "#2196F3", // healwin blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

export const fmtCurrency = (n: number) =>
  "₹" + Math.round(n || 0).toLocaleString("en-IN");

export const fmtNumber = (n: number) => (n || 0).toLocaleString("en-IN");

export const toISODate = (d: Date) => d.toISOString().slice(0, 10);

export const daysAgo = (days: number) =>
  toISODate(new Date(Date.now() - days * 86_400_000));

/** Date-range filter bar with quick presets, shared by every report page. */
export const ReportRangeBar: React.FC<{
  dateFrom: string;
  dateTo: string;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  loading?: boolean;
}> = ({ dateFrom, dateTo, setDateFrom, setDateTo, loading }) => {
  const preset = (days: number) => {
    setDateFrom(daysAgo(days));
    setDateTo(toISODate(new Date()));
  };
  const presets: Array<[string, number]> = [
    ["7D", 7],
    ["30D", 30],
    ["90D", 90],
    ["1Y", 365],
  ];
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <Field label="From">
        <Input
          type="date"
          value={dateFrom}
          max={dateTo}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-auto"
        />
      </Field>
      <Field label="To">
        <Input
          type="date"
          value={dateTo}
          min={dateFrom}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-auto"
        />
      </Field>
      <div className="flex items-center gap-1.5 pb-0.5">
        {presets.map(([label, days]) => (
          <Button
            key={label}
            size="sm"
            variant="secondary"
            onClick={() => preset(days)}
          >
            {label}
          </Button>
        ))}
      </div>
      {loading && <Spinner className="mb-1.5 ml-1" />}
    </div>
  );
};

/** Small KPI card used in the summary strip atop each report. */
export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "blue" | "emerald" | "amber" | "red" | "violet";
}> = ({ label, value, hint, icon, tone = "blue" }) => {
  const tones: Record<string, string> = {
    blue: "bg-healwin-50 text-healwin-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
      </div>
      {icon && (
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            tones[tone],
          )}
        >
          {icon}
        </span>
      )}
    </Card>
  );
};

/** Titled card that wraps a chart with a fixed height. */
export const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, className, children }) => (
  <Card className={cn("p-5", className)}>
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
    </div>
    {children}
  </Card>
);

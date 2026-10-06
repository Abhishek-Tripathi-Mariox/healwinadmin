import type React from "react";

import { cn } from "./ui";

/**
 * A week-off pattern: the days of the week that are off, plus (optionally)
 * which Saturdays of the month are off on top of that.
 *
 * Used twice — on an employee, and on the organisation default they fall back
 * to — so it lives here rather than in either screen.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SATURDAYS = [1, 2, 3, 4, 5];
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];

/** Plain-English summary of a pattern, for helper text and confirmations. */
export const describeWeekOff = (days: number[], saturdays: number[]): string => {
  const parts: string[] = [];
  if (days.length) {
    parts.push(
      [...days].sort((a, b) => a - b).map((d) => `every ${DAYS[d]}`).join(", "),
    );
  }
  // The nth-Saturday rule only adds days, so it is redundant once every
  // Saturday is already off.
  if (saturdays.length && !days.includes(6)) {
    parts.push(
      `the ${[...saturdays].sort((a, b) => a - b).map((n) => ORDINALS[n - 1]).join(" & ")} Saturday`,
    );
  }
  return parts.join(", plus ") || "no week off";
};

const toggle = (list: number[], value: number) =>
  list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value].sort((a, b) => a - b);

const Chip: React.FC<{
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, disabled, title, onClick, children }) => (
  <button
    type="button"
    disabled={disabled}
    title={title}
    onClick={onClick}
    className={cn(
      "h-8 min-w-12 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
      active
        ? "border-healwin-500 bg-healwin-600 text-white"
        : "border-gray-300 text-gray-600 hover:bg-gray-50",
    )}
  >
    {children}
  </button>
);

export default function WeekOffPicker({
  label = "Week offs",
  days,
  saturdays,
  onChange,
  hint,
  disabled,
}: {
  label?: string;
  days: number[];
  saturdays: number[];
  onChange: (days: number[], saturdays: number[]) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const everySaturday = days.includes(6);

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {SHORT.map((s, i) => (
          <Chip
            key={s}
            active={days.includes(i)}
            disabled={disabled}
            onClick={() => onChange(toggle(days, i), saturdays)}
          >
            {s}
          </Chip>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-gray-500">Saturdays off:</span>
        {SATURDAYS.map((n) => (
          <Chip
            key={n}
            active={!everySaturday && saturdays.includes(n)}
            disabled={disabled || everySaturday}
            title={
              everySaturday
                ? "Saturday is already a full week off above"
                : undefined
            }
            onClick={() => onChange(days, toggle(saturdays, n))}
          >
            {ORDINALS[n - 1]}
          </Chip>
        ))}
        {(saturdays.length > 0 || everySaturday) && !disabled && (
          <button
            type="button"
            className="ml-1 text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
            onClick={() => onChange(days, [])}
          >
            clear
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-gray-500">
        {days.length || saturdays.length
          ? `Off ${describeWeekOff(days, saturdays)}.`
          : hint || "No pattern set."}
      </p>
      {hint && (days.length > 0 || saturdays.length > 0) && (
        <p className="mt-0.5 text-xs text-gray-400">{hint}</p>
      )}
    </div>
  );
}

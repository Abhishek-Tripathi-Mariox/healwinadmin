import { useEffect, useRef, useState } from "react";
import { cn } from "./ui";

export interface MultiOption {
  _id: string;
  name: string;
  /** Second line, e.g. a phone number. */
  hint?: string;
}

/**
 * Pick several things from a list.
 *
 * A plain `<select multiple>` is unusable with a mouse (ctrl-click to add,
 * and one stray click wipes the selection), which matters here because the
 * things being picked are people being put on an ambulance.
 */
export default function MultiSelect({
  options,
  selected,
  onChange,
  emptyLabel,
  disabled,
}: {
  options: MultiOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const label =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? options.find((o) => o._id === selected[0])?.name || "1 selected"
        : `${selected.length} selected`;

  const toggle = (id: string) =>
    onChange(
      selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id],
    );

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm outline-none transition-colors focus:border-healwin-500 focus:ring-2 focus:ring-healwin-500/20 disabled:bg-gray-100",
          selected.length ? "text-gray-900" : "text-gray-500",
        )}
      >
        <span className="truncate">{label}</span>
        <span className="text-gray-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.length === 0 && (
            <p className="px-3 py-3 text-xs text-gray-400">Nobody to choose from.</p>
          )}
          {selected.length > 0 && (
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50"
              onClick={() => onChange([])}
            >
              Clear selection
            </button>
          )}
          {options.map((o) => (
            <label
              key={o._id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(o._id)}
                onChange={() => toggle(o._id)}
              />
              <span className="min-w-0 truncate">
                {o.name}
                {o.hint && <span className="ml-1 text-xs text-gray-400">{o.hint}</span>}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

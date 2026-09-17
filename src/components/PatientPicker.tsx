import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { hospitalPatientApi } from "../services/admin-api";
import { Button, Spinner, cn } from "./ui";

// Searchable patient dropdown shared by OPD booking and IPD admission.
// Opens on focus with the most recent registrations, then narrows as you type
// (name / patient ID / phone). Out-of-order responses are dropped so a slow
// early request can't overwrite the results for what's typed now.
const PatientPicker: React.FC<{
  selected: any;
  onSelect: (p: any) => void;
  placeholder?: string;
}> = ({ selected, onSelect, placeholder = "Search by name, patient ID or phone" }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  // Query the current results belong to; "loading" is simply "not yet for q".
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const seq = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await hospitalPatientApi.list({ search: q.trim(), limit: 10 });
        if (id !== seq.current) return;
        setResults(res.data?.items || []);
        setError("");
        setActive(0);
        setLoadedFor(q);
      } catch (e: any) {
        if (id !== seq.current) return;
        setResults([]);
        setError(e?.message || "Could not load patients");
        setLoadedFor(q);
      }
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const loading = loadedFor !== q;

  const pick = (p: any) => {
    onSelect(p);
    setOpen(false);
    setQ("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (selected)
    return (
      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
        <span>
          {selected.fullName}{" "}
          <span className="font-mono text-xs text-gray-500">{selected.patientId}</span>
          {selected.phone && <span className="ml-2 text-xs text-gray-500">{selected.phone}</span>}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onSelect(null)}
        >
          Change
        </Button>
      </div>
    );

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {!q.trim() && results.length > 0 && (
            <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Recent patients
            </div>
          )}
          {loading && results.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500">
              <Spinner className="h-4 w-4" /> Loading…
            </div>
          )}
          {error && <div className="px-3 py-3 text-sm text-red-600">{error}</div>}
          {!loading && !error && results.length === 0 && (
            <div className="px-3 py-3 text-xs text-amber-600">
              {q.trim()
                ? <>No registered patient matches “{q.trim()}”. Register them first under <span className="font-medium">Hospital (HMS) → Patients</span>.</>
                : "No patients registered yet."}
            </div>
          )}
          {results.map((p, i) => (
            <button
              type="button"
              key={p._id}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(p)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm",
                i === active ? "bg-blue-50" : "hover:bg-gray-50",
              )}
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-gray-800">{p.fullName}</span>{" "}
                <span className="font-mono text-xs text-gray-400">{p.patientId}</span>
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                {[p.phone, p.gender, p.age != null ? `${p.age}y` : null].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientPicker;

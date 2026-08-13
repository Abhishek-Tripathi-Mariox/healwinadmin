import React from "react";
import { createPortal } from "react-dom";

/**
 * Healwin Admin — shared UI kit (Modern SaaS look, Healwin-blue accent).
 *
 * One import surface for every page: buttons, badges, cards, modals, tables,
 * form controls, page headers, empty states. Centralizing these keeps all 50+
 * admin screens visually consistent and easy to restyle in one place.
 */

export const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

/* ============================ Button ============================ */

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "subtle";
type ButtonSize = "sm" | "md";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-healwin-600 text-white shadow-sm hover:bg-healwin-700 focus-visible:ring-healwin-500",
  secondary:
    "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-healwin-500",
  ghost:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-300",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500",
  subtle:
    "bg-healwin-50 text-healwin-700 hover:bg-healwin-100 focus-visible:ring-healwin-500",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...props
}) => (
  <button
    className={cn(
      "inline-flex items-center justify-center rounded-lg font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
      buttonVariants[variant],
      buttonSizes[size],
      className,
    )}
    {...props}
  >
    {icon}
    {children}
  </button>
);

/* ============================ Badge ============================ */

type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
  accent: "bg-healwin-50 text-healwin-700",
};

const badgeDots: Record<BadgeTone, string> = {
  neutral: "bg-gray-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  accent: "bg-healwin-500",
};

export const Badge: React.FC<{
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = "neutral", dot = false, className, children }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
      badgeTones[tone],
      className,
    )}
  >
    {dot && <span className={cn("h-1.5 w-1.5 rounded-full", badgeDots[tone])} />}
    {children}
  </span>
);

/* ============================ Card ============================ */

export const Card: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }
> = ({ padded = false, className, children, ...props }) => (
  <div
    className={cn(
      "animate-fade-in-up rounded-2xl border border-white/60 bg-white/80 shadow-[0_10px_30px_-12px_rgba(30,64,175,0.18)] backdrop-blur-xl",
      padded && "p-5",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

/* ============================ PageHeader ============================ */

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <div className="animate-fade-in flex flex-wrap items-start justify-between gap-3 mb-5">
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-gray-900">
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

/* ============================ Table ============================ */

export const Table: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => (
  <div className="animate-fade-in-up overflow-x-auto rounded-2xl border border-white/60 bg-white/80 shadow-[0_10px_30px_-12px_rgba(30,64,175,0.18)] backdrop-blur-xl">
    <table className={cn("min-w-full text-sm", className)}>{children}</table>
  </div>
);

export const THead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="bg-gray-50/80 text-gray-500">
    <tr className="border-b border-gray-200">{children}</tr>
  </thead>
);

export const Th: React.FC<
  React.ThHTMLAttributes<HTMLTableCellElement>
> = ({ className, children, ...props }) => (
  <th
    className={cn(
      "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap",
      className,
    )}
    {...props}
  >
    {children}
  </th>
);

export const TBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="divide-y divide-gray-100">{children}</tbody>
);

export const TR: React.FC<
  React.HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }
> = ({ clickable, className, children, ...props }) => (
  <tr
    className={cn(
      "transition-colors hover:bg-gray-50",
      clickable && "cursor-pointer",
      className,
    )}
    {...props}
  >
    {children}
  </tr>
);

export const Td: React.FC<
  React.TdHTMLAttributes<HTMLTableCellElement>
> = ({ className, children, ...props }) => (
  <td className={cn("px-4 py-3 text-gray-700 align-middle", className)} {...props}>
    {children}
  </td>
);

/** Full-width state cell for loading / empty rows inside a table body. */
export const TableState: React.FC<{ colSpan: number; children: React.ReactNode }> = ({
  colSpan,
  children,
}) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-gray-400">
      {children}
    </td>
  </tr>
);

/* ============================ Form controls ============================ */

// Note: width is intentionally NOT baked in here. Inputs/Textarea add `w-full`
// explicitly, while Select only defaults to full width when the caller hasn't
// passed its own `w-*` class — so filter dropdowns can use `w-auto`/`w-44`
// without being overridden by a hard-coded `w-full` (CSS source order issue).
const fieldBase =
  "rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-healwin-500 focus:ring-2 focus:ring-healwin-500/20 disabled:bg-gray-100";

const hasWidth = (cls?: string) => /\bw-/.test(cls || "");

export const Input: React.FC<
  React.InputHTMLAttributes<HTMLInputElement>
> = ({ className, ...props }) => (
  // Same width guard Select uses: `cn` is a plain join, not tailwind-merge, so
  // an unconditional "w-full" would still be emitted alongside a caller's
  // "w-16" — and Tailwind orders w-full last, so w-full won and the caller's
  // width was silently ignored. Only default to full width when none is given.
  <input
    className={cn(fieldBase, "h-10", hasWidth(className) ? "" : "w-full", className)}
    {...props}
  />
);

export const Textarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
> = ({ className, ...props }) => (
  <textarea
    className={cn(fieldBase, "py-2", hasWidth(className) ? "" : "w-full", className)}
    {...props}
  />
);

export const Select: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement>
> = ({ className, children, ...props }) => (
  <select
    className={cn(
      fieldBase,
      "h-10 pr-8",
      hasWidth(className) ? "" : "w-full",
      className,
    )}
    {...props}
  >
    {children}
  </select>
);

export const Field: React.FC<{
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, hint, error, className, children }) => (
  <label className={cn("block", className)}>
    {label && (
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </span>
    )}
    {children}
    {hint && !error && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
  </label>
);

export const SearchInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement>
> = ({ className, ...props }) => (
  <div className={cn("relative", className)}>
    <svg
      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
    <input className={cn(fieldBase, "h-10 w-full pl-9")} {...props} />
  </div>
);

/* ============================ Feedback ============================ */

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={cn(
      "inline-block h-5 w-5 animate-spin rounded-full border-2 border-healwin-500 border-t-transparent",
      className,
    )}
  />
);

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    {icon && (
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        {icon}
      </div>
    )}
    <p className="text-sm font-medium text-gray-900">{title}</p>
    {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Alert: React.FC<{
  tone?: "danger" | "success" | "info" | "warning";
  className?: string;
  children: React.ReactNode;
}> = ({ tone = "danger", className, children }) => {
  const tones = {
    danger: "bg-red-50 text-red-700 border-red-100",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    info: "bg-blue-50 text-blue-700 border-blue-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
  };
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
};

/* ============================ Modal ============================ */

type ModalSize = "sm" | "md" | "lg" | "xl";
const modalSizes: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: ModalSize;
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, size = "md", footer, children }) => {
  if (!open) return null;
  // Render to <body> so the overlay escapes the scrollable <main> container —
  // otherwise the sticky page header paints over the modal's top edge.
  return createPortal(
    <div
      className="animate-backdrop-in fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-gray-900/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          "animate-modal-in my-8 flex max-h-[calc(100vh-4rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5",
          modalSizes[size],
        )}
      >
        {(title || subtitle) && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 bg-gradient-to-r from-healwin-50/70 via-white to-white px-6 py-4">
            <div>
              {title && (
                <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              )}
              {subtitle && (
                <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

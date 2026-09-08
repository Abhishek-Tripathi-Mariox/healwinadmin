import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { callsApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";

/**
 * Click-to-call. MyOperator rings the signed-in admin's own phone first, then
 * bridges them to the customer — so the patient's phone only rings once a
 * human is genuinely on the line.
 *
 * Renders nothing without `calls:place`, and nothing without a number, so it
 * can be dropped next to any phone number in the panel without guards at the
 * call site.
 */
export default function CallButton({
  phone,
  subjectType,
  subjectId,
  subjectLabel,
  size = "sm",
  variant = "icon",
  className = "",
}: {
  phone?: string | null;
  subjectType?: string;
  subjectId?: string;
  subjectLabel?: string;
  size?: "sm" | "md";
  variant?: "icon" | "button";
  className?: string;
}) {
  const { hasPermission } = useAuth();
  const canPlace = hasPermission(PERMISSIONS.CALLS_PLACE);
  const [busy, setBusy] = useState(false);

  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  if (!canPlace || digits.length !== 10) return null;

  const place = async () => {
    if (
      !window.confirm(
        `Call ${digits}?\n\nYour own phone rings first — answer it, and you will be connected.`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await callsApi.clickToCall({
        customerNumber: digits,
        subjectType,
        subjectId,
        subjectLabel,
      });
      const agent = res.data?.agentNumber;
      alert(
        agent
          ? `Ringing ${agent} now — answer to be connected to ${digits}.`
          : `Call placed to ${digits}.`,
      );
    } catch (err: unknown) {
      const e = err as { data?: { hint?: string }; message?: string };
      alert(e.data?.hint || e.message || "The call could not be placed");
    } finally {
      setBusy(false);
    }
  };

  const icon = busy ? (
    <Loader2 className={`${size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} animate-spin`} />
  ) : (
    <Phone className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
  );

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={place}
        disabled={busy}
        title={`Call ${digits} via MyOperator`}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60 ${className}`}
      >
        {icon}
        {busy ? "Connecting…" : "Call"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={place}
      disabled={busy}
      aria-label={`Call ${digits}`}
      title={`Call ${digits} via MyOperator`}
      className={`inline-flex items-center justify-center rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-60 ${className}`}
    >
      {icon}
    </button>
  );
}

/**
 * App dialogs — the replacement for the browser's `alert()` and `confirm()`.
 *
 * The native ones are wrong for this panel on three counts: they paint a bare
 * OS strip at the top of the screen with "localhost:5173 says" above the
 * message, they cannot be styled, and `confirm()` blocks the whole tab while
 * it is open. These render as a normal centred modal instead.
 *
 * Deliberately a module, not just a hook, so it also works from code that is
 * not a React component (API interceptors, helpers). `DialogHost` registers
 * the real implementation on mount; until then — and if the host is ever
 * unmounted — the native dialogs stand in, so a confirmation can never be
 * silently skipped.
 */

export type DialogTone = "default" | "danger";

export interface ConfirmOptions {
  title?: string;
  /** Body text. Newlines are rendered as separate paragraphs. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for destructive actions — delete, cancel, force-close. */
  tone?: DialogTone;
}

export interface AlertOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  tone?: DialogTone;
}

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
type AlertFn = (o: AlertOptions) => Promise<void>;

let confirmImpl: ConfirmFn | null = null;
let alertImpl: AlertFn | null = null;

/** Called by DialogHost. Not for use anywhere else. */
export const registerDialogHost = (fns: { confirm: ConfirmFn; alert: AlertFn }) => {
  confirmImpl = fns.confirm;
  alertImpl = fns.alert;
  return () => {
    confirmImpl = null;
    alertImpl = null;
  };
};

const asText = (o: { title?: string; message: string }) =>
  o.title ? `${o.title}\n\n${o.message}` : o.message;

export const dialog = {
  /** Resolves true if the user confirmed. */
  confirm: (options: ConfirmOptions | string): Promise<boolean> => {
    const o = typeof options === "string" ? { message: options } : options;
    if (!confirmImpl) return Promise.resolve(window.confirm(asText(o)));
    return confirmImpl(o);
  },

  /** Resolves once the user has dismissed it. */
  alert: (options: AlertOptions | string): Promise<void> => {
    const o = typeof options === "string" ? { message: options } : options;
    if (!alertImpl) {
      window.alert(asText(o));
      return Promise.resolve();
    }
    return alertImpl(o);
  },
};

/**
 * Split a message into a heading and body.
 *
 * These messages were written for the native dialogs, where the convention was
 * a short question, a blank line, then the detail — the first line read as the
 * heading because nothing else could. Preserving that here means every
 * converted call site gets a proper title without being rewritten by hand.
 *
 * Only a genuinely short opener is promoted; a long first paragraph (a server
 * error, say) is left as body text where it belongs.
 */
export const splitHeading = (o: {
  title?: string;
  message: string;
}): { title?: string; body: string } => {
  if (o.title) return { title: o.title, body: o.message };
  const [first, ...rest] = o.message.split(/\n\s*\n/);
  if (rest.length && first.length <= 70 && !first.includes("\n")) {
    return { title: first.trim(), body: rest.join("\n\n") };
  }
  return { body: o.message };
};

/** Convenience for the most common case: "really delete this?". */
export const confirmDelete = (what: string, detail?: string) =>
  dialog.confirm({
    title: `Delete ${what}?`,
    message: detail || "This cannot be undone.",
    confirmLabel: "Delete",
    tone: "danger",
  });

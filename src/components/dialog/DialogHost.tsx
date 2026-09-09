import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle, Info } from "lucide-react";

import {
  registerDialogHost,
  splitHeading,
  type AlertOptions,
  type ConfirmOptions,
} from "../../services/dialog";
import { Button, Modal } from "../ui";

/**
 * Renders whatever `dialog.confirm()` / `dialog.alert()` ask for.
 *
 * Mounted once, at the app root. One dialog is shown at a time — a second
 * request while one is open queues behind it rather than replacing it, so a
 * confirmation cannot be swallowed by an error alert arriving underneath it.
 */

type Pending = { id: number } & (
  | { kind: "confirm"; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "alert"; options: AlertOptions; resolve: () => void }
);

let nextId = 0;

export default function DialogHost() {
  const [current, setCurrent] = useState<Pending | null>(null);
  const queue = useRef<Pending[]>([]);

  const push = useCallback((item: Pending) => {
    setCurrent((open) => {
      if (open) {
        queue.current.push(item);
        return open;
      }
      return item;
    });
  }, []);

  const close = useCallback((confirmed: boolean) => {
    setCurrent((open) => {
      if (open) {
        if (open.kind === "confirm") open.resolve(confirmed);
        else open.resolve();
      }
      return queue.current.shift() ?? null;
    });
  }, []);

  useEffect(
    () =>
      registerDialogHost({
        confirm: (options) =>
          new Promise<boolean>((resolve) =>
            push({ id: nextId++, kind: "confirm", options, resolve }),
          ),
        alert: (options) =>
          new Promise<void>((resolve) =>
            push({ id: nextId++, kind: "alert", options, resolve }),
          ),
      }),
    [push],
  );

  // Enter confirms, Escape cancels — the keyboard behaviour the native
  // dialogs had, which people are used to. (Escape is handled by Modal.)
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        close(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, close]);

  if (!current) return null;

  const { options, kind } = current;
  const { title, body } = splitHeading(options);
  const danger = options.tone === "danger";
  const Icon = danger ? AlertTriangle : kind === "confirm" ? HelpCircle : Info;

  return (
    <Modal
      // Keyed per dialog so moving to the next one in the queue remounts the
      // body — otherwise autoFocus, which only fires on mount, would leave the
      // second dialog's button unfocused.
      key={current.id}
      open
      // Clicking the backdrop or pressing Escape is a cancel, never a confirm.
      onClose={() => close(false)}
      size="sm"
      footer={
        <>
          {kind === "confirm" && (
            <Button variant="secondary" onClick={() => close(false)}>
              {(options as ConfirmOptions).cancelLabel || "Cancel"}
            </Button>
          )}
          <Button
            autoFocus
            variant={danger ? "danger" : "primary"}
            onClick={() => close(true)}
          >
            {options.confirmLabel || (kind === "confirm" ? "Confirm" : "OK")}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            danger ? "bg-red-50 text-red-600" : "bg-healwin-50 text-healwin-600"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 pt-0.5">
          {title && (
            <h2 className="mb-1 text-base font-semibold text-gray-900">{title}</h2>
          )}
          {/* Messages are written with blank lines between paragraphs; keeping
              them as separate blocks reads far better than one wrapped run. */}
          {body.split("\n").filter(Boolean).map((line, i) => (
            <p key={i} className="text-sm leading-relaxed text-gray-600 [&+p]:mt-2">
              {line}
            </p>
          ))}
        </div>
      </div>
    </Modal>
  );
}

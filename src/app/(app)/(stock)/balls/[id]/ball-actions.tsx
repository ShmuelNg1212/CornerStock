"use client";

import { ArrowLeftRight, Ban, Pencil, Tag, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { adjustBall, removeBall, reverseSale, sellBall, transferBall, type ActionResult, type AdjustInput } from "@/app/actions";
import { buttonClass, Field, inputClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { ActionPanel } from "@/components/ui/action-panel";
import type { BallStatus, Location } from "@/lib/types";

type Panel = "sell" | "move" | "reverse" | "remove" | "correct" | null;
const panelLabels = {
  sell: "Mark as sold",
  move: "Move ball",
  reverse: "Put back in stock",
  remove: "Remove from stock",
  correct: "Correct details",
};
type BallForActions = { id: string; serial: string; status: BallStatus; location_id: string } & AdjustInput;

export function BallActions({
  ball,
  modelLabel,
  locations,
  owner,
}: {
  ball: BallForActions;
  modelLabel: string;
  locations: Location[];
  owner: boolean;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AdjustInput, string>>>({});
  const [pending, startTransition] = useTransition();
  // One request id for each opened panel. A second tap or a retry sends the same id,
  // and the database then does the change one time only.
  const requestId = useRef("");
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!panel) trigger.current?.focus();
  }, [panel]);

  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const others = locations.filter((l) => l.id !== ball.location_id);
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [values, setValues] = useState<AdjustInput>({
    serial: ball.serial,
    gross_weight: ball.gross_weight,
    top_weight: ball.top_weight,
    pin_distance: ball.pin_distance,
    boxed_on: ball.boxed_on,
  });

  function open(next: Panel, button: HTMLButtonElement) {
    trigger.current = button;
    requestId.current = crypto.randomUUID();
    setError(null);
    setFieldErrors({});
    setReason("");
    setReference("");
    setPanel(next);
  }

  function run(action: () => Promise<ActionResult & { fieldErrors?: Partial<Record<keyof AdjustInput, string>> }>, done: string) {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof action>>;
      try {
        result = await action();
      } catch {
        result = { ok: false, error: "The change was not sent. Check the connection and try again." };
      }
      if (result.ok) {
        setPanel(null);
        toast.success(done);
        router.refresh();
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  const reasonField = (placeholder: string) => (
    <Field label="Reason">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} required maxLength={200} className={inputClass} />
    </Field>
  );
  const footer = (label: string, busy: string, style: string = buttonClass.primary) => (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={`${style} flex-1`}>
          {pending ? busy : label}
        </button>
        <button type="button" onClick={() => setPanel(null)} disabled={pending} className={buttonClass.quiet}>
          Cancel
        </button>
      </div>
    </>
  );
  const form = (onSubmit: () => void, children: React.ReactNode) => (
    <ActionPanel
      label={`${panel ? panelLabels[panel] : "Ball actions"} · ${ball.serial}`}
      pending={pending}
      onDismiss={() => setPanel(null)}
    >
      <form
        className="space-y-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending) onSubmit();
        }}
      >
        {children}
      </form>
    </ActionPanel>
  );

  function renderPanel() {
    if (panel === "sell") {
      return form(
        () => run(() => sellBall(ball.id, requestId.current, reference), `Sold · ${ball.serial}`),
        <>
          <p className="font-semibold">Mark this ball as sold?</p>
          <p className="text-muted-foreground">
            {modelLabel} · <span className="font-mono">{ball.serial}</span>
          </p>
          <Field label="Receipt number (optional)">
            <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} className={inputClass} />
          </Field>
          {footer("Mark as sold", "Saving…", buttonClass.action)}
        </>,
      );
    }
    if (panel === "move") {
      return form(
        () => run(() => transferBall(ball.id, target, requestId.current), `Moved to ${locations.find((l) => l.id === target)?.name ?? "the location"}`),
        <>
          <Field label="Move to">
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass}>
              {others.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </Field>
          {footer("Move ball", "Moving…")}
        </>,
      );
    }
    if (panel === "reverse") {
      return form(
        () => run(() => reverseSale(ball.id, requestId.current, reason), "Back in stock"),
        <>
          <p className="font-semibold">Put this ball back in stock?</p>
          {reasonField("For example: sold by mistake")}
          {footer("Put back in stock", "Saving…")}
        </>,
      );
    }
    if (panel === "remove") {
      return form(
        () => run(() => removeBall(ball.id, requestId.current, reason), "Removed from stock"),
        <>
          <p className="font-semibold">Remove this ball from stock?</p>
          <p className="text-muted-foreground">Use this for a ball that is damaged, lost, or recorded by mistake. The record and its history stay.</p>
          {reasonField("For example: damaged in transit")}
          {footer("Remove from stock", "Removing…")}
        </>,
      );
    }
    if (panel === "correct") {
      const input = (field: keyof AdjustInput, label: string, hint?: string, mode?: "decimal") => (
        <Field label={label} error={fieldErrors[field]} hint={hint}>
          <input
            value={values[field]}
            onChange={(e) => setValues({ ...values, [field]: e.target.value })}
            inputMode={mode}
            autoCapitalize={field === "serial" ? "characters" : undefined}
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={fieldErrors[field] ? true : undefined}
            className={`${inputClass} tabular ${field === "serial" ? "font-mono" : ""}`}
          />
        </Field>
      );
      return form(
        () => run(() => adjustBall(ball.id, requestId.current, values, reason), "Correction saved"),
        <>
          <p className="font-semibold">Correct the details</p>
          {input("serial", "Serial number")}
          <div className="grid grid-cols-2 gap-3">
            {input("gross_weight", "Gross weight", "15 lb 4 oz")}
            {input("top_weight", "Top weight", undefined, "decimal")}
            {input("pin_distance", "Pin distance", "3-3.5")}
            {input("boxed_on", "Boxed on", "month/day/year")}
          </div>
          {reasonField("For example: label was misread")}
          {footer("Save correction", "Saving…")}
        </>,
      );
    }

    return null;
  }

  const quiet = `${buttonClass.quiet} w-full`;
  return (
    <>
      <div hidden={panel !== null} className={`${panel ? "hidden" : "grid"} mt-5 gap-2 sm:grid-cols-2 lg:grid-cols-1`}>
        {ball.status === "in_stock" && (
          <button type="button" onClick={(event) => open("sell", event.currentTarget)} className={`${buttonClass.action} w-full sm:col-span-2 lg:col-span-1`}>
            <Tag className="size-5" aria-hidden="true" />
            Mark as sold
          </button>
        )}
        {ball.status === "in_stock" && others.length > 0 && (
          <button type="button" onClick={(event) => open("move", event.currentTarget)} className={quiet}>
            <ArrowLeftRight className="size-5" aria-hidden="true" />
            Move to another location
          </button>
        )}
        {owner && ball.status === "sold" && (
          <button type="button" onClick={(event) => open("reverse", event.currentTarget)} className={quiet}>
            <Undo2 className="size-5" aria-hidden="true" />
            Put back in stock
          </button>
        )}
        {owner && (
          <button type="button" onClick={(event) => open("correct", event.currentTarget)} className={quiet}>
            <Pencil className="size-5" aria-hidden="true" />
            Correct details
          </button>
        )}
        {owner && ball.status === "in_stock" && (
          <button type="button" onClick={(event) => open("remove", event.currentTarget)} className={quiet}>
            <Ban className="size-5" aria-hidden="true" />
            Remove from stock
          </button>
        )}
      </div>
      {renderPanel()}
    </>
  );
}

"use client";
// The one large action per slot: "I've taken these". Routines can carry an optional reading.
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/submit-button";
import type { ActionResult } from "@/server/errors";

type FormAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

export function TakeSlotForm({
  action: takeAction,
  slotAt,
  items,
  label,
  primary,
  readingLabel,
}: {
  action: FormAction;
  slotAt: string;
  items: Array<{ id: string; name: string; needsReading: boolean }>;
  label: string;
  primary: boolean;
  readingLabel: string;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(takeAction, { ok: true });
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slotAt" value={slotAt} />
      {items.map((i) => (
        <input key={i.id} type="hidden" name="itemIds" value={i.id} />
      ))}
      {items
        .filter((i) => i.needsReading)
        .map((i) => (
          <div key={i.id} className="flex flex-col gap-1">
            <label htmlFor={`reading-${slotAt}-${i.id}`} className="text-sm font-semibold">
              {i.name}: {readingLabel}
            </label>
            <input
              id={`reading-${slotAt}-${i.id}`}
              name={`reading:${i.id}`}
              inputMode="text"
              maxLength={60}
              className="min-h-12 rounded-2xl bg-card px-4 text-lg ring-1 ring-inset ring-ink/30 focus-visible:ring-3 focus-visible:ring-olive focus-visible:outline-none"
            />
          </div>
        ))}
      <SubmitButton
        size="lg"
        variant={primary ? "primary" : "secondary"}
        className="w-full"
        pendingText="Saving…"
      >
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

"use client";
// Per-item skip with a reason from the fixed list, inside a native disclosure (works without JS too).
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/submit-button";
import type { ActionResult } from "@/server/errors";

type FormAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

export function SkipForm({
  action: skipAction,
  slotAt,
  itemId,
  itemName,
  title,
  question,
  reasons,
}: {
  action: FormAction;
  slotAt: string;
  itemId: string;
  itemName: string;
  title: string;
  question: string;
  reasons: Array<{ value: string; label: string }>;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(skipAction, { ok: true });
  const base = `skip-${itemId}-${slotAt}`;
  return (
    <details className="group open:basis-full">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-full px-3 text-base font-semibold text-olive underline decoration-2 underline-offset-4 [&::-webkit-details-marker]:hidden">
        {title}
        <span className="sr-only"> {itemName}</span>
      </summary>
      <form
        action={action}
        className="mt-3 flex w-full flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-ink/15"
      >
        <input type="hidden" name="slotAt" value={slotAt} />
        <input type="hidden" name="itemId" value={itemId} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-base font-semibold">{question}</legend>
          {reasons.map((r, i) => (
            <label
              key={r.value}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 text-lg ring-1 ring-inset ring-ink/15 has-[:checked]:bg-lime has-[:checked]:ring-olive"
            >
              <input
                type="radio"
                name="reason"
                value={r.value}
                defaultChecked={i === 0}
                className="size-5 accent-[#243100]"
              />
              {r.label}
            </label>
          ))}
        </fieldset>
        <label htmlFor={`${base}-note`} className="text-sm font-semibold">
          Note (optional)
        </label>
        <input
          id={`${base}-note`}
          name="note"
          maxLength={200}
          className="min-h-12 rounded-xl bg-card px-3 text-base ring-1 ring-inset ring-ink/25 focus-visible:ring-3 focus-visible:ring-olive focus-visible:outline-none"
        />
        <SubmitButton variant="secondary" size="lg" pendingText="Saving…">
          {title} {itemName}
        </SubmitButton>
        <FormMessage state={state} />
      </form>
    </details>
  );
}

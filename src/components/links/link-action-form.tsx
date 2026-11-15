"use client";
// One large button that POSTs a signed email-link token, then shows the outcome in a live region.
import { useActionState } from "react";
import { SubmitButton } from "@/components/common/submit-button";
import type { ActionResult } from "@/server/errors";

type FormAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

export function LinkActionForm({
  action: linkAction,
  token,
  label,
  pendingText,
}: {
  action: FormAction;
  token: string;
  label: string;
  pendingText: string;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    (prev, fd) => linkAction(prev ?? { ok: true }, fd),
    null,
  );
  const done = state?.ok === true;
  return (
    <div className="flex flex-col gap-4">
      {!done && (
        <form action={action}>
          <input type="hidden" name="t" value={token} />
          <SubmitButton size="lg" pendingText={pendingText} className="min-h-16 w-full text-xl">
            {label}
          </SubmitButton>
        </form>
      )}
      <p
        role="status"
        aria-live="polite"
        className={
          state
            ? `rounded-3xl p-5 text-xl font-semibold text-ink ${state.ok ? "bg-lime" : "bg-blush"}`
            : "sr-only"
        }
      >
        {state ? (state.ok ? state.message : state.error) : ""}
      </p>
    </div>
  );
}

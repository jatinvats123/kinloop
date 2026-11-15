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
  doneText,
}: {
  action: FormAction;
  token: string;
  label: string;
  pendingText: string;
  /** Shown instead of the button when the work was already done before this page was opened. */
  doneText?: string;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    (prev, fd) => linkAction(prev ?? { ok: true }, fd),
    null,
  );
  // Stays mounted when the page re-renders after the action, so the thank-you message is kept.
  const message = state ? (state.ok ? state.message : state.error) : doneText;
  const done = state?.ok === true || (!state && Boolean(doneText));
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
          message
            ? `rounded-3xl p-5 text-xl font-semibold text-ink ${state && !state.ok ? "bg-blush" : "bg-lime"}`
            : "sr-only"
        }
      >
        {message ?? ""}
      </p>
    </div>
  );
}

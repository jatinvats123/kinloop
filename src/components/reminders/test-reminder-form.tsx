"use client";
// "Send a test reminder to my email": saves the member's email and sends one test message.
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/submit-button";
import { TextField } from "@/components/ui/field";
import type { ActionResult } from "@/server/errors";

type FormAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

export function TestReminderForm({
  action: sendAction,
  email,
  hint,
}: {
  action: FormAction;
  email: string | null;
  hint: string;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(sendAction, { ok: true });
  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        label="Your email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={email ?? ""}
        hint={hint}
        error={!state.ok ? state.fieldErrors?.email : undefined}
      />
      <SubmitButton pendingText="Sending…" className="self-start">
        Send a test reminder to my email
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

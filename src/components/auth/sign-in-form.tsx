"use client";
// Sign-in with circle code + personal 6-digit passcode.
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/submit-button";
import { TextField } from "@/components/ui/field";
import type { ActionResult } from "@/server/errors";

export function SignInForm({
  action,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: true });
  const errors = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <TextField
        label="Circle code"
        name="code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        hint="8 letters and numbers, like KMQT-74XA"
        error={errors.code}
        required
        className="text-xl tracking-widest uppercase"
      />
      <TextField
        label="Your passcode"
        name="passcode"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        pattern="\d{6}"
        maxLength={6}
        hint="Your personal 6-digit passcode"
        error={errors.passcode}
        required
        className="text-xl tracking-[0.4em]"
      />
      <SubmitButton size="lg" pendingText="Signing in…" className="w-full">
        Sign in
      </SubmitButton>
      <FormMessage state={state.ok ? undefined : state} />
    </form>
  );
}

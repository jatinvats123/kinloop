"use client";
// Submit button that shows a pending state while its form's server action runs.
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  size = "md",
  className = "",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={buttonClass(variant, size, className)}
    >
      {pending ? pendingText : children}
    </button>
  );
}

/** Polite live region for the outcome of a form action. */
export function FormMessage({
  state,
}: {
  state: { ok: boolean; error?: string; message?: string } | undefined;
}) {
  const text = state ? (state.ok ? state.message : state.error) : undefined;
  return (
    <p
      role="status"
      aria-live="polite"
      className={`text-sm font-semibold ${state && !state.ok ? "text-danger" : "text-ink"} ${text ? "" : "sr-only"}`}
    >
      {text}
    </p>
  );
}

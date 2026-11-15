"use client";
// Create a care circle, then show the circle code and passcodes exactly once.
import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/submit-button";
import { buttonClass } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import type { ActionResult } from "@/server/errors";
import type { CreatedCircle } from "@/server/services/circles";

type Action = (
  prev: ActionResult<CreatedCircle>,
  fd: FormData,
) => Promise<ActionResult<CreatedCircle>>;

const roleNames = { elder: "Elder", family: "Family", caretaker: "Caretaker" } as const;

export function CreateCircleForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<ActionResult<CreatedCircle>, FormData>(action, {
    ok: true,
  });
  const [role, setRole] = useState("family");
  const errors = state.ok ? {} : (state.fieldErrors ?? {});

  if (state.ok && state.data) {
    const created = state.data;
    const creator = created.people.find((p) => p.memberId === created.creatorId);
    return (
      <section aria-labelledby="codes-heading" className="flex flex-col gap-5" role="status">
        <h2 id="codes-heading" className="text-2xl font-semibold">
          Your circle is ready. Write these down now.
        </h2>
        <p className="text-base text-muted">
          They are shown only once. Each person signs in with the circle code and their own
          passcode.
        </p>
        <dl className="grid gap-3 rounded-card bg-lime p-5 text-ink">
          <div>
            <dt className="text-sm font-semibold">Circle code</dt>
            <dd className="numeral text-4xl tracking-widest">{created.displayCode}</dd>
          </div>
          {created.people.map((p) => (
            <div key={p.memberId}>
              <dt className="text-sm font-semibold">
                {p.name} ({roleNames[p.role]})
              </dt>
              <dd className="numeral text-3xl tracking-[0.3em]">{p.passcode}</dd>
            </div>
          ))}
        </dl>
        <Link
          href={creator?.role === "elder" ? "/today" : "/overview"}
          className={buttonClass("primary", "lg", "w-full")}
        >
          I&apos;ve saved them. Continue
        </Link>
      </section>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <TextField
        label="Elder's name"
        name="elderName"
        autoComplete="off"
        hint="The person whose care this circle is for"
        error={errors.elderName}
        required
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">You are</legend>
        <div className="flex flex-wrap gap-2">
          {(["elder", "family", "caretaker"] as const).map((r) => (
            <label
              key={r}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-card px-4 text-sm font-semibold ring-1 ring-inset ring-ink/25 has-[:checked]:bg-ink has-[:checked]:text-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-olive"
            >
              <input
                type="radio"
                name="creatorRole"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="sr-only"
              />
              {r === "elder" ? "The elder" : r === "family" ? "Family" : "A caretaker"}
            </label>
          ))}
        </div>
      </fieldset>
      {role !== "elder" ? (
        <TextField
          label="Your name"
          name="creatorName"
          autoComplete="name"
          error={errors.creatorName}
          required
        />
      ) : null}
      <input type="hidden" name="timezone" value="Asia/Kolkata" />
      <SubmitButton size="lg" pendingText="Creating…" className="w-full">
        Create the circle
      </SubmitButton>
      <FormMessage state={state.ok ? undefined : state} />
    </form>
  );
}

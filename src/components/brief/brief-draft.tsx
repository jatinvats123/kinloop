"use client";
// AI-drafted part of the visit brief: shown from cache when the facts are unchanged, otherwise drafted
// on an explicit button press. Rendered as plain text and labelled as AI-drafted, not medical advice.
import { useActionState } from "react";
import { Printer } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/common/submit-button";
import { AiLabel, Sparkle } from "@/components/signature/sparkle";
import { Button } from "@/components/ui/button";
import type { BriefDraft as Draft } from "@/domain/types";
import type { ActionResult } from "@/server/errors";

type DraftAction = (prev: ActionResult<Draft>, fd: FormData) => Promise<ActionResult<Draft>>;

function PointList({ title, points }: { title: string; points: string[] }) {
  return (
    <div>
      <h3 className="text-xl font-semibold">{title}</h3>
      {points.length === 0 ? (
        <p className="mt-2 text-base text-muted">Nothing stood out in the facts.</p>
      ) : (
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-6 text-lg">
          {points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BriefDraft({
  appointmentId,
  initial,
  action,
}: {
  appointmentId: string;
  initial: Draft | null;
  action: DraftAction;
}) {
  const [state, formAction] = useActionState<ActionResult<Draft> | null, FormData>(
    (prev, fd) => action(prev ?? { ok: true }, fd),
    null,
  );
  const draft = state?.ok ? (state.data ?? null) : initial;

  return (
    <section
      aria-labelledby="brief-ai"
      className="rounded-card bg-card p-5 shadow-card sm:p-6 print:shadow-none print:ring-1 print:ring-ink/30"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="brief-ai" className="flex items-center gap-2 text-2xl font-semibold">
          <Sparkle size={22} />
          Points to discuss
        </h2>
        <AiLabel>AI-drafted from the facts above</AiLabel>
      </div>
      <p className="mt-2 text-base text-muted">
        The AI only rephrases the facts on this page into talking points. It is not medical advice;
        the doctor decides.
      </p>
      {draft ? (
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <PointList title="Things to mention" points={draft.mention} />
          <PointList title="Questions to ask" points={draft.questions} />
        </div>
      ) : (
        <form action={formAction} className="mt-5 flex flex-col gap-3 print:hidden">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <SubmitButton size="lg" pendingText="Drafting…" className="self-start">
            <Sparkle size={18} />
            Draft points to discuss
          </SubmitButton>
          <FormMessage state={state ?? undefined} />
        </form>
      )}
    </section>
  );
}

/** Opens the browser's print dialog; the print stylesheet hides navigation and buttons. */
export function PrintButton() {
  return (
    <Button variant="secondary" size="lg" onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden="true" size={20} />
      Print this brief
    </Button>
  );
}

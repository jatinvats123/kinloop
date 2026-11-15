// Demo-only "Try it in two minutes" panel: the next step up front, the full checklist one tap away.
// Steps tick themselves from the activity feed; each links straight to its screen, switching person
// when the step needs someone else.
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import type { TourStep, TourStepId } from "@/domain/tour";
import type { Member } from "@/domain/types";

function StepAction({
  step,
  current,
  members,
  switchAction,
  primary,
}: {
  step: TourStep;
  current: Member;
  members: Member[];
  switchAction: (fd: FormData) => Promise<void>;
  primary: boolean;
}) {
  const variant = primary ? "primary" : "secondary";
  const who = members.find((m) => m.role === step.as);
  if (!who || current.role === step.as) {
    return (
      <Link
        href={step.href}
        aria-label={`Go to: ${step.title}`}
        className={buttonClass(variant, "md", "shrink-0")}
      >
        Go
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    );
  }
  const first = who.name.split(" ")[0];
  return (
    <form action={switchAction} className="shrink-0">
      <input type="hidden" name="memberId" value={who.id} />
      <input type="hidden" name="next" value={step.href} />
      <button
        type="submit"
        aria-label={`Go as ${first}: ${step.title}`}
        className={buttonClass(variant, "md")}
      >
        Go as {first}
        <ArrowRight aria-hidden="true" size={18} />
      </button>
    </form>
  );
}

export function TourPanel({
  steps,
  done,
  current,
  members,
  switchAction,
  hideAction,
}: {
  steps: TourStep[];
  done: Record<TourStepId, boolean>;
  current: Member;
  members: Member[];
  switchAction: (fd: FormData) => Promise<void>;
  hideAction: (fd: FormData) => Promise<void>;
}) {
  const count = steps.filter((s) => done[s.id]).length;
  const next = steps.find((s) => !done[s.id]);
  const caretaker = members.find((m) => m.role === "caretaker");

  return (
    <section
      aria-labelledby="tour-h"
      className="rounded-[1.75rem] bg-card p-4 shadow-card ring-2 ring-lime sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="tour-h" className="text-lg font-semibold">
            Try it in two minutes
          </h2>
          <p className="text-sm text-muted" aria-live="polite">
            {count} of {steps.length} done
          </p>
        </div>
        <form action={hideAction}>
          <input type="hidden" name="hidden" value="1" />
          <button
            type="submit"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold ring-1 ring-inset ring-ink/20 hover:ring-ink/50"
          >
            <X aria-hidden="true" size={16} />
            Hide tour
          </button>
        </form>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {steps.map((s) => (
          <span
            key={s.id}
            className={`h-1.5 flex-1 rounded-full ${done[s.id] ? "bg-olive" : "bg-ink/10"}`}
          />
        ))}
      </div>

      {next ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-lime-soft p-3 sm:p-4">
          <div>
            <p className="text-sm font-semibold text-muted">Next, step {steps.indexOf(next) + 1}</p>
            <p className="text-base font-semibold sm:text-lg">{next.title}</p>
            <p className="hidden text-base sm:block">{next.detail}</p>
          </div>
          <StepAction
            step={next}
            current={current}
            members={members}
            switchAction={switchAction}
            primary
          />
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-lime-soft p-4 text-lg font-semibold">
          <CheckCircle2 aria-hidden="true" size={22} />
          You have seen every part of Kinloop.
        </p>
      )}

      <details className="mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-olive underline underline-offset-4">
          All steps
        </summary>
        <ol className="mt-2 flex flex-col gap-2">
          {steps.map((s, i) => (
            <li
              key={s.id}
              className="flex flex-col gap-2 border-t border-ink/10 pt-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="flex items-start gap-2 text-base">
                {done[s.id] ? (
                  <CheckCircle2
                    aria-hidden="true"
                    size={20}
                    className="mt-0.5 shrink-0 text-olive"
                  />
                ) : (
                  <Circle aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-muted" />
                )}
                <span>
                  <span className="font-semibold">
                    {i + 1}. {s.title}
                  </span>
                  <span className="sr-only">{done[s.id] ? " (done)" : " (not done yet)"}</span>
                  <span className="block text-sm text-muted">{s.detail}</span>
                </span>
              </p>
              <StepAction
                step={s}
                current={current}
                members={members}
                switchAction={switchAction}
                primary={false}
              />
            </li>
          ))}
        </ol>
        {caretaker ? (
          <p className="mt-3 border-t border-ink/10 pt-3 text-sm text-muted">
            Also try {caretaker.name} (caretaker, view only): sees everything and can press
            &ldquo;I&rsquo;ll check on her&rdquo;, but cannot change medicines.
          </p>
        ) : null}
      </details>
    </section>
  );
}

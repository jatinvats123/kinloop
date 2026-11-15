"use client";
// Prescription import: paste text or choose a photo, let the AI draft medicines, then review each
// draft (edit, add or discard). Fields the AI was unsure about are flagged; nothing saves unasked.
import { useActionState, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { shrinkImage } from "@/components/check/shrink-image";
import { FormMessage, SubmitButton } from "@/components/common/submit-button";
import { AiLabel, Sparkle } from "@/components/signature/sparkle";
import { buttonClass } from "@/components/ui/button";
import { ChoiceGroup, TextArea, TextField } from "@/components/ui/field";
import { shortDate } from "@/domain/time";
import type { ActionResult } from "@/server/errors";
import type { MedicineDraft } from "@/server/services/prescription-import";

type DraftAction = (
  prev: ActionResult<MedicineDraft[]>,
  fd: FormData,
) => Promise<ActionResult<MedicineDraft[]>>;
type AcceptAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const UNSURE_HINT = "Check this: the AI wasn't sure it read it right.";
const unsureRing = "ring-2 ring-blush";

function DraftCard({
  draft,
  accept,
  onDiscard,
}: {
  draft: MedicineDraft;
  accept: AcceptAction;
  onDiscard: () => void;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    (prev, fd) => accept(prev ?? { ok: true }, fd),
    null,
  );
  const unsure = (f: MedicineDraft["unsure"][number]) => draft.unsure.includes(f);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const id = (f: string) => `${draft.key}-${f}`;

  if (state?.ok) {
    return (
      <li className="flex items-center gap-3 rounded-card bg-lime p-5 text-lg font-semibold text-ink">
        <CheckCircle2 aria-hidden="true" size={24} />
        <span>
          {draft.name}: {state.message}
        </span>
      </li>
    );
  }
  return (
    <li className="rounded-card bg-card p-5 shadow-card sm:p-6">
      <form action={action} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="kind" value="medicine" />
        <input type="hidden" name="startDate" value={draft.startDate} />
        <input type="hidden" name="endDate" value={draft.endDate} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl font-semibold">{draft.name}</h3>
          <AiLabel>AI-drafted, please check</AiLabel>
        </div>
        {draft.unsure.length > 0 ? (
          <p className="flex items-start gap-2 rounded-2xl bg-blush-soft px-4 py-3 text-base font-semibold">
            <AlertTriangle aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
            Some fields need a second look: {draft.unsure.join(", ")}.
          </p>
        ) : null}
        <TextField
          id={id("name")}
          label="Medicine name"
          name="name"
          defaultValue={draft.name}
          required
          error={errors.name}
          hint={unsure("name") ? UNSURE_HINT : undefined}
          className={unsure("name") ? unsureRing : ""}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id={id("composition")}
            label="Composition (generic name)"
            name="composition"
            defaultValue={draft.composition}
            error={errors.composition}
          />
          <TextField
            id={id("dose")}
            label="Strength or dose"
            name="dose"
            defaultValue={draft.dose}
            error={errors.dose}
            hint={unsure("dose") ? UNSURE_HINT : undefined}
            className={unsure("dose") ? unsureRing : ""}
          />
        </div>
        <TextArea
          id={id("instructions")}
          label="Instructions"
          name="instructions"
          defaultValue={draft.instructions}
          error={errors.instructions}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Times of day</legend>
          {unsure("times") ? <p className="text-xs text-muted">{UNSURE_HINT}</p> : null}
          <div className="flex flex-wrap gap-2">
            {draft.times.map((t, i) => (
              <span key={i}>
                <label htmlFor={id(`time-${i}`)} className="sr-only">
                  Time {i + 1}
                </label>
                <input
                  id={id(`time-${i}`)}
                  type="time"
                  name="times"
                  defaultValue={t}
                  className={`min-h-12 rounded-2xl bg-card px-4 text-lg ring-1 ring-inset ring-ink/25 focus-visible:ring-3 focus-visible:ring-olive focus-visible:outline-none ${unsure("times") ? unsureRing : ""}`}
                />
              </span>
            ))}
          </div>
          {errors.times ? (
            <p className="text-sm font-semibold text-danger">{errors.times}</p>
          ) : null}
        </fieldset>
        <ChoiceGroup
          legend="Days"
          name="daysOfWeek"
          type="checkbox"
          options={DAYS.map((d, i) => ({ value: String(i), label: d }))}
          defaultValues={draft.daysOfWeek.map(String)}
          error={errors.daysOfWeek}
        />
        <p className="text-base text-muted">
          Starts today{draft.endDate ? `, ends ${shortDate(draft.endDate)}` : ", no end date"}.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton pendingText="Adding…" size="lg">
            Add this medicine
          </SubmitButton>
          <button type="button" onClick={onDiscard} className={buttonClass("secondary", "lg")}>
            <Trash2 aria-hidden="true" size={18} />
            Discard<span className="sr-only"> {draft.name}</span>
          </button>
        </div>
        <FormMessage state={state && !state.ok ? state : undefined} />
      </form>
    </li>
  );
}

export function PrescriptionImport({
  draftAction,
  acceptAction,
  sample,
}: {
  draftAction: DraftAction;
  acceptAction: AcceptAction;
  /** Demo circles only: a fictional prescription the visitor can paste with one click. */
  sample?: string;
}) {
  const [prefill, setPrefill] = useState("");
  const [state, dispatch] = useActionState<ActionResult<MedicineDraft[]> | null, FormData>(
    (prev, fd) => draftAction(prev ?? { ok: true }, fd),
    null,
  );
  const [pending, startTransition] = useTransition();
  const [discarded, setDiscarded] = useState<Set<string>>(new Set());
  const drafts = state?.ok ? (state.data ?? []).filter((d) => !discarded.has(d.key)) : [];
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const photo = fd.get("photo");
    if (photo instanceof Blob && photo.size > 0)
      fd.set("photo", await shrinkImage(photo), "rx.jpg");
    else fd.delete("photo");
    setDiscarded(new Set());
    startTransition(() => dispatch(fd));
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-5 rounded-card bg-card p-5 shadow-card sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(e.currentTarget);
        }}
        noValidate
      >
        {sample ? (
          <button
            type="button"
            onClick={() => setPrefill(sample)}
            className={buttonClass("secondary", "md", "self-start")}
          >
            Paste the sample prescription
          </button>
        ) : null}
        <TextArea
          key={prefill}
          defaultValue={prefill}
          label="Paste the prescription"
          name="text"
          rows={6}
          maxLength={4000}
          error={errors.text}
          hint="For example: Tab Metformin 500 mg BD after food x 30 days"
        />
        <TextField
          label="Or choose a photo of it"
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          error={errors.photo}
          hint="PNG, JPEG or WebP. The photo is read once and never stored."
          className="py-2.5"
        />
        <button
          type="submit"
          disabled={pending}
          className={buttonClass("primary", "lg", "self-start")}
        >
          <Sparkle size={18} />
          {pending ? "Reading the prescription…" : "Read prescription"}
        </button>
        <p role="status" aria-live="polite" className="text-base font-semibold">
          {state && !state.ok && !state.fieldErrors ? state.error : ""}
          {state?.ok && !pending
            ? (state.data?.length ?? 0) === 0
              ? "No medicines found. Try clearer text, or add them by hand."
              : `${state.data?.length} medicine${state.data?.length === 1 ? "" : "s"} drafted. Check each one before adding it.`
            : ""}
        </p>
      </form>

      {drafts.length > 0 ? (
        <section aria-labelledby="drafts-h" className="flex flex-col gap-4">
          <h2 id="drafts-h" className="text-2xl font-semibold">
            Review the drafts
          </h2>
          <ul className="flex flex-col gap-4">
            {drafts.map((d) => (
              <DraftCard
                key={d.key}
                draft={d}
                accept={acceptAction}
                onDiscard={() => setDiscarded((s) => new Set(s).add(d.key))}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

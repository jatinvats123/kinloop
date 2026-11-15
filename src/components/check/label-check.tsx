"use client";
// The right-medicine check flow: take or choose a photo (camera on phones) or a sample label, resize
// it in the browser, send it, then show the verdict in very large type with one action.
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { VerdictPanel, type VerdictTone } from "@/components/signature/verdict-panel";
import { TakeSlotForm } from "@/components/today/take-slot-form";
import { buttonClass } from "@/components/ui/button";
import type { LabelVerdict } from "@/domain/label-match";
import { shrinkImage as shrink } from "./shrink-image";
import type { ActionResult } from "@/server/errors";
import type { LabelCheckResult } from "@/server/services/label-check";

type CheckAction = (
  prev: ActionResult<LabelCheckResult>,
  fd: FormData,
) => Promise<ActionResult<LabelCheckResult>>;
type TakeAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

export interface SampleLabel {
  src: string;
  label: string;
}

export interface CheckStrings {
  takePhoto: string;
  checking: string;
  again: string;
  markTaken: string;
  samples: string;
}

const TONE: Record<LabelVerdict, VerdictTone> = {
  "due-now": "match",
  "not-now": "stop",
  "already-taken": "stop",
  "strength-mismatch": "stop",
  "not-on-list": "stop",
  unreadable: "neutral",
};

export function LabelCheck({
  checkAction,
  takeAction,
  samples,
  strings,
}: {
  checkAction: CheckAction;
  takeAction: TakeAction;
  samples: SampleLabel[];
  strings: CheckStrings;
}) {
  const [state, dispatch] = useActionState<ActionResult<LabelCheckResult> | null, FormData>(
    (prev, fd) => checkAction(prev ?? { ok: true }, fd),
    null,
  );
  const [pending, startTransition] = useTransition();
  const [preparing, setPreparing] = useState(false);
  const [shown, setShown] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const outcome = useRef<HTMLDivElement>(null);
  const busy = pending || preparing;


  async function send(file: Blob) {
    setPreparing(true);
    setShown(true);
    const fd = new FormData();
    fd.set("photo", await shrink(file), "label.jpg");
    setPreparing(false);
    startTransition(() => dispatch(fd));
  }

  async function trySample(src: string) {
    setPreparing(true);
    const blob = await fetch(src).then((r) => r.blob());
    await send(blob);
  }

  const result = shown && !busy && state ? state : null;
  // Keyboard and screen-reader users land on the answer instead of losing focus to the page.
  useEffect(() => {
    if (result) outcome.current?.focus();
  }, [result]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <input
          ref={input}
          id="label-photo"
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          capture="environment"
          className="peer sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) void send(file);
            e.currentTarget.value = "";
          }}
        />
        <label
          htmlFor="label-photo"
          className={buttonClass(
            "primary",
            "lg",
            "min-h-16 w-full cursor-pointer text-xl peer-focus-visible:ring-4 peer-focus-visible:ring-olive peer-focus-visible:ring-offset-2",
          )}
        >
          <Camera aria-hidden="true" size={26} />
          {strings.takePhoto}
        </label>
        {samples.length > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-base font-semibold">{strings.samples}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {samples.map((s) => (
                <button
                  key={s.src}
                  type="button"
                  disabled={busy}
                  onClick={() => void trySample(s.src)}
                  className={buttonClass("secondary", "lg", "w-full")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className={busy ? "text-2xl font-semibold" : "sr-only"}>
        {busy ? strings.checking : ""}
      </p>

      <div ref={outcome} tabIndex={-1} className="flex flex-col gap-4 outline-none">
        {result && !result.ok ? (
          <p role="alert" className="rounded-card bg-blush p-6 text-xl font-semibold text-ink">
            {result.fieldErrors?.photo ?? result.error}
          </p>
        ) : null}

        {result?.ok && result.data ? (
          <VerdictPanel
            tone={TONE[result.data.verdict]}
            sentence={result.data.message}
            action={
              <div className="flex w-full flex-col gap-3">
                {result.data.mark ? (
                  <TakeSlotForm
                    action={takeAction}
                    slotAt={result.data.mark.slotAt}
                    items={[{ id: result.data.mark.itemId, name: "", needsReading: false }]}
                    label={strings.markTaken}
                    primary
                    readingLabel=""
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setShown(false);
                    input.current?.focus();
                  }}
                  className={buttonClass("secondary", "lg", "w-full")}
                >
                  <RotateCcw aria-hidden="true" size={20} />
                  {strings.again}
                </button>
              </div>
            }
          />
        ) : null}
      </div>
    </div>
  );
}

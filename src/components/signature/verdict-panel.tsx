// Verdict panel for the right-medicine check: one giant icon, one sentence, one action.
import { CheckCircle2, OctagonX, ScanLine } from "lucide-react";
import type { ReactNode } from "react";

export type VerdictTone = "match" | "stop" | "neutral";

const tones: Record<VerdictTone, { cls: string; Icon: typeof CheckCircle2 }> = {
  match: { cls: "bg-lime", Icon: CheckCircle2 },
  stop: { cls: "bg-blush", Icon: OctagonX },
  neutral: { cls: "bg-card ring-1 ring-inset ring-ink/15", Icon: ScanLine },
};

export function VerdictPanel({
  tone,
  sentence,
  detail,
  action,
}: {
  tone: VerdictTone;
  sentence: string;
  detail?: string;
  action?: ReactNode;
}) {
  const { cls, Icon } = tones[tone];
  return (
    <section
      role="status"
      aria-live="polite"
      className={`flex w-full flex-col items-start gap-5 rounded-card p-6 sm:p-8 ${cls}`}
    >
      <Icon aria-hidden="true" size={72} strokeWidth={1.75} className="text-ink" />
      <p className="text-2xl font-semibold leading-tight text-ink sm:text-3xl">{sentence}</p>
      {detail ? <p className="text-lg text-ink">{detail}</p> : null}
      {action}
    </section>
  );
}

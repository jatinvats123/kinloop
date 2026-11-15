// Right-medicine check ("Is this the right one?"): photograph a strip or box before taking it.
// The AI only reads the label; tested code compares it with the schedule and gives the verdict.
import type { Metadata } from "next";
import { checkLabelAction } from "@/app/actions/ai";
import { takeSlotAction } from "@/app/actions/care";
import { LabelCheck, type SampleLabel } from "@/components/check/label-check";
import { Sparkle } from "@/components/signature/sparkle";
import { t } from "@/domain/messages";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Is this the right one?" };
export const maxDuration = 60;

/** Sample labels for demo circles, matched to the seed: due now, already taken, not on the list. */
const SAMPLES: SampleLabel[] = [
  { src: "/samples/amlodipine-5mg.webp", label: "Amlodipine 5 mg" },
  { src: "/samples/levothyroxine-50mcg.webp", label: "Levothyroxine 50 mcg" },
  { src: "/samples/paracetamol-500mg.webp", label: "Paracetamol 500 mg" },
];

export default async function CheckPage() {
  const ctx = await requireSession();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">{t("check.title")}</h1>
        <p className="mt-2 text-xl">{t("check.intro")}</p>
      </div>
      <LabelCheck
        checkAction={checkLabelAction}
        takeAction={takeSlotAction}
        samples={ctx.circle.isDemo ? SAMPLES : []}
        strings={{
          takePhoto: t("check.takePhoto"),
          checking: t("check.checking"),
          again: t("check.again"),
          markTaken: t("check.markTaken"),
          samples: t("check.samples"),
        }}
      />
      <aside className="flex gap-3 rounded-card bg-card p-5 text-lg shadow-card">
        <Sparkle size={22} className="mt-1 shrink-0 text-olive" />
        <p>
          {t("check.aiNote")} {t("check.disclaimer")}
        </p>
      </aside>
    </div>
  );
}

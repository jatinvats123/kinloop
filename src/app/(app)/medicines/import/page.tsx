// Prescription import: the AI drafts medicines from pasted text or a photo; each draft is reviewed,
// edited and confirmed before it is saved (or proposed, when "Ask me first" is on).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { acceptDraftAction, draftPrescriptionAction } from "@/app/actions/ai";
import { PageHeader } from "@/components/common/page-header";
import { PrescriptionImport } from "@/components/import/prescription-import";
import { Sparkle } from "@/components/signature/sparkle";
import { can, needsApproval } from "@/domain/permissions";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Import a prescription" };
export const maxDuration = 60;

export default async function ImportPage() {
  const ctx = await requireSession();
  if (!can(ctx.member, "edit-schedule")) redirect("/medicines");
  const elder = ctx.circle.elderName.split(" ")[0];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Import a prescription"
        intro="Paste the prescription or choose a photo. The AI drafts the medicines; you check and confirm each one before anything is saved."
      />
      <aside className="flex gap-3 rounded-card bg-lime-soft p-5 text-base">
        <Sparkle size={20} className="mt-0.5 shrink-0" />
        <p>
          The AI only copies what the prescription says into drafts. It is not medical advice, and
          nothing is saved until you press Add.
          {needsApproval(ctx.member, ctx.circle)
            ? ` Ask me first is on, so each medicine you add is sent to ${elder} to approve.`
            : ""}
        </p>
      </aside>
      <PrescriptionImport draftAction={draftPrescriptionAction} acceptAction={acceptDraftAction} />
    </div>
  );
}

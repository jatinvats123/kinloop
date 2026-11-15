// Edit a member's details, access and alerts; regenerate their passcode; remove them.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  regeneratePasscodeAction,
  removeMemberAction,
  updateMemberAction,
} from "@/app/actions/care";
import { PageHeader } from "@/components/common/page-header";
import { EditMemberForm, RegeneratePasscodeForm } from "@/components/care/member-forms";
import { buttonClass } from "@/components/ui/button";
import { canManageMember } from "@/domain/permissions";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Member" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  const target = await ctx.repo.getMember(ctx.circle.code, (await params).id);
  if (!target) notFound();
  const isSelf = target.id === ctx.member.id;
  const managing = canManageMember(ctx.member, target);
  if (!isSelf && !managing) redirect("/circle");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={isSelf ? "Your settings" : target.name} />
      <div className="rounded-card bg-card p-5 shadow-card sm:p-8">
        <EditMemberForm
          action={updateMemberAction}
          member={target}
          managing={managing && target.role !== "elder"}
        />
      </div>
      {!isSelf && managing ? (
        <div className="mt-6 flex flex-col gap-6">
          <RegeneratePasscodeForm
            action={regeneratePasscodeAction}
            memberId={target.id}
            label={`Issue ${target.name} a new passcode`}
          />
          <form action={removeMemberAction}>
            <input type="hidden" name="id" value={target.id} />
            <button type="submit" className={buttonClass("attention", "lg")}>
              Remove {target.name} from the circle
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

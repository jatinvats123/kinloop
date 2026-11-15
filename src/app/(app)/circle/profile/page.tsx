// Edit the elder's health profile.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { updateProfileAction } from "@/app/actions/care";
import { PageHeader } from "@/components/common/page-header";
import { ProfileForm } from "@/components/care/member-forms";
import { can } from "@/domain/permissions";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Health profile" };

export default async function ProfilePage() {
  const ctx = await requireSession();
  if (!can(ctx.member, "edit-profile")) redirect("/circle");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Health profile" intro="Shown on the overview and used for visit briefs." />
      <div className="rounded-card bg-card p-5 shadow-card sm:p-8">
        <ProfileForm action={updateProfileAction} profile={ctx.circle.profile} />
      </div>
    </div>
  );
}

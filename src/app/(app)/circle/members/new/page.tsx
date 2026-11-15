// Add a family member or caretaker.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { addMemberAction } from "@/app/actions/care";
import { PageHeader } from "@/components/common/page-header";
import { AddMemberForm } from "@/components/care/member-forms";
import { can } from "@/domain/permissions";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Add a member" };

export default async function NewMemberPage() {
  const ctx = await requireSession();
  if (!can(ctx.member, "manage-members")) redirect("/circle");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Add a member"
        intro="They get their own 6-digit passcode. Choose what they can do."
      />
      <div className="rounded-card bg-card p-5 shadow-card sm:p-8">
        <AddMemberForm action={addMemberAction} />
      </div>
    </div>
  );
}

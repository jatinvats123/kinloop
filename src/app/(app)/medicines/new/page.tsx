// Add a medicine or routine.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { saveItemAction } from "@/app/actions/care";
import { PageHeader } from "@/components/common/page-header";
import { ItemForm } from "@/components/care/item-form";
import { can } from "@/domain/permissions";
import { todayIn } from "@/domain/time";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Add a medicine or routine" };

export default async function NewItemPage() {
  const ctx = await requireSession();
  if (!can(ctx.member, "edit-schedule")) redirect("/medicines");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add a medicine or routine" />
      <div className="rounded-card bg-card p-5 shadow-card sm:p-8">
        <ItemForm action={saveItemAction} today={todayIn(ctx.circle.timezone, ctx.now)} />
      </div>
    </div>
  );
}

// Edit or delete a medicine or routine.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { deleteItemAction, saveItemAction } from "@/app/actions/care";
import { PageHeader } from "@/components/common/page-header";
import { ItemForm } from "@/components/care/item-form";
import { buttonClass } from "@/components/ui/button";
import { can } from "@/domain/permissions";
import { todayIn } from "@/domain/time";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit" };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  if (!can(ctx.member, "edit-schedule")) redirect("/medicines");
  const item = await ctx.repo.getItem(ctx.circle.code, (await params).id);
  if (!item) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Edit ${item.name}`} />
      <div className="rounded-card bg-card p-5 shadow-card sm:p-8">
        <ItemForm
          action={saveItemAction}
          item={item}
          today={todayIn(ctx.circle.timezone, ctx.now)}
        />
      </div>
      <form action={deleteItemAction} className="mt-6">
        <input type="hidden" name="id" value={item.id} />
        <button type="submit" className={buttonClass("attention", "lg")}>
          Delete {item.name}
        </button>
        <p className="mt-2 text-sm text-muted">
          Deleting removes it from the schedule. Pausing keeps its history instead.
        </p>
      </form>
    </div>
  );
}

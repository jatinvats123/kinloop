// Edit or delete a doctor appointment.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { deleteAppointmentAction, saveAppointmentAction } from "@/app/actions/care";
import { PageHeader } from "@/components/common/page-header";
import { AppointmentForm } from "@/components/care/appointment-form";
import { buttonClass } from "@/components/ui/button";
import { can } from "@/domain/permissions";
import { zonedParts } from "@/domain/time";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Edit visit" };

export default async function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  if (!can(ctx.member, "edit-appointments")) redirect("/appointments");
  const appt = await ctx.repo.getAppointment(ctx.circle.code, (await params).id);
  if (!appt) notFound();
  const { date, time } = zonedParts(appt.at, ctx.circle.timezone);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`Edit visit with ${appt.doctor}`} />
      <div className="rounded-card bg-card p-5 shadow-card sm:p-8">
        <AppointmentForm action={saveAppointmentAction} defaults={{ ...appt, date, time }} />
      </div>
      <form action={deleteAppointmentAction} className="mt-6">
        <input type="hidden" name="id" value={appt.id} />
        <button type="submit" className={buttonClass("attention", "lg")}>
          Delete this visit
        </button>
      </form>
    </div>
  );
}

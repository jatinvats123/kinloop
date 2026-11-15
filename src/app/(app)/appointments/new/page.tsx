// Add a doctor appointment.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { saveAppointmentAction } from "@/app/actions/care";
import { PageHeader } from "@/components/common/page-header";
import { AppointmentForm } from "@/components/care/appointment-form";
import { can } from "@/domain/permissions";
import { addDays, todayIn } from "@/domain/time";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Add a visit" };

export default async function NewAppointmentPage() {
  const ctx = await requireSession();
  if (!can(ctx.member, "edit-appointments")) redirect("/appointments");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add a visit" />
      <div className="rounded-card bg-card p-5 shadow-card sm:p-8">
        <AppointmentForm
          action={saveAppointmentAction}
          defaults={{ date: addDays(todayIn(ctx.circle.timezone, ctx.now), 1), time: "10:00" }}
        />
      </div>
    </div>
  );
}

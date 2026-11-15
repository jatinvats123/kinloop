// Upcoming doctor appointments with "Add to Google Calendar" links.
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, MapPin, Plus } from "lucide-react";
import { PageHeader, SavedNotice } from "@/components/common/page-header";
import { buttonClass } from "@/components/ui/button";
import { googleCalendarUrl } from "@/domain/calendar-link";
import { can } from "@/domain/permissions";
import { clockLabel, longDate } from "@/domain/time";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Visits" };

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const ctx = await requireSession();
  const zone = ctx.circle.timezone;
  const since = new Date(ctx.now.getTime() - 2 * 3600_000).toISOString();
  const appts = await ctx.repo.listAppointments(ctx.circle.code, since, 30);
  const canEdit = can(ctx.member, "edit-appointments");

  return (
    <div>
      <PageHeader
        title="Visits"
        intro="Upcoming doctor appointments. Reminders go out a day and two hours before."
        action={
          canEdit ? (
            <Link href="/appointments/new" className={buttonClass("primary", "lg")}>
              <Plus aria-hidden="true" size={20} />
              Add a visit
            </Link>
          ) : undefined
        }
      />
      <SavedNotice show={(await searchParams).saved === "1"} />
      {appts.length === 0 ? (
        <p className="rounded-card bg-card p-6 text-lg shadow-card">No visits coming up.</p>
      ) : (
        <ol className="grid gap-4 lg:grid-cols-2">
          {appts.map((a, i) => (
            <li
              key={a.id}
              className={`flex flex-col gap-3 rounded-card p-5 shadow-card sm:p-6 ${i === 0 ? "bg-lime" : "bg-card"}`}
            >
              <p className="text-lg font-semibold">
                {longDate(a.at, zone)}
                <span className="numeral ml-2 text-2xl">{clockLabel(a.at, zone)}</span>
              </p>
              <h2 className="text-2xl font-semibold">
                {a.doctor}
                {a.specialty ? <span className="font-medium"> ({a.specialty})</span> : null}
              </h2>
              {a.location ? (
                <p className="flex items-center gap-2 text-base">
                  <MapPin aria-hidden="true" size={18} />
                  {a.location}
                </p>
              ) : null}
              {a.notes ? <p className="text-base">{a.notes}</p> : null}
              <div className="mt-1 flex flex-wrap gap-2">
                <a
                  href={googleCalendarUrl(a, ctx.circle.elderName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("secondary")}
                >
                  <CalendarPlus aria-hidden="true" size={18} />
                  Add to Google Calendar<span className="sr-only"> (opens in a new tab)</span>
                </a>
                {canEdit ? (
                  <Link href={`/appointments/${a.id}`} className={buttonClass("secondary")}>
                    Edit<span className="sr-only"> visit with {a.doctor}</span>
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

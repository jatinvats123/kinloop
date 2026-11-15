// Reminders log: what was sent, what is coming up, and a strictly limited test email.
import type { Metadata } from "next";
import { BellRing, Clock, Mail } from "lucide-react";
import { sendTestReminderAction } from "@/app/actions/reminders";
import { PageHeader } from "@/components/common/page-header";
import { TestReminderForm } from "@/components/reminders/test-reminder-form";
import { Card } from "@/components/ui/card";
import { reminderLadder } from "@/domain/config";
import { clockLabel, longDate } from "@/domain/time";
import type { NotificationType } from "@/domain/types";
import { requireSession } from "@/server/auth/session";
import { buildRemindersView } from "@/server/services/reminders";

export const metadata: Metadata = { title: "Reminders" };

const STAGE_LABEL: Record<NotificationType, string> = {
  due: "Dose due",
  "missed-elder": "Second nudge",
  "missed-circle": "Told the circle",
  "appt-24h": "Appointment tomorrow",
  "appt-2h": "Appointment in 2 hours",
  test: "Test email",
};

export default async function RemindersPage() {
  const ctx = await requireSession();
  const view = await buildRemindersView(ctx);
  const zone = ctx.circle.timezone;
  const when = (iso: string) => `${longDate(iso, zone)}, ${clockLabel(iso, zone)}`;
  const L = reminderLadder;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Reminders"
        intro={`Email reminders follow a ladder: ${ctx.circle.elderName} hears first, ${-L.dueOffsetMin} minutes before a dose and again ${L.missedElderOffsetMin} minutes after. Only if it is still not marked an hour after does the circle hear.`}
      />

      <Card aria-labelledby="test-heading">
        <h2 id="test-heading" className="flex items-center gap-2 text-xl font-semibold">
          <Mail aria-hidden="true" size={22} /> Get reminders by email
        </h2>
        <p className="mt-1 mb-4 text-base text-muted">
          {ctx.circle.isDemo
            ? `This is a demo circle. Enter your email while signed in as ${ctx.member.name}, and the real reminder ladder will reach that address for this demo. Switch to Kamla to get her dose emails, or to Priya to get the escalation.`
            : "Reminders go only to members' own addresses. You can send yourself up to three test emails an hour."}
        </p>
        <TestReminderForm
          action={sendTestReminderAction}
          email={view.myEmail}
          hint="Used only for this circle's reminders."
        />
      </Card>

      <Card aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="flex items-center gap-2 text-xl font-semibold">
          <Clock aria-hidden="true" size={22} /> Coming up in the next 24 hours
        </h2>
        {view.upcoming.length === 0 ? (
          <p className="mt-2 text-base text-muted">
            {view.anyEmail
              ? "Nothing is due to be sent."
              : "No one in the circle has an email yet, so no reminders will be sent."}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-ink/10">
            {view.upcoming.map((u) => (
              <li key={`${u.stage}-${u.at}`} className="flex flex-col py-3 sm:flex-row sm:gap-4">
                <span className="w-48 shrink-0 font-semibold">
                  <time dateTime={u.sendAt}>{when(u.sendAt)}</time>
                </span>
                <span>
                  {STAGE_LABEL[u.stage]} to {u.toNames.join(", ")}
                  {u.itemIds.length > 0
                    ? ` (${u.itemIds.length} item${u.itemIds.length > 1 ? "s" : ""} at ${clockLabel(u.at, zone)})`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="sent-heading">
        <h2 id="sent-heading" className="flex items-center gap-2 text-xl font-semibold">
          <BellRing aria-hidden="true" size={22} /> Sent in the last 7 days
        </h2>
        {view.sent.length === 0 ? (
          <p className="mt-2 text-base text-muted">No reminders sent yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-ink/10">
            {view.sent.map((n) => (
              <li key={n.id} className="flex flex-col py-3 sm:flex-row sm:gap-4">
                <span className="w-48 shrink-0 font-semibold">
                  <time dateTime={n.sentAt}>{when(n.sentAt)}</time>
                </span>
                <span>
                  {STAGE_LABEL[n.type]} to {n.toName}
                  {n.type !== "test" ? ` (about ${clockLabel(n.at, zone)})` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

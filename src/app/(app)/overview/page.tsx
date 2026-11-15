// Overview: where family and caretakers land. Today's status, flagged skips, the week, adherence,
// the health profile, the next visit and recent activity.
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronRight, HeartHandshake } from "lucide-react";
import { DayBloom } from "@/components/signature/day-bloom";
import { ThinCurve } from "@/components/signature/data-marks";
import { StatusLabel } from "@/components/signature/status-label";
import { WeekStrip } from "@/components/signature/week-strip";
import { Card, CardHeader } from "@/components/ui/card";
import { t } from "@/domain/messages";
import { clockLabel, longDate, to12h } from "@/domain/time";
import { requireSession } from "@/server/auth/session";
import { buildOverview } from "@/server/services/read-models";

export const metadata: Metadata = { title: "Overview" };

const linkCls =
  "inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-olive underline underline-offset-4";

export default async function OverviewPage() {
  const ctx = await requireSession();
  const { circle } = ctx;
  const zone = circle.timezone;
  const o = await buildOverview(ctx.repo, circle, ctx.now);
  const firstName = circle.elderName.split(" ")[0];
  const pct = o.adherence7.overall.percent;
  const p = circle.profile;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-lg font-semibold text-muted">{longDate(ctx.now, zone)}</p>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
          How {firstName} is doing <span className="font-semibold">today</span>
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card aria-labelledby="today-h">
            <CardHeader
              id="today-h"
              title="Today"
              action={
                <Link href="/today" className={linkCls}>
                  Open Today
                  <ChevronRight aria-hidden="true" size={16} />
                </Link>
              }
            />
            <div className="flex items-center gap-5">
              <DayBloom total={o.today.total} done={o.today.done} size="md" />
              <p className="text-xl font-semibold">
                {o.today.total === 0
                  ? t("today.nothingScheduled")
                  : t("today.progress", { taken: o.today.done, total: o.today.total })}
              </p>
            </div>
            <ul className="mt-5 flex flex-col divide-y divide-ink/10">
              {o.today.groups.map((g) => (
                <li key={g.at} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">{to12h(g.time).label}</p>
                    <p className="truncate text-sm text-muted">
                      {g.items.map((i) => i.item.name).join(", ")}
                    </p>
                    {g.followUp ? (
                      <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-lime-soft px-3 py-1 text-sm font-semibold">
                        <HeartHandshake aria-hidden="true" size={16} />
                        {g.followUp.memberName} is checking
                      </p>
                    ) : null}
                  </div>
                  <StatusLabel status={g.status} />
                </li>
              ))}
            </ul>
          </Card>

          {o.flagged.length > 0 ? (
            <section aria-labelledby="flag-h" className="rounded-card bg-blush-soft p-5 sm:p-6">
              <h2 id="flag-h" className="mb-3 flex items-center gap-2 text-xl font-semibold">
                <AlertTriangle aria-hidden="true" size={22} />
                Needs attention
              </h2>
              <ul className="flex flex-col gap-3">
                {o.flagged.slice(0, 4).map((f) => (
                  <li key={f.log.id} className="text-base">
                    <span className="font-semibold">
                      {f.log.reason ? t(`skip.${f.log.reason}`) : ""}
                    </span>
                    : skipped {f.itemName} on {longDate(f.log.scheduledAt, zone)},{" "}
                    {clockLabel(f.log.scheduledAt, zone)}
                    {f.log.note ? (
                      <span className="text-muted">. &ldquo;{f.log.note}&rdquo;</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Card aria-labelledby="act-h">
            <CardHeader
              id="act-h"
              title="Recent activity"
              action={
                <Link href="/activity" className={linkCls}>
                  All activity
                  <ChevronRight aria-hidden="true" size={16} />
                </Link>
              }
            />
            <ol className="flex flex-col gap-3">
              {o.activity.slice(0, 6).map((a) => (
                <li key={a.id} className="text-base">
                  <span className="font-semibold">{a.actor}</span>{" "}
                  {a.summary.charAt(0).toLowerCase() + a.summary.slice(1)}
                  <span className="block text-sm text-muted">
                    {longDate(a.at, zone)}, {clockLabel(a.at, zone)}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card aria-labelledby="week-h">
            <CardHeader
              id="week-h"
              title="This week"
              action={
                <Link href="/adherence" className={linkCls}>
                  Adherence
                  <ChevronRight aria-hidden="true" size={16} />
                </Link>
              }
            />
            <WeekStrip days={o.week} />
            <div className="mt-5 grid grid-cols-[auto_1fr] items-end gap-5">
              <div>
                <p className="numeral text-5xl">
                  {pct ?? "–"}
                  {pct !== null ? <span className="text-2xl text-muted"> %</span> : null}
                </p>
                <p className="text-sm font-semibold text-muted">taken, last 7 days</p>
              </div>
              <ThinCurve
                values={o.adherence7.daily
                  .filter((d) => d.percent !== null)
                  .map((d) => d.percent as number)}
                label={`Daily adherence: ${o.adherence7.daily.map((d) => (d.percent === null ? "none" : `${d.percent}%`)).join(", ")}`}
              />
            </div>
            {o.adherence7.mostMissedPart ? (
              <p className="mt-4 rounded-2xl bg-stage px-4 py-3 text-base">
                Most often missed:{" "}
                <span className="font-semibold">{o.adherence7.mostMissedPart.part} doses</span> (
                {o.adherence7.mostMissedPart.count} this week)
              </p>
            ) : null}
          </Card>

          <Card aria-labelledby="visit-h">
            <h2 id="visit-h" className="mb-3 flex items-center gap-2 text-xl font-semibold">
              <CalendarDays aria-hidden="true" size={22} />
              Next visit
            </h2>
            {o.upcoming[0] ? (
              <>
                <p className="text-2xl font-semibold">{o.upcoming[0].doctor}</p>
                <p className="text-base text-muted">
                  {longDate(o.upcoming[0].at, zone)}, {clockLabel(o.upcoming[0].at, zone)}
                  {o.upcoming[0].location ? `, ${o.upcoming[0].location}` : ""}
                </p>
                <div className="flex flex-wrap gap-x-5">
                  <Link href={`/appointments/${o.upcoming[0].id}/brief`} className={linkCls}>
                    Visit brief
                    <ChevronRight aria-hidden="true" size={16} />
                  </Link>
                  <Link href="/appointments" className={linkCls}>
                    All visits
                    <ChevronRight aria-hidden="true" size={16} />
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-base text-muted">No visits coming up.</p>
            )}
          </Card>

          <Card aria-labelledby="rem-h">
            <CardHeader
              id="rem-h"
              title="Email reminders"
              action={
                <Link href="/reminders" className={linkCls}>
                  Reminders log
                  <ChevronRight aria-hidden="true" size={16} />
                </Link>
              }
            />
            <p className="text-base">
              {firstName} is reminded first. If a dose is still not marked an hour later, members
              who asked are emailed, and the first to answer is shown here as checking.
            </p>
          </Card>

          <Card aria-labelledby="prof-h">
            <CardHeader
              id="prof-h"
              title="Health profile"
              action={
                <Link href="/circle" className={linkCls}>
                  Details
                  <ChevronRight aria-hidden="true" size={16} />
                </Link>
              }
            />
            <dl className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <dt className="text-sm font-semibold text-muted">Conditions</dt>
                <dd className="text-base font-semibold">
                  {p.conditions.join(", ") || "None recorded"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm font-semibold text-muted">Allergies</dt>
                <dd className="text-base font-semibold">
                  {p.allergies.join(", ") || "None recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-muted">Blood group</dt>
                <dd className="text-base font-semibold">{p.bloodGroup || "Not known"}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-muted">Emergency</dt>
                <dd className="text-base font-semibold">{p.emergencyContact.phone || "Not set"}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

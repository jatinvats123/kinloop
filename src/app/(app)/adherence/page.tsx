// Adherence: 7- and 30-day percentages overall and per item, streak, most-missed part of day,
// drawn with hand-made SVG marks that each carry a text equivalent.
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { ThinCurve, TickBar, type Mark } from "@/components/signature/data-marks";
import { WeekStrip } from "@/components/signature/week-strip";
import { Card, CardHeader } from "@/components/ui/card";
import { requireSession } from "@/server/auth/session";
import { buildOverview } from "@/server/services/read-models";

export const metadata: Metadata = { title: "Adherence" };

export default async function AdherencePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const ctx = await requireSession();
  const days = (await searchParams).days === "30" ? 30 : 7;
  const o = await buildOverview(ctx.repo, ctx.circle, ctx.now);
  const report = days === 30 ? o.adherence30 : o.adherence7;
  const { overall } = report;
  const marks: Mark[] = report.daily.map((d) =>
    d.counted === 0
      ? "none"
      : d.taken === d.counted
        ? "taken"
        : d.missed > 0
          ? "missed"
          : "skipped",
  );

  return (
    <div>
      <PageHeader
        title="Adherence"
        intro="Doses count once their time has passed by an hour, or once they are logged. Skipped doses count as not taken."
        action={
          <nav aria-label="Period" className="flex rounded-full bg-card p-1 shadow-card">
            {[7, 30].map((n) => (
              <Link
                key={n}
                href={`/adherence?days=${n}`}
                aria-current={days === n ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold ${days === n ? "bg-ink text-card" : "text-ink"}`}
              >
                {n} days
              </Link>
            ))}
          </nav>
        }
      />
      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_1.2fr]">
        <Card aria-labelledby="overall-h">
          <CardHeader id="overall-h" title={`Last ${days} days`} />
          <p className="numeral text-6xl">
            {overall.percent ?? "–"}
            {overall.percent !== null ? <span className="text-3xl text-muted"> %</span> : null}
          </p>
          <p className="mt-1 text-lg">
            {overall.taken} taken, {overall.skipped} skipped, {overall.missed} missed
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-stage p-4">
              <dt className="text-sm font-semibold text-muted">Streak</dt>
              <dd className="numeral text-3xl">
                {report.streakDays}
                <span className="text-lg text-muted">
                  {" "}
                  {report.streakDays === 1 ? "day" : "days"}
                </span>
              </dd>
            </div>
            <div className="rounded-2xl bg-stage p-4">
              <dt className="text-sm font-semibold text-muted">Most missed</dt>
              <dd className="text-xl font-semibold capitalize">
                {report.mostMissedPart ? report.mostMissedPart.part : "Nothing"}
              </dd>
            </div>
          </dl>
          <div className="mt-6">
            <TickBar
              marks={marks}
              label={`Day by day: ${report.daily.map((d) => `${d.date} ${d.counted === 0 ? "nothing counted" : `${d.taken} of ${d.counted}`}`).join("; ")}`}
            />
            <ThinCurve
              values={report.daily
                .filter((d) => d.percent !== null)
                .map((d) => d.percent as number)}
              label="Daily adherence trend"
            />
          </div>
        </Card>
        <div className="flex flex-col gap-6">
          <Card aria-labelledby="week-h">
            <CardHeader id="week-h" title="This week" />
            <WeekStrip days={o.week} />
          </Card>
          <Card aria-labelledby="items-h">
            <CardHeader id="items-h" title="By medicine and routine" />
            <table className="w-full text-left">
              <caption className="sr-only">Adherence per item over the last {days} days</caption>
              <thead>
                <tr className="text-sm text-muted">
                  <th scope="col" className="pb-2 font-semibold">
                    Item
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Taken
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Skipped
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Missed
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.perItem.map((i) => (
                  <tr key={i.itemId} className="border-t border-ink/10 text-base">
                    <th scope="row" className="py-3 font-semibold">
                      {i.name}
                    </th>
                    <td className="py-3 text-right">{i.taken}</td>
                    <td className="py-3 text-right">{i.skipped}</td>
                    <td className="py-3 text-right">{i.missed}</td>
                    <td className="py-3 text-right font-semibold">{i.percent ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}

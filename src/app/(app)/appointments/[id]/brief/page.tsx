// Visit brief for one appointment: facts computed by code (always shown), then AI-drafted points to
// discuss. Printable; the print stylesheet drops navigation and buttons.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { draftBriefAction } from "@/app/actions/ai";
import { BriefDraft, PrintButton } from "@/components/brief/brief-draft";
import { clockLabel, longDate } from "@/domain/time";
import { AppError } from "@/server/errors";
import { requireSession } from "@/server/auth/session";
import { openVisitBrief, type VisitBrief } from "@/server/services/visit-brief";

export const metadata: Metadata = { title: "Visit brief" };

const card =
  "rounded-card bg-card p-5 shadow-card sm:p-6 print:break-inside-avoid print:shadow-none print:ring-1 print:ring-ink/30";

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div>
      <dt className="text-base font-semibold text-muted">{label}</dt>
      <dd className="numeral mt-1 text-4xl">
        {value}
        {unit ? <span className="ml-1 text-lg font-semibold">{unit}</span> : null}
      </dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-base text-muted">{children}</p>;
}

export default async function VisitBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  let brief: VisitBrief;
  try {
    brief = await openVisitBrief(ctx, (await params).id);
  } catch (err) {
    if (err instanceof AppError && err.code === "not-found") notFound();
    throw err;
  }
  const { appointment: appt, facts } = brief;
  const zone = ctx.circle.timezone;
  const a = facts.adherence;
  const pct = (p: number | null) => (p === null ? "–" : String(p));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <Link
        href="/appointments"
        className="inline-flex min-h-11 items-center gap-2 self-start text-base font-semibold underline-offset-4 hover:underline print:hidden"
      >
        <ArrowLeft aria-hidden="true" size={18} />
        All visits
      </Link>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
            Visit brief for {ctx.circle.elderName}
          </h1>
          <p className="mt-2 text-lg font-semibold">
            {appt.doctor}
            {appt.specialty ? ` (${appt.specialty})` : ""}, {longDate(appt.at, zone)} at{" "}
            {clockLabel(appt.at, zone)}
          </p>
          {appt.location ? <p className="text-base text-muted">{appt.location}</p> : null}
        </div>
        <PrintButton />
      </header>

      <section aria-labelledby="brief-adherence" className={card}>
        <h2 id="brief-adherence" className="text-2xl font-semibold">
          Medicines taken, last {a.days} days
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Stat value={pct(a.percent30)} unit="%" label={`${a.days} days`} />
          <Stat value={pct(a.percent7)} unit="%" label="7 days" />
          <Stat value={String(a.missed)} unit="missed" label="Not logged" />
          <Stat value={String(a.skipped)} unit="skipped" label="Skipped" />
        </dl>
        {a.mostMissedPart ? (
          <p className="mt-4 text-lg">
            Doses are most often missed in the <strong>{a.mostMissedPart}</strong>.
          </p>
        ) : null}
        {facts.perItem.length > 0 ? (
          <table className="mt-5 w-full text-left text-base">
            <caption className="sr-only">Adherence for each item</caption>
            <thead>
              <tr className="border-b border-ink/15">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Item
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Taken
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Missed
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Skipped
                </th>
              </tr>
            </thead>
            <tbody>
              {facts.perItem.map((p) => (
                <tr key={p.name} className="border-b border-ink/10 last:border-0">
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {p.name}
                  </th>
                  <td className="py-2 pr-3">{p.percent === null ? "–" : `${p.percent} %`}</td>
                  <td className="py-2 pr-3">{p.missed}</td>
                  <td className="py-2">{p.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section aria-labelledby="brief-skips" className={card}>
          <h2 id="brief-skips" className="text-2xl font-semibold">
            Skipped, and why
          </h2>
          {facts.skips.length === 0 ? (
            <Empty>No doses skipped.</Empty>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-base">
              {facts.skips.map((s, i) => (
                <li key={i}>
                  <strong>{s.reason}</strong>: {s.item}, {s.date} {s.time}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="brief-missed" className={card}>
          <h2 id="brief-missed" className="text-2xl font-semibold">
            Recent missed doses
          </h2>
          {facts.missed.length === 0 ? (
            <Empty>No missed doses.</Empty>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-base">
              {facts.missed.map((m, i) => (
                <li key={i}>
                  {m.item}, {m.date} {m.time}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="brief-schedule" className={card}>
        <h2 id="brief-schedule" className="text-2xl font-semibold">
          Current medicines and routines
        </h2>
        <ul className="mt-3 flex flex-col gap-3 text-base">
          {facts.schedule.map((s, i) => (
            <li key={i}>
              <strong className="text-lg">
                {s.name}
                {s.dose ? ` ${s.dose}` : ""}
              </strong>
              {s.composition ? <span className="text-muted"> ({s.composition})</span> : null}
              {s.paused ? <span className="font-semibold"> · Paused</span> : null}
              <br />
              {s.kind === "routine" ? "Routine" : "Medicine"} at {s.times.join(", ")}
              {s.instructions ? `. ${s.instructions}` : ""}
            </li>
          ))}
        </ul>
        {facts.readings.length > 0 ? (
          <>
            <h3 className="mt-5 text-xl font-semibold">Readings noted</h3>
            <ul className="mt-2 flex flex-col gap-1 text-base">
              {facts.readings.map((r, i) => (
                <li key={i}>
                  {r.item}, {r.date}: {r.note}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section aria-labelledby="brief-profile" className={card}>
        <h2 id="brief-profile" className="text-2xl font-semibold">
          Health profile
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-base sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Conditions</dt>
          <dd>{facts.profile.conditions.join(", ") || "None recorded"}</dd>
          <dt className="font-semibold">Allergies</dt>
          <dd>{facts.profile.allergies.join(", ") || "None recorded"}</dd>
          <dt className="font-semibold">Blood group</dt>
          <dd>{facts.profile.bloodGroup || "Not recorded"}</dd>
          <dt className="font-semibold">Primary doctor</dt>
          <dd>{facts.profile.primaryDoctor || "Not recorded"}</dd>
        </dl>
      </section>

      <BriefDraft appointmentId={appt.id} initial={brief.draft} action={draftBriefAction} />

      <p className="text-sm text-muted">
        Facts computed by Kinloop from the logged schedule on {longDate(ctx.now, zone)}.
      </p>
    </div>
  );
}

// Activity feed: who changed, logged or checked what, and when.
import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { clockLabel, longDate } from "@/domain/time";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const ctx = await requireSession();
  const zone = ctx.circle.timezone;
  const entries = await ctx.repo.listActivity(ctx.circle.code, 60);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Activity"
        intro="Every change, dose and decision in the circle, newest first."
      />
      {entries.length === 0 ? (
        <p className="rounded-card bg-card p-6 text-lg shadow-card">Nothing has happened yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((a) => (
            <li key={a.id} className="rounded-card bg-card px-5 py-4 shadow-card">
              <p className="text-lg">
                <span className="font-semibold">{a.actor}</span>{" "}
                {a.summary.charAt(0).toLowerCase() + a.summary.slice(1)}
              </p>
              <p className="text-sm text-muted">
                <time dateTime={a.at}>
                  {longDate(a.at, zone)}, {clockLabel(a.at, zone)}
                </time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

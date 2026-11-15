// Today: the elder-first screen. Slots grouped by time, one large action per slot, skip with a
// reason, statuses as icon + text, the day bloom, the next appointment and comfort controls.
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CalendarDays, ScanLine } from "lucide-react";
import { setTextSizeAction } from "@/app/actions/prefs";
import {
  decideProposalAction,
  skipItemAction,
  takeSlotAction,
  undoLogAction,
} from "@/app/actions/care";
import { DayBloom } from "@/components/signature/day-bloom";
import { SlotCard, type SlotCardItem } from "@/components/signature/slot-card";
import { ReadAloud, TextSizeControl } from "@/components/today/comfort-controls";
import { ProposalCards } from "@/components/today/proposal-cards";
import { SkipForm } from "@/components/today/skip-form";
import { TakeSlotForm } from "@/components/today/take-slot-form";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { t, type MessageKey } from "@/domain/messages";
import { can } from "@/domain/permissions";
import { clockLabel, greetingPart, longDate, to12h } from "@/domain/time";
import { SKIP_REASONS, type SlotStatus } from "@/domain/types";
import { requireSession } from "@/server/auth/session";
import { listPendingProposals } from "@/server/services/proposals";
import { buildToday, type TodayGroup } from "@/server/services/read-models";

export const metadata: Metadata = { title: "Today" };

const statusKey: Record<SlotStatus, MessageKey> = {
  taken: "status.taken",
  skipped: "status.skipped",
  missed: "status.missed",
  due: "status.due",
  upcoming: "status.upcoming",
};

function itemDetail(i: TodayGroup["items"][number]): { detail: string; note?: string } {
  const detail = i.item.instructions;
  if (i.log?.status === "skipped" && i.log.reason) {
    return {
      detail,
      note: `${t("status.skipped")}: ${t(`skip.${i.log.reason}`)}${i.log.note ? `, ${i.log.note}` : ""}`,
    };
  }
  if (i.log?.note) return { detail, note: `Reading ${i.log.note}` };
  return { detail };
}

function skippedText(g: TodayGroup): string {
  const reason = g.items.find((i) => i.log?.reason)?.log?.reason;
  return reason ? `${t("status.skipped")}: ${t(`skip.${reason}`)}` : t("status.skipped");
}

function itemName(i: TodayGroup["items"][number]): string {
  return i.item.kind === "medicine" && i.item.dose ? `${i.item.name} ${i.item.dose}` : i.item.name;
}

export default async function TodayPage() {
  const ctx = await requireSession();
  const { circle, member } = ctx;
  const [view, proposals] = await Promise.all([
    buildToday(ctx.repo, circle, ctx.now),
    listPendingProposals(ctx),
  ]);
  const canLog = can(member, "log-dose");
  const isElder = member.role === "elder";
  const firstName = circle.elderName.split(" ")[0] ?? circle.elderName;
  const heading = isElder
    ? t(`greeting.${greetingPart(ctx.now, circle.timezone)}`, { name: `${firstName} ji` })
    : `${firstName}'s day`;
  const progress =
    view.total === 0
      ? t("today.nothingScheduled")
      : view.done === view.total
        ? t("today.allDone")
        : t("today.progress", { taken: view.done, total: view.total });
  const textSize = (await cookies()).get("kl_text")?.value ?? "normal";
  const reasons = SKIP_REASONS.map((r) => ({ value: r, label: t(`skip.${r}`) }));

  const spoken = [
    heading,
    progress,
    ...view.groups.map(
      (g) =>
        `${to12h(g.time).label}: ${g.items.map(itemName).join(", ")}. ${t(statusKey[g.status])}.`,
    ),
    view.nextAppointment
      ? `${t("today.nextAppointment")}: ${view.nextAppointment.doctor}, ${longDate(view.nextAppointment.at, circle.timezone)} at ${clockLabel(view.nextAppointment.at, circle.timezone)}.`
      : "",
  ].join(" ");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <section aria-labelledby="today-heading" className="flex flex-col gap-5">
        <p className="text-lg font-semibold text-muted">{longDate(ctx.now, circle.timezone)}</p>
        <h1 id="today-heading" className="text-3xl font-light tracking-tight sm:text-4xl">
          {heading}
        </h1>
        <div className="flex items-center gap-5 sm:gap-8">
          <DayBloom total={view.total} done={view.done} size="lg" breathing />
          <div>
            {view.total > 0 ? (
              <p className="numeral text-5xl sm:text-6xl">
                {view.done} <span className="text-2xl text-muted">of {view.total}</span>
              </p>
            ) : null}
            <p className="text-lg font-semibold" aria-live="polite">
              {progress}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ReadAloud
            text={spoken}
            startLabel={t("today.readAloud")}
            stopLabel={t("today.stopReading")}
          />
          <TextSizeControl
            action={setTextSizeAction}
            current={textSize}
            label={t("today.textSize")}
          />
        </div>
      </section>

      <Link href="/check" className={buttonClass("lime", "lg", "min-h-16 w-full text-xl")}>
        <ScanLine aria-hidden="true" size={26} />
        {t("check.open")}
      </Link>

      <ProposalCards
        proposals={proposals}
        canDecide={isElder}
        elderFirstName={firstName}
        action={decideProposalAction}
      />

      {view.groups.length === 0 ? (
        <Card>
          <p className="text-lg">{t("today.nothingScheduled")}.</p>
          {can(member, "edit-schedule") ? (
            <Link
              href="/medicines/new"
              className="mt-3 inline-flex min-h-11 items-center font-semibold text-olive underline underline-offset-4"
            >
              Add a medicine or routine
            </Link>
          ) : null}
        </Card>
      ) : (
        <ol className="flex flex-col gap-4" aria-label="Today's times">
          {view.groups.map((g) => {
            const clock = to12h(g.time);
            const open = g.items.filter((i) => i.status !== "taken" && i.status !== "skipped");
            const lastTaken = g.items
              .map((i) => i.log)
              .filter((l) => l?.status === "taken")
              .sort((a, b) => ((a?.loggedAt ?? "") < (b?.loggedAt ?? "") ? 1 : -1))[0];
            const items: SlotCardItem[] = g.items.map((i) => ({
              id: i.item.id,
              kind: i.item.kind,
              name: itemName(i),
              status: i.status,
              ...itemDetail(i),
            }));
            const settled = g.status === "taken" || g.status === "skipped";
            const allRoutines = g.items.every((i) => i.item.kind === "routine");
            return (
              <SlotCard
                key={g.at}
                time={clock.time}
                meridiem={clock.meridiem}
                status={g.status}
                statusText={t(statusKey[g.status])}
                settledText={
                  lastTaken
                    ? t("slot.takenAt", { time: clockLabel(lastTaken.loggedAt, circle.timezone) })
                    : skippedText(g)
                }
                items={items}
                itemAction={
                  canLog
                    ? (item) => (
                        <SkipForm
                          action={skipItemAction}
                          slotAt={g.at}
                          itemId={item.id}
                          itemName={item.name}
                          title={t("slot.skip")}
                          question={t("slot.skipWhy", { item: item.name })}
                          reasons={reasons}
                        />
                      )
                    : undefined
                }
                action={
                  canLog && !settled ? (
                    <TakeSlotForm
                      action={takeSlotAction}
                      slotAt={g.at}
                      primary={g.status === "due" || g.status === "missed"}
                      label={
                        allRoutines
                          ? t("slot.doneRoutine")
                          : open.length === 1
                            ? t("slot.takeOne")
                            : t("slot.takeAll")
                      }
                      readingLabel={t("slot.reading")}
                      items={open.map((i) => ({
                        id: i.item.id,
                        name: i.item.name,
                        needsReading: i.item.kind === "routine",
                      }))}
                    />
                  ) : canLog && settled ? (
                    <form action={undoLogAction} className="shrink-0">
                      <input type="hidden" name="slotAt" value={g.at} />
                      {g.items.map((i) => (
                        <input key={i.item.id} type="hidden" name="itemIds" value={i.item.id} />
                      ))}
                      <button
                        type="submit"
                        className="min-h-11 rounded-full px-3 text-sm font-semibold text-olive underline underline-offset-4"
                      >
                        Undo<span className="sr-only"> {clock.label}</span>
                      </button>
                    </form>
                  ) : undefined
                }
              />
            );
          })}
        </ol>
      )}

      <Card aria-labelledby="next-appt">
        <h2 id="next-appt" className="flex items-center gap-2 text-xl font-semibold">
          <CalendarDays aria-hidden="true" size={22} />
          {t("today.nextAppointment")}
        </h2>
        {view.nextAppointment ? (
          <div className="mt-3">
            <p className="text-2xl font-semibold">{view.nextAppointment.doctor}</p>
            <p className="text-lg text-muted">
              {longDate(view.nextAppointment.at, circle.timezone)},{" "}
              {clockLabel(view.nextAppointment.at, circle.timezone)}
              {view.nextAppointment.location ? `, ${view.nextAppointment.location}` : ""}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-lg text-muted">{t("today.noAppointment")}</p>
        )}
      </Card>
    </div>
  );
}

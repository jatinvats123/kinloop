// Medicines and routines: the full schedule, with pause/resume and links to edit.
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Pause, Pill, Play, Plus } from "lucide-react";
import { toggleItemAction } from "@/app/actions/care";
import { PageHeader, SavedNotice } from "@/components/common/page-header";
import { buttonClass } from "@/components/ui/button";
import { can } from "@/domain/permissions";
import { to12h } from "@/domain/time";
import type { Item } from "@/domain/types";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Medicines and routines" };

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function days(item: Item): string {
  return item.daysOfWeek.length === 7 ? "Every day" : item.daysOfWeek.map((d) => DAY[d]).join(", ");
}

export default async function MedicinesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const ctx = await requireSession();
  const items = (await ctx.repo.listItems(ctx.circle.code)).sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
  );
  const canEdit = can(ctx.member, "edit-schedule");
  const groups: Array<[string, Item[]]> = [
    ["Medicines", items.filter((i) => i.kind === "medicine")],
    ["Routines", items.filter((i) => i.kind === "routine")],
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Medicines and routines"
        intro={
          canEdit
            ? "Everything on the schedule. Changes show on Today straight away."
            : "You can view the schedule. Ask an organiser for edit access to change it."
        }
        action={
          canEdit ? (
            <Link href="/medicines/new" className={buttonClass("primary", "lg")}>
              <Plus aria-hidden="true" size={20} />
              Add
            </Link>
          ) : undefined
        }
      />
      <SavedNotice show={(await searchParams).saved === "1"} />
      {items.length === 0 ? (
        <p className="rounded-card bg-card p-6 text-lg shadow-card">
          Nothing here yet. Add the first medicine or routine to build Today.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {groups.map(([title, list]) => (
            <section key={title} aria-labelledby={`h-${title}`}>
              <h2 id={`h-${title}`} className="mb-3 text-xl font-semibold">
                {title} <span className="text-muted">({list.length})</span>
              </h2>
              <ul className="flex flex-col gap-3">
                {list.map((item) => {
                  const Icon = item.kind === "medicine" ? Pill : Activity;
                  return (
                    <li
                      key={item.id}
                      className={`rounded-card bg-card p-5 shadow-card ${item.active ? "" : "opacity-80"}`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon aria-hidden="true" size={22} className="mt-1 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-semibold">
                            {item.name}
                            {item.dose ? (
                              <span className="font-medium text-muted"> {item.dose}</span>
                            ) : null}
                          </h3>
                          {item.composition ? (
                            <p className="text-sm text-muted">{item.composition}</p>
                          ) : null}
                          <p className="mt-1 text-base">
                            {item.times.map((t) => to12h(t).label).join(", ")}. {days(item)}.
                          </p>
                          {item.instructions ? (
                            <p className="text-sm text-muted">{item.instructions}</p>
                          ) : null}
                          {!item.active ? (
                            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-stage px-3 py-1 text-sm font-semibold ring-1 ring-inset ring-ink/20">
                              <Pause aria-hidden="true" size={14} /> Paused
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {canEdit ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={`/medicines/${item.id}`} className={buttonClass("secondary")}>
                            Edit<span className="sr-only"> {item.name}</span>
                          </Link>
                          <form action={toggleItemAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="active" value={String(!item.active)} />
                            <button type="submit" className={buttonClass("secondary")}>
                              {item.active ? (
                                <Pause aria-hidden="true" size={16} />
                              ) : (
                                <Play aria-hidden="true" size={16} />
                              )}
                              {item.active ? "Pause" : "Resume"}
                              <span className="sr-only"> {item.name}</span>
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

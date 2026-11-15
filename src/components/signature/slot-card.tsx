// Slot card: one time slot on Today. Due-now takes the lime fill; upcoming and missed are white;
// a fully settled slot collapses into a quiet row with a check and the time it was taken.
import { Check, Pill, Activity } from "lucide-react";
import type { ReactNode } from "react";
import type { ItemKind, SlotStatus } from "@/domain/types";
import { StatusLabel } from "./status-label";

export interface SlotCardItem {
  id: string;
  kind: ItemKind;
  name: string;
  detail: string;
  status: SlotStatus;
  note?: string;
}

type Props = {
  time: string;
  meridiem: string;
  status: SlotStatus;
  statusText: string;
  items: SlotCardItem[];
  settledText?: string;
  action?: ReactNode;
  itemAction?: (item: SlotCardItem) => ReactNode;
  headingLevel?: "h2" | "h3";
};

export function SlotCard({
  time,
  meridiem,
  status,
  statusText,
  items,
  settledText,
  action,
  itemAction,
  headingLevel: H = "h2",
}: Props) {
  const settled = status === "taken" || status === "skipped";
  const label = `${time} ${meridiem}`;

  if (settled) {
    return (
      <li className="flex items-center gap-4 rounded-card bg-card/70 px-5 py-4 ring-1 ring-inset ring-ink/10">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full bg-lime text-ink"
          aria-hidden="true"
        >
          <Check size={22} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <H className="text-lg font-semibold">
            <span className="numeral">{label}</span>
            <span className="sr-only">, </span>
            <span className="ml-2 text-base font-semibold text-muted">
              {settledText ?? statusText}
            </span>
          </H>
          <p className="truncate text-sm text-muted">{items.map((i) => i.name).join(", ")}</p>
        </div>
      </li>
    );
  }

  const due = status === "due";
  return (
    <li
      className={`relative overflow-hidden rounded-card p-5 shadow-card sm:p-6 ${due ? "bg-lime" : "bg-card"}`}
      aria-current={due ? "time" : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <H className="flex items-baseline gap-2">
          <span className="numeral text-4xl sm:text-5xl">{time}</span>
          <span className="text-xl font-semibold">{meridiem}</span>
        </H>
        <StatusLabel status={status} label={statusText} />
      </div>
      <ul className="mt-5 flex flex-col gap-3">
        {items.map((item) => {
          const Icon = item.kind === "medicine" ? Pill : Activity;
          const itemSettled = item.status === "taken" || item.status === "skipped";
          return (
            <li key={item.id} className="flex items-center gap-3">
              <Icon aria-hidden="true" size={22} className="shrink-0" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-lg font-semibold ${itemSettled ? "text-muted line-through decoration-2" : ""}`}
                >
                  {item.name}
                  {itemSettled ? <span className="sr-only"> ({item.status})</span> : null}
                </p>
                <p className={`text-sm ${due ? "text-ink/80" : "text-muted"}`}>{item.detail}</p>
                {item.note ? <p className="text-sm font-semibold">{item.note}</p> : null}
              </div>
              {itemAction && !itemSettled ? itemAction(item) : null}
            </li>
          );
        })}
      </ul>
      {action ? <div className="mt-6">{action}</div> : null}
    </li>
  );
}

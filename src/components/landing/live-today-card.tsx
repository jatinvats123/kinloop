"use client";
// A live, working Today card for the landing page: tap a slot and its petal fills.
import { Check } from "lucide-react";
import { useState } from "react";
import { DayBloom } from "@/components/signature/day-bloom";

const SLOTS = [
  { time: "8:00", meridiem: "AM", items: "Metformin 500 mg, Amlodipine 5 mg" },
  { time: "1:00", meridiem: "PM", items: "Check blood pressure" },
  { time: "8:00", meridiem: "PM", items: "Metformin 500 mg" },
  { time: "9:00", meridiem: "PM", items: "Atorvastatin 10 mg" },
];

export function LiveTodayCard() {
  const [done, setDone] = useState(1);
  const next = SLOTS[done];

  return (
    <div className="relative w-full max-w-md">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 opacity-90">
        <DayBloom total={SLOTS.length} done={done} size="xl" tone="dark" breathing />
      </div>
      <section
        aria-label="Try it: a sample Today card"
        className="relative rounded-[2rem] bg-stage p-5 text-ink shadow-2xl sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold">Good morning, Kamla ji</p>
          <DayBloom total={SLOTS.length} done={done} size="sm" />
        </div>
        <p className="mt-1 text-base text-muted" aria-live="polite">
          {done === SLOTS.length ? "All done for today" : `${done} of ${SLOTS.length} done today`}
        </p>
        <ol className="mt-4 flex flex-col gap-2">
          {SLOTS.map((s, i) =>
            i < done ? (
              <li
                key={s.time + s.meridiem}
                className="flex items-center gap-3 rounded-2xl bg-card/70 px-4 py-3 ring-1 ring-inset ring-ink/10"
              >
                <span
                  className="grid size-9 place-items-center rounded-full bg-lime"
                  aria-hidden="true"
                >
                  <Check size={18} strokeWidth={2.5} />
                </span>
                <span className="font-semibold">
                  {s.time} {s.meridiem}
                </span>
                <span className="text-sm text-muted">Taken</span>
              </li>
            ) : i === done ? (
              <li key={s.time + s.meridiem} className="rounded-2xl bg-lime p-4">
                <p className="flex items-baseline gap-1.5">
                  <span className="numeral text-4xl">{s.time}</span>
                  <span className="text-lg font-semibold">{s.meridiem}</span>
                </p>
                <p className="mt-1 text-base font-semibold">{s.items}</p>
              </li>
            ) : (
              <li
                key={s.time + s.meridiem}
                className="flex items-center justify-between rounded-2xl bg-card px-4 py-3"
              >
                <span className="font-semibold">
                  {s.time} {s.meridiem}
                </span>
                <span className="text-sm text-muted">Not yet</span>
              </li>
            ),
          )}
        </ol>
        {next ? (
          <button
            type="button"
            onClick={() => setDone((d) => Math.min(d + 1, SLOTS.length))}
            className="mt-4 min-h-14 w-full rounded-full bg-olive text-lg font-semibold text-card transition-transform duration-200 hover:bg-olive-hover active:scale-[0.98]"
          >
            I&apos;ve taken these
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setDone(0)}
            className="mt-4 min-h-14 w-full rounded-full bg-card text-lg font-semibold ring-1 ring-inset ring-ink/20"
          >
            Start the day again
          </button>
        )}
      </section>
    </div>
  );
}

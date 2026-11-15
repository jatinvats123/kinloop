// Week strip: seven day pills with a mini bloom each; today is the black pill.
import { DayBloom } from "./day-bloom";

export interface WeekDay {
  date: string;
  weekday: string;
  day: number;
  total: number;
  done: number;
  isToday: boolean;
}

export function WeekStrip({
  days,
  label = "Last seven days",
}: {
  days: WeekDay[];
  label?: string;
}) {
  return (
    <figure className="m-0">
      <figcaption className="sr-only">{label}</figcaption>
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((d) => (
          <li
            key={d.date}
            className={`flex flex-col items-center gap-1.5 rounded-full px-1 py-3 ${d.isToday ? "bg-ink text-card" : "bg-card text-ink ring-1 ring-inset ring-ink/10"}`}
          >
            <span className="text-xs font-semibold">{d.weekday}</span>
            <DayBloom total={d.total} done={d.done} size="sm" tone={d.isToday ? "dark" : "light"} />
            <span className="numeral text-lg">{d.day}</span>
            <span className="sr-only">
              {d.total === 0 ? "nothing scheduled" : `${d.done} of ${d.total} done`}
              {d.isToday ? ", today" : ""}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

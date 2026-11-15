// Demo-only panel: switch between Kamla, Priya and Ramesh, and see the demo sign-in details.
import { KeyRound, Repeat } from "lucide-react";
import type { Circle, Member } from "@/domain/types";

const roleLabel = { elder: "Elder", family: "Daughter", caretaker: "Caretaker" } as const;

export function DemoPanel({
  circle,
  members,
  current,
  switchAction,
}: {
  circle: Circle;
  members: Member[];
  current: Member;
  switchAction: (fd: FormData) => Promise<void>;
}) {
  const access = circle.demoAccess ?? {};
  return (
    <aside
      aria-label="Demo controls"
      className="on-dark rounded-[1.75rem] bg-canvas-raised p-4 text-stage sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Repeat aria-hidden="true" size={22} className="text-lime" />
          <p className="text-sm font-semibold">
            Demo circle. See it as:
            <span className="sr-only"> (currently {current.name})</span>
          </p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {members.map((m) => {
            const active = m.id === current.id;
            return (
              <li key={m.id}>
                <form action={switchAction}>
                  <input type="hidden" name="memberId" value={m.id} />
                  <button
                    type="submit"
                    aria-pressed={active}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${active ? "bg-lime text-ink" : "bg-canvas text-stage ring-1 ring-inset ring-stage/25 hover:ring-lime"}`}
                  >
                    {m.name}
                    <span className={active ? "text-ink/80" : "text-muted-dark"}>
                      {roleLabel[m.role]}
                      {m.role !== "elder" ? `, ${m.access}` : ""}
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
      <details className="group mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full text-sm font-semibold text-lime">
          <KeyRound aria-hidden="true" size={18} />
          Sign-in details for this demo
        </summary>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-dark">Circle code</dt>
          <dd className="font-semibold tracking-wider">{access.code}</dd>
          {members.map((m) => (
            <div key={m.id} className="contents">
              <dt className="text-muted-dark">{m.name}&apos;s passcode</dt>
              <dd className="font-semibold tracking-wider">{access[m.id]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-dark">
          Fictional people. This circle deletes itself after 24 hours.
        </p>
      </details>
    </aside>
  );
}

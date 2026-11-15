// Temporary design preview of primitives and signature components (deleted before the phase ends).
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ChoiceGroup, SelectField, TextField } from "@/components/ui/field";
import { DayBloom } from "@/components/signature/day-bloom";
import { DotRow, ThinCurve, TickBar, type Mark } from "@/components/signature/data-marks";
import { SlotCard } from "@/components/signature/slot-card";
import { AiLabel, Sparkle } from "@/components/signature/sparkle";
import { VerdictPanel } from "@/components/signature/verdict-panel";
import { WeekStrip } from "@/components/signature/week-strip";

const marks: Mark[] = [
  "taken",
  "taken",
  "taken",
  "missed",
  "taken",
  "taken",
  "skipped",
  "taken",
  "taken",
  "missed",
  "taken",
  "taken",
  "taken",
  "taken",
];

export default function Preview() {
  return (
    <div className="dot-grid min-h-dvh p-0 sm:p-6">
      <main
        id="main"
        className="relative mx-auto max-w-6xl overflow-hidden bg-stage sm:rounded-[2rem]"
      >
        <div className="glow -right-24 -top-24 size-96" />
        <div className="relative grid gap-8 p-4 sm:p-10 lg:grid-cols-[1fr_1.1fr]">
          <section aria-labelledby="today-h" className="flex flex-col gap-5">
            <p className="text-lg text-muted">Saturday, 14 November</p>
            <h1 id="today-h" className="text-3xl font-light tracking-tight sm:text-4xl">
              Good morning, <span className="font-semibold">Kamla ji</span>
            </h1>
            <div className="flex items-center gap-5">
              <DayBloom total={4} done={1} size="lg" breathing />
              <div>
                <p className="numeral text-5xl">
                  1<span className="ml-2 text-2xl text-muted">of 4</span>
                </p>
                <p className="text-lg font-semibold">taken today</p>
              </div>
            </div>
            <ol className="flex flex-col gap-3">
              <SlotCard
                time="8:00"
                meridiem="AM"
                status="taken"
                statusText="Taken"
                settledText="Taken 8:05 AM"
                items={[
                  {
                    id: "a",
                    kind: "medicine",
                    name: "Metformin 500 mg",
                    detail: "After breakfast",
                    status: "taken",
                  },
                ]}
              />
              <SlotCard
                time="1:00"
                meridiem="PM"
                status="due"
                statusText="Due now"
                items={[
                  {
                    id: "b",
                    kind: "medicine",
                    name: "Amlodipine 5 mg",
                    detail: "1 tablet, with water",
                    status: "due",
                  },
                  {
                    id: "c",
                    kind: "routine",
                    name: "Check blood pressure",
                    detail: "Note the reading",
                    status: "due",
                  },
                ]}
                itemAction={() => (
                  <button type="button" className={buttonClass("quiet")}>
                    Skip
                  </button>
                )}
                action={
                  <Button size="lg" className="w-full">
                    I&apos;ve taken these
                  </Button>
                }
              />
              <SlotCard
                time="8:00"
                meridiem="PM"
                status="upcoming"
                statusText="Not yet"
                items={[
                  {
                    id: "d",
                    kind: "medicine",
                    name: "Atorvastatin 10 mg",
                    detail: "After dinner",
                    status: "upcoming",
                  },
                ]}
                action={
                  <Button variant="secondary" size="lg" className="w-full">
                    I&apos;ve taken these
                  </Button>
                }
              />
            </ol>
          </section>

          <section aria-label="Components" className="flex flex-col gap-6">
            <Card>
              <CardHeader title="This week" />
              <WeekStrip
                days={[
                  { date: "1", weekday: "Su", day: 8, total: 5, done: 5, isToday: false },
                  { date: "2", weekday: "Mo", day: 9, total: 5, done: 4, isToday: false },
                  { date: "3", weekday: "Tu", day: 10, total: 5, done: 5, isToday: false },
                  { date: "4", weekday: "We", day: 11, total: 5, done: 3, isToday: false },
                  { date: "5", weekday: "Th", day: 12, total: 5, done: 4, isToday: false },
                  { date: "6", weekday: "Fr", day: 13, total: 5, done: 5, isToday: false },
                  { date: "7", weekday: "Sa", day: 14, total: 5, done: 1, isToday: true },
                ]}
              />
            </Card>
            <Card>
              <CardHeader title="Adherence" />
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="numeral text-5xl">
                    86<span className="text-2xl text-muted"> %</span>
                  </p>
                  <p className="text-sm font-semibold text-muted">last 7 days</p>
                </div>
                <ThinCurve
                  values={[90, 80, 100, 60, 80, 100, 86]}
                  label="Daily adherence: 90, 80, 100, 60, 80, 100, 86 percent"
                />
              </div>
              <div className="mt-5 flex flex-col gap-3">
                <TickBar marks={marks} label="12 of 14 doses taken" />
                <DotRow
                  marks={["taken", "missed", "taken", "missed", "missed", "taken", "taken"]}
                  label="Evening: 4 of 7"
                />
              </div>
            </Card>
            <VerdictPanel
              tone="match"
              sentence="Yes. This is your 1:00 PM Amlodipine 5 mg."
              action={<Button size="lg">Mark as taken</Button>}
            />
            <VerdictPanel
              tone="stop"
              sentence="Not on your list. Check with Priya or your doctor first."
            />
            <Card>
              <CardHeader title="Fields" action={<AiLabel />} />
              <form className="flex flex-col gap-5">
                <TextField
                  label="Medicine name"
                  name="name"
                  required
                  hint="As written on the strip"
                />
                <TextField
                  label="Strength"
                  name="dose"
                  error="Enter a strength like 500 mg"
                  defaultValue="five hundred"
                />
                <SelectField
                  label="Kind"
                  name="kind"
                  options={[
                    { value: "medicine", label: "Medicine" },
                    { value: "routine", label: "Routine" },
                  ]}
                />
                <ChoiceGroup
                  legend="Days"
                  name="days"
                  type="checkbox"
                  defaultValues={["1", "3"]}
                  options={["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d, i) => ({
                    value: String(i),
                    label: d,
                  }))}
                />
                <div className="flex flex-wrap gap-3">
                  <Button>Save</Button>
                  <Button variant="secondary">Cancel</Button>
                  <Button variant="attention">Remove</Button>
                  <Sparkle className="text-olive" />
                </div>
              </form>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}

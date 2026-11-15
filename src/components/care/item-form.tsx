"use client";
// One form for medicines and routines; medicine-only fields appear when the kind is "medicine".
import { Plus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/submit-button";
import { ChoiceGroup, TextArea, TextField } from "@/components/ui/field";
import type { Item } from "@/domain/types";
import type { ActionResult } from "@/server/errors";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ItemForm({
  action,
  item,
  today,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  item?: Item;
  today: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: true });
  const [kind, setKind] = useState<Item["kind"]>(item?.kind ?? "medicine");
  const [times, setTimes] = useState<string[]>(item?.times ?? ["08:00"]);
  const errors = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">What is it?</legend>
        <div className="flex flex-wrap gap-2">
          {(["medicine", "routine"] as const).map((k) => (
            <label
              key={k}
              className="inline-flex min-h-12 cursor-pointer items-center rounded-full bg-card px-5 text-base font-semibold ring-1 ring-inset ring-ink/25 has-[:checked]:bg-ink has-[:checked]:text-card has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-olive"
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              {k === "medicine" ? "Medicine" : "Routine (walk, BP check, exercise)"}
            </label>
          ))}
        </div>
      </fieldset>

      <TextField
        label={kind === "medicine" ? "Medicine name" : "Routine name"}
        name="name"
        defaultValue={item?.name}
        error={errors.name}
        required
        hint={kind === "medicine" ? "As written on the strip, e.g. Glycomet" : "e.g. Evening walk"}
      />
      {kind === "medicine" ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="Composition (generic name)"
            name="composition"
            defaultValue={item?.composition ?? ""}
            error={errors.composition}
            hint="Optional, e.g. Metformin hydrochloride"
          />
          <TextField
            label="Strength or dose"
            name="dose"
            defaultValue={item?.dose ?? ""}
            error={errors.dose}
            hint="e.g. 500 mg, 1 tablet"
          />
        </div>
      ) : null}
      <TextArea
        label="Instructions"
        name="instructions"
        defaultValue={item?.instructions}
        error={errors.instructions}
        hint={
          kind === "medicine"
            ? "e.g. After breakfast, with water"
            : "e.g. Note the reading when done"
        }
      />

      <fieldset
        className="flex flex-col gap-3"
        aria-describedby={errors.times ? "times-error" : undefined}
      >
        <legend className="text-sm font-semibold">Times of day</legend>
        <ul className="flex flex-col gap-2">
          {times.map((t, i) => (
            <li key={i} className="flex items-center gap-2">
              <label htmlFor={`time-${i}`} className="sr-only">
                Time {i + 1}
              </label>
              <input
                id={`time-${i}`}
                type="time"
                name="times"
                value={t}
                required
                onChange={(e) =>
                  setTimes((all) => all.map((x, j) => (j === i ? e.target.value : x)))
                }
                className="min-h-12 rounded-2xl bg-card px-4 text-lg ring-1 ring-inset ring-ink/25 focus-visible:ring-3 focus-visible:ring-olive focus-visible:outline-none"
              />
              {times.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setTimes((all) => all.filter((_, j) => j !== i))}
                  className="grid size-12 place-items-center rounded-full ring-1 ring-inset ring-ink/20 hover:ring-ink/50"
                  aria-label={`Remove time ${i + 1}`}
                >
                  <X aria-hidden="true" size={20} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {times.length < 6 ? (
          <button
            type="button"
            onClick={() => setTimes((all) => [...all, "20:00"])}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-inset ring-ink/25 hover:ring-ink/50"
          >
            <Plus aria-hidden="true" size={18} />
            Add another time
          </button>
        ) : null}
        {errors.times ? (
          <p id="times-error" className="text-sm font-semibold text-danger">
            {errors.times}
          </p>
        ) : null}
      </fieldset>

      <ChoiceGroup
        legend="Days"
        name="daysOfWeek"
        type="checkbox"
        options={DAYS.map((d, i) => ({ value: String(i), label: d }))}
        defaultValues={(item?.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]).map(String)}
        error={errors.daysOfWeek}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="Start date"
          name="startDate"
          type="date"
          defaultValue={item?.startDate ?? today}
          error={errors.startDate}
          required
        />
        <TextField
          label="End date"
          name="endDate"
          type="date"
          defaultValue={item?.endDate ?? ""}
          error={errors.endDate}
          hint="Leave empty if ongoing"
        />
      </div>

      <div className="flex flex-col gap-3">
        <SubmitButton size="lg" className="w-full sm:w-auto">
          {item ? "Save changes" : kind === "medicine" ? "Add medicine" : "Add routine"}
        </SubmitButton>
        <FormMessage state={state.ok ? undefined : state} />
      </div>
    </form>
  );
}

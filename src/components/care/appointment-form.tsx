"use client";
// Add or edit a doctor appointment (date and time in the circle's timezone).
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/submit-button";
import { TextArea, TextField } from "@/components/ui/field";
import type { ActionResult } from "@/server/errors";

export interface AppointmentDefaults {
  id?: string;
  doctor?: string;
  specialty?: string;
  location?: string;
  date: string;
  time: string;
  notes?: string;
}

export function AppointmentForm({
  action,
  defaults,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  defaults: AppointmentDefaults;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: true });
  const errors = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <TextField
        label="Doctor"
        name="doctor"
        defaultValue={defaults.doctor}
        error={errors.doctor}
        required
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="Specialty"
          name="specialty"
          defaultValue={defaults.specialty}
          error={errors.specialty}
          hint="Optional, e.g. Cardiology"
        />
        <TextField
          label="Place"
          name="location"
          defaultValue={defaults.location}
          error={errors.location}
          hint="Hospital or clinic"
        />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="Date"
          name="date"
          type="date"
          defaultValue={defaults.date}
          error={errors.date}
          required
        />
        <TextField
          label="Time"
          name="time"
          type="time"
          defaultValue={defaults.time}
          error={errors.time}
          required
        />
      </div>
      <TextArea
        label="Notes"
        name="notes"
        defaultValue={defaults.notes}
        error={errors.notes}
        hint="What to bring or ask"
      />
      <SubmitButton size="lg" className="w-full sm:w-auto">
        {defaults.id ? "Save changes" : "Add appointment"}
      </SubmitButton>
      <FormMessage state={state.ok ? undefined : state} />
    </form>
  );
}

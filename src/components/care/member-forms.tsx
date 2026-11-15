"use client";
// Member and profile forms: add a member (passcode shown once), edit a member, regenerate a
// passcode, and edit the health profile.
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/common/submit-button";
import { ChoiceGroup, SelectField, TextArea, TextField } from "@/components/ui/field";
import type { HealthProfile, Member } from "@/domain/types";
import type { ActionResult } from "@/server/errors";

type Action<T = undefined> = (prev: ActionResult<T>, fd: FormData) => Promise<ActionResult<T>>;
type Issued = { name: string; passcode: string };

function PasscodeReveal({ issued }: { issued: Issued }) {
  return (
    <div role="status" className="rounded-card bg-lime p-5">
      <p className="text-base font-semibold">
        {issued.name}&apos;s new passcode. Share it privately; it is shown only once.
      </p>
      <p className="numeral mt-2 text-4xl tracking-[0.3em]">{issued.passcode}</p>
    </div>
  );
}

function MemberFields({
  member,
  errors,
  managing,
}: {
  member?: Member;
  errors: Record<string, string>;
  managing: boolean;
}) {
  return (
    <>
      <TextField
        label="Name"
        name="name"
        defaultValue={member?.name}
        error={errors.name}
        required
      />
      {!member ? (
        <SelectField
          label="Role"
          name="role"
          options={[
            { value: "family", label: "Family" },
            { value: "caretaker", label: "Caretaker" },
          ]}
          error={errors.role}
        />
      ) : null}
      <TextField
        label="Email for reminders"
        name="email"
        type="email"
        autoComplete="off"
        defaultValue={member?.email ?? ""}
        error={errors.email}
        hint="Optional. Only used for Kinloop alerts."
      />
      {managing ? (
        <>
          <ChoiceGroup
            legend="Access"
            name="access"
            type="radio"
            options={[
              { value: "view", label: "View only" },
              { value: "edit", label: "Can edit" },
            ]}
            defaultValues={[member?.access ?? "view"]}
            error={errors.access}
          />
          <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
            <input
              type="checkbox"
              name="isOrganiser"
              defaultChecked={member?.isOrganiser}
              className="size-6 accent-[#243100]"
            />
            Organiser (can add and remove members)
          </label>
        </>
      ) : (
        <>
          <input type="hidden" name="access" value={member?.access ?? "view"} />
        </>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Email alerts</legend>
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            name="alertMissed"
            defaultChecked={member?.alerts.missed ?? true}
            className="size-6 accent-[#243100]"
          />
          Missed doses (after the elder has been reminded)
        </label>
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            name="alertAppointments"
            defaultChecked={member?.alerts.appointments ?? true}
            className="size-6 accent-[#243100]"
          />
          Upcoming visits
        </label>
      </fieldset>
    </>
  );
}

export function AddMemberForm({ action }: { action: Action<Issued> }) {
  const [state, formAction] = useActionState<ActionResult<Issued>, FormData>(action, { ok: true });
  const errors = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <div className="flex flex-col gap-6">
      {state.ok && state.data ? <PasscodeReveal issued={state.data} /> : null}
      <form action={formAction} className="flex flex-col gap-5" noValidate>
        <MemberFields errors={errors} managing />
        <SubmitButton size="lg" className="w-full sm:w-auto">
          Add to circle
        </SubmitButton>
        <FormMessage state={state.ok ? undefined : state} />
      </form>
    </div>
  );
}

export function EditMemberForm({
  action,
  member,
  managing,
}: {
  action: Action;
  member: Member;
  managing: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: true });
  const errors = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="id" value={member.id} />
      {member.role === "elder" ? (
        <>
          <TextField
            label="Email for reminders"
            name="email"
            type="email"
            defaultValue={member.email ?? ""}
            error={errors.email}
            hint="Your own reminders and confirm links go here."
          />
          <label className="flex min-h-11 items-center gap-3 text-base">
            <input
              type="checkbox"
              name="alertMissed"
              defaultChecked={member.alerts.missed}
              className="size-6 accent-[#243100]"
            />
            Remind me about doses
          </label>
          <label className="flex min-h-11 items-center gap-3 text-base">
            <input
              type="checkbox"
              name="alertAppointments"
              defaultChecked={member.alerts.appointments}
              className="size-6 accent-[#243100]"
            />
            Remind me about visits
          </label>
        </>
      ) : (
        <MemberFields member={member} errors={errors} managing={managing} />
      )}
      <SubmitButton size="lg" className="w-full sm:w-auto">
        Save
      </SubmitButton>
      <FormMessage state={state.ok ? undefined : state} />
    </form>
  );
}

export function RegeneratePasscodeForm({
  action,
  memberId,
  label,
}: {
  action: Action<Issued>;
  memberId: string;
  label: string;
}) {
  const [state, formAction] = useActionState<ActionResult<Issued>, FormData>(action, { ok: true });
  return (
    <div className="flex flex-col gap-3">
      <form action={formAction}>
        <input type="hidden" name="id" value={memberId} />
        <SubmitButton variant="secondary" pendingText="Issuing…">
          {label}
        </SubmitButton>
      </form>
      {state.ok && state.data ? <PasscodeReveal issued={state.data} /> : null}
      <FormMessage state={state.ok ? undefined : state} />
    </div>
  );
}

export function ProfileForm({ action, profile }: { action: Action; profile: HealthProfile }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: true });
  const errors = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <TextArea
        label="Conditions"
        name="conditions"
        defaultValue={profile.conditions.join("\n")}
        error={errors.conditions}
        hint="One per line"
      />
      <TextArea
        label="Allergies"
        name="allergies"
        defaultValue={profile.allergies.join("\n")}
        error={errors.allergies}
        hint="One per line"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Blood group"
          name="bloodGroup"
          defaultValue={profile.bloodGroup}
          error={errors.bloodGroup}
          options={["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => ({
            value: v,
            label: v || "Not known",
          }))}
        />
        <TextField
          label="Primary doctor"
          name="primaryDoctor"
          defaultValue={profile.primaryDoctor}
          error={errors.primaryDoctor}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Emergency contact"
          name="emergencyName"
          defaultValue={profile.emergencyContact.name}
          error={errors.emergencyName}
        />
        <TextField
          label="Emergency phone"
          name="emergencyPhone"
          type="tel"
          defaultValue={profile.emergencyContact.phone}
          error={errors.emergencyPhone}
        />
      </div>
      <SubmitButton size="lg" className="w-full sm:w-auto">
        Save profile
      </SubmitButton>
      <FormMessage state={state.ok ? undefined : state} />
    </form>
  );
}

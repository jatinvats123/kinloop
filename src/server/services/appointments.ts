// Doctor appointments: add, edit and delete. Times are entered in the circle's timezone.
import { clockLabel, longDate, zonedToUtc } from "@/domain/time";
import type { Appointment } from "@/domain/types";
import { AppError } from "@/server/errors";
import { newId } from "@/server/auth/passcode";
import { appointmentSchema } from "@/server/validation";
import { parseInput, recordActivity, requirePermission, type Ctx } from "./context";

function fromInput(ctx: Ctx, input: unknown): Omit<Appointment, "id"> {
  const d = parseInput(appointmentSchema, input);
  return {
    doctor: d.doctor,
    specialty: d.specialty,
    location: d.location,
    at: zonedToUtc(d.date, d.time, ctx.circle.timezone).toISOString(),
    notes: d.notes,
  };
}

function when(ctx: Ctx, at: string): string {
  return `${longDate(at, ctx.circle.timezone)}, ${clockLabel(at, ctx.circle.timezone)}`;
}

/** Adds an appointment. */
export async function createAppointment(ctx: Ctx, input: unknown): Promise<Appointment> {
  requirePermission(ctx, "edit-appointments");
  const appt: Appointment = { id: newId(), ...fromInput(ctx, input) };
  await ctx.repo.putAppointment(ctx.circle.code, appt);
  await recordActivity(
    ctx,
    "appointment.added",
    `Added an appointment with ${appt.doctor} on ${when(ctx, appt.at)}`,
  );
  return appt;
}

/** Edits an appointment. */
export async function updateAppointment(
  ctx: Ctx,
  id: string,
  input: unknown,
): Promise<Appointment> {
  requirePermission(ctx, "edit-appointments");
  if (!(await ctx.repo.getAppointment(ctx.circle.code, id)))
    throw new AppError("not-found", "That appointment no longer exists.");
  const appt: Appointment = { id, ...fromInput(ctx, input) };
  await ctx.repo.putAppointment(ctx.circle.code, appt);
  await recordActivity(
    ctx,
    "appointment.updated",
    `Changed the appointment with ${appt.doctor} to ${when(ctx, appt.at)}`,
  );
  return appt;
}

/** Deletes an appointment. */
export async function deleteAppointment(ctx: Ctx, id: string): Promise<void> {
  requirePermission(ctx, "edit-appointments");
  const appt = await ctx.repo.getAppointment(ctx.circle.code, id);
  if (!appt) throw new AppError("not-found", "That appointment no longer exists.");
  await ctx.repo.deleteAppointment(ctx.circle.code, id);
  await recordActivity(ctx, "appointment.removed", `Removed the appointment with ${appt.doctor}`);
}

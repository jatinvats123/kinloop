// Zod schemas for every form and request body, with hard length and count limits.
import { z } from "zod";
import { SKIP_REASONS } from "@/domain/types";
import { isValidTimeZone } from "@/domain/time";
import { limits } from "@/domain/config";

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);
const required = (max: number, label: string) => text(max).min(1, `Enter ${label}`);
const optional = (max: number) =>
  text(max)
    .optional()
    .transform((v) => (v ? v : null));
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 08:00");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
const listOf = (max: number, itemMax: number) =>
  z
    .string()
    .max(max * (itemMax + 2))
    .transform((v) =>
      v
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(itemMax)).max(max, `List at most ${max}`));
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

export const roleSchema = z.enum(["elder", "family", "caretaker"]);

export const createCircleSchema = z.object({
  elderName: required(60, "the elder's name"),
  creatorRole: roleSchema,
  creatorName: optional(60),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid timezone").default("Asia/Kolkata"),
});

export const signInSchema = z.object({
  code: z.string().trim().min(1, "Enter the circle code").max(20),
  passcode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter your 6-digit passcode"),
});

export const memberSchema = z.object({
  name: required(60, "a name"),
  role: z.enum(["family", "caretaker"]),
  email: z
    .union([z.literal(""), z.email("Enter a valid email address").max(120)])
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null)),
  access: z.enum(["view", "edit"]),
  isOrganiser: checkbox,
  alertMissed: checkbox,
  alertAppointments: checkbox,
});

export const memberUpdateSchema = memberSchema.omit({ name: true, role: true }).extend({
  name: required(60, "a name"),
});

export const elderUpdateSchema = z.object({
  email: memberSchema.shape.email,
  alertMissed: checkbox,
  alertAppointments: checkbox,
});

export const profileSchema = z.object({
  conditions: listOf(15, 80),
  allergies: listOf(15, 80),
  bloodGroup: z.enum(["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
  primaryDoctor: text(80),
  emergencyName: text(60),
  emergencyPhone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+\d\s()-]*$/, "Use digits, spaces and + only"),
});

export const itemSchema = z
  .object({
    kind: z.enum(["medicine", "routine"]),
    name: required(80, "a name"),
    composition: optional(120),
    dose: optional(40),
    instructions: text(200),
    times: z
      .array(hhmm)
      .min(1, "Add at least one time")
      .max(limits.maxTimesPerItem, `At most ${limits.maxTimesPerItem} times a day`),
    daysOfWeek: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, "Choose at least one day")
      .max(7),
    startDate: isoDate,
    endDate: z
      .union([z.literal(""), isoDate])
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "End date must be on or after the start date",
  });

export const appointmentSchema = z.object({
  doctor: required(80, "the doctor's name"),
  specialty: text(60),
  location: text(120),
  date: isoDate,
  time: hhmm,
  notes: text(500),
});

export const slotAtSchema = z.iso.datetime({ message: "Invalid slot" });

export const takeSchema = z.object({
  slotAt: slotAtSchema,
  itemIds: z.array(z.string().min(1).max(40)).min(1).max(12),
});

export const skipSchema = z.object({
  slotAt: slotAtSchema,
  itemId: z.string().min(1).max(40),
  reason: z.enum(SKIP_REASONS),
  note: optional(200),
});

/** Turns a FormData into a plain object; keys listed in `arrays` collect every value. */
export function formToObject(
  fd: FormData,
  arrays: readonly string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = arrays.includes(key) ? values.filter((v) => v !== "") : (values[0] ?? "");
  }
  for (const key of arrays) out[key] ??= [];
  return out;
}

/** Flattens Zod issues into one message per field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

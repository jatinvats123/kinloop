// Right-medicine check: compares what the AI read on a strip or box with the schedule. The verdict is
// computed here, by tested code, never by the model. Wording is "matches your schedule", never "safe".
import { LABEL_DUE_WINDOW, MINUTE_MS } from "./config";
import { slotsForRange } from "./schedule";
import { addDays, todayIn } from "./time";
import type { DoseLog, Item } from "./types";

export interface LabelIngredient {
  ingredient: string;
  strength: string | null;
}

/** What the model may return about a label: only these fields. */
export interface LabelReading {
  readable: boolean;
  brand: string | null;
  composition: LabelIngredient[];
  confidence: number;
}

export type LabelVerdict =
  "due-now" | "not-now" | "already-taken" | "strength-mismatch" | "not-on-list" | "unreadable";

export interface LabelMatch {
  verdict: LabelVerdict;
  item: Item | null;
  /** The slot the verdict refers to: due now, already taken, or the next one. */
  slotAt: string | null;
  /** When the slot was logged as taken (already-taken only). */
  takenAt: string | null;
  labelStrength: string | null;
  listStrength: string | null;
}

/** Below this the reading is treated as unreadable. */
export const MIN_CONFIDENCE = 0.4;

const SALTS = new Set([
  "hydrochloride",
  "hcl",
  "dihydrochloride",
  "sodium",
  "potassium",
  "calcium",
  "besylate",
  "besilate",
  "maleate",
  "mesylate",
  "mesilate",
  "succinate",
  "tartrate",
  "citrate",
  "sulphate",
  "sulfate",
  "phosphate",
  "acetate",
  "bromide",
  "fumarate",
  "monohydrate",
  "trihydrate",
  "hydrate",
  "magnesium",
]);

const FILLER = new Set([
  "tablet",
  "tablets",
  "tab",
  "tabs",
  "capsule",
  "capsules",
  "cap",
  "caps",
  "ip",
  "bp",
  "usp",
  "sr",
  "er",
  "xr",
  "xl",
  "cr",
  "mr",
  "od",
  "film",
  "coated",
  "extended",
  "prolonged",
  "sustained",
  "release",
  "uncoated",
  "oral",
  "mg",
  "mcg",
  "g",
  "iu",
  "ml",
]);

/**
 * Normalises a medicine name for comparison: lower case, no punctuation or numbers, without salt
 * forms ("hydrochloride") or filler ("tablets", "IP"). "Metformin Hydrochloride Tablets IP 500 mg"
 * becomes "metformin".
 */
export function normaliseName(name: string): string {
  // "Amlodipine Besylate IP eq. to Amlodipine" names the active moiety after "eq. to".
  const active = name.split(/\b(?:eq|equiv|equivalent)\.?\s+to\b/i).pop() ?? name;
  return active
    .toLowerCase()
    .replaceAll(".", "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !SALTS.has(w) && !FILLER.has(w))
    .join(" ");
}

/** Splits a composition such as "Glimepiride + Metformin" into normalised ingredient names. */
export function ingredientsOf(composition: string | null): string[] {
  if (!composition) return [];
  return composition
    .split(/\+|\/|,|&|\band\b/i)
    .map(normaliseName)
    .filter(Boolean);
}

interface Strength {
  value: number;
  unit: "mg" | "iu" | "ml";
}

const UNIT: Record<string, { unit: Strength["unit"]; factor: number }> = {
  mg: { unit: "mg", factor: 1 },
  g: { unit: "mg", factor: 1000 },
  gm: { unit: "mg", factor: 1000 },
  mcg: { unit: "mg", factor: 0.001 },
  µg: { unit: "mg", factor: 0.001 },
  ug: { unit: "mg", factor: 0.001 },
  iu: { unit: "iu", factor: 1 },
  ml: { unit: "ml", factor: 1 },
};

/** Parses every strength in a string ("500 mg", "0.5g", "50 mcg + 5 mg") into comparable values. */
export function parseStrengths(text: string | null): Strength[] {
  if (!text) return [];
  const out: Strength[] = [];
  for (const m of text.toLowerCase().matchAll(/(\d+(?:[.,]\d+)?)\s*(mg|gm|g|mcg|µg|ug|iu|ml)\b/g)) {
    const u = UNIT[m[2] ?? ""];
    if (!u) continue;
    const value = Math.round(Number((m[1] ?? "").replace(",", ".")) * u.factor * 1000) / 1000;
    out.push({ value, unit: u.unit });
  }
  return out;
}

const sameStrength = (a: Strength, b: Strength) => a.unit === b.unit && a.value === b.value;
const within = (xs: Strength[], ys: Strength[]) =>
  xs.every((x) => ys.some((y) => sameStrength(x, y)));

/** True when both sides state strengths and neither set is contained in the other. */
function strengthsDiffer(label: Strength[], list: Strength[]): boolean {
  if (label.length === 0 || list.length === 0) return false;
  return !within(label, list) && !within(list, label);
}

/** How well a label matches an item: 0 none, higher is better. Brand or composition vs name or composition. */
function score(label: LabelReading, item: Item): number {
  const labelNames = [
    ...(label.brand ? [normaliseName(label.brand)] : []),
    ...label.composition.map((c) => normaliseName(c.ingredient)),
  ].filter(Boolean);
  const itemIngredients = ingredientsOf(item.composition);
  const itemNames = [normaliseName(item.name), ...itemIngredients].filter(Boolean);
  if (!labelNames.some((n) => itemNames.includes(n))) return 0;
  const labelIngredients = new Set(label.composition.map((c) => normaliseName(c.ingredient)));
  const brandHit = label.brand !== null && normaliseName(label.brand) === normaliseName(item.name);
  const sameSet =
    itemIngredients.length > 0 &&
    itemIngredients.length === labelIngredients.size &&
    itemIngredients.every((i) => labelIngredients.has(i));
  return 1 + (brandHit ? 2 : 0) + (sameSet ? 2 : 0);
}

function labelStrengthText(label: LabelReading): string | null {
  const parts = label.composition.map((c) => c.strength).filter((s): s is string => Boolean(s));
  return parts.length ? parts.join(" + ") : null;
}

const none = (verdict: LabelVerdict, label: LabelReading): LabelMatch => ({
  verdict,
  item: null,
  slotAt: null,
  takenAt: null,
  labelStrength: labelStrengthText(label),
  listStrength: null,
});

/**
 * Decides whether a photographed label matches the schedule right now.
 * - unreadable: the model could not read it, read no names, or is not confident;
 * - not-on-list: no active item matches by brand or composition (salt forms and filler ignored);
 * - strength-mismatch: both strengths are known and differ;
 * - due-now: a slot of the matched item lies within −60/+120 minutes of now and has no log;
 * - already-taken: the most recent slot is already logged as taken (prevents a double dose);
 * - not-now: otherwise, with the next slot.
 */
export function matchLabel(
  label: LabelReading,
  items: readonly Item[],
  logs: readonly DoseLog[],
  now: Date,
  zone: string,
): LabelMatch {
  const readable =
    label.readable &&
    label.confidence >= MIN_CONFIDENCE &&
    (Boolean(label.brand?.trim()) || label.composition.some((c) => c.ingredient.trim()));
  if (!readable) return none("unreadable", label);

  const ranked = items
    .filter((i) => i.active && i.kind === "medicine")
    .map((item) => ({ item, s: score(label, item) }))
    .filter((r) => r.s > 0);

  const today = todayIn(zone, now);
  const t = now.getTime();
  const windowFrom = t - LABEL_DUE_WINDOW.afterMin * MINUTE_MS;
  const windowTo = t + LABEL_DUE_WINDOW.beforeMin * MINUTE_MS;
  const taken = new Map(
    logs.filter((l) => l.status === "taken").map((l) => [`${l.itemId}_${l.scheduledAt}`, l]),
  );
  const logged = new Set(logs.map((l) => `${l.itemId}_${l.scheduledAt}`));
  const slotsOf = (item: Item) =>
    slotsForRange([item], addDays(today, -1), addDays(today, 7), zone);
  const dueSlot = (item: Item) =>
    slotsOf(item).find((s) => {
      const at = Date.parse(s.at);
      return at >= windowFrom && at <= windowTo && !logged.has(`${item.id}_${s.at}`);
    });

  // Best score first; among equals, prefer an item that is due now.
  ranked.sort(
    (a, b) => b.s - a.s || Number(Boolean(dueSlot(b.item))) - Number(Boolean(dueSlot(a.item))),
  );
  const top = ranked[0];
  if (!top) return none("not-on-list", label);
  const item = top.item;
  const labelStrength = labelStrengthText(label);
  const base = { item, labelStrength, listStrength: item.dose };

  const labelValues = label.composition.flatMap((c) => parseStrengths(c.strength));
  if (strengthsDiffer(labelValues, parseStrengths(item.dose))) {
    return { verdict: "strength-mismatch", slotAt: null, takenAt: null, ...base };
  }

  const due = dueSlot(item);
  if (due) return { verdict: "due-now", slotAt: due.at, takenAt: null, ...base };

  const slots = slotsOf(item);
  const latestPast = [...slots]
    .reverse()
    .find((s) => s.date === today && Date.parse(s.at) <= windowTo);
  const latestLog = latestPast ? taken.get(`${item.id}_${latestPast.at}`) : undefined;
  if (latestPast && latestLog) {
    return {
      verdict: "already-taken",
      slotAt: latestPast.at,
      takenAt: latestLog.loggedAt,
      ...base,
    };
  }
  const next = slots.find((s) => Date.parse(s.at) > windowTo);
  return { verdict: "not-now", slotAt: next?.at ?? null, takenAt: null, ...base };
}

// Circle codes (8 unambiguous characters, shown XXXX-XXXX) and 6-digit passcodes.
// Randomness is injected so the server can pass a cryptographic source and tests a fixed one.

/** No 0/O, 1/I/L, or 5/S, 2/Z, 8/B pairs that are easy to misread aloud or on a screen. */
export const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
export const CODE_LENGTH = 8;

/** Returns an integer in [0, max) from a randomness source. */
export type RandomInt = (max: number) => number;

/** Generates a raw 8-character circle code. */
export function generateCircleCode(randomInt: RandomInt): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** Generates a 6-digit passcode (leading zeros allowed). */
export function generatePasscode(randomInt: RandomInt): string {
  let out = "";
  for (let i = 0; i < 6; i += 1) out += String(randomInt(10));
  return out;
}

/** Displays a raw code as XXXX-XXXX. */
export function formatCircleCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Normalises user input to a raw code: uppercase, separators and spaces removed. Returns null when
 * the result is not a well-formed code.
 */
export function parseCircleCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, "");
  if (raw.length !== CODE_LENGTH) return null;
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null;
  return raw;
}

/** True for exactly six digits. */
export function isPasscode(input: string): boolean {
  return /^\d{6}$/.test(input);
}

// Passcode hashing with scrypt and a per-member salt; verification in constant time.
import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { generateCircleCode, generatePasscode } from "@/domain/codes";

const KEY_LENGTH = 32;

function derive(passcode: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(passcode, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** Hashes a passcode with a fresh random salt. */
export async function hashPasscode(passcode: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  return { hash: (await derive(passcode, salt)).toString("hex"), salt };
}

/** True when `passcode` matches the stored hash; compares in constant time. */
export async function verifyPasscode(
  passcode: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  if (!hash || !salt) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await derive(passcode, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** New random 6-digit passcode from a cryptographic source. */
export function newPasscode(): string {
  return generatePasscode(randomInt);
}

/** New random 8-character circle code from a cryptographic source. */
export function newCircleCode(): string {
  return generateCircleCode(randomInt);
}

/** New random record ID. */
export function newId(): string {
  return randomBytes(9).toString("base64url");
}

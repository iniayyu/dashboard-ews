import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PREFIX = "scrypt$";

export const isHashed = (v: string) => v.startsWith(PREFIX);

/** Format: scrypt$<salt hex>$<hash hex> */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  return `${PREFIX}${salt.toString("hex")}$${scryptSync(plain, salt, 32).toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!isHashed(stored)) return false;
  const [, saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(plain, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Hash jika masih teks biasa (migrasi data lama). */
export const ensureHashed = (v: string) => (isHashed(v) ? v : hashPassword(v));

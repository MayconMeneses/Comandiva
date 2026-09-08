import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

/**
 * Hash de senha do Super Admin — scrypt, mesmo formato usado em
 * server/db/users.ts::hashStaffPassword no app principal (senha escolhida por
 * humano, precisa de hash lento). Diferente do sha256 em _core/apiKey.ts, que
 * é pra token gerado de alta entropia — threat model diferente.
 */
export async function hashPlatformPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPlatformPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const actualHash = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actualHash.length && timingSafeEqual(expected, actualHash);
}

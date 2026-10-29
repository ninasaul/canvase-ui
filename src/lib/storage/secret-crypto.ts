import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getEncryptionKey(): Buffer {
  const raw =
    process.env.STORAGE_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "";
  if (!raw) {
    throw new Error("STORAGE_SECRET or BETTER_AUTH_SECRET is required");
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): { cipher: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    cipher: Buffer.concat([encrypted, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(cipher: string, iv: string): string {
  const payload = Buffer.from(cipher, "base64");
  if (payload.length < 17) {
    return "";
  }
  const encrypted = payload.subarray(0, payload.length - 16);
  const tag = payload.subarray(payload.length - 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

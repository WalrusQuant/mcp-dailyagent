import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for encrypting secrets. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt plaintext → "iv:authTag:ciphertext" (all base64) */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/** Decrypt "iv:authTag:ciphertext" → plaintext */
export function decrypt(encoded: string): string {
  const key = getKey();
  const parts = encoded.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = Buffer.from(parts[2], "base64");

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/** Mask a secret value → "••••xxxx" (last 4 chars visible) */
export function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return "••••" + value.slice(-4);
}

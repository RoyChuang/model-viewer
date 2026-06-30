import { createCipheriv, randomBytes } from "crypto";

export function encryptModelBuffer(plaintext: Buffer, keyHex: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error("Invalid MODEL_ENCRYPTION_KEY");
  }

  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, tag]);
}

export function isGlbBuffer(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.subarray(0, 4).toString("utf8") === "glTF";
}

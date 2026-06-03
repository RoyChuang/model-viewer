import { readFile } from "fs/promises";
import { createDecipheriv } from "crypto";

const TTL = 60_000; // 60 s — long enough for all chunks to be fetched

interface Entry {
  // Store a Promise so concurrent requests for the same model share one decrypt
  promise: Promise<Buffer>;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

export async function getOrDecrypt(
  modelId: string,
  filePath: string,
  keyHex: string
): Promise<Buffer> {
  const now = Date.now();
  const entry = cache.get(modelId);

  if (entry && entry.expiresAt > now) {
    return entry.promise;
  }

  const promise = decrypt(filePath, keyHex);

  cache.set(modelId, { promise, expiresAt: now + TTL });

  setTimeout(() => {
    const current = cache.get(modelId);
    if (current && current.expiresAt <= Date.now()) {
      cache.delete(modelId);
    }
  }, TTL + 1000);

  return promise;
}

async function decrypt(filePath: string, keyHex: string): Promise<Buffer> {
  const encrypted = await readFile(filePath);
  const key = Buffer.from(keyHex, "hex");
  const iv = encrypted.subarray(0, 12);
  const tag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(12, encrypted.length - 16);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

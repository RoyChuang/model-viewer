import { createHmac, timingSafeEqual } from "crypto";

const TTL = 5 * 60; // 5 minutes

// Token format: "<modelId>.<expiresAt>.<hmac32>"
export function createModelToken(modelId: string): string {
  const secret = process.env.MODEL_TOKEN_SECRET!;
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const payload = `${modelId}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
  return `${payload}.${sig}`;
}

export function verifyModelToken(token: string, modelId: string): boolean {
  const secret = process.env.MODEL_TOKEN_SECRET;
  if (!secret) return false;

  const lastDot = token.lastIndexOf(".");
  const secondLastDot = token.lastIndexOf(".", lastDot - 1);
  if (lastDot === -1 || secondLastDot === -1) return false;

  const id = token.slice(0, secondLastDot);
  const expStr = token.slice(secondLastDot + 1, lastDot);
  const sig = token.slice(lastDot + 1);

  if (id !== modelId) return false;

  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const payload = `${id}.${expStr}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);

  // Constant-time compare prevents timing attacks
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

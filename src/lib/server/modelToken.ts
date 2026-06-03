import { createHmac, timingSafeEqual } from "crypto";

const TTL = 5 * 60; // 5 minutes

// Token format: "<modelId>.<expiresAt>.<hmac32>"
export function createModelToken(modelId: string): { token: string; expiresAt: number } {
  const secret = process.env.MODEL_TOKEN_SECRET!;
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const payload = `${modelId}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
  return { token: `${payload}.${sig}`, expiresAt: exp };
}

export function verifyModelToken(
  token: string,
  modelId: string
): { valid: boolean; expiresAt?: number } {
  const secret = process.env.MODEL_TOKEN_SECRET;
  if (!secret) return { valid: false };

  const lastDot = token.lastIndexOf(".");
  const secondLastDot = token.lastIndexOf(".", lastDot - 1);
  if (lastDot === -1 || secondLastDot === -1) return { valid: false };

  const id = token.slice(0, secondLastDot);
  const expStr = token.slice(secondLastDot + 1, lastDot);
  const sig = token.slice(lastDot + 1);

  if (id !== modelId) return { valid: false };

  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return { valid: false };

  const payload = `${id}.${expStr}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);

  try {
    const match = timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
    return match ? { valid: true, expiresAt: exp } : { valid: false };
  } catch {
    return { valid: false };
  }
}

// Deterministic per-token session key — re-derivable at chunk time without state.
// Never transmitted; client receives it only after unwrapping via ECDH.
export function deriveSessionKey(modelId: string, expiresAt: number): Buffer {
  const secret = process.env.MODEL_TOKEN_SECRET!;
  return createHmac("sha256", secret)
    .update(`${modelId}.${expiresAt}:session-key`)
    .digest();
}

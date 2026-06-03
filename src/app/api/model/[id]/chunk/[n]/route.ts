import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { resolve } from "path";
import { createCipheriv, randomBytes } from "crypto";
import { verifyModelToken, deriveSessionKey } from "@/lib/server/modelToken";
import { getOrDecrypt } from "@/lib/server/plaintextCache";
import { CHUNK_SIZE } from "../../route";

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; n: string }> }
) {
  const { id, n: nStr } = await params;

  if (!SAFE_ID.test(id)) {
    return new NextResponse("Invalid model id", { status: 400 });
  }

  const chunkIndex = parseInt(nStr, 10);
  if (isNaN(chunkIndex) || chunkIndex < 0) {
    return new NextResponse("Invalid chunk index", { status: 400 });
  }

  const token = req.nextUrl.searchParams.get("token");
  const { valid, expiresAt } = verifyModelToken(token ?? "", id);
  if (!token || !valid || expiresAt === undefined) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const keyHex = process.env.MODEL_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    return new NextResponse("Not configured", { status: 503 });
  }

  const filePath = resolve(process.cwd(), "public/models", `${id}.glbenc`);
  if (!existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // ── Plaintext from cache (decrypts once per model per 60 s) ──────────────
  let plaintext: Buffer;
  try {
    plaintext = await getOrDecrypt(id, filePath, keyHex);
  } catch {
    return new NextResponse("Decryption failed", { status: 500 });
  }

  const start = chunkIndex * CHUNK_SIZE;
  if (start >= plaintext.length) {
    return new NextResponse("Chunk out of range", { status: 416 });
  }

  // ── Slice plaintext chunk ─────────────────────────────────────────────────
  const end = Math.min(start + CHUNK_SIZE, plaintext.length);
  const chunk = new Uint8Array(plaintext.buffer, plaintext.byteOffset + start, end - start);

  // ── Encrypt chunk with per-token session key (AES-256-GCM) ───────────────
  // sessionKey is derived deterministically from token payload — never transmitted.
  const sessionKey = deriveSessionKey(id, expiresAt);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey, iv);
  const encryptedChunk = Buffer.concat([cipher.update(chunk), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Wire format: IV(12) + ciphertext + authTag(16)
  const response = Buffer.concat([iv, encryptedChunk, authTag]);

  return new NextResponse(response.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

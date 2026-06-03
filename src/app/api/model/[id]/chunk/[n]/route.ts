import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { resolve } from "path";
import { createDecipheriv } from "crypto";
import { verifyModelToken } from "@/lib/server/modelToken";
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
  if (!token || !verifyModelToken(token, id)) {
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

  const encrypted = await readFile(filePath);
  const key = Buffer.from(keyHex, "hex");

  // Decrypt full model (IV: first 12B, tag: last 16B)
  const iv = encrypted.subarray(0, 12);
  const tag = encrypted.subarray(encrypted.length - 16);
  const ciphertext = encrypted.subarray(12, encrypted.length - 16);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return new NextResponse("Decryption failed", { status: 500 });
  }

  const start = chunkIndex * CHUNK_SIZE;
  if (start >= plaintext.length) {
    return new NextResponse("Chunk out of range", { status: 416 });
  }

  // subarray() is a view into the full plaintext buffer — .buffer would return all bytes.
  // Copy into a fresh Uint8Array so the response contains only this chunk.
  const slice = plaintext.subarray(start, Math.min(start + CHUNK_SIZE, plaintext.length));
  const chunk = new Uint8Array(slice.length);
  chunk.set(slice);

  return new NextResponse(chunk.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      // Let the client know which chunk and total size for reassembly
      "X-Chunk-Index": String(chunkIndex),
      "X-Chunk-Size": String(slice.length),
      "X-Total-Size": String(plaintext.length),
    },
  });
}

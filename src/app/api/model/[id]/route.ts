import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { existsSync } from "fs";
import { createDecipheriv } from "crypto";

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const IV_LEN = 16; // Node crypto GCM IV

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!SAFE_ID.test(id)) {
    return new NextResponse("Invalid model id", { status: 400 });
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

  // Format: [IV 12 bytes][ciphertext][auth tag 16 bytes]
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

  return new NextResponse(plaintext.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "model/gltf-binary",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      // Inline = browser can't trigger Save As dialog on this response
      "Content-Disposition": "inline",
    },
  });
}

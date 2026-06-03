import { NextRequest, NextResponse } from "next/server";
import { createModelToken, deriveSessionKey } from "@/lib/server/modelToken";
import { existsSync } from "fs";
import { resolve } from "path";
import { createECDH, createCipheriv, randomBytes, hkdfSync } from "crypto";

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

// POST body: { clientPublicKey: string }  (hex-encoded uncompressed P-256 public key, 65 bytes)
//
// ECDH flow:
//   1. Server generates ephemeral keypair
//   2. sharedSecret = ECDH(serverPriv, clientPub)
//   3. wrappingKey  = HKDF(sharedSecret, "key-wrap")   — never transmitted
//   4. sessionKey   = HMAC(tokenSecret, modelId.exp:session-key)  — deterministic, re-derivable
//   5. wrappedKey   = AES-256-GCM(sessionKey, wrappingKey)
//   6. Return { token, serverPublicKey, wrappedKey }
//
// Client derives the same wrappingKey via ECDH then unwraps sessionKey.
// sessionKey itself never appears on the wire.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!SAFE_ID.test(id)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  if (!process.env.MODEL_TOKEN_SECRET) {
    return new NextResponse("Not configured", { status: 503 });
  }

  const filePath = resolve(process.cwd(), "public/models", `${id}.glbenc`);
  if (!existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let clientPublicKeyHex: string;
  try {
    const body = await req.json();
    clientPublicKeyHex = body.clientPublicKey;
    if (typeof clientPublicKeyHex !== "string" || clientPublicKeyHex.length !== 130) {
      throw new Error("bad key");
    }
  } catch {
    return new NextResponse("Invalid request body", { status: 400 });
  }

  // ── Token ────────────────────────────────────────────────────────────────
  const { token, expiresAt } = createModelToken(id);

  // ── Server ephemeral ECDH keypair ─────────────────────────────────────────
  const serverECDH = createECDH("prime256v1");
  serverECDH.generateKeys();
  const serverPublicKeyHex = serverECDH.getPublicKey("hex");

  // ── Shared secret → wrapping key (HKDF) ──────────────────────────────────
  const clientPublicKeyBuf = Buffer.from(clientPublicKeyHex, "hex");
  const sharedSecret = serverECDH.computeSecret(clientPublicKeyBuf);
  const wrappingKey = Buffer.from(
    hkdfSync("sha256", sharedSecret, Buffer.alloc(0), Buffer.from("key-wrap"), 32)
  );

  // ── Wrap session key ──────────────────────────────────────────────────────
  const sessionKey = deriveSessionKey(id, expiresAt);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", wrappingKey, iv);
  const encrypted = Buffer.concat([cipher.update(sessionKey), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: IV(12) + ciphertext(32) + authTag(16) = 60 bytes → 120 hex chars
  const wrappedKey = Buffer.concat([iv, encrypted, authTag]).toString("hex");

  return NextResponse.json(
    { token, serverPublicKey: serverPublicKeyHex, wrappedKey, expiresIn: 300 },
    { headers: { "Cache-Control": "no-store" } }
  );
}

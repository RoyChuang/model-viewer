// Web Worker: ECDH key exchange + Layer 1 (signed token) + Layer 2 (chunked streaming)
//
// Flow:
//   1. Generate ephemeral ECDH keypair (P-256, private key non-extractable)
//   2. POST /api/model-token with clientPublicKey
//   3. Receive serverPublicKey + wrappedKey
//   4. Derive sharedSecret via ECDH → HKDF → wrappingKey
//   5. Unwrap sessionKey (AES-256-GCM, non-extractable)
//   6. Fetch manifest → fetch all chunks in parallel
//   7. Decrypt each chunk with sessionKey
//   8. Reassemble → postMessage zero-copy

const hexToBytes = (hex: string): Uint8Array =>
  Uint8Array.from({ length: hex.length / 2 }, (_, i) =>
    parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  );

self.onmessage = async (e: MessageEvent<{ modelId: string }>) => {
  const { modelId } = e.data;

  try {
    // ── Step 1: Generate ephemeral ECDH keypair ───────────────────────────
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false, // private key non-extractable
      ["deriveBits"]
    );
    const clientPublicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const clientPublicKeyHex = [...new Uint8Array(clientPublicKeyRaw)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // ── Step 2: POST to token endpoint ────────────────────────────────────
    const tokenRes = await fetch(`/api/model-token/${encodeURIComponent(modelId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientPublicKey: clientPublicKeyHex }),
    });
    if (!tokenRes.ok) throw new Error(`Token fetch failed: ${tokenRes.status}`);
    const { token, serverPublicKey, wrappedKey } = (await tokenRes.json()) as {
      token: string;
      serverPublicKey: string;
      wrappedKey: string;
    };

    // ── Step 3: ECDH → shared secret ─────────────────────────────────────
    const serverCryptoKey = await crypto.subtle.importKey(
      "raw",
      hexToBytes(serverPublicKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );
    const sharedSecretBits = await crypto.subtle.deriveBits(
      { name: "ECDH", public: serverCryptoKey },
      keyPair.privateKey,
      256
    );

    // ── Step 4: HKDF → wrapping key ───────────────────────────────────────
    const sharedSecretKey = await crypto.subtle.importKey(
      "raw",
      sharedSecretBits,
      "HKDF",
      false,
      ["deriveKey"]
    );
    const wrappingKey = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(0),
        info: new TextEncoder().encode("key-wrap"),
      },
      sharedSecretKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // ── Step 5: Unwrap session key ────────────────────────────────────────
    // wrappedKey wire format: IV(12) + ciphertext(32) + authTag(16) = 60 bytes
    const wrappedBytes = hexToBytes(wrappedKey);
    const wrapIv = wrappedBytes.slice(0, 12);
    const wrappedData = wrappedBytes.slice(12); // ciphertext + tag
    const sessionKeyBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: wrapIv },
      wrappingKey,
      wrappedData
    );
    const sessionKey = await crypto.subtle.importKey(
      "raw",
      sessionKeyBuffer,
      { name: "AES-GCM" },
      false, // non-extractable
      ["decrypt"]
    );

    // ── Step 6: Fetch manifest then all chunks in parallel ─────────────────
    const q = `token=${encodeURIComponent(token)}`;

    const manifestRes = await fetch(`/api/model/${encodeURIComponent(modelId)}?${q}`);
    if (!manifestRes.ok) throw new Error(`Manifest fetch failed: ${manifestRes.status}`);
    const { totalChunks, totalSize } = (await manifestRes.json()) as {
      totalChunks: number;
      chunkSize: number;
      totalSize: number;
    };

    const chunkResponses = await Promise.all(
      Array.from({ length: totalChunks }, (_, i) =>
        fetch(`/api/model/${encodeURIComponent(modelId)}/chunk/${i}?${q}`)
      )
    );
    for (const res of chunkResponses) {
      if (!res.ok) throw new Error(`Chunk fetch failed: ${res.status}`);
    }

    // ── Step 7: Decrypt each chunk ────────────────────────────────────────
    // Chunk wire format: IV(12) + ciphertext + authTag(16)
    const plainChunks = await Promise.all(
      chunkResponses.map(async (res) => {
        const enc = new Uint8Array(await res.arrayBuffer());
        const iv = enc.slice(0, 12);
        const data = enc.slice(12); // ciphertext + authTag (WebCrypto handles split)
        return crypto.subtle.decrypt({ name: "AES-GCM", iv }, sessionKey, data);
      })
    );

    // ── Step 8: Reassemble in order ───────────────────────────────────────
    const assembled = new Uint8Array(totalSize);
    let offset = 0;
    for (const buf of plainChunks) {
      assembled.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    // Transfer zero-copy — worker loses its reference immediately
    self.postMessage({ ok: true, buffer: assembled.buffer }, { transfer: [assembled.buffer] });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};

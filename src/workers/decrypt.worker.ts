// Web Worker: Layer 1 (signed token) + Layer 2 (chunked streaming)
// Flow: get token → get manifest → fetch all chunks in parallel → reassemble → postMessage
self.onmessage = async (e: MessageEvent<{ modelId: string }>) => {
  const { modelId } = e.data;

  try {
    // ── Layer 1: obtain a 5-minute signed token ────────────────────────────
    const tokenRes = await fetch(`/api/model-token/${encodeURIComponent(modelId)}`);
    if (!tokenRes.ok) throw new Error(`Token fetch failed: ${tokenRes.status}`);
    const { token } = (await tokenRes.json()) as { token: string };

    const q = `token=${encodeURIComponent(token)}`;

    // ── Layer 2: fetch manifest (chunk count) ─────────────────────────────
    const manifestRes = await fetch(`/api/model/${encodeURIComponent(modelId)}?${q}`);
    if (!manifestRes.ok) throw new Error(`Manifest fetch failed: ${manifestRes.status}`);
    const { totalChunks, totalSize } = (await manifestRes.json()) as {
      totalChunks: number;
      chunkSize: number;
      totalSize: number;
    };

    // ── Layer 2: fetch all chunks in parallel ─────────────────────────────
    const chunkResponses = await Promise.all(
      Array.from({ length: totalChunks }, (_, i) =>
        fetch(`/api/model/${encodeURIComponent(modelId)}/chunk/${i}?${q}`)
      )
    );

    for (const res of chunkResponses) {
      if (!res.ok) throw new Error(`Chunk fetch failed: ${res.status}`);
    }

    const chunkBuffers = await Promise.all(chunkResponses.map((r) => r.arrayBuffer()));

    // ── Reassemble chunks in order ────────────────────────────────────────
    const assembled = new Uint8Array(totalSize);
    let offset = 0;
    for (const buf of chunkBuffers) {
      assembled.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    // Transfer zero-copy — worker loses its reference immediately
    self.postMessage({ ok: true, buffer: assembled.buffer }, { transfer: [assembled.buffer] });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};

// Web Worker: fetch server-decrypted model, pass ArrayBuffer to main thread
self.onmessage = async (e: MessageEvent<{ modelId: string }>) => {
  const { modelId } = e.data;

  try {
    const res = await fetch(`/api/model/${encodeURIComponent(modelId)}`);
    if (!res.ok) throw new Error(`Model fetch failed: ${res.status}`);

    const buffer = await res.arrayBuffer();

    // Transfer zero-copy — worker loses its reference immediately
    self.postMessage({ ok: true, buffer }, { transfer: [buffer] });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};

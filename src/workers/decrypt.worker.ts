// Web Worker: get a short-lived signed token, then fetch & pass model to main thread
self.onmessage = async (e: MessageEvent<{ modelId: string }>) => {
  const { modelId } = e.data;

  try {
    // Step 1: obtain a 5-minute signed token from the server
    const tokenRes = await fetch(`/api/model-token/${encodeURIComponent(modelId)}`);
    if (!tokenRes.ok) throw new Error(`Token fetch failed: ${tokenRes.status}`);
    const { token } = (await tokenRes.json()) as { token: string };

    // Step 2: fetch the model, presenting the signed token
    const modelRes = await fetch(
      `/api/model/${encodeURIComponent(modelId)}?token=${encodeURIComponent(token)}`
    );
    if (!modelRes.ok) throw new Error(`Model fetch failed: ${modelRes.status}`);

    const buffer = await modelRes.arrayBuffer();

    // Transfer zero-copy — worker loses its reference immediately
    self.postMessage({ ok: true, buffer }, { transfer: [buffer] });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};

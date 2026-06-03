"use client";

import { useState, useEffect, useRef } from "react";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; blobUrl: string }
  | { status: "error"; message: string };

// Module-level session cache: lives as long as the page is open.
// Stores the raw ArrayBuffer so blob URLs can be created/revoked freely.
// Cleared automatically on page reload — no IndexedDB, no persistent storage.
const sessionCache = new Map<string, ArrayBuffer>();

export function useSecureModel(modelId: string | null) {
  const [state, setState] = useState<State>({ status: "idle" });
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!modelId) {
      setState({ status: "idle" });
      return;
    }

    // Revoke previous blob URL (the buffer stays in sessionCache)
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }

    // Cache hit: skip the worker entirely
    const cached = sessionCache.get(modelId);
    if (cached) {
      const url = URL.createObjectURL(
        new Blob([cached], { type: "model/gltf-binary" })
      );
      blobRef.current = url;
      setState({ status: "ready", blobUrl: url });
      return;
    }

    setState({ status: "loading" });

    const worker = new Worker(
      new URL("../workers/decrypt.worker.ts", import.meta.url)
    );

    worker.onmessage = (e: MessageEvent<{ ok: boolean; buffer?: ArrayBuffer; error?: string }>) => {
      if (e.data.ok && e.data.buffer) {
        // Store in session cache before creating the blob URL
        sessionCache.set(modelId, e.data.buffer);

        const blob = new Blob([e.data.buffer], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        blobRef.current = url;
        setState({ status: "ready", blobUrl: url });
      } else {
        setState({ status: "error", message: e.data.error ?? "Decryption failed" });
      }
      worker.terminate();
    };

    worker.onerror = (err) => {
      setState({ status: "error", message: err.message });
      worker.terminate();
    };

    worker.postMessage({ modelId });

    return () => {
      worker.terminate();
    };
  }, [modelId]);

  // Cleanup blob URL on unmount (buffer stays in sessionCache)
  useEffect(() => {
    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, []);

  return state;
}

"use client";

import { useState, useEffect, useRef } from "react";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; blobUrl: string }
  | { status: "error"; message: string };

export function useSecureModel(modelId: string | null) {
  const [state, setState] = useState<State>({ status: "idle" });
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!modelId) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });

    // Revoke any previous blob URL
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }

    const worker = new Worker(
      new URL("../workers/decrypt.worker.ts", import.meta.url)
    );

    worker.onmessage = (e: MessageEvent<{ ok: boolean; buffer?: ArrayBuffer; error?: string }>) => {
      if (e.data.ok && e.data.buffer) {
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

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, []);

  return state;
}

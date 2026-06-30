"use client";

import { useState, useEffect } from "react";

type State =
  | { status: "idle" }
  | { status: "loading"; progress: number; stage?: string }
  | { status: "ready"; blobUrl: string }
  | { status: "error"; message: string };

type ProgressSnapshot = {
  progress: number;
  stage?: string;
};

type WorkerMessage =
  | { type: "progress"; progress: number; stage?: string }
  | { ok: true; buffer: ArrayBuffer }
  | { ok: false; error?: string };

type PendingLoad = {
  promise: Promise<ArrayBuffer>;
  snapshot: ProgressSnapshot;
  subscribe: (listener: (snapshot: ProgressSnapshot) => void) => () => void;
};

// Module-level session cache: lives as long as the page is open.
// Stores the raw ArrayBuffer so blob URLs can be created/revoked freely.
// Cleared automatically on page reload — no IndexedDB, no persistent storage.
const sessionCache = new Map<string, ArrayBuffer>();
const sessionBlobUrls = new Map<string, string>();
const pendingLoads = new Map<string, PendingLoad>();

function getBlobUrl(modelId: string, buffer: ArrayBuffer) {
  const cachedUrl = sessionBlobUrls.get(modelId);
  if (cachedUrl) return cachedUrl;

  const url = URL.createObjectURL(new Blob([buffer], { type: "model/gltf-binary" }));
  sessionBlobUrls.set(modelId, url);
  return url;
}

function loadModel(modelId: string): PendingLoad {
  const existing = pendingLoads.get(modelId);
  if (existing) return existing;

  const listeners = new Set<(snapshot: ProgressSnapshot) => void>();
  const pending: PendingLoad = {
    promise: Promise.resolve(new ArrayBuffer(0)),
    snapshot: { progress: 0, stage: "準備中" },
    subscribe(listener) {
      listeners.add(listener);
      listener(pending.snapshot);
      return () => listeners.delete(listener);
    },
  };

  const publish = (snapshot: ProgressSnapshot) => {
    pending.snapshot = snapshot;
    listeners.forEach((listener) => listener(snapshot));
  };

  pending.promise = new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/decrypt.worker.ts", import.meta.url)
    );

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const message = e.data;

      if ("type" in message) {
        publish({ progress: message.progress, stage: message.stage });
        return;
      }

      worker.terminate();

      if (message.ok) {
        sessionCache.set(modelId, message.buffer);
        publish({ progress: 100, stage: "完成" });
        resolve(message.buffer);
      } else {
        reject(new Error(message.error ?? "Decryption failed"));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message));
    };

    worker.postMessage({ modelId });
  }).finally(() => {
    pendingLoads.delete(modelId);
  });

  pendingLoads.set(modelId, pending);
  return pending;
}

export function useSecureModel(modelId: string | null) {
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    if (!modelId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to idle when no model is selected.
      setState({ status: "idle" });
      return;
    }

    // Cache hit: skip the worker entirely
    const cached = sessionCache.get(modelId);
    if (cached) {
      const url = getBlobUrl(modelId, cached);
      setState({ status: "ready", blobUrl: url });
      return;
    }

    let cancelled = false;
    const pending = loadModel(modelId);

    setState({
      status: "loading",
      progress: pending.snapshot.progress,
      stage: pending.snapshot.stage,
    });

    const unsubscribe = pending.subscribe((snapshot) =>
      setState({ status: "loading", ...snapshot })
    );

    pending.promise
      .then((buffer) => {
        if (cancelled) return;
        const url = getBlobUrl(modelId, buffer);
        setState({ status: "ready", blobUrl: url });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [modelId]);

  return state;
}

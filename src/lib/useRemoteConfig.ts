"use client";

import { useEffect, useState } from "react";

type ConfigState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

export function useRemoteConfig<T>(
  url: string,
  parse: (value: unknown) => T
): ConfigState<T> {
  const [state, setState] = useState<ConfigState<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    setState({ status: "loading" });

    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
        return res.json() as Promise<unknown>;
      })
      .then((json) => {
        if (cancelled) return;
        setState({ status: "ready", data: parse(json) });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [parse, url]);

  return state;
}

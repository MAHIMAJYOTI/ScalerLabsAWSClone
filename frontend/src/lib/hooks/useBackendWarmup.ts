"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api/client";

export type WarmupState = "connecting" | "ready" | "failed";

const INITIAL_DELAY_MS = 2_000;
const MAX_DELAY_MS = 10_000;
const TOTAL_BUDGET_MS = 90_000;

/**
 * Probes GET /api/v1/health with exponential backoff (2s, 4s, 8s, capped at
 * 10s) for up to 90s — free-tier backends can cold-start for 30-60s.
 */
export function useBackendWarmup(): { state: WarmupState; retry: () => void } {
  const [state, setState] = useState<WarmupState>("connecting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      const startedAt = Date.now();
      let delay = INITIAL_DELAY_MS;
      for (;;) {
        try {
          await api.get("/api/v1/health");
          if (!cancelled) setState("ready");
          return;
        } catch {
          if (Date.now() - startedAt + delay > TOTAL_BUDGET_MS) {
            if (!cancelled) setState("failed");
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (cancelled) return;
          delay = Math.min(delay * 2, MAX_DELAY_MS);
        }
      }
    };

    void probe();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState("connecting");
    setAttempt((current) => current + 1);
  }, []);

  return { state, retry };
}

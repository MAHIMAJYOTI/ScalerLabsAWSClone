"use client";

import { useEffect, useState } from "react";

/**
 * Preference state persisted to localStorage. Reads happen in an effect after
 * mount (never during render) so SSR and the first client render agree — no
 * hydration mismatches. All storage access is wrapped in try/catch.
 */
export function usePersistedPreferences<T>(
  storageKey: string,
  defaults: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(defaults);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        // One-time deferred hydration from storage; must happen after mount so
        // the SSR and first client render agree (no hydration mismatch).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue({ ...defaults, ...(JSON.parse(raw) as Partial<T>) });
      }
    } catch {
      // Ignore corrupted/unavailable storage and keep defaults.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per key
  }, [storageKey]);

  const update = (next: T) => {
    setValue(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage may be unavailable (private mode) — preferences stay in memory.
    }
  };

  return [value, update];
}

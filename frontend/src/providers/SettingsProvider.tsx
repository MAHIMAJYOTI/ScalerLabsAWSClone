"use client";

import {
  Density,
  Mode,
  applyDensity,
  applyMode,
} from "@cloudscape-design/global-styles";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type VisualMode = "browser" | "light" | "dark";
export type UiDensity = "comfortable" | "compact";

export interface UiSettings {
  mode: VisualMode;
  density: UiDensity;
}

export const SETTINGS_STORAGE_KEY = "r53.settings";
const DEFAULTS: UiSettings = { mode: "browser", density: "comfortable" };

function readStoredSettings(): UiSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<UiSettings>) };
    }
  } catch {
    // corrupted/unavailable storage — fall back to defaults
  }
  return DEFAULTS;
}

interface SettingsContextValue {
  settings: UiSettings;
  updateSettings: (next: UiSettings) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Lazy init from storage: the value is never rendered into SSR markup, so
  // reading it here is hydration-safe and avoids a light-mode flash.
  const [settings, setSettings] = useState<UiSettings>(() =>
    typeof window === "undefined" ? DEFAULTS : readStoredSettings(),
  );

  useEffect(() => {
    const dark =
      settings.mode === "dark" ||
      (settings.mode === "browser" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    applyMode(dark ? Mode.Dark : Mode.Light);
    applyDensity(
      settings.density === "compact" ? Density.Compact : Density.Comfortable,
    );
    if (settings.mode !== "browser") return;
    // Browser default follows prefers-color-scheme live.
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () =>
      applyMode(mediaQuery.matches ? Mode.Dark : Mode.Light);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, [settings]);

  const updateSettings = useCallback((next: UiSettings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — settings stay in memory for the session
    }
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings }),
    [settings, updateSettings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

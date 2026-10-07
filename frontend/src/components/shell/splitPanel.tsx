"use client";

import { createContext, useContext } from "react";

export interface SplitPanelContent {
  header: string;
  content: React.ReactNode;
}

interface SplitPanelContextValue {
  openPanel: (content: SplitPanelContent) => void;
  closePanel: () => void;
}

export const SplitPanelContext = createContext<SplitPanelContextValue | null>(
  null,
);

export function useSplitPanel(): SplitPanelContextValue {
  const context = useContext(SplitPanelContext);
  if (!context) {
    throw new Error("useSplitPanel must be used within the ConsoleShell");
  }
  return context;
}

"use client";

import { useEffect, useRef } from "react";

/** Actions a page can register (see usePageShortcuts in the shell). */
export interface PageShortcutActions {
  focusFilter?: () => void;
  create?: () => void;
  refresh?: () => void;
  importZone?: () => void;
}

export interface GlobalShortcutHandlers {
  openShortcutsHelp: () => void;
  focusTopNavSearch: () => void;
  goToZones: () => void;
  goToDashboard: () => void;
  closeSplitPanel: () => void;
  getPageActions: () => PageShortcutActions;
}

const G_SEQUENCE_WINDOW_MS = 1000;
const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

function isAnyModalOpen(): boolean {
  // Cloudscape modal class names are hashed but keep the awsui_modal prefix.
  return document.querySelector('[class*="awsui_modal"]') !== null;
}

/**
 * Single global keydown listener implementing all console shortcuts.
 * Keystrokes are ignored while an editable element has focus (except Esc).
 */
export function useKeyboardShortcuts(handlers: GlobalShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    let lastGPressAt = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      const current = handlersRef.current;

      if (event.key === "Escape") {
        if (!isAnyModalOpen()) current.closeSplitPanel();
        return;
      }
      if (isEditableTarget(event.target)) return;

      if (event.altKey && event.code === "KeyS") {
        event.preventDefault();
        current.focusTopNavSearch();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const actions = current.getPageActions();
      switch (event.key) {
        case "?":
          event.preventDefault();
          current.openShortcutsHelp();
          break;
        case "/":
          event.preventDefault();
          actions.focusFilter?.();
          break;
        case "c":
          actions.create?.();
          break;
        case "r":
          event.preventDefault();
          actions.refresh?.();
          break;
        case "i":
          actions.importZone?.();
          break;
        case "g":
          lastGPressAt = Date.now();
          break;
        case "z":
          if (Date.now() - lastGPressAt < G_SEQUENCE_WINDOW_MS) {
            current.goToZones();
          }
          lastGPressAt = 0;
          break;
        case "d":
          if (Date.now() - lastGPressAt < G_SEQUENCE_WINDOW_MS) {
            current.goToDashboard();
          }
          lastGPressAt = 0;
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

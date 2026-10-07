"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import Table from "@cloudscape-design/components/table";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useSplitPanel } from "./splitPanel";
import {
  useKeyboardShortcuts,
  type PageShortcutActions,
} from "@/lib/hooks/useKeyboardShortcuts";

export const TOPNAV_SEARCH_ID = "r53-topnav-search";

interface ShortcutsContextValue {
  /** Register the current page's shortcut actions via a getter. */
  setPageActions: (getter: (() => PageShortcutActions) | null) => void;
  openModal: () => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "?", action: "Show keyboard shortcuts" },
  { keys: "/", action: "Focus the table filter" },
  { keys: "Alt+S", action: "Focus the top navigation search" },
  { keys: "c", action: "Create (hosted zone on the list, record on a zone)" },
  { keys: "r", action: "Refresh the current table" },
  { keys: "g then z", action: "Go to Hosted zones" },
  { keys: "g then d", action: "Go to Dashboard" },
  { keys: "i", action: "Import zone file (on a hosted zone)" },
  { keys: "Esc", action: "Close the record details panel" },
];

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { closePanel } = useSplitPanel();
  const [modalVisible, setModalVisible] = useState(false);
  const pageActionsRef = useRef<(() => PageShortcutActions) | null>(null);

  const setPageActions = useCallback(
    (getter: (() => PageShortcutActions) | null) => {
      pageActionsRef.current = getter;
    },
    [],
  );
  const openModal = useCallback(() => setModalVisible(true), []);

  useKeyboardShortcuts({
    openShortcutsHelp: openModal,
    focusTopNavSearch: () => {
      document
        .getElementById(TOPNAV_SEARCH_ID)
        ?.querySelector("input")
        ?.focus();
    },
    goToZones: () => router.push("/route53/v2/hostedzones"),
    goToDashboard: () => router.push("/route53/v2/dashboard"),
    closeSplitPanel: closePanel,
    getPageActions: () => pageActionsRef.current?.() ?? {},
  });

  const value = useMemo(
    () => ({ setPageActions, openModal }),
    [setPageActions, openModal],
  );

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
      {modalVisible && (
        <Modal
          visible
          onDismiss={() => setModalVisible(false)}
          closeAriaLabel="Close modal"
          header="Keyboard shortcuts"
          footer={
            <Box float="right">
              <Button variant="primary" onClick={() => setModalVisible(false)}>
                Close
              </Button>
            </Box>
          }
        >
          <Table
            variant="embedded"
            items={SHORTCUTS}
            trackBy="keys"
            columnDefinitions={[
              {
                id: "keys",
                header: "Shortcut",
                cell: (item) => <Box variant="code">{item.keys}</Box>,
              },
              { id: "action", header: "Action", cell: (item) => item.action },
            ]}
          />
        </Modal>
      )}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts(): ShortcutsContextValue {
  const context = useContext(ShortcutsContext);
  if (!context) {
    throw new Error("useShortcuts must be used within the ConsoleShell");
  }
  return context;
}

/** Page-level registration: call with the actions the current page supports. */
export function usePageShortcuts(actions: PageShortcutActions): void {
  const { setPageActions } = useShortcuts();
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    setPageActions(() => actionsRef.current);
    return () => setPageActions(null);
  }, [setPageActions]);
}

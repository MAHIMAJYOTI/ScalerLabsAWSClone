"use client";

import type { FlashbarProps } from "@cloudscape-design/components/flashbar";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

const SUCCESS_AUTO_DISMISS_MS = 8000;

export interface NotifyInput {
  type: FlashbarProps.Type;
  header?: React.ReactNode;
  content: React.ReactNode;
  action?: React.ReactNode;
}

interface NotificationsContextValue {
  items: FlashbarProps.MessageDefinition[];
  notify: (input: NotifyInput) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (input: NotifyInput) => {
      counter.current += 1;
      const id = `flash-${counter.current}`;
      const item: FlashbarProps.MessageDefinition = {
        id,
        type: input.type,
        header: input.header,
        content: input.content,
        action: input.action,
        dismissible: true,
        dismissLabel: "Dismiss message",
        onDismiss: () => dismiss(id),
      };
      setItems((current) => [item, ...current]);
      if (input.type === "success") {
        window.setTimeout(() => dismiss(id), SUCCESS_AUTO_DISMISS_MS);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ items, notify }), [items, notify]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider",
    );
  }
  return context;
}

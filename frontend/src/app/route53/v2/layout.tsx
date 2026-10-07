"use client";

import { ConsoleShell } from "@/components/shell/ConsoleShell";
import { AuthGuard } from "@/providers/AuthGuard";
import { NotificationsProvider } from "@/providers/NotificationsProvider";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <NotificationsProvider>
        <ConsoleShell>{children}</ConsoleShell>
      </NotificationsProvider>
    </AuthGuard>
  );
}

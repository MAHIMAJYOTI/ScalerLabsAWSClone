"use client";

import Input from "@cloudscape-design/components/input";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TOPNAV_SEARCH_ID, useShortcuts } from "./shortcuts";
import { UnifiedSettingsModal } from "./UnifiedSettingsModal";
import { useLogout, useMe } from "@/lib/api/hooks/auth";
import { formatAccountId } from "@/lib/format";

export function TopNav() {
  const router = useRouter();
  const { data: user } = useMe();
  const logout = useLogout();
  const { openModal: openShortcutsModal } = useShortcuts();
  const [search, setSearch] = useState("");
  const [settingsVisible, setSettingsVisible] = useState(false);

  const accountId = formatAccountId(user?.account_id ?? "");
  const displayName = user?.display_name ?? "";

  return (
    <div id="r53-top-nav" style={{ position: "sticky", top: 0, zIndex: 1002 }}>
      <TopNavigation
        identity={{
          href: "/route53/v2/dashboard",
          title: "Route 53 Clone",
          onFollow: (event) => {
            event.preventDefault();
            router.push("/route53/v2/dashboard");
          },
        }}
        search={
          <div id={TOPNAV_SEARCH_ID}>
            <Input
              type="search"
              placeholder="Search  [Alt+S]"
              ariaLabel="Search"
              value={search}
              onChange={({ detail }) => setSearch(detail.value)}
            />
          </div>
        }
        utilities={[
          {
            type: "button",
            iconName: "command-prompt",
            ariaLabel: "CloudShell",
            title: "CloudShell",
          },
          {
            type: "button",
            iconName: "notification",
            ariaLabel: "Notifications",
            title: "Notifications",
          },
          {
            type: "menu-dropdown",
            iconName: "status-info",
            ariaLabel: "Help",
            title: "Help",
            onItemClick: ({ detail }) => {
              if (detail.id === "shortcuts") openShortcutsModal();
            },
            items: [
              { id: "documentation", text: "Documentation", disabled: true },
              { id: "shortcuts", text: "Keyboard shortcuts" },
            ],
          },
          {
            type: "button",
            iconName: "settings",
            ariaLabel: "Settings",
            title: "Settings",
            onClick: () => setSettingsVisible(true),
          },
          {
            type: "menu-dropdown",
            text: "Global",
            ariaLabel: "Region selector (Global)",
            title: "Region",
            items: [
              {
                id: "region-info",
                text: "Route 53 does not require region selection.",
                disabled: true,
              },
            ],
          },
          {
            type: "menu-dropdown",
            text: `${displayName} @ ${accountId}`,
            iconName: "user-profile",
            ariaLabel: "Account menu",
            onItemClick: ({ detail }) => {
              if (detail.id === "signout") {
                logout.mutate(undefined, {
                  onSettled: () => {
                    // Intentional full navigation on sign-out: clears every
                    // bit of client state along with the query cache.
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.assign("/login");
                  },
                });
              } else if (detail.id === "account-id") {
                void navigator.clipboard?.writeText(user?.account_id ?? "");
              }
            },
            items: [
              {
                id: "account-group",
                text: `Account ID: ${accountId}`,
                items: [
                  {
                    id: "account-id",
                    text: `Account ID: ${accountId}`,
                    iconName: "copy",
                  },
                  { id: "organization", text: "Organization" },
                  { id: "account", text: "Account" },
                  { id: "billing", text: "Billing and Cost Management" },
                  { id: "credentials", text: "Security credentials" },
                  { id: "settings", text: "Settings" },
                ],
              },
              { id: "signout", text: "Sign out" },
            ],
          },
        ]}
        i18nStrings={{
          overflowMenuTriggerText: "More",
          overflowMenuTitleText: "All",
          searchIconAriaLabel: "Search",
          searchDismissIconAriaLabel: "Close search",
        }}
      />
      {settingsVisible && (
        <UnifiedSettingsModal onDismiss={() => setSettingsVisible(false)} />
      )}
    </div>
  );
}

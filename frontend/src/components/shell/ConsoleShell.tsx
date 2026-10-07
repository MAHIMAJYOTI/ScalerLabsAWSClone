"use client";

import AppLayout, {
  type AppLayoutProps,
} from "@cloudscape-design/components/app-layout";
import Flashbar from "@cloudscape-design/components/flashbar";
import HelpPanel from "@cloudscape-design/components/help-panel";
import SplitPanel from "@cloudscape-design/components/split-panel";
import { useCallback, useMemo, useState } from "react";

import { Breadcrumbs } from "./Breadcrumbs";
import { FooterBar } from "./FooterBar";
import { HELP_TOPICS, HelpContext, type HelpTopicId } from "./help";
import { ShortcutsProvider } from "./shortcuts";
import { SideNav } from "./SideNav";
import {
  SplitPanelContext,
  type SplitPanelContent,
} from "./splitPanel";
import { TopNav } from "./TopNav";
import { useNotifications } from "@/providers/NotificationsProvider";

const SPLIT_PANEL_I18N = {
  preferencesTitle: "Split panel preferences",
  preferencesPositionLabel: "Split panel position",
  preferencesPositionDescription:
    "Choose the default split panel position for the service.",
  preferencesPositionSide: "Side",
  preferencesPositionBottom: "Bottom",
  preferencesConfirm: "Confirm",
  preferencesCancel: "Cancel",
  closeButtonAriaLabel: "Close panel",
  openButtonAriaLabel: "Open panel",
  resizeHandleAriaLabel: "Resize split panel",
};

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { items } = useNotifications();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [topicId, setTopicId] = useState<HelpTopicId>("hostedZones");
  const [panel, setPanel] = useState<SplitPanelContent | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelPreferences, setPanelPreferences] =
    useState<AppLayoutProps.SplitPanelPreferences>({ position: "bottom" });

  const openHelp = useCallback((topic: HelpTopicId) => {
    setTopicId(topic);
    setToolsOpen(true);
  }, []);
  const helpValue = useMemo(() => ({ openHelp }), [openHelp]);

  const openPanel = useCallback((content: SplitPanelContent) => {
    setPanel(content);
    setPanelOpen(true);
  }, []);
  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setPanel(null);
  }, []);
  const splitPanelValue = useMemo(
    () => ({ openPanel, closePanel }),
    [openPanel, closePanel],
  );

  const topic = HELP_TOPICS[topicId];

  return (
    <HelpContext.Provider value={helpValue}>
      <SplitPanelContext.Provider value={splitPanelValue}>
        <ShortcutsProvider>
        <TopNav />
        <AppLayout
          headerSelector="#r53-top-nav"
          footerSelector="#r53-footer"
          breadcrumbs={<Breadcrumbs />}
          navigation={<SideNav />}
          notifications={
            <Flashbar
              items={items}
              stackItems
              i18nStrings={{
                ariaLabel: "Notifications",
                notificationBarAriaLabel: "View all notifications",
                notificationBarText: "View all notifications",
                errorIconAriaLabel: "Error",
                warningIconAriaLabel: "Warning",
                successIconAriaLabel: "Success",
                infoIconAriaLabel: "Info",
                inProgressIconAriaLabel: "In progress",
              }}
            />
          }
          toolsOpen={toolsOpen}
          onToolsChange={({ detail }) => setToolsOpen(detail.open)}
          tools={
            <HelpPanel header={<h2>{topic.header}</h2>}>
              {topic.content}
            </HelpPanel>
          }
          splitPanel={
            panel ? (
              <SplitPanel header={panel.header} i18nStrings={SPLIT_PANEL_I18N}>
                {panel.content}
              </SplitPanel>
            ) : undefined
          }
          splitPanelOpen={panelOpen && panel !== null}
          onSplitPanelToggle={({ detail }) => {
            setPanelOpen(detail.open);
            if (!detail.open) setPanel(null);
          }}
          splitPanelPreferences={panelPreferences}
          onSplitPanelPreferencesChange={({ detail }) =>
            setPanelPreferences(detail)
          }
          content={children}
        />
        <FooterBar />
        </ShortcutsProvider>
      </SplitPanelContext.Provider>
    </HelpContext.Provider>
  );
}

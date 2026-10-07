"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Modal from "@cloudscape-design/components/modal";
import RadioGroup from "@cloudscape-design/components/radio-group";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";

import {
  useSettings,
  type UiDensity,
  type VisualMode,
} from "@/providers/SettingsProvider";

export function UnifiedSettingsModal({ onDismiss }: { onDismiss: () => void }) {
  const { settings, updateSettings } = useSettings();
  const [mode, setMode] = useState<VisualMode>(settings.mode);
  const [density, setDensity] = useState<UiDensity>(settings.density);

  const save = () => {
    updateSettings({ mode, density });
    onDismiss();
  };

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      closeAriaLabel="Close modal"
      header="Unified settings"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              Save
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <FormField
          label="Visual mode"
          description="Choose how the console looks."
          stretch
        >
          <RadioGroup
            value={mode}
            onChange={({ detail }) => setMode(detail.value as VisualMode)}
            items={[
              {
                value: "browser",
                label: "Browser default",
                description: "Follow the operating system color scheme.",
              },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </FormField>
        <FormField
          label="Density"
          description="Choose the amount of space between elements."
          stretch
        >
          <RadioGroup
            value={density}
            onChange={({ detail }) => setDensity(detail.value as UiDensity)}
            items={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import { useBatchDeleteZones } from "@/lib/api/hooks/hostedZones";
import type { HostedZoneListItem } from "@/lib/api/types";
import { displayZoneName } from "@/lib/format";

export interface BulkDeleteOutcome {
  deleted: string[];
  failed: { name: string; reason: string }[];
}

interface BulkDeleteZonesModalProps {
  zones: HostedZoneListItem[];
  visible: boolean;
  onDismiss: () => void;
  onDone: (outcome: BulkDeleteOutcome) => void;
}

export function BulkDeleteZonesModal({
  zones,
  visible,
  onDismiss,
  onDone,
}: BulkDeleteZonesModalProps) {
  const batchDelete = useBatchDeleteZones();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleDismiss = () => {
    setConfirmText("");
    setError(null);
    onDismiss();
  };

  const handleDelete = () => {
    setError(null);
    batchDelete.mutate(
      zones.map((zone) => zone.id),
      {
        onSuccess: (response) => {
          const nameById = new Map(
            zones.map((zone) => [zone.id, displayZoneName(zone.name)]),
          );
          const outcome: BulkDeleteOutcome = { deleted: [], failed: [] };
          for (const result of response.results) {
            const name = nameById.get(result.id) ?? result.id;
            if (result.ok) {
              outcome.deleted.push(name);
            } else {
              outcome.failed.push({
                name,
                reason: result.error?.message ?? "Unknown error",
              });
            }
          }
          setConfirmText("");
          onDone(outcome);
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  return (
    <Modal
      visible={visible}
      onDismiss={handleDismiss}
      closeAriaLabel="Close modal"
      header="Delete hosted zones?"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleDismiss}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={confirmText !== "delete"}
              loading={batchDelete.isPending}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {error && (
          <Alert type="error" header="Couldn't delete the hosted zones">
            {error}
          </Alert>
        )}
        <Box variant="span">
          Delete the following {zones.length} hosted zones permanently? This
          action can&apos;t be undone.
        </Box>
        <ul>
          {zones.map((zone) => (
            <li key={zone.id}>
              <Box variant="span" fontWeight="bold">
                {displayZoneName(zone.name)}
              </Box>{" "}
              <Box variant="span" color="text-body-secondary">
                ({zone.id})
              </Box>
            </li>
          ))}
        </ul>
        <FormField
          label={
            <span>
              To confirm deletion, type <i>delete</i> in the field.
            </span>
          }
          stretch
        >
          <Input
            value={confirmText}
            onChange={({ detail }) => setConfirmText(detail.value)}
            placeholder="delete"
            ariaLabel="Type delete to confirm"
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

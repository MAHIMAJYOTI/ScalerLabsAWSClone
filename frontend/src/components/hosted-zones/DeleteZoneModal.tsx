"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";

import { ApiError, errorMessage } from "@/lib/api/client";
import { useDeleteHostedZone } from "@/lib/api/hooks/hostedZones";
import { displayZoneName } from "@/lib/format";

interface DeleteZoneModalProps {
  zone: { id: string; name: string } | null;
  visible: boolean;
  onDismiss: () => void;
  /** Called after a successful delete (flash + navigation live in the caller). */
  onDeleted: (zoneName: string) => void;
}

export function DeleteZoneModal({
  zone,
  visible,
  onDismiss,
  onDeleted,
}: DeleteZoneModalProps) {
  const deleteZone = useDeleteHostedZone();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<ApiError | null>(null);

  const name = zone ? displayZoneName(zone.name) : "";

  // Reset on close so the next open starts clean (no state sync in effects).
  const handleDismiss = () => {
    setConfirmText("");
    setError(null);
    onDismiss();
  };

  const handleDelete = () => {
    if (!zone) return;
    setError(null);
    deleteZone.mutate(zone.id, {
      onSuccess: () => {
        setConfirmText("");
        onDeleted(name);
      },
      onError: (err) => {
        setError(
          err instanceof ApiError
            ? err
            : new ApiError("UnknownError", errorMessage(err), 500),
        );
      },
    });
  };

  return (
    <Modal
      visible={visible}
      onDismiss={handleDismiss}
      closeAriaLabel="Close modal"
      header="Delete hosted zone?"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleDismiss}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={confirmText !== "delete"}
              loading={deleteZone.isPending}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box variant="span">
          Delete hosted zone{" "}
          <Box variant="span" fontWeight="bold">
            {name}
          </Box>{" "}
          permanently? This action can&apos;t be undone.
        </Box>
        {error && (
          <Alert
            type="error"
            header={
              error.code === "HostedZoneNotEmpty"
                ? "This hosted zone can't be deleted"
                : "Couldn't delete the hosted zone"
            }
          >
            {error.code === "HostedZoneNotEmpty" ? (
              <SpaceBetween size="xs">
                <Box variant="span">
                  You can&apos;t delete a hosted zone that contains records
                  other than the default NS and SOA records. Delete the other
                  records first.
                </Box>
                <Box variant="span" color="text-body-secondary">
                  {error.message}
                </Box>
              </SpaceBetween>
            ) : (
              error.message
            )}
          </Alert>
        )}
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

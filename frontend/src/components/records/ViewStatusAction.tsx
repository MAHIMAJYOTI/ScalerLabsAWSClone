"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useState } from "react";

import { useChange } from "@/lib/api/hooks/changes";
import { formatDate } from "@/lib/format";

function ChangeStatusModal({
  changeId,
  onDismiss,
}: {
  changeId: string;
  onDismiss: () => void;
}) {
  const { data: change, isFetching, refetch } = useChange(changeId);

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      closeAriaLabel="Close modal"
      header="Change status"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              iconName="refresh"
              loading={isFetching}
              onClick={() => void refetch()}
            >
              Refresh
            </Button>
            <Button variant="primary" onClick={onDismiss}>
              Close
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <KeyValuePairs
        columns={1}
        items={[
          { label: "Change ID", value: changeId },
          {
            label: "Submitted at",
            value: change ? formatDate(change.submitted_at) : "-",
          },
          {
            label: "Status",
            value:
              change?.status === "INSYNC" ? (
                <StatusIndicator type="success">In sync</StatusIndicator>
              ) : (
                <StatusIndicator type="in-progress">Pending</StatusIndicator>
              ),
          },
        ]}
      />
    </Modal>
  );
}

/** "View status" button for flashbar actions — opens the change-status modal. */
export function ViewStatusAction({ changeId }: { changeId: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Button onClick={() => setVisible(true)}>View status</Button>
      {visible && (
        <ChangeStatusModal
          changeId={changeId}
          onDismiss={() => setVisible(false)}
        />
      )}
    </>
  );
}

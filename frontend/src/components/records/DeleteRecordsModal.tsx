"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import {
  useBatchDeleteRecords,
  useDeleteRecord,
} from "@/lib/api/hooks/records";
import type { HostedZoneDetail, RecordOut } from "@/lib/api/types";
import { displayZoneName } from "@/lib/format";

interface DeleteRecordsModalProps {
  zone: HostedZoneDetail;
  records: RecordOut[];
  visible: boolean;
  onDismiss: () => void;
  onDeleted: (count: number, changeId: string) => void;
}

export function DeleteRecordsModal({
  zone,
  records,
  visible,
  onDismiss,
  onDeleted,
}: DeleteRecordsModalProps) {
  const deleteOne = useDeleteRecord(zone.id);
  const deleteMany = useBatchDeleteRecords(zone.id);
  const [error, setError] = useState<string | null>(null);

  const hasProtected = records.some((record) => record.protected);
  const isPending = deleteOne.isPending || deleteMany.isPending;

  const handleDismiss = () => {
    setError(null);
    onDismiss();
  };

  const handleDelete = () => {
    setError(null);
    if (records.length === 1) {
      deleteOne.mutate(records[0].id, {
        onSuccess: (response) => onDeleted(1, response.change.id),
        onError: (err) => setError(errorMessage(err)),
      });
    } else {
      deleteMany.mutate(
        records.map((record) => record.id),
        {
          onSuccess: (response) =>
            onDeleted(response.deleted_ids.length, response.change.id),
          onError: (err) => setError(errorMessage(err)),
        },
      );
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={handleDismiss}
      closeAriaLabel="Close modal"
      header="Delete records?"
      size="large"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleDismiss}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={hasProtected || records.length === 0}
              loading={isPending}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {hasProtected && (
          <Alert type="error">
            You can&apos;t delete the SOA record or the NS record for the root
            domain of the hosted zone.
          </Alert>
        )}
        {error && (
          <Alert type="error" header="Couldn't delete the records">
            {error}
          </Alert>
        )}
        <Box variant="span">
          Are you sure you want to delete the following records?
        </Box>
        <Table
          variant="embedded"
          items={records}
          trackBy="id"
          columnDefinitions={[
            {
              id: "name",
              header: "Record name",
              cell: (record) => displayZoneName(record.name),
            },
            { id: "type", header: "Type", cell: (record) => record.type },
            {
              id: "value",
              header: "Value",
              cell: (record) =>
                record.is_alias
                  ? (record.alias_dns_name ?? "-")
                  : record.values.join(", "),
            },
          ]}
        />
      </SpaceBetween>
    </Modal>
  );
}

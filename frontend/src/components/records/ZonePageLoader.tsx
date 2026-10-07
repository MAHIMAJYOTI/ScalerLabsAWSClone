"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import StatusIndicator from "@cloudscape-design/components/status-indicator";

import { errorMessage } from "@/lib/api/client";
import { useHostedZone } from "@/lib/api/hooks/hostedZones";
import { useRecord } from "@/lib/api/hooks/records";
import type { HostedZoneDetail, RecordOut } from "@/lib/api/types";

function LoadingState({ title }: { title: string }) {
  return (
    <ContentLayout header={<Header variant="h1">{title}</Header>}>
      <Box padding={{ vertical: "xl" }} textAlign="center">
        <StatusIndicator type="loading">Loading</StatusIndicator>
      </Box>
    </ContentLayout>
  );
}

function ErrorState({ title, error }: { title: string; error: unknown }) {
  return (
    <ContentLayout header={<Header variant="h1">{title}</Header>}>
      <Alert type="error" header="Couldn't load the hosted zone">
        {errorMessage(error)}
      </Alert>
    </ContentLayout>
  );
}

/** Loads the zone, then renders children — shared by record/import pages. */
export function ZonePageLoader({
  zoneId,
  title,
  children,
}: {
  zoneId: string;
  title: string;
  children: (zone: HostedZoneDetail) => React.ReactNode;
}) {
  const { data: zone, error, isPending, refetch } = useHostedZone(zoneId);

  if (isPending) return <LoadingState title={title} />;
  if (error || !zone) {
    return (
      <ContentLayout header={<Header variant="h1">{title}</Header>}>
        <Alert
          type="error"
          header="Couldn't load the hosted zone"
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        >
          {errorMessage(error)}
        </Alert>
      </ContentLayout>
    );
  }
  return <>{children(zone)}</>;
}

/** Loads zone + record for the edit page. */
export function RecordPageLoader({
  zoneId,
  recordId,
  title,
  children,
}: {
  zoneId: string;
  recordId: string;
  title: string;
  children: (zone: HostedZoneDetail, record: RecordOut) => React.ReactNode;
}) {
  const zoneQuery = useHostedZone(zoneId);
  const recordQuery = useRecord(zoneId, recordId);

  if (zoneQuery.isPending || recordQuery.isPending) {
    return <LoadingState title={title} />;
  }
  if (zoneQuery.error || !zoneQuery.data) {
    return <ErrorState title={title} error={zoneQuery.error} />;
  }
  if (recordQuery.error || !recordQuery.data) {
    return (
      <ContentLayout header={<Header variant="h1">{title}</Header>}>
        <Alert type="error" header="Couldn't load the record">
          {errorMessage(recordQuery.error)}
        </Alert>
      </ContentLayout>
    );
  }
  return <>{children(zoneQuery.data, recordQuery.data)}</>;
}

"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import ContentLayout from "@cloudscape-design/components/content-layout";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Tabs from "@cloudscape-design/components/tabs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DeleteZoneModal } from "./DeleteZoneModal";
import { DnssecTab } from "./DnssecTab";
import { TagsTab } from "./TagsTab";
import { InfoLink } from "@/components/common/InfoLink";
import { RecordsTable } from "@/components/records/RecordsTable";
import { ApiError, errorMessage } from "@/lib/api/client";
import { useHostedZone } from "@/lib/api/hooks/hostedZones";
import { displayZoneName } from "@/lib/format";
import { useNotifications } from "@/providers/NotificationsProvider";

const LIST = "/route53/v2/hostedzones";

export function HostedZoneDetails({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const { data: zone, error, isPending, refetch } = useHostedZone(zoneId);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const name = zone ? displayZoneName(zone.name) : zoneId;

  useEffect(() => {
    if (zone) {
      document.title = `${displayZoneName(zone.name)} | Route 53 Clone`;
    }
  }, [zone]);

  if (isPending) {
    return (
      <ContentLayout header={<Header variant="h1">{zoneId}</Header>}>
        <Box padding={{ vertical: "xl" }} textAlign="center">
          <StatusIndicator type="loading">Loading hosted zone</StatusIndicator>
        </Box>
      </ContentLayout>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <ContentLayout
        header={<Header variant="h1">Hosted zone not found</Header>}
      >
        <Alert
          type="warning"
          header="Hosted zone not found"
          action={
            <Button onClick={() => router.push(LIST)}>
              Back to hosted zones
            </Button>
          }
        >
          The hosted zone {zoneId} doesn&apos;t exist or was deleted.
        </Alert>
      </ContentLayout>
    );
  }

  if (error || !zone) {
    return (
      <ContentLayout header={<Header variant="h1">{zoneId}</Header>}>
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

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          info={<InfoLink topic="zoneDetails" />}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <ButtonDropdown
                items={[
                  { id: "bind", text: "Export as BIND zone file" },
                  { id: "json", text: "Export as JSON" },
                ]}
                onItemClick={({ detail }) => {
                  // Same-origin download so the session cookie rides along.
                  const anchor = document.createElement("a");
                  anchor.href = `/api/v1/hostedzones/${zone.id}/export?format=${detail.id}`;
                  anchor.download = "";
                  document.body.appendChild(anchor);
                  anchor.click();
                  anchor.remove();
                }}
              >
                Export
              </ButtonDropdown>
              <Button onClick={() => setDeleteVisible(true)}>
                Delete zone
              </Button>
              <Button disabled>Test record</Button>
              <Button disabled>Configure query logging</Button>
            </SpaceBetween>
          }
        >
          {name}
        </Header>
      }
    >
      <SpaceBetween size="l">
        <ExpandableSection
          variant="container"
          headerText="Hosted zone details"
          headerActions={
            <Button
              onClick={() => router.push(`${LIST}/${zone.id}/edit`)}
            >
              Edit hosted zone
            </Button>
          }
        >
          <KeyValuePairs
            columns={3}
            items={[
              { label: "Hosted zone name", value: name },
              {
                label: "Hosted zone ID",
                value: (
                  <CopyToClipboard
                    variant="inline"
                    textToCopy={zone.id}
                    copySuccessText="Hosted zone ID copied"
                    copyErrorText="Hosted zone ID failed to copy"
                  />
                ),
              },
              { label: "Description", value: zone.comment || "-" },
              { label: "Query log", value: "-" },
              {
                label: "Type",
                value: zone.private_zone
                  ? "Private hosted zone"
                  : "Public hosted zone",
              },
              { label: "Record count", value: zone.record_count },
              {
                label: "Name servers",
                value:
                  zone.private_zone || zone.name_servers.length === 0 ? (
                    "-"
                  ) : (
                    <SpaceBetween size="xxs">
                      {zone.name_servers.map((nameServer) => (
                        <CopyToClipboard
                          key={nameServer}
                          variant="inline"
                          textToCopy={nameServer}
                          copySuccessText="Name server copied"
                          copyErrorText="Name server failed to copy"
                        />
                      ))}
                    </SpaceBetween>
                  ),
              },
              { label: "Created by", value: zone.created_by },
              ...(zone.private_zone
                ? [
                    {
                      label: "VPCs associated with the hosted zone",
                      value: (
                        <SpaceBetween size="xxs">
                          {zone.vpcs.map((vpc) => (
                            <Box variant="span" key={`${vpc.region}:${vpc.vpc_id}`}>
                              {vpc.vpc_id} ({vpc.region})
                            </Box>
                          ))}
                        </SpaceBetween>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </ExpandableSection>

        <Tabs
          tabs={[
            {
              id: "records",
              label: `Records (${zone.record_count})`,
              content: <RecordsTable zone={zone} />,
            },
            {
              id: "dnssec",
              label: "DNSSEC signing",
              content: <DnssecTab />,
            },
            {
              id: "tags",
              label: `Hosted zone tags (${zone.tags.length})`,
              content: <TagsTab tags={zone.tags} />,
            },
          ]}
        />
      </SpaceBetween>

      <DeleteZoneModal
        zone={zone}
        visible={deleteVisible}
        onDismiss={() => setDeleteVisible(false)}
        onDeleted={(zoneName) => {
          setDeleteVisible(false);
          notify({
            type: "success",
            content: `Hosted zone ${zoneName} was deleted.`,
          });
          router.push(LIST);
        }}
      />
    </ContentLayout>
  );
}

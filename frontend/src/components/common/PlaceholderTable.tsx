"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";

export interface PlaceholderPageConfig {
  /** Page title, e.g. "Health checks". */
  title: string;
  /** Lowercase plural noun for the empty state, e.g. "health checks". */
  noun: string;
  /** Primary action label, e.g. "Create health check". */
  createLabel: string;
  columns: string[];
}

export const PLACEHOLDER_PAGES = {
  healthchecks: {
    title: "Health checks",
    noun: "health checks",
    createLabel: "Create health check",
    columns: ["Name", "Status", "Description", "Alarms", "ID"],
  },
  trafficpolicies: {
    title: "Traffic policies",
    noun: "traffic policies",
    createLabel: "Create traffic policy",
    columns: ["Policy name", "Latest version", "Version count", "Description"],
  },
  policyrecords: {
    title: "Policy records",
    noun: "policy records",
    createLabel: "Create policy record",
    columns: [
      "DNS name",
      "Status",
      "Traffic policy",
      "Version",
      "Hosted zone ID",
      "TTL",
    ],
  },
  profiles: {
    title: "Profiles",
    noun: "profiles",
    createLabel: "Create profile",
    columns: ["Name", "Profile ID", "Status", "Shared by", "Created"],
  },
  cidrcollections: {
    title: "CIDR collections",
    noun: "CIDR collections",
    createLabel: "Create CIDR collection",
    columns: ["Collection name", "Collection ID", "Version"],
  },
  domains: {
    title: "Registered domains",
    noun: "registered domains",
    createLabel: "Register domain",
    columns: ["Domain name", "Expiration date", "Auto-renew", "Transfer lock"],
  },
  requests: {
    title: "Requests",
    noun: "requests",
    createLabel: "Create request",
    columns: ["Domain name", "Operation", "Status", "Submitted date"],
  },
  resolverVpcs: {
    title: "VPCs",
    noun: "VPCs",
    createLabel: "Create VPC association",
    columns: ["VPC ID", "Region", "Resolver DNSSEC validation", "Name"],
  },
  resolverInbound: {
    title: "Inbound endpoints",
    noun: "inbound endpoints",
    createLabel: "Create inbound endpoint",
    columns: [
      "Name",
      "ID",
      "Status",
      "VPC",
      "Security group IDs",
      "IP addresses",
    ],
  },
  resolverOutbound: {
    title: "Outbound endpoints",
    noun: "outbound endpoints",
    createLabel: "Create outbound endpoint",
    columns: [
      "Name",
      "ID",
      "Status",
      "VPC",
      "Security group IDs",
      "IP addresses",
    ],
  },
  resolverRules: {
    title: "Rules",
    noun: "rules",
    createLabel: "Create rule",
    columns: ["Name", "ID", "Type", "Domain name", "Status", "Outbound endpoint"],
  },
  resolverQueryLogging: {
    title: "Query logging",
    noun: "query logging configurations",
    createLabel: "Configure query logging",
    columns: ["Name", "Destination type", "Destination", "Status", "VPCs"],
  },
  firewallRuleGroups: {
    title: "Rule groups",
    noun: "rule groups",
    createLabel: "Create rule group",
    columns: ["Name", "ID", "Rules", "Association count", "Status"],
  },
  firewallDomainLists: {
    title: "Domain lists",
    noun: "domain lists",
    createLabel: "Create domain list",
    columns: ["Name", "ID", "Domain count", "Status"],
  },
} satisfies Record<string, PlaceholderPageConfig>;

export type PlaceholderPageId = keyof typeof PLACEHOLDER_PAGES;

/** Console-like empty table for sections that aren't part of this demo. */
export function PlaceholderTable({ page }: { page: PlaceholderPageId }) {
  const config = PLACEHOLDER_PAGES[page];
  return (
    <SpaceBetween size="m">
      <Alert type="info">
        This section is a placeholder in this demo. Hosted zones and records
        are fully functional.
      </Alert>
      <Table<Record<string, never>>
        variant="full-page"
        items={[]}
        columnDefinitions={config.columns.map((column) => ({
          id: column,
          header: column,
          cell: () => "-",
        }))}
        header={
          <Header
            variant="awsui-h1-sticky"
            counter="(0)"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel={`Refresh ${config.noun}`}
                />
                <Button
                  variant="primary"
                  disabled
                  disabledReason="Not available in this demo"
                >
                  {config.createLabel}
                </Button>
              </SpaceBetween>
            }
          >
            {config.title}
          </Header>
        }
        empty={
          <Box textAlign="center" color="inherit">
            <Box variant="strong" textAlign="center" color="inherit">
              No {config.noun}
            </Box>
            <Box variant="p" color="inherit">
              You don&apos;t have any {config.noun}.
            </Box>
          </Box>
        }
      />
    </SpaceBetween>
  );
}

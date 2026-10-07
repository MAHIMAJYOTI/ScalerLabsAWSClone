"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";

import type { RecordOut } from "@/lib/api/types";
import { displayZoneName, routingPolicyLabel } from "@/lib/format";

interface RecordDetailsPanelProps {
  record: RecordOut;
  onEdit: () => void;
  onDelete: () => void;
}

function geoLabel(record: RecordOut): string {
  const parts = [
    record.geo_continent && `Continent: ${record.geo_continent}`,
    record.geo_country && `Country: ${record.geo_country}`,
    record.geo_subdivision && `Subdivision: ${record.geo_subdivision}`,
  ].filter(Boolean);
  return parts.join(", ");
}

export function RecordDetailsPanel({
  record,
  onEdit,
  onDelete,
}: RecordDetailsPanelProps) {
  const items = [
    { label: "Record name", value: displayZoneName(record.name) },
    { label: "Record type", value: record.type },
    {
      label: "Value",
      value: record.is_alias ? (
        (record.alias_dns_name ?? "-")
      ) : (
        <SpaceBetween size="xxs">
          {record.values.map((value, index) => (
            <Box variant="code" key={`${index}-${value}`}>
              {value}
            </Box>
          ))}
        </SpaceBetween>
      ),
    },
    { label: "Alias", value: record.is_alias ? "Yes" : "No" },
    {
      label: "TTL (seconds)",
      value: record.ttl === null ? "-" : String(record.ttl),
    },
    {
      label: "Routing policy",
      value: routingPolicyLabel(record.routing_policy),
    },
  ];

  if (record.routing_policy === "WEIGHTED") {
    items.push({ label: "Weight", value: String(record.weight ?? "-") });
  } else if (record.routing_policy === "LATENCY") {
    items.push({ label: "Region", value: record.region ?? "-" });
  } else if (record.routing_policy === "FAILOVER") {
    items.push({
      label: "Failover record type",
      value: record.failover ?? "-",
    });
  } else if (record.routing_policy === "GEOLOCATION") {
    items.push({ label: "Location", value: geoLabel(record) || "-" });
  }

  items.push(
    { label: "Record ID", value: record.set_identifier ?? "-" },
    { label: "Health check ID", value: record.health_check_id ?? "-" },
    {
      label: "Evaluate target health",
      value: record.is_alias
        ? record.alias_evaluate_target_health
          ? "Yes"
          : "No"
        : "-",
    },
  );

  return (
    <SpaceBetween size="m">
      <Header
        variant="h3"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={onEdit}>Edit record</Button>
            <Button onClick={onDelete}>Delete record</Button>
          </SpaceBetween>
        }
      >
        {displayZoneName(record.name)}
      </Header>
      <KeyValuePairs columns={3} items={items} />
    </SpaceBetween>
  );
}

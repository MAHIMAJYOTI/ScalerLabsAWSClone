"use client";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import StatusIndicator from "@cloudscape-design/components/status-indicator";

export function DnssecTab() {
  return (
    <Container
      header={
        <Header
          variant="h2"
          actions={<Button disabled>Enable DNSSEC signing</Button>}
        >
          DNSSEC signing
        </Header>
      }
    >
      <KeyValuePairs
        columns={1}
        items={[
          {
            label: "DNSSEC signing status",
            value: <StatusIndicator type="stopped">Not signing</StatusIndicator>,
          },
        ]}
      />
    </Container>
  );
}

"use client";

import { createContext, useContext } from "react";

export interface HelpTopic {
  header: string;
  content: React.ReactNode;
}

export const HELP_TOPICS = {
  hostedZones: {
    header: "Hosted zones",
    content: (
      <div>
        <p>
          A hosted zone is a container for records, which include information
          about how you want to route traffic for a domain (such as example.com)
          and all of its subdomains.
        </p>
        <p>
          A hosted zone has the same name as the corresponding domain. Route 53
          allows multiple hosted zones with the same name — use the description
          to tell them apart.
        </p>
      </div>
    ),
  },
  createZone: {
    header: "Create hosted zone",
    content: (
      <div>
        <p>
          When you create a hosted zone, Route 53 automatically creates a name
          server (NS) record and a start of authority (SOA) record for the zone.
        </p>
        <p>
          A public hosted zone routes internet traffic. A private hosted zone
          routes traffic within one or more Amazon VPCs that you associate with
          the zone.
        </p>
      </div>
    ),
  },
  zoneDetails: {
    header: "Hosted zone details",
    content: (
      <div>
        <p>
          Use the four name servers in the delegation set to configure your
          domain registrar so that DNS queries for your domain are routed to
          Route 53.
        </p>
        <p>
          The default NS and SOA records can&apos;t be deleted; a hosted zone
          must be empty except for those records before you can delete it.
        </p>
      </div>
    ),
  },
  records: {
    header: "Records",
    content: (
      <div>
        <p>
          Records contain the information about how you want to route traffic
          for a domain or subdomain. The name of each record in a hosted zone
          must end with the name of the hosted zone.
        </p>
        <p>
          Route 53 responds to DNS queries using the record values; alias
          records instead route traffic to selected AWS resources.
        </p>
      </div>
    ),
  },
  createRecord: {
    header: "Create record",
    content: (
      <div>
        <p>
          Choose a routing policy to determine how Route 53 responds to
          queries. Simple routing returns the values in the record; other
          policies (weighted, latency, failover, geolocation) choose among
          multiple records with the same name and type using a record ID.
        </p>
        <p>
          Use &quot;Add another record&quot; to create several records in one
          atomic request — if any record is invalid, none are created.
        </p>
      </div>
    ),
  },
  importZone: {
    header: "Import zone file",
    content: (
      <div>
        <p>
          Paste a BIND-format zone file to create up to 1,000 records at once.
          Route 53 ignores the SOA record and the NS records for the root
          domain; unsupported record types are skipped and reported.
        </p>
      </div>
    ),
  },
} satisfies Record<string, HelpTopic>;

export type HelpTopicId = keyof typeof HELP_TOPICS;

interface HelpContextValue {
  openHelp: (topic: HelpTopicId) => void;
}

export const HelpContext = createContext<HelpContextValue | null>(null);

export function useHelp(): HelpContextValue {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error("useHelp must be used within the ConsoleShell");
  }
  return context;
}

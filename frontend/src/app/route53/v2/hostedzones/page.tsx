import type { Metadata } from "next";

import { HostedZonesTable } from "@/components/hosted-zones/HostedZonesTable";

export const metadata: Metadata = { title: "Hosted zones" };

export default function HostedZonesPage() {
  return <HostedZonesTable />;
}

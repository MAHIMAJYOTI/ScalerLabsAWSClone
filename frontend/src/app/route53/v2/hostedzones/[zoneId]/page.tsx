import type { Metadata } from "next";

import { HostedZoneDetails } from "@/components/hosted-zones/HostedZoneDetails";

export const metadata: Metadata = { title: "Hosted zone details" };

export default async function HostedZoneDetailsPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  return <HostedZoneDetails zoneId={zoneId} />;
}

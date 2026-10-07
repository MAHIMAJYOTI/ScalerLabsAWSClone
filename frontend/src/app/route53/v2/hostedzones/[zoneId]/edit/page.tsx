import type { Metadata } from "next";

import { EditHostedZoneForm } from "@/components/hosted-zones/EditHostedZoneForm";

export const metadata: Metadata = { title: "Edit hosted zone" };

export default async function EditHostedZonePage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  return <EditHostedZoneForm zoneId={zoneId} />;
}

import type { Metadata } from "next";

import { ImportZonePage } from "@/components/records/pages";

export const metadata: Metadata = { title: "Import zone file" };

export default async function Page({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  return <ImportZonePage zoneId={zoneId} />;
}

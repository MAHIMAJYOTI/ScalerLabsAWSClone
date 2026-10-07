import type { Metadata } from "next";

import { CreateRecordPage } from "@/components/records/pages";

export const metadata: Metadata = { title: "Create record" };

export default async function Page({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  return <CreateRecordPage zoneId={zoneId} />;
}

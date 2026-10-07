import type { Metadata } from "next";

import { EditRecordPage } from "@/components/records/pages";

export const metadata: Metadata = { title: "Edit record" };

export default async function Page({
  params,
}: {
  params: Promise<{ zoneId: string; recordId: string }>;
}) {
  const { zoneId, recordId } = await params;
  return <EditRecordPage zoneId={zoneId} recordId={recordId} />;
}

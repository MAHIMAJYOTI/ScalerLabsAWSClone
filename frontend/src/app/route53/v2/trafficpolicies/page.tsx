import type { Metadata } from "next";

import { PlaceholderTable } from "@/components/common/PlaceholderTable";

export const metadata: Metadata = { title: "Traffic policies" };

export default function Page() {
  return <PlaceholderTable page="trafficpolicies" />;
}

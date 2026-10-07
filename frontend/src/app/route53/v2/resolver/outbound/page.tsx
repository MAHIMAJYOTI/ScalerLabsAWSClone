import type { Metadata } from "next";

import { PlaceholderTable } from "@/components/common/PlaceholderTable";

export const metadata: Metadata = { title: "Outbound endpoints" };

export default function Page() {
  return <PlaceholderTable page="resolverOutbound" />;
}

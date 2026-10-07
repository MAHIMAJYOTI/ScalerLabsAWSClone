import type { Metadata } from "next";

import { PlaceholderTable } from "@/components/common/PlaceholderTable";

export const metadata: Metadata = { title: "Requests" };

export default function Page() {
  return <PlaceholderTable page="requests" />;
}

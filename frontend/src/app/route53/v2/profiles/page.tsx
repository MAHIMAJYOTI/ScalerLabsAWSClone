import type { Metadata } from "next";

import { PlaceholderTable } from "@/components/common/PlaceholderTable";

export const metadata: Metadata = { title: "Profiles" };

export default function Page() {
  return <PlaceholderTable page="profiles" />;
}

import type { Metadata } from "next";

import { PlaceholderTable } from "@/components/common/PlaceholderTable";

export const metadata: Metadata = { title: "Health checks" };

export default function Page() {
  return <PlaceholderTable page="healthchecks" />;
}

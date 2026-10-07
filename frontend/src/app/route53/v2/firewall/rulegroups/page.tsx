import type { Metadata } from "next";

import { PlaceholderTable } from "@/components/common/PlaceholderTable";

export const metadata: Metadata = { title: "Rule groups" };

export default function Page() {
  return <PlaceholderTable page="firewallRuleGroups" />;
}

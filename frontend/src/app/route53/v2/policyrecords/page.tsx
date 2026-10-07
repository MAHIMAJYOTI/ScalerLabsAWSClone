import type { Metadata } from "next";

import { PlaceholderTable } from "@/components/common/PlaceholderTable";

export const metadata: Metadata = { title: "Policy records" };

export default function Page() {
  return <PlaceholderTable page="policyrecords" />;
}

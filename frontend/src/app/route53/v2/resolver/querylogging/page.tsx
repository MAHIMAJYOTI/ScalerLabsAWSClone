import type { Metadata } from "next";

import { PlaceholderTable } from "@/components/common/PlaceholderTable";

export const metadata: Metadata = { title: "Query logging" };

export default function Page() {
  return <PlaceholderTable page="resolverQueryLogging" />;
}

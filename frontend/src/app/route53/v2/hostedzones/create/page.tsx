import type { Metadata } from "next";

import { CreateHostedZoneForm } from "@/components/hosted-zones/CreateHostedZoneForm";

export const metadata: Metadata = { title: "Create hosted zone" };

export default function CreateHostedZonePage() {
  return <CreateHostedZoneForm />;
}

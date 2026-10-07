"use client";

import Link from "@cloudscape-design/components/link";

import { useHelp, type HelpTopicId } from "@/components/shell/help";

export function InfoLink({ topic }: { topic: HelpTopicId }) {
  const { openHelp } = useHelp();
  return (
    <Link
      variant="info"
      onFollow={(event) => {
        event.preventDefault();
        openHelp(topic);
      }}
    >
      Info
    </Link>
  );
}

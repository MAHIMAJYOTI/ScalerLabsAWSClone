"use client";

import Box from "@cloudscape-design/components/box";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";

import type { TagIn } from "@/lib/api/types";

export function TagsTab({ tags }: { tags: TagIn[] }) {
  return (
    <Table
      variant="container"
      items={tags}
      trackBy="key"
      columnDefinitions={[
        { id: "key", header: "Key", cell: (tag) => tag.key },
        { id: "value", header: "Value", cell: (tag) => tag.value || "-" },
      ]}
      header={
        <Header variant="h2" counter={`(${tags.length})`}>
          Tags
        </Header>
      }
      empty={
        <Box textAlign="center" color="inherit">
          <Box variant="strong" textAlign="center" color="inherit">
            No tags
          </Box>
          <Box variant="p" color="inherit">
            No tags associated with the hosted zone.
          </Box>
        </Box>
      }
    />
  );
}

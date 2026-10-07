"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useRouter } from "next/navigation";

import { useHostedZones } from "@/lib/api/hooks/hostedZones";

const ZONES_PAGE = "/route53/v2/hostedzones";

export function Dashboard() {
  const router = useRouter();
  // Only the total is needed — fetch the smallest possible page.
  const { data, isPending } = useHostedZones({
    page: 1,
    pageSize: 1,
    sortBy: "name",
    sortOrder: "asc",
  });

  return (
    <ContentLayout header={<Header variant="h1">Route 53 Dashboard</Header>}>
      <ColumnLayout columns={4} minColumnWidth={220}>
        <Container header={<Header variant="h2">DNS management</Header>}>
          <SpaceBetween size="s">
            <div>
              <Box variant="awsui-key-label">Hosted zones</Box>
              {isPending ? (
                <Spinner />
              ) : (
                <Link
                  fontSize="display-l"
                  href={ZONES_PAGE}
                  onFollow={(event) => {
                    event.preventDefault();
                    router.push(ZONES_PAGE);
                  }}
                >
                  {data?.total ?? 0}
                </Link>
              )}
            </div>
            <Button
              variant="primary"
              onClick={() => router.push(`${ZONES_PAGE}/create`)}
            >
              Create hosted zone
            </Button>
          </SpaceBetween>
        </Container>
        <Container header={<Header variant="h2">Traffic management</Header>}>
          <Box variant="awsui-key-label">Traffic policies</Box>
          <Box variant="awsui-value-large">0</Box>
        </Container>
        <Container
          header={<Header variant="h2">Availability monitoring</Header>}
        >
          <Box variant="awsui-key-label">Health checks</Box>
          <Box variant="awsui-value-large">0</Box>
        </Container>
        <Container header={<Header variant="h2">Domain registration</Header>}>
          <Box variant="awsui-key-label">Registered domains</Box>
          <Box variant="awsui-value-large">0</Box>
        </Container>
      </ColumnLayout>
    </ContentLayout>
  );
}

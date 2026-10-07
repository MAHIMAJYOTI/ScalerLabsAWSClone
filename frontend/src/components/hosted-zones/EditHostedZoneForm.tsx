"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Textarea from "@cloudscape-design/components/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorMessage } from "@/lib/api/client";
import {
  useHostedZone,
  useUpdateHostedZone,
} from "@/lib/api/hooks/hostedZones";
import { displayZoneName } from "@/lib/format";
import { useNotifications } from "@/providers/NotificationsProvider";

const LIST = "/route53/v2/hostedzones";

export function EditHostedZoneForm({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const { data: zone, error, isPending, refetch } = useHostedZone(zoneId);
  const updateZone = useUpdateHostedZone();
  // null = untouched → falls back to the zone's current comment.
  const [comment, setComment] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (isPending) {
    return (
      <ContentLayout header={<Header variant="h1">Edit hosted zone</Header>}>
        <Box padding={{ vertical: "xl" }} textAlign="center">
          <StatusIndicator type="loading">Loading hosted zone</StatusIndicator>
        </Box>
      </ContentLayout>
    );
  }

  if (error || !zone) {
    return (
      <ContentLayout header={<Header variant="h1">Edit hosted zone</Header>}>
        <Alert
          type="error"
          header="Couldn't load the hosted zone"
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        >
          {errorMessage(error)}
        </Alert>
      </ContentLayout>
    );
  }

  const name = displayZoneName(zone.name);
  const value = comment ?? zone.comment ?? "";
  const tooLong = value.length > 256;
  const detailsPage = `${LIST}/${zone.id}`;

  const submit = () => {
    if (tooLong) return;
    setFormError(null);
    updateZone.mutate(
      { zoneId: zone.id, comment: value.trim() ? value.trim() : null },
      {
        onSuccess: () => {
          notify({
            type: "success",
            content: `Hosted zone ${name} was updated.`,
          });
          router.push(detailsPage);
        },
        onError: (err) => setFormError(errorMessage(err)),
      },
    );
  };

  return (
    <ContentLayout header={<Header variant="h1">Edit hosted zone</Header>}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Form
          errorText={formError}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                formAction="none"
                onClick={() => router.push(detailsPage)}
              >
                Cancel
              </Button>
              <Button variant="primary" loading={updateZone.isPending}>
                Save changes
              </Button>
            </SpaceBetween>
          }
        >
          <Container
            header={
              <Header variant="h2">Hosted zone configuration</Header>
            }
          >
            <SpaceBetween size="l">
              <FormField
                label="Domain name"
                description="The domain name can't be changed after the hosted zone is created."
                stretch
              >
                <Input value={name} disabled />
              </FormField>
              <FormField
                label="Type"
                description="The type can't be changed after the hosted zone is created."
                stretch
              >
                <Input
                  value={
                    zone.private_zone
                      ? "Private hosted zone"
                      : "Public hosted zone"
                  }
                  disabled
                />
              </FormField>
              <FormField
                label={
                  <span>
                    Description - <i>optional</i>
                  </span>
                }
                description="This value lets you distinguish hosted zones that have the same name."
                constraintText={`The description can have up to 256 characters. ${value.length}/256`}
                errorText={
                  tooLong
                    ? "The description can have up to 256 characters."
                    : undefined
                }
                stretch
              >
                <Textarea
                  value={value}
                  rows={3}
                  placeholder="The hosted zone is used for..."
                  onChange={({ detail }) => setComment(detail.value)}
                />
              </FormField>
            </SpaceBetween>
          </Container>
        </Form>
      </form>
    </ContentLayout>
  );
}

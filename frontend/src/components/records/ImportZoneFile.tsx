"use client";

import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ViewStatusAction } from "./ViewStatusAction";
import { InfoLink } from "@/components/common/InfoLink";
import { ApiError } from "@/lib/api/client";
import { useImportZoneFile } from "@/lib/api/hooks/records";
import type { ApiErrorDetail, HostedZoneDetail } from "@/lib/api/types";
import { displayZoneName } from "@/lib/format";
import { useNotifications } from "@/providers/NotificationsProvider";

function sampleZoneFile(zoneName: string): string {
  const origin = zoneName.endsWith(".") ? zoneName : `${zoneName}.`;
  return `$ORIGIN ${origin}
$TTL 300
; Sample zone file — Route 53 ignores the SOA and root NS records.
app            300 IN A     192.0.2.10
app            300 IN A     192.0.2.11
ipv6           300 IN AAAA  2001:db8::15
web            300 IN CNAME app.${origin}
@             3600 IN MX    10 mail.${origin}
@              300 IN TXT   "v=spf1 -all"
_sip._tcp      300 IN SRV   10 5 5060 sip.${origin}
@              300 IN CAA   0 issue "letsencrypt.org"
`;
}

export function ImportZoneFile({ zone }: { zone: HostedZoneDetail }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const importZone = useImportZoneFile(zone.id);
  const [zoneFile, setZoneFile] = useState("");
  const [error, setError] = useState<ApiError | null>(null);

  const zonePage = `/route53/v2/hostedzones/${zone.id}`;

  const submit = () => {
    setError(null);
    importZone.mutate(zoneFile, {
      onSuccess: (response) => {
        notify({
          type: "success",
          content: `Imported ${response.created} records. Skipped ${response.skipped.length}.`,
          action: <ViewStatusAction changeId={response.change.id} />,
        });
        router.push(zonePage);
      },
      onError: (err) => {
        setError(
          err instanceof ApiError
            ? err
            : new ApiError("UnknownError", "Import failed. Try again.", 500),
        );
      },
    });
  };

  const renderErrorDetails = (details: ApiErrorDetail[]) => {
    if (error?.code === "InvalidZoneFile") {
      return (
        <ul>
          {details.map((detail, index) => (
            <li key={index}>
              Line {detail.line ?? 0}: {detail.message}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul>
        {details.map((detail, index) => (
          <li key={index}>
            {detail.name ? `${detail.name} ${detail.type ?? ""}: ` : ""}
            {detail.message}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={<InfoLink topic="importZone" />}>
          Import zone file
        </Header>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                formAction="none"
                onClick={() => router.push(zonePage)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={importZone.isPending}
                disabled={!zoneFile.trim()}
              >
                Import
              </Button>
            </SpaceBetween>
          }
        >
          <Container
            header={
              <Header
                variant="h2"
                actions={
                  <Link
                    onFollow={(event) => {
                      event.preventDefault();
                      setZoneFile(sampleZoneFile(zone.name));
                    }}
                  >
                    Load sample
                  </Link>
                }
              >
                Zone file
              </Header>
            }
          >
            <SpaceBetween size="m">
              {error && (
                <Alert
                  type="error"
                  header={
                    error.code === "InvalidZoneFile"
                      ? "The zone file is invalid"
                      : "The records couldn't be created"
                  }
                >
                  {error.details.length > 0
                    ? renderErrorDetails(error.details)
                    : error.message}
                </Alert>
              )}
              <FormField
                label="Zone file"
                description={`Paste the contents of a zone file in BIND format. Route 53 ignores the SOA record and the NS records for the root domain. Importing into ${displayZoneName(zone.name)}.`}
                stretch
              >
                <div className="r53-mono">
                  <Textarea
                    value={zoneFile}
                    rows={20}
                    spellcheck={false}
                    placeholder={`$ORIGIN ${zone.name}\n$TTL 300\nwww 300 IN A 192.0.2.1`}
                    onChange={({ detail }) => setZoneFile(detail.value)}
                    ariaLabel="Zone file"
                  />
                </div>
              </FormField>
            </SpaceBetween>
          </Container>
        </Form>
      </form>
    </ContentLayout>
  );
}

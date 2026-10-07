"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from "react-hook-form";

import { ViewStatusAction } from "./ViewStatusAction";
import { InfoLink } from "@/components/common/InfoLink";
import { ApiError } from "@/lib/api/client";
import { useCreateRecords, useUpdateRecord } from "@/lib/api/hooks/records";
import type {
  HostedZoneDetail,
  RecordCreatePayload,
  RecordOut,
  RecordUpdatePayload,
} from "@/lib/api/types";
import {
  ALIAS_TARGET_OPTIONS,
  ALB_HOSTED_ZONE_IDS,
  CLOUDFRONT_HOSTED_ZONE_ID,
  ALIAS_REGION_OPTIONS,
  S3_WEBSITE_HOSTED_ZONE_IDS,
  aliasHostedZoneId,
  aliasTargetNeedsRegion,
  type AliasTargetKind,
} from "@/lib/aliasTargets";
import { displayZoneName, relativeRecordName } from "@/lib/format";
import { AWS_REGIONS } from "@/lib/regions";
import {
  DEFAULT_TTL,
  GEO_LOCATION_OPTIONS,
  RECORD_TYPE_OPTIONS,
  ROUTING_POLICY_OPTIONS,
  VALUE_PLACEHOLDERS,
  emptyRecordBlock,
  recordsFormSchema,
  splitValueLines,
  type RecordBlockValues,
  type RecordsFormValues,
} from "@/lib/validation/record";
import { useNotifications } from "@/providers/NotificationsProvider";

const NAME_CONSTRAINT =
  "Valid characters: a-z, 0-9, ! \" # $ % & ' ( ) * + , - / : ; < = > ? @ [ \\ ] ^ _ ` { | } . ~";

const PROPAGATION_MESSAGE =
  "Route 53 propagates your changes to all of the Route 53 authoritative DNS servers within 60 seconds. Use the View status button to check propagation status.";

const RECORD_ID_HELPERS: Record<string, string> = {
  WEIGHTED:
    "Enter a value that uniquely identifies this record in the group of weighted records.",
  LATENCY:
    "Enter a value that uniquely identifies this record in the group of latency records.",
  FAILOVER:
    "Enter a value that uniquely identifies this record in the group of failover records.",
  GEOLOCATION:
    "Enter a value that uniquely identifies this record in the group of geolocation records.",
  MULTIVALUE:
    "Enter a value that uniquely identifies this record in the group of multivalue answer records.",
  IP_BASED:
    "Enter a value that uniquely identifies this record in the group of IP-based records.",
};

function blockToPayload(
  block: RecordBlockValues,
  zone: HostedZoneDetail,
): RecordCreatePayload {
  const payload: RecordCreatePayload = {
    name: block.name.trim() === "@" ? "" : block.name.trim(),
    type: block.type,
    routing_policy: block.routingPolicy,
  };
  if (block.routingPolicy !== "SIMPLE") {
    payload.set_identifier = block.setIdentifier.trim();
    if (block.routingPolicy === "WEIGHTED") {
      payload.weight = Number(block.weight);
    } else if (block.routingPolicy === "LATENCY") {
      payload.region = block.latencyRegion;
    } else if (block.routingPolicy === "FAILOVER") {
      payload.failover = block.failover;
    } else if (block.routingPolicy === "GEOLOCATION") {
      const [kind, code] = block.geoLocation.split(":");
      if (kind === "continent") payload.geo_continent = code;
      else payload.geo_country = code;
    }
    if (block.healthCheckId.trim()) {
      payload.health_check_id = block.healthCheckId.trim();
    }
  }
  if (block.alias) {
    payload.is_alias = true;
    payload.alias_dns_name = block.aliasEndpoint.trim();
    payload.alias_hosted_zone_id = aliasHostedZoneId(
      block.aliasTarget,
      block.aliasRegion,
      zone.id,
    );
    payload.alias_evaluate_target_health = block.evaluateTargetHealth;
  } else {
    payload.ttl = Number(block.ttl);
    payload.values = splitValueLines(block.values);
  }
  return payload;
}

function guessAliasTarget(
  record: RecordOut,
  zone: HostedZoneDetail,
): { target: AliasTargetKind; region: string } {
  const hz = record.alias_hosted_zone_id ?? "";
  if (hz === CLOUDFRONT_HOSTED_ZONE_ID) return { target: "cloudfront", region: "" };
  if (hz === zone.id) return { target: "record", region: "" };
  for (const [region, id] of Object.entries(ALB_HOSTED_ZONE_IDS)) {
    if (id === hz) return { target: "alb", region };
  }
  for (const [region, id] of Object.entries(S3_WEBSITE_HOSTED_ZONE_IDS)) {
    if (id === hz) return { target: "s3", region };
  }
  return { target: "record", region: "" };
}

function recordToBlock(
  record: RecordOut,
  zone: HostedZoneDetail,
): RecordBlockValues {
  const { target, region } = guessAliasTarget(record, zone);
  return {
    name: relativeRecordName(record.name, zone.name),
    type: record.type as RecordBlockValues["type"],
    alias: record.is_alias,
    values: record.values.join("\n"),
    ttl: String(record.ttl ?? DEFAULT_TTL),
    routingPolicy: record.routing_policy as RecordBlockValues["routingPolicy"],
    setIdentifier: record.set_identifier ?? "",
    weight: record.weight === null ? "" : String(record.weight),
    latencyRegion: record.region ?? "",
    failover: record.failover ?? "",
    geoLocation: record.geo_continent
      ? `continent:${record.geo_continent}`
      : record.geo_country
        ? `country:${record.geo_country}`
        : "",
    healthCheckId: record.health_check_id ?? "",
    aliasTarget: target,
    aliasRegion: region,
    aliasEndpoint: record.alias_dns_name ?? "",
    evaluateTargetHealth: record.alias_evaluate_target_health,
  };
}

interface BlockFieldsProps {
  index: number;
  control: Control<RecordsFormValues>;
  setValue: UseFormSetValue<RecordsFormValues>;
  zone: HostedZoneDetail;
  mode: "create" | "edit";
}

function RecordBlockFields({
  index,
  control,
  setValue,
  zone,
  mode,
}: BlockFieldsProps) {
  const block = useWatch({ control, name: `records.${index}` });
  const zoneSuffix = `.${displayZoneName(zone.name)}`;
  const aliasCapable = ["A", "AAAA", "CNAME"].includes(block.type);
  const isEdit = mode === "edit";

  return (
    <SpaceBetween size="l">
      <SpaceBetween size="l" direction="horizontal">
        <Controller
          name={`records.${index}.name`}
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              label="Record name"
              description="Keep blank to create a record for the root domain."
              constraintText={NAME_CONSTRAINT}
              errorText={fieldState.error?.message}
            >
              <div className="r53-name-suffix">
                <Input
                  value={field.value}
                  placeholder="subdomain"
                  disabled={isEdit}
                  onChange={({ detail }) => field.onChange(detail.value)}
                  onBlur={field.onBlur}
                  ariaLabel="Record name"
                />
                <span className="r53-name-suffix-label">
                  <Box variant="span" color="text-body-secondary">
                    {zoneSuffix}
                  </Box>
                </span>
              </div>
            </FormField>
          )}
        />
        <Controller
          name={`records.${index}.type`}
          control={control}
          render={({ field, fieldState }) => (
            <FormField label="Record type" errorText={fieldState.error?.message}>
              {isEdit ? (
                <Input value={field.value} disabled ariaLabel="Record type" />
              ) : (
                <Select
                  options={[...RECORD_TYPE_OPTIONS]}
                  selectedOption={
                    RECORD_TYPE_OPTIONS.find(
                      (option) => option.value === field.value,
                    ) ?? null
                  }
                  triggerVariant="option"
                  onChange={({ detail }) => {
                    field.onChange(detail.selectedOption.value);
                    if (
                      !["A", "AAAA", "CNAME"].includes(
                        detail.selectedOption.value ?? "",
                      )
                    ) {
                      setValue(`records.${index}.alias`, false);
                    }
                  }}
                  ariaLabel="Record type"
                />
              )}
            </FormField>
          )}
        />
      </SpaceBetween>

      {aliasCapable && (
        <Controller
          name={`records.${index}.alias`}
          control={control}
          render={({ field, fieldState }) => (
            <FormField errorText={fieldState.error?.message}>
              <Toggle
                checked={field.value}
                onChange={({ detail }) => field.onChange(detail.checked)}
              >
                Alias
              </Toggle>
            </FormField>
          )}
        />
      )}

      {block.alias ? (
        <SpaceBetween size="l">
          <Controller
            name={`records.${index}.aliasTarget`}
            control={control}
            render={({ field }) => (
              <FormField label="Route traffic to" stretch>
                <Select
                  options={ALIAS_TARGET_OPTIONS}
                  selectedOption={
                    ALIAS_TARGET_OPTIONS.find(
                      (option) => option.value === field.value,
                    ) ?? null
                  }
                  onChange={({ detail }) =>
                    field.onChange(detail.selectedOption.value)
                  }
                  ariaLabel="Route traffic to"
                />
              </FormField>
            )}
          />
          {aliasTargetNeedsRegion(block.aliasTarget) && (
            <Controller
              name={`records.${index}.aliasRegion`}
              control={control}
              render={({ field, fieldState }) => (
                <FormField label="Region" errorText={fieldState.error?.message}>
                  <Select
                    options={ALIAS_REGION_OPTIONS}
                    placeholder="Choose a Region"
                    selectedOption={
                      ALIAS_REGION_OPTIONS.find(
                        (option) => option.value === field.value,
                      ) ?? null
                    }
                    onChange={({ detail }) =>
                      field.onChange(detail.selectedOption.value)
                    }
                    ariaLabel="Alias Region"
                  />
                </FormField>
              )}
            />
          )}
          <Controller
            name={`records.${index}.aliasEndpoint`}
            control={control}
            render={({ field, fieldState }) => (
              <FormField
                label="Endpoint"
                description="The domain name of the resource to route traffic to."
                errorText={fieldState.error?.message}
                stretch
              >
                <Input
                  value={field.value}
                  placeholder="d111111abcdef8.cloudfront.net"
                  onChange={({ detail }) => field.onChange(detail.value)}
                  onBlur={field.onBlur}
                  ariaLabel="Alias endpoint"
                />
              </FormField>
            )}
          />
          <Controller
            name={`records.${index}.evaluateTargetHealth`}
            control={control}
            render={({ field }) => (
              <Toggle
                checked={field.value}
                onChange={({ detail }) => field.onChange(detail.checked)}
              >
                Evaluate target health
              </Toggle>
            )}
          />
        </SpaceBetween>
      ) : (
        <SpaceBetween size="l">
          <Controller
            name={`records.${index}.values`}
            control={control}
            render={({ field, fieldState }) => (
              <FormField
                label="Value"
                description="Enter multiple values on separate lines."
                constraintText={`Example: ${VALUE_PLACEHOLDERS[block.type] ?? ""}`}
                errorText={fieldState.error?.message}
                stretch
              >
                <Textarea
                  value={field.value}
                  rows={3}
                  placeholder={VALUE_PLACEHOLDERS[block.type] ?? ""}
                  onChange={({ detail }) => field.onChange(detail.value)}
                  onBlur={field.onBlur}
                  ariaLabel="Record value"
                />
              </FormField>
            )}
          />
          <Controller
            name={`records.${index}.ttl`}
            control={control}
            render={({ field, fieldState }) => (
              <FormField
                label="TTL (seconds)"
                description="Recommended values: 60 to 172800 (two days)"
                errorText={fieldState.error?.message}
              >
                <SpaceBetween size="xs" direction="horizontal">
                  <Input
                    type="number"
                    value={field.value}
                    onChange={({ detail }) => field.onChange(detail.value)}
                    onBlur={field.onBlur}
                    ariaLabel="TTL in seconds"
                  />
                  <Button
                    formAction="none"
                    onClick={() => setValue(`records.${index}.ttl`, "60")}
                  >
                    1m
                  </Button>
                  <Button
                    formAction="none"
                    onClick={() => setValue(`records.${index}.ttl`, "3600")}
                  >
                    1h
                  </Button>
                  <Button
                    formAction="none"
                    onClick={() => setValue(`records.${index}.ttl`, "86400")}
                  >
                    1d
                  </Button>
                </SpaceBetween>
              </FormField>
            )}
          />
        </SpaceBetween>
      )}

      <Controller
        name={`records.${index}.routingPolicy`}
        control={control}
        render={({ field }) => (
          <FormField
            label="Routing policy"
            description="The routing policy determines how Route 53 responds to queries."
          >
            <Select
              options={[...ROUTING_POLICY_OPTIONS]}
              selectedOption={
                ROUTING_POLICY_OPTIONS.find(
                  (option) => option.value === field.value,
                ) ?? null
              }
              onChange={({ detail }) =>
                field.onChange(detail.selectedOption.value)
              }
              ariaLabel="Routing policy"
            />
          </FormField>
        )}
      />

      {block.routingPolicy !== "SIMPLE" && (
        <SpaceBetween size="l">
          {block.routingPolicy === "WEIGHTED" && (
            <Controller
              name={`records.${index}.weight`}
              control={control}
              render={({ field, fieldState }) => (
                <FormField
                  label="Weight"
                  description="A number between 0 and 255."
                  errorText={fieldState.error?.message}
                >
                  <Input
                    type="number"
                    value={field.value}
                    onChange={({ detail }) => field.onChange(detail.value)}
                    onBlur={field.onBlur}
                    ariaLabel="Weight"
                  />
                </FormField>
              )}
            />
          )}
          {block.routingPolicy === "LATENCY" && (
            <Controller
              name={`records.${index}.latencyRegion`}
              control={control}
              render={({ field, fieldState }) => (
                <FormField label="Region" errorText={fieldState.error?.message}>
                  <Select
                    options={AWS_REGIONS}
                    placeholder="Choose a Region"
                    filteringType="auto"
                    selectedOption={
                      AWS_REGIONS.find(
                        (option) => option.value === field.value,
                      ) ?? null
                    }
                    onChange={({ detail }) =>
                      field.onChange(detail.selectedOption.value)
                    }
                    ariaLabel="Latency Region"
                  />
                </FormField>
              )}
            />
          )}
          {block.routingPolicy === "FAILOVER" && (
            <Controller
              name={`records.${index}.failover`}
              control={control}
              render={({ field, fieldState }) => (
                <FormField
                  label="Failover record type"
                  errorText={fieldState.error?.message}
                >
                  <Select
                    options={[
                      { value: "PRIMARY", label: "Primary" },
                      { value: "SECONDARY", label: "Secondary" },
                    ]}
                    placeholder="Choose the failover record type"
                    selectedOption={
                      field.value
                        ? {
                            value: field.value,
                            label:
                              field.value === "PRIMARY"
                                ? "Primary"
                                : "Secondary",
                          }
                        : null
                    }
                    onChange={({ detail }) =>
                      field.onChange(detail.selectedOption.value)
                    }
                    ariaLabel="Failover record type"
                  />
                </FormField>
              )}
            />
          )}
          {block.routingPolicy === "GEOLOCATION" && (
            <Controller
              name={`records.${index}.geoLocation`}
              control={control}
              render={({ field, fieldState }) => (
                <FormField label="Location" errorText={fieldState.error?.message}>
                  <Select
                    options={[...GEO_LOCATION_OPTIONS]}
                    placeholder="Choose a location"
                    selectedOption={
                      GEO_LOCATION_OPTIONS.find(
                        (option) => option.value === field.value,
                      ) ?? null
                    }
                    onChange={({ detail }) =>
                      field.onChange(detail.selectedOption.value)
                    }
                    ariaLabel="Location"
                  />
                </FormField>
              )}
            />
          )}
          <Controller
            name={`records.${index}.healthCheckId`}
            control={control}
            render={({ field }) => (
              <FormField
                label={
                  <span>
                    Health check ID - <i>optional</i>
                  </span>
                }
              >
                <Input
                  value={field.value}
                  placeholder="No health check"
                  onChange={({ detail }) => field.onChange(detail.value)}
                  ariaLabel="Health check ID"
                />
              </FormField>
            )}
          />
          <Controller
            name={`records.${index}.setIdentifier`}
            control={control}
            render={({ field, fieldState }) => (
              <FormField
                label="Record ID"
                description={
                  RECORD_ID_HELPERS[block.routingPolicy] ??
                  "Enter a value that uniquely identifies this record in the group."
                }
                errorText={fieldState.error?.message}
              >
                <Input
                  value={field.value}
                  onChange={({ detail }) => field.onChange(detail.value)}
                  onBlur={field.onBlur}
                  ariaLabel="Record ID"
                />
              </FormField>
            )}
          />
        </SpaceBetween>
      )}
    </SpaceBetween>
  );
}

function expandBlocksWithErrors(
  errors: FieldErrors<RecordsFormValues>,
  setExpanded: React.Dispatch<React.SetStateAction<boolean[]>>,
): void {
  const records = errors.records;
  if (!records) return;
  setExpanded((previous) =>
    previous.map(
      (expanded, index) => expanded || records[index] !== undefined,
    ),
  );
}

export function RecordForm({
  zone,
  mode,
  record,
}: {
  zone: HostedZoneDetail;
  mode: "create" | "edit";
  record?: RecordOut;
}) {
  const router = useRouter();
  const { notify } = useNotifications();
  const createRecords = useCreateRecords(zone.id);
  const updateRecord = useUpdateRecord(zone.id);
  const [formError, setFormError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean[]>([true]);

  const { control, handleSubmit, setValue, setError } =
    useForm<RecordsFormValues>({
    resolver: zodResolver(recordsFormSchema),
    mode: "onTouched",
    defaultValues: {
      records:
        mode === "edit" && record
          ? [recordToBlock(record, zone)]
          : [emptyRecordBlock()],
    },
  });
  const recordArray = useFieldArray({ control, name: "records" });

  const zonePage = `/route53/v2/hostedzones/${zone.id}`;
  const isPending = createRecords.isPending || updateRecord.isPending;

  const applyServerError = (err: unknown): void => {
    if (!(err instanceof ApiError)) {
      setFormError("Something went wrong. Try again.");
      return;
    }
    if (err.code === "InvalidChangeBatch" && err.details.length > 0) {
      const indexes: number[] = [];
      for (const detail of err.details) {
        const index = detail.index ?? 0;
        indexes.push(index);
        setError(`records.${index}.values`, {
          message: detail.message ?? err.message,
        });
      }
      setExpanded((previous) =>
        previous.map((value, i) => value || indexes.includes(i)),
      );
      return;
    }
    if (err.status === 422 && err.details.length > 0) {
      let mapped = false;
      const fieldMap: Record<string, string> = {
        values: "values",
        ttl: "ttl",
        name: "name",
        type: "type",
        set_identifier: "setIdentifier",
        weight: "weight",
      };
      for (const detail of err.details) {
        const match = /records\.(\d+)\.(\w+)/.exec(detail.loc ?? "");
        if (match && fieldMap[match[2]]) {
          const index = Number(match[1]);
          setError(
            `records.${index}.${fieldMap[match[2]]}` as Parameters<
              typeof setError
            >[0],
            { message: detail.message ?? err.message },
          );
          setExpanded((previous) =>
            previous.map((value, i) => value || i === index),
          );
          mapped = true;
        }
      }
      if (mapped) return;
    }
    setFormError(err.message);
  };

  const onSubmit = (values: RecordsFormValues) => {
    setFormError(null);
    if (mode === "edit" && record) {
      const payload: RecordUpdatePayload = blockToPayload(
        values.records[0],
        zone,
      );
      delete payload.name;
      delete payload.type;
      updateRecord.mutate(
        { recordId: record.id, payload },
        {
          onSuccess: (response) => {
            notify({
              type: "success",
              header: `Record for ${displayZoneName(response.record.name)} was successfully updated.`,
              content: PROPAGATION_MESSAGE,
              action: <ViewStatusAction changeId={response.change.id} />,
            });
            router.push(zonePage);
          },
          onError: applyServerError,
        },
      );
      return;
    }
    createRecords.mutate(
      { records: values.records.map((block) => blockToPayload(block, zone)) },
      {
        onSuccess: (response) => {
          const header =
            response.records.length > 1
              ? `${response.records.length} records were successfully created.`
              : `Record for ${displayZoneName(response.records[0].name)} was successfully created.`;
          notify({
            type: "success",
            header,
            content: PROPAGATION_MESSAGE,
            action: <ViewStatusAction changeId={response.change.id} />,
          });
          router.push(zonePage);
        },
        onError: applyServerError,
      },
    );
  };

  const singleBlock = recordArray.fields.length === 1;

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          info={<InfoLink topic="createRecord" />}
          actions={
            mode === "create" ? (
              <Link onFollow={(event) => event.preventDefault()}>
                Switch to wizard
              </Link>
            ) : undefined
          }
        >
          {mode === "create" ? "Create record" : "Edit record"}
        </Header>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(onSubmit, (invalidErrors) =>
            expandBlocksWithErrors(invalidErrors, setExpanded),
          )(event);
        }}
      >
        <Form
          errorText={formError}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              {mode === "create" && (
                <Button
                  formAction="none"
                  onClick={() => {
                    recordArray.append(emptyRecordBlock());
                    setExpanded((previous) => [...previous, true]);
                  }}
                >
                  Add another record
                </Button>
              )}
              <Button
                variant="link"
                formAction="none"
                onClick={() => router.push(zonePage)}
              >
                Cancel
              </Button>
              <Button variant="primary" loading={isPending}>
                {mode === "create" ? "Create records" : "Save"}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            {recordArray.fields.map((field, index) =>
              singleBlock ? (
                <Container
                  key={field.id}
                  header={<Header variant="h2">Record {index + 1}</Header>}
                >
                  <RecordBlockFields
                    index={index}
                    control={control}
                    setValue={setValue}
                    zone={zone}
                    mode={mode}
                  />
                </Container>
              ) : (
                <ExpandableSection
                  key={field.id}
                  variant="container"
                  headerText={`Record ${index + 1}`}
                  expanded={expanded[index] ?? true}
                  onChange={({ detail }) =>
                    setExpanded((previous) =>
                      previous.map((value, i) =>
                        i === index ? detail.expanded : value,
                      ),
                    )
                  }
                  headerActions={
                    <Button
                      formAction="none"
                      onClick={() => {
                        recordArray.remove(index);
                        setExpanded((previous) =>
                          previous.filter((_, i) => i !== index),
                        );
                      }}
                    >
                      Delete
                    </Button>
                  }
                >
                  <RecordBlockFields
                    index={index}
                    control={control}
                    setValue={setValue}
                    zone={zone}
                    mode={mode}
                  />
                </ExpandableSection>
              ),
            )}
          </SpaceBetween>
        </Form>
      </form>
    </ContentLayout>
  );
}

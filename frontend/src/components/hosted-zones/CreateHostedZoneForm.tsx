"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import AttributeEditor from "@cloudscape-design/components/attribute-editor";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Tiles from "@cloudscape-design/components/tiles";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { InfoLink } from "@/components/common/InfoLink";
import { ApiError } from "@/lib/api/client";
import { useCreateHostedZone } from "@/lib/api/hooks/hostedZones";
import type { HostedZoneCreate } from "@/lib/api/types";
import { displayZoneName } from "@/lib/format";
import { AWS_REGIONS, DEFAULT_REGION, DEFAULT_VPC, vpcsForRegion } from "@/lib/regions";
import {
  DOMAIN_NAME_CONSTRAINT,
  MAX_TAGS,
  zoneFormSchema,
  type ZoneFormValues,
} from "@/lib/validation/zone";
import { useNotifications } from "@/providers/NotificationsProvider";

const LIST = "/route53/v2/hostedzones";

export function CreateHostedZoneForm() {
  const router = useRouter();
  const { notify } = useNotifications();
  const createZone = useCreateHostedZone();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneFormSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      comment: "",
      type: "public",
      vpcs: [{ region: DEFAULT_REGION, vpcId: DEFAULT_VPC }],
      tags: [],
    },
  });

  const vpcArray = useFieldArray({ control, name: "vpcs" });
  const tagArray = useFieldArray({ control, name: "tags" });
  const zoneType = watch("type");
  const commentLength = watch("comment").length;
  const vpcValues = watch("vpcs");

  const onSubmit = (values: ZoneFormValues) => {
    setFormError(null);
    const payload: HostedZoneCreate = {
      name: values.name.trim(),
      comment: values.comment.trim() ? values.comment.trim() : null,
      private_zone: values.type === "private",
      vpcs:
        values.type === "private"
          ? values.vpcs.map((vpc) => ({ region: vpc.region, vpc_id: vpc.vpcId }))
          : [],
      tags: values.tags.map((tag) => ({
        key: tag.key.trim(),
        value: tag.value,
      })),
    };
    createZone.mutate(payload, {
      onSuccess: (response) => {
        const name = displayZoneName(response.hosted_zone.name);
        notify({
          type: "success",
          header: `${name} was successfully created.`,
          content:
            "Now you can create records in the hosted zone to specify how you want Route 53 to route traffic for your domain.",
        });
        router.push(`${LIST}/${response.hosted_zone.id}`);
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.code === "InvalidDomainName") {
            setError("name", { message: err.message });
            return;
          }
          if (err.status === 422 && err.details.length > 0) {
            let mapped = false;
            for (const detail of err.details) {
              const loc = detail.loc ?? "";
              const message = detail.message ?? err.message;
              if (loc.includes("name")) {
                setError("name", { message });
                mapped = true;
              } else if (loc.includes("comment")) {
                setError("comment", { message });
                mapped = true;
              }
            }
            if (mapped) return;
          }
          setFormError(err.message);
          return;
        }
        setFormError("Something went wrong. Try again.");
      },
    });
  };

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={<InfoLink topic="createZone" />}>
          Create hosted zone
        </Header>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(onSubmit)(event);
        }}
      >
        <Form
          errorText={formError}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                formAction="none"
                onClick={() => router.push(LIST)}
              >
                Cancel
              </Button>
              <Button variant="primary" loading={createZone.isPending}>
                Create hosted zone
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Container
              header={
                <Header
                  variant="h2"
                  description="A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains."
                >
                  Hosted zone configuration
                </Header>
              }
            >
              <SpaceBetween size="l">
                <Controller
                  name="name"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormField
                      label="Domain name"
                      description="This is the name of the domain that you want to route traffic for."
                      constraintText={DOMAIN_NAME_CONSTRAINT}
                      errorText={fieldState.error?.message}
                      stretch
                    >
                      <Input
                        value={field.value}
                        placeholder="example.com"
                        onChange={({ detail }) => field.onChange(detail.value)}
                        onBlur={field.onBlur}
                        autoFocus
                      />
                    </FormField>
                  )}
                />
                <Controller
                  name="comment"
                  control={control}
                  render={({ field, fieldState }) => (
                    <FormField
                      label={
                        <span>
                          Description - <i>optional</i>
                        </span>
                      }
                      description="This value lets you distinguish hosted zones that have the same name."
                      constraintText={`The description can have up to 256 characters. ${commentLength}/256`}
                      errorText={fieldState.error?.message}
                      stretch
                    >
                      <Textarea
                        value={field.value}
                        placeholder="The hosted zone is used for..."
                        rows={3}
                        onChange={({ detail }) => field.onChange(detail.value)}
                        onBlur={field.onBlur}
                      />
                    </FormField>
                  )}
                />
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <FormField
                      label="Type"
                      description="The type indicates whether you want to route traffic on the internet or in an Amazon VPC."
                      stretch
                    >
                      <Tiles
                        value={field.value}
                        onChange={({ detail }) => field.onChange(detail.value)}
                        items={[
                          {
                            value: "public",
                            label: "Public hosted zone",
                            description:
                              "A public hosted zone determines how traffic is routed on the internet.",
                          },
                          {
                            value: "private",
                            label: "Private hosted zone",
                            description:
                              "A private hosted zone determines how traffic is routed within an Amazon VPC.",
                          },
                        ]}
                      />
                    </FormField>
                  )}
                />
              </SpaceBetween>
            </Container>

            {zoneType === "private" && (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="To associate a VPC with the hosted zone, choose the Region and ID of the VPC."
                  >
                    VPCs to associate with the hosted zone
                  </Header>
                }
              >
                <FormField
                  errorText={errors.vpcs?.root?.message ?? errors.vpcs?.message}
                  stretch
                >
                  <AttributeEditor
                    items={vpcArray.fields}
                    addButtonText="Add VPC"
                    removeButtonText="Remove"
                    onAddButtonClick={() =>
                      vpcArray.append({ region: "", vpcId: "" })
                    }
                    onRemoveButtonClick={({ detail }) =>
                      vpcArray.remove(detail.itemIndex)
                    }
                    isItemRemovable={() => vpcArray.fields.length > 1}
                    empty="No VPCs associated with the hosted zone."
                    definition={[
                      {
                        label: "Region",
                        control: (_item, index) => (
                          <Controller
                            name={`vpcs.${index}.region`}
                            control={control}
                            render={({ field }) => (
                              <Select
                                placeholder="Choose a Region"
                                options={AWS_REGIONS}
                                filteringType="auto"
                                selectedOption={
                                  AWS_REGIONS.find(
                                    (region) => region.value === field.value,
                                  ) ?? null
                                }
                                onChange={({ detail }) => {
                                  field.onChange(
                                    detail.selectedOption.value ?? "",
                                  );
                                  setValue(`vpcs.${index}.vpcId`, "");
                                }}
                              />
                            )}
                          />
                        ),
                        errorText: (_item, index) =>
                          errors.vpcs?.[index]?.region?.message,
                      },
                      {
                        label: "VPC ID",
                        control: (_item, index) => (
                          <Controller
                            name={`vpcs.${index}.vpcId`}
                            control={control}
                            render={({ field }) => {
                              const region = vpcValues[index]?.region ?? "";
                              const options = vpcsForRegion(region).map(
                                (vpcId) => ({ label: vpcId, value: vpcId }),
                              );
                              return (
                                <Select
                                  placeholder="Choose a VPC"
                                  options={options}
                                  disabled={!region}
                                  selectedOption={
                                    options.find(
                                      (option) => option.value === field.value,
                                    ) ?? null
                                  }
                                  onChange={({ detail }) =>
                                    field.onChange(
                                      detail.selectedOption.value ?? "",
                                    )
                                  }
                                />
                              );
                            }}
                          />
                        ),
                        errorText: (_item, index) =>
                          errors.vpcs?.[index]?.vpcId?.message,
                      },
                    ]}
                  />
                </FormField>
              </Container>
            )}

            <Container
              header={
                <Header
                  variant="h2"
                  description="Apply tags to hosted zones to help organize and identify them."
                >
                  Tags - <i>optional</i>
                </Header>
              }
            >
              <AttributeEditor
                items={tagArray.fields}
                addButtonText="Add tag"
                removeButtonText="Remove"
                additionalInfo={`You can add up to ${MAX_TAGS - tagArray.fields.length} more tags.`}
                disableAddButton={tagArray.fields.length >= MAX_TAGS}
                onAddButtonClick={() => tagArray.append({ key: "", value: "" })}
                onRemoveButtonClick={({ detail }) =>
                  tagArray.remove(detail.itemIndex)
                }
                empty="No tags associated with the hosted zone."
                definition={[
                  {
                    label: "Key",
                    control: (_item, index) => (
                      <Controller
                        name={`tags.${index}.key`}
                        control={control}
                        render={({ field }) => (
                          <Input
                            value={field.value}
                            placeholder="Enter key"
                            onChange={({ detail }) =>
                              field.onChange(detail.value)
                            }
                            onBlur={field.onBlur}
                          />
                        )}
                      />
                    ),
                    errorText: (_item, index) =>
                      errors.tags?.[index]?.key?.message,
                  },
                  {
                    label: "Value",
                    control: (_item, index) => (
                      <Controller
                        name={`tags.${index}.value`}
                        control={control}
                        render={({ field }) => (
                          <Input
                            value={field.value}
                            placeholder="Enter value"
                            onChange={({ detail }) =>
                              field.onChange(detail.value)
                            }
                            onBlur={field.onBlur}
                          />
                        )}
                      />
                    ),
                    errorText: (_item, index) =>
                      errors.tags?.[index]?.value?.message,
                  },
                ]}
              />
            </Container>
          </SpaceBetween>
        </Form>
      </form>
    </ContentLayout>
  );
}

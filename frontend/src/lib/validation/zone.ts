import { z } from "zod";

const LABEL_RE = /^[A-Za-z0-9_-]{1,63}$/;

export const DOMAIN_NAME_CONSTRAINT =
  "Valid characters: a-z, A-Z, 0-9, hyphen (-) and underscore (_). Labels are separated by dots; each label can have up to 63 characters.";

/** Mirrors backend normalize_zone_name/validate_fqdn. Returns null when valid. */
export function domainNameError(raw: string): string | null {
  const name = raw.trim().replace(/\.$/, "");
  if (!name) return "Domain name is required.";
  if (name.length > 254) {
    return "The domain name can't be longer than 255 characters.";
  }
  if (name.includes("*")) {
    return "The domain name can't contain a wildcard (*).";
  }
  for (const label of name.split(".")) {
    if (!label) return "The domain name can't contain consecutive dots.";
    if (label.length > 63) {
      return `Each label can have up to 63 characters: "${label}".`;
    }
    if (!LABEL_RE.test(label)) {
      return `Invalid character in "${label}". ${DOMAIN_NAME_CONSTRAINT}`;
    }
  }
  return null;
}

export const MAX_TAGS = 50;

export const zoneFormSchema = z
  .object({
    name: z.string(),
    comment: z
      .string()
      .max(256, "The description can have up to 256 characters."),
    type: z.enum(["public", "private"]),
    vpcs: z.array(
      z.object({
        region: z.string(),
        vpcId: z.string(),
      }),
    ),
    tags: z
      .array(
        z.object({
          key: z.string().max(128, "The tag key can have up to 128 characters."),
          value: z
            .string()
            .max(256, "The tag value can have up to 256 characters."),
        }),
      )
      .max(MAX_TAGS, `You can add up to ${MAX_TAGS} tags.`),
  })
  .superRefine((values, ctx) => {
    const nameError = domainNameError(values.name);
    if (nameError) {
      ctx.addIssue({ code: "custom", path: ["name"], message: nameError });
    }
    if (values.type === "private") {
      if (values.vpcs.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["vpcs"],
          message:
            "To create a private hosted zone, associate at least one VPC with it.",
        });
      }
      values.vpcs.forEach((vpc, index) => {
        if (!vpc.region) {
          ctx.addIssue({
            code: "custom",
            path: ["vpcs", index, "region"],
            message: "Choose a Region.",
          });
        }
        if (!vpc.vpcId) {
          ctx.addIssue({
            code: "custom",
            path: ["vpcs", index, "vpcId"],
            message: "Choose a VPC.",
          });
        }
      });
    }
    const seenKeys = new Set<string>();
    values.tags.forEach((tag, index) => {
      const key = tag.key.trim();
      if (!key) {
        ctx.addIssue({
          code: "custom",
          path: ["tags", index, "key"],
          message: "Tag key is required.",
        });
        return;
      }
      if (seenKeys.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["tags", index, "key"],
          message: "Tag keys must be unique.",
        });
      }
      seenKeys.add(key);
    });
  });

export type ZoneFormValues = z.infer<typeof zoneFormSchema>;

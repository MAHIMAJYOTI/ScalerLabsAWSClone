import { z } from "zod";

/** Mirrors backend/app/services/dns_validation.py on the client. */

export const MAX_TTL = 2_147_483_647;
export const DEFAULT_TTL = 300;

const LABEL_RE = /^[A-Za-z0-9_-]{1,63}$/;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
// Pragmatic IPv6 matcher: full/compressed hex groups, optional IPv4 tail.
const IPV6_RE =
  /^(([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|(([0-9A-Fa-f]{1,4}:)*[0-9A-Fa-f]{1,4})?::((([0-9A-Fa-f]{1,4}:)*[0-9A-Fa-f]{1,4})|((\d{1,3}\.){3}\d{1,3}))?|::)$/;

export const RECORD_TYPE_OPTIONS = [
  {
    value: "A",
    label: "A",
    description: "Routes traffic to an IPv4 address and some AWS resources",
  },
  {
    value: "AAAA",
    label: "AAAA",
    description: "Routes traffic to an IPv6 address and some AWS resources",
  },
  {
    value: "CAA",
    label: "CAA",
    description:
      "Restricts CAs that can create SSL/TLS certifications for the domain",
  },
  {
    value: "CNAME",
    label: "CNAME",
    description:
      "Routes traffic to another domain name and to some AWS resources",
  },
  { value: "MX", label: "MX", description: "Specifies mail servers" },
  { value: "NS", label: "NS", description: "Name servers for a hosted zone" },
  {
    value: "PTR",
    label: "PTR",
    description: "Maps an IP address to a domain name",
  },
  {
    value: "SRV",
    label: "SRV",
    description: "Application-specific values that identify servers",
  },
  {
    value: "TXT",
    label: "TXT",
    description:
      "Used to verify email senders and for application-specific values",
  },
] as const;

export const VALUE_PLACEHOLDERS: Record<string, string> = {
  A: "192.0.2.235",
  AAAA: "2001:0db8:85a3:0:0:8a2e:0370:7334",
  CNAME: "www.example.com",
  MX: "10 mailserver.example.com",
  TXT: '"Sample Text Entries"',
  NS: "ns-1.example.com",
  PTR: "www.example.com",
  SRV: "1 10 5269 xmpp-server.example.com",
  CAA: '0 issue "caa.example.com"',
  SOA: "ns.example.com. hostmaster.example.com. 1 7200 900 1209600 86400",
};

function isHostname(value: string): boolean {
  let v = value.trim();
  if (!v || v.length > 255) return false;
  if (v.endsWith(".")) v = v.slice(0, -1);
  return v.split(".").every((label) => LABEL_RE.test(label));
}

function isIntInRange(raw: string, low: number, high: number): boolean {
  if (!/^\d+$/.test(raw)) return false;
  const n = Number(raw);
  return n >= low && n <= high;
}

/** Validate one value line for a type. Returns an error message or null. */
export function valueError(type: string, value: string): string | null {
  const v = value.trim();
  switch (type) {
    case "A": {
      const m = IPV4_RE.exec(v);
      if (!m || m.slice(1).some((part) => Number(part) > 255)) {
        return `"${v}" is not a valid IPv4 address.`;
      }
      return null;
    }
    case "AAAA":
      return IPV6_RE.test(v) ? null : `"${v}" is not a valid IPv6 address.`;
    case "CNAME":
    case "NS":
    case "PTR":
      return isHostname(v) ? null : `"${v}" is not a valid domain name.`;
    case "MX": {
      const parts = v.split(/\s+/);
      if (parts.length !== 2) return "MX format: priority hostname.";
      if (!isIntInRange(parts[0], 0, 65535)) {
        return "MX priority must be between 0 and 65535.";
      }
      return isHostname(parts[1]) ? null : `"${parts[1]}" is not a valid hostname.`;
    }
    case "SRV": {
      const parts = v.split(/\s+/);
      if (parts.length !== 4) return "SRV format: priority weight port target.";
      for (const [index, what] of ["priority", "weight", "port"].entries()) {
        if (!isIntInRange(parts[index], 0, 65535)) {
          return `SRV ${what} must be between 0 and 65535.`;
        }
      }
      return isHostname(parts[3]) ? null : `"${parts[3]}" is not a valid target.`;
    }
    case "CAA": {
      const m = /^(\d{1,3})\s+(\S+)\s+(.+)$/.exec(v);
      if (!m) return 'CAA format: flags tag "value".';
      if (Number(m[1]) > 255) return "CAA flags must be between 0 and 255.";
      if (!["issue", "issuewild", "iodef"].includes(m[2].toLowerCase())) {
        return "CAA tag must be issue, issuewild or iodef.";
      }
      return null;
    }
    case "TXT": {
      if (v.startsWith('"')) {
        return /^("(?:[^"\\]|\\.)*"\s*)+$/.test(v)
          ? null
          : "TXT values must be properly quoted strings.";
      }
      return v.length <= 255
        ? null
        : "Each TXT string can have up to 255 characters.";
    }
    case "SOA": {
      const parts = v.split(/\s+/);
      return parts.length === 7
        ? null
        : "SOA format: mname rname serial refresh retry expire minimum.";
    }
    default:
      return null;
  }
}

/** Record-name part typed by the user (relative; "" or "@" = apex). */
export function recordNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "@") return null;
  const labels = trimmed.replace(/\.$/, "").split(".");
  for (const [index, label] of labels.entries()) {
    if (label === "*") {
      if (index !== 0) return "'*' is only allowed as the leftmost label.";
      continue;
    }
    if (!label) return "The record name can't contain consecutive dots.";
    if (!LABEL_RE.test(label)) {
      return `Invalid label "${label}". Letters, digits, hyphen (-) and underscore (_) are allowed.`;
    }
  }
  return null;
}

export const ROUTING_POLICY_OPTIONS = [
  { value: "SIMPLE", label: "Simple routing" },
  { value: "WEIGHTED", label: "Weighted" },
  { value: "GEOLOCATION", label: "Geolocation" },
  { value: "LATENCY", label: "Latency" },
  { value: "FAILOVER", label: "Failover" },
  { value: "MULTIVALUE", label: "Multivalue answer" },
  { value: "IP_BASED", label: "IP-based" },
] as const;

export const GEO_LOCATION_OPTIONS = [
  { value: "continent:AF", label: "Africa" },
  { value: "continent:AS", label: "Asia" },
  { value: "continent:EU", label: "Europe" },
  { value: "continent:NA", label: "North America" },
  { value: "continent:SA", label: "South America" },
  { value: "country:US", label: "United States" },
  { value: "country:DE", label: "Germany" },
  { value: "country:IN", label: "India" },
  { value: "country:JP", label: "Japan" },
  { value: "country:GB", label: "United Kingdom" },
] as const;

export const recordBlockSchema = z.object({
  name: z.string(),
  type: z.enum([
    "A",
    "AAAA",
    "CAA",
    "CNAME",
    "MX",
    "NS",
    "PTR",
    "SRV",
    "TXT",
    "SOA",
  ]),
  alias: z.boolean(),
  values: z.string(),
  ttl: z.string(),
  routingPolicy: z.enum([
    "SIMPLE",
    "WEIGHTED",
    "GEOLOCATION",
    "LATENCY",
    "FAILOVER",
    "MULTIVALUE",
    "IP_BASED",
  ]),
  setIdentifier: z.string(),
  weight: z.string(),
  latencyRegion: z.string(),
  failover: z.string(),
  geoLocation: z.string(),
  healthCheckId: z.string(),
  aliasTarget: z.enum(["cloudfront", "alb", "s3", "record"]),
  aliasRegion: z.string(),
  aliasEndpoint: z.string(),
  evaluateTargetHealth: z.boolean(),
});

export type RecordBlockValues = z.infer<typeof recordBlockSchema>;

export function splitValueLines(values: string): string[] {
  return values
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isApexName(name: string): boolean {
  const trimmed = name.trim();
  return !trimmed || trimmed === "@";
}

function validateBlock(
  block: RecordBlockValues,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  const issue = (field: string, message: string) =>
    ctx.addIssue({ code: "custom", path: [...path, field], message });

  const nameErr = recordNameError(block.name);
  if (nameErr) issue("name", nameErr);

  if (block.type === "CNAME" && isApexName(block.name)) {
    issue(
      "name",
      "A CNAME record can't be created for the root domain (zone apex).",
    );
  }

  if (block.alias) {
    if (!["A", "AAAA", "CNAME"].includes(block.type)) {
      issue("alias", "Alias is only supported for A, AAAA and CNAME records.");
    }
    if (!block.aliasEndpoint.trim()) {
      issue("aliasEndpoint", "Specify the endpoint to route traffic to.");
    } else if (!isHostname(block.aliasEndpoint)) {
      issue("aliasEndpoint", "The endpoint must be a valid domain name.");
    }
    if (
      (block.aliasTarget === "alb" || block.aliasTarget === "s3") &&
      !block.aliasRegion
    ) {
      issue("aliasRegion", "Choose a Region.");
    }
  } else {
    const lines = splitValueLines(block.values);
    if (lines.length === 0) {
      issue("values", "Specify at least one value.");
    } else {
      if (block.type === "CNAME" && lines.length > 1) {
        issue("values", "A CNAME record can contain only one value.");
      }
      if (block.type === "SOA" && lines.length > 1) {
        issue("values", "An SOA record can contain only one value.");
      }
      for (const [index, line] of lines.entries()) {
        const error = valueError(block.type, line);
        if (error) {
          issue("values", `Line ${index + 1}: ${error}`);
          break;
        }
      }
    }
    if (!/^\d+$/.test(block.ttl.trim())) {
      issue("ttl", "TTL must be a non-negative integer.");
    } else if (Number(block.ttl) > MAX_TTL) {
      issue("ttl", `TTL must be between 0 and ${MAX_TTL}.`);
    }
  }

  if (block.routingPolicy !== "SIMPLE") {
    if (!block.setIdentifier.trim()) {
      issue(
        "setIdentifier",
        "Enter a value that uniquely identifies this record in the group.",
      );
    }
    if (block.routingPolicy === "WEIGHTED") {
      if (!isIntInRange(block.weight.trim(), 0, 255)) {
        issue("weight", "Weight must be an integer between 0 and 255.");
      }
    } else if (block.routingPolicy === "LATENCY" && !block.latencyRegion) {
      issue("latencyRegion", "Choose a Region.");
    } else if (
      block.routingPolicy === "FAILOVER" &&
      !["PRIMARY", "SECONDARY"].includes(block.failover)
    ) {
      issue("failover", "Choose the failover record type.");
    } else if (block.routingPolicy === "GEOLOCATION" && !block.geoLocation) {
      issue("geoLocation", "Choose a location.");
    }
  }
}

export const recordsFormSchema = z
  .object({ records: z.array(recordBlockSchema).min(1) })
  .superRefine((form, ctx) => {
    form.records.forEach((block, index) =>
      validateBlock(block, ctx, ["records", index]),
    );
  });

export type RecordsFormValues = z.infer<typeof recordsFormSchema>;

export function emptyRecordBlock(): RecordBlockValues {
  return {
    name: "",
    type: "A",
    alias: false,
    values: "",
    ttl: String(DEFAULT_TTL),
    routingPolicy: "SIMPLE",
    setIdentifier: "",
    weight: "",
    latencyRegion: "",
    failover: "",
    geoLocation: "",
    healthCheckId: "",
    aliasTarget: "cloudfront",
    aliasRegion: "",
    aliasEndpoint: "",
    evaluateTargetHealth: false,
  };
}

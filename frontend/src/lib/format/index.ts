/** "example.com." → "example.com" — the console never shows the trailing dot. */
export function displayZoneName(name: string): string {
  return name.endsWith(".") ? name.slice(0, -1) : name;
}

/** "123456789012" → "1234-5678-9012" as the console renders account IDs. */
export function formatAccountId(accountId: string): string {
  if (accountId.length !== 12) return accountId;
  return `${accountId.slice(0, 4)}-${accountId.slice(4, 8)}-${accountId.slice(8)}`;
}

/** "www.example.com." relative to "example.com." → "www"; apex → "". */
export function relativeRecordName(name: string, zoneName: string): string {
  const lower = name.toLowerCase();
  const zone = zoneName.toLowerCase();
  if (lower === zone) return "";
  if (lower.endsWith(`.${zone}`)) {
    return name.slice(0, name.length - zone.length - 1);
  }
  return displayZoneName(name);
}

const ROUTING_POLICY_LABELS: Record<string, string> = {
  SIMPLE: "Simple",
  WEIGHTED: "Weighted",
  LATENCY: "Latency",
  FAILOVER: "Failover",
  GEOLOCATION: "Geolocation",
  MULTIVALUE: "Multivalue answer",
  IP_BASED: "IP-based",
};

export function routingPolicyLabel(policy: string): string {
  return ROUTING_POLICY_LABELS[policy] ?? policy;
}

/** ISO timestamp → "October 6, 2026, 21:45 (UTC)" style console date. */
export function formatDate(iso: string): string {
  const date = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

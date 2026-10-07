"use client";

import BreadcrumbGroup, {
  type BreadcrumbGroupProps,
} from "@cloudscape-design/components/breadcrumb-group";
import { usePathname, useRouter } from "next/navigation";

import { useHostedZone } from "@/lib/api/hooks/hostedZones";
import { displayZoneName } from "@/lib/format";

const PAGE_TITLES: Record<string, string> = {
  "/route53/v2/dashboard": "Dashboard",
  "/route53/v2/healthchecks": "Health checks",
  "/route53/v2/profiles": "Profiles",
  "/route53/v2/cidrcollections": "CIDR collections",
  "/route53/v2/trafficpolicies": "Traffic policies",
  "/route53/v2/policyrecords": "Policy records",
  "/route53/v2/domains": "Registered domains",
  "/route53/v2/domains/requests": "Requests",
  "/route53/v2/resolver/vpcs": "VPCs",
  "/route53/v2/resolver/inbound": "Inbound endpoints",
  "/route53/v2/resolver/outbound": "Outbound endpoints",
  "/route53/v2/resolver/rules": "Rules",
  "/route53/v2/resolver/querylogging": "Query logging",
  "/route53/v2/firewall/rulegroups": "Rule groups",
  "/route53/v2/firewall/domainlists": "Domain lists",
};

export function Breadcrumbs() {
  const router = useRouter();
  const pathname = usePathname();

  const zoneMatch = pathname.match(/^\/route53\/v2\/hostedzones\/([^/]+)/);
  const zoneId =
    zoneMatch && zoneMatch[1] !== "create" ? zoneMatch[1] : null;
  const { data: zone } = useHostedZone(zoneId);

  const items: BreadcrumbGroupProps.Item[] = [
    { text: "Route 53", href: "/route53/v2/dashboard" },
  ];

  if (pathname.startsWith("/route53/v2/hostedzones")) {
    items.push({ text: "Hosted zones", href: "/route53/v2/hostedzones" });
    if (zoneId) {
      items.push({
        text: zone ? displayZoneName(zone.name) : zoneId,
        href: `/route53/v2/hostedzones/${zoneId}`,
      });
      if (pathname.includes("/records/create")) {
        items.push({ text: "Create record", href: pathname });
      } else if (/\/records\/[^/]+\/edit$/.test(pathname)) {
        items.push({ text: "Edit record", href: pathname });
      } else if (pathname.endsWith("/import")) {
        items.push({ text: "Import zone file", href: pathname });
      } else if (pathname.endsWith("/edit")) {
        items.push({ text: "Edit hosted zone", href: pathname });
      }
    } else if (pathname.endsWith("/create")) {
      items.push({ text: "Create hosted zone", href: pathname });
    }
  } else {
    const title = PAGE_TITLES[pathname];
    if (title) {
      items.push({ text: title, href: pathname });
    }
  }

  return (
    <BreadcrumbGroup
      ariaLabel="Breadcrumbs"
      items={items}
      onFollow={(event) => {
        event.preventDefault();
        router.push(event.detail.href);
      }}
    />
  );
}

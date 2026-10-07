"use client";

import SideNavigation, {
  type SideNavigationProps,
} from "@cloudscape-design/components/side-navigation";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS: SideNavigationProps.Item[] = [
  { type: "link", text: "Dashboard", href: "/route53/v2/dashboard" },
  { type: "link", text: "Hosted zones", href: "/route53/v2/hostedzones" },
  { type: "link", text: "Health checks", href: "/route53/v2/healthchecks" },
  { type: "link", text: "Profiles", href: "/route53/v2/profiles" },
  {
    type: "section",
    text: "IP-based routing",
    items: [
      {
        type: "link",
        text: "CIDR collections",
        href: "/route53/v2/cidrcollections",
      },
    ],
  },
  {
    type: "section",
    text: "Traffic flow",
    items: [
      {
        type: "link",
        text: "Traffic policies",
        href: "/route53/v2/trafficpolicies",
      },
      {
        type: "link",
        text: "Policy records",
        href: "/route53/v2/policyrecords",
      },
    ],
  },
  {
    type: "section",
    text: "Domains",
    items: [
      { type: "link", text: "Registered domains", href: "/route53/v2/domains" },
      { type: "link", text: "Requests", href: "/route53/v2/domains/requests" },
    ],
  },
  {
    type: "section",
    text: "Resolver",
    items: [
      { type: "link", text: "VPCs", href: "/route53/v2/resolver/vpcs" },
      {
        type: "link",
        text: "Inbound endpoints",
        href: "/route53/v2/resolver/inbound",
      },
      {
        type: "link",
        text: "Outbound endpoints",
        href: "/route53/v2/resolver/outbound",
      },
      { type: "link", text: "Rules", href: "/route53/v2/resolver/rules" },
      {
        type: "link",
        text: "Query logging",
        href: "/route53/v2/resolver/querylogging",
      },
    ],
  },
  {
    type: "section",
    text: "DNS Firewall",
    items: [
      {
        type: "link",
        text: "Rule groups",
        href: "/route53/v2/firewall/rulegroups",
      },
      {
        type: "link",
        text: "Domain lists",
        href: "/route53/v2/firewall/domainlists",
      },
    ],
  },
];

function collectHrefs(items: readonly SideNavigationProps.Item[]): string[] {
  const hrefs: string[] = [];
  for (const item of items) {
    if (item.type === "link") hrefs.push(item.href);
    else if (item.type === "section") hrefs.push(...collectHrefs(item.items));
  }
  return hrefs;
}

const ALL_HREFS = collectHrefs(NAV_ITEMS);

export function SideNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Longest matching prefix wins so /hostedzones/Z123 highlights "Hosted zones"
  // and /domains/requests highlights "Requests", not "Registered domains".
  const activeHref = ALL_HREFS.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  ).sort((a, b) => b.length - a.length)[0];

  return (
    <SideNavigation
      header={{ text: "Route 53", href: "/route53/v2/dashboard" }}
      items={NAV_ITEMS}
      activeHref={activeHref}
      onFollow={(event) => {
        if (!event.detail.external) {
          event.preventDefault();
          router.push(event.detail.href);
        }
      }}
    />
  );
}

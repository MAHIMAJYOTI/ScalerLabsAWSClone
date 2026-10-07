/** Alias target catalog: Route53 hosted zone IDs for AWS endpoints (mocked). */

export type AliasTargetKind = "cloudfront" | "alb" | "s3" | "record";

export const ALIAS_TARGET_OPTIONS: { value: AliasTargetKind; label: string }[] =
  [
    { value: "cloudfront", label: "Alias to CloudFront distribution" },
    {
      value: "alb",
      label: "Alias to Application and Classic Load Balancer",
    },
    { value: "s3", label: "Alias to S3 website endpoint" },
    { value: "record", label: "Alias to another record in this hosted zone" },
  ];

export const CLOUDFRONT_HOSTED_ZONE_ID = "Z2FDTNDATAQYW2";

export const ALB_HOSTED_ZONE_IDS: Record<string, string> = {
  "us-east-1": "Z35SXDOTRQ7X7K",
  "us-east-2": "Z3AADJGX6KTTL2",
  "us-west-2": "Z1H1FL5HABSF5",
  "eu-west-1": "Z32O12XQLNTSW2",
  "ap-southeast-1": "Z1LMS91P8CMLE5",
};

export const S3_WEBSITE_HOSTED_ZONE_IDS: Record<string, string> = {
  "us-east-1": "Z3AQBSTGFYJSTF",
  "us-east-2": "Z2O1EMRO9K5GLX",
  "us-west-2": "Z3BJ6K6RIION7M",
  "eu-west-1": "Z1BKCTXD74EZPE",
  "ap-southeast-1": "Z3O0J2DXBE1FTB",
};

export const ALIAS_REGION_OPTIONS = Object.keys(ALB_HOSTED_ZONE_IDS).map(
  (region) => ({ value: region, label: region }),
);

export function aliasHostedZoneId(
  target: AliasTargetKind,
  region: string,
  currentZoneId: string,
): string {
  switch (target) {
    case "cloudfront":
      return CLOUDFRONT_HOSTED_ZONE_ID;
    case "alb":
      return ALB_HOSTED_ZONE_IDS[region] ?? "";
    case "s3":
      return S3_WEBSITE_HOSTED_ZONE_IDS[region] ?? "";
    case "record":
      return currentZoneId;
  }
}

export function aliasTargetNeedsRegion(target: AliasTargetKind): boolean {
  return target === "alb" || target === "s3";
}

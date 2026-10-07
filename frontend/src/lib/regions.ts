/** Mock AWS regions + per-region VPCs for the private-zone VPC picker. */

export interface RegionOption {
  value: string;
  label: string;
}

export const AWS_REGIONS: RegionOption[] = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "eu-west-2", label: "Europe (London)" },
  { value: "eu-central-1", label: "Europe (Frankfurt)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
];

const MOCK_VPCS: Record<string, string[]> = {
  "us-east-1": ["vpc-0a1b2c3d4e5f6a7b8", "vpc-0f9e8d7c6b5a43210", "vpc-0123456789abcdef0"],
  "us-east-2": ["vpc-02468ace13579bdf0", "vpc-0aaaa1111bbbb2222"],
  "us-west-1": ["vpc-0cccc3333dddd4444"],
  "us-west-2": ["vpc-0eeee5555ffff6666", "vpc-0404040404040404a"],
  "eu-west-1": ["vpc-0abcd1234ef015678", "vpc-0dead0000beef1111"],
  "eu-west-2": ["vpc-0feed2222face3333"],
  "eu-central-1": ["vpc-0cafe4444babe5555"],
  "ap-south-1": ["vpc-0aaaa6666bbbb7777"],
  "ap-southeast-1": ["vpc-0cccc8888dddd9999"],
  "ap-southeast-2": ["vpc-0eeee0000ffff1111"],
  "ap-northeast-1": ["vpc-0123456789fedcba0"],
  "sa-east-1": ["vpc-0a0b0c0d0e0f01020"],
};

export function vpcsForRegion(region: string): string[] {
  return MOCK_VPCS[region] ?? [];
}

export const DEFAULT_REGION = "us-east-1";
export const DEFAULT_VPC = MOCK_VPCS[DEFAULT_REGION][0];

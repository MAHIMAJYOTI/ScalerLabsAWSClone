// Mirrors backend/app/schemas/*.py — keep both sides in sync.
// Field names stay snake_case exactly as the API returns them.

// ---- auth.py ----

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserOut {
  username: string;
  display_name: string;
  account_id: string;
}

// ---- common.py ----

export interface ChangeOut {
  id: string;
  status: "PENDING" | "INSYNC";
  comment: string | null;
  submitted_at: string;
}

export interface BatchIds {
  ids: string[];
}

// ---- hosted_zone.py ----

export interface VpcIn {
  region: string;
  vpc_id: string;
}

export interface TagIn {
  key: string;
  value: string;
}

export interface HostedZoneCreate {
  name: string;
  comment?: string | null;
  private_zone: boolean;
  vpcs?: VpcIn[];
  tags?: TagIn[];
}

export interface HostedZoneUpdate {
  comment: string | null;
}

export interface HostedZoneListItem {
  id: string;
  name: string;
  private_zone: boolean;
  comment: string | null;
  record_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface HostedZoneListResponse {
  items: HostedZoneListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface HostedZoneDetail {
  id: string;
  name: string;
  caller_reference: string;
  comment: string | null;
  private_zone: boolean;
  record_count: number;
  name_servers: string[];
  vpcs: VpcIn[];
  tags: TagIn[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DelegationSet {
  name_servers: string[];
}

export interface HostedZoneCreateResponse {
  hosted_zone: HostedZoneDetail;
  delegation_set: DelegationSet | null;
  change: ChangeOut;
}

export interface ChangeResponse {
  change: ChangeOut;
}

// ---- record.py (records UI lands next phase) ----

export type RecordType =
  | "A"
  | "AAAA"
  | "CNAME"
  | "TXT"
  | "MX"
  | "NS"
  | "PTR"
  | "SRV"
  | "CAA"
  | "SOA";

export type RoutingPolicy =
  | "SIMPLE"
  | "WEIGHTED"
  | "LATENCY"
  | "FAILOVER"
  | "GEOLOCATION"
  | "MULTIVALUE"
  | "IP_BASED";

export interface RecordOut {
  id: string;
  zone_id: string;
  name: string;
  type: RecordType;
  ttl: number | null;
  routing_policy: RoutingPolicy;
  set_identifier: string | null;
  weight: number | null;
  region: string | null;
  failover: string | null;
  geo_continent: string | null;
  geo_country: string | null;
  geo_subdivision: string | null;
  multivalue_answer: boolean;
  health_check_id: string | null;
  is_alias: boolean;
  alias_dns_name: string | null;
  alias_hosted_zone_id: string | null;
  alias_evaluate_target_health: boolean;
  values: string[];
  /** True for the SOA and the apex NS record — they can't be deleted. */
  protected: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecordListResponse {
  items: RecordOut[];
  total: number;
  /** Zone record count ignoring q/type/routing_policy/alias filters. */
  total_unfiltered: number;
  page: number;
  page_size: number;
}

/** Mirrors RecordCreate (RecordBase + name/type). */
export interface RecordCreatePayload {
  name: string;
  type: string;
  ttl?: number | null;
  values?: string[] | null;
  routing_policy?: RoutingPolicy;
  set_identifier?: string | null;
  weight?: number | null;
  region?: string | null;
  failover?: string | null;
  geo_continent?: string | null;
  geo_country?: string | null;
  geo_subdivision?: string | null;
  health_check_id?: string | null;
  is_alias?: boolean;
  alias_dns_name?: string | null;
  alias_hosted_zone_id?: string | null;
  alias_evaluate_target_health?: boolean;
}

/** Mirrors RecordUpdate (name/type optional + immutable server-side). */
export type RecordUpdatePayload = Omit<RecordCreatePayload, "name" | "type"> & {
  name?: string;
  type?: string;
};

export interface RecordBatchCreatePayload {
  records: RecordCreatePayload[];
}

export interface RecordCreateResponse {
  records: RecordOut[];
  change: ChangeOut;
}

export interface RecordUpdateResponse {
  record: RecordOut;
  change: ChangeOut;
}

export interface RecordBatchDeleteResponse {
  deleted_ids: string[];
  change: ChangeOut;
}

// ---- zone file import/export (phase-3 contract) ----

export interface ZoneFileImportRequest {
  zone_file: string;
}

export interface SkippedImportRecord {
  name: string;
  type: string;
  reason: string;
}

export interface ZoneFileImportResponse {
  created: number;
  skipped: SkippedImportRecord[];
  change: ChangeOut;
}

// ---- error envelope (app/core/errors.py) ----

export interface ApiErrorDetail {
  loc?: string;
  message?: string;
  index?: number;
  code?: string;
  /** InvalidZoneFile details. */
  line?: number;
  /** InvalidChangeBatch (import) details. */
  name?: string;
  type?: string;
}

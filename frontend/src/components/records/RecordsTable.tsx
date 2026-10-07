"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Multiselect from "@cloudscape-design/components/multiselect";
import Pagination from "@cloudscape-design/components/pagination";
import Select, {
  type SelectProps,
} from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { DeleteRecordsModal } from "./DeleteRecordsModal";
import { RecordDetailsPanel } from "./RecordDetailsPanel";
import { ViewStatusAction } from "./ViewStatusAction";
import { InfoLink } from "@/components/common/InfoLink";
import { usePageShortcuts } from "@/components/shell/shortcuts";
import { useSplitPanel } from "@/components/shell/splitPanel";
import { errorMessage } from "@/lib/api/client";
import {
  useRecords,
  type RecordSortField,
} from "@/lib/api/hooks/records";
import type { HostedZoneDetail, RecordOut } from "@/lib/api/types";
import { displayZoneName, routingPolicyLabel } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { usePersistedPreferences } from "@/lib/hooks/usePersistedPreferences";
import { useNotifications } from "@/providers/NotificationsProvider";

type Preferences = Required<
  Pick<
    CollectionPreferencesProps.Preferences,
    "pageSize" | "wrapLines" | "stripedRows" | "contentDisplay"
  >
>;

const DEFAULT_PREFERENCES: Preferences = {
  pageSize: 50,
  wrapLines: false,
  stripedRows: false,
  contentDisplay: [
    { id: "name", visible: true },
    { id: "type", visible: true },
    { id: "routing_policy", visible: true },
    { id: "differentiator", visible: true },
    { id: "alias", visible: true },
    { id: "value", visible: true },
    { id: "ttl", visible: true },
    { id: "health_check_id", visible: true },
    { id: "evaluate_target_health", visible: true },
    { id: "record_id", visible: true },
  ],
};

const TYPE_OPTIONS: SelectProps.Option[] = [
  "A",
  "AAAA",
  "CAA",
  "CNAME",
  "MX",
  "NS",
  "PTR",
  "SOA",
  "SRV",
  "TXT",
].map((type) => ({ value: type, label: type }));

const ROUTING_FILTER_OPTIONS: SelectProps.Option[] = [
  { value: "all", label: "All routing policies" },
  { value: "SIMPLE", label: "Simple" },
  { value: "WEIGHTED", label: "Weighted" },
  { value: "LATENCY", label: "Latency" },
  { value: "FAILOVER", label: "Failover" },
  { value: "GEOLOCATION", label: "Geolocation" },
  { value: "MULTIVALUE", label: "Multivalue answer" },
  { value: "IP_BASED", label: "IP-based" },
];

const ALIAS_FILTER_OPTIONS: SelectProps.Option[] = [
  { value: "all", label: "All records" },
  { value: "yes", label: "Alias: Yes" },
  { value: "no", label: "Alias: No" },
];

const SORTABLE_FIELDS: RecordSortField[] = [
  "name",
  "type",
  "ttl",
  "routing_policy",
];

function differentiator(record: RecordOut): string {
  switch (record.routing_policy) {
    case "WEIGHTED":
      return record.weight === null ? "-" : String(record.weight);
    case "LATENCY":
      return record.region ?? "-";
    case "FAILOVER":
      return record.failover ?? "-";
    case "GEOLOCATION":
      return (
        record.geo_subdivision ??
        record.geo_country ??
        record.geo_continent ??
        "-"
      );
    case "MULTIVALUE":
      return "Multivalue";
    case "IP_BASED":
      return record.set_identifier ?? "-";
    default:
      return "-";
  }
}

export function RecordsTable({ zone }: { zone: HostedZoneDetail }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const splitPanel = useSplitPanel();

  const [preferences, setPreferences] = usePersistedPreferences<Preferences>(
    "r53.records.tablePreferences",
    DEFAULT_PREFERENCES,
  );
  const [filteringText, setFilteringText] = useState("");
  const debouncedQ = useDebouncedValue(filteringText, 300);
  const [typeFilter, setTypeFilter] = useState<readonly SelectProps.Option[]>(
    [],
  );
  const [routingFilter, setRoutingFilter] = useState<SelectProps.Option>(
    ROUTING_FILTER_OPTIONS[0],
  );
  const [aliasFilter, setAliasFilter] = useState<SelectProps.Option>(
    ALIAS_FILTER_OPTIONS[0],
  );
  const [page, setPage] = useState(1);
  const [sortingColumn, setSortingColumn] = useState<
    TableProps.SortingColumn<RecordOut> | undefined
  >(undefined);
  const [sortingDescending, setSortingDescending] = useState(false);
  const [selectedItems, setSelectedItems] = useState<RecordOut[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<RecordOut[] | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  // Close the record panel when this table unmounts (navigation away).
  const closePanel = splitPanel.closePanel;
  useEffect(() => () => closePanel(), [closePanel]);

  const filterRef = useRef<HTMLDivElement>(null);

  const sortBy =
    sortingColumn &&
    SORTABLE_FIELDS.includes(sortingColumn.sortingField as RecordSortField)
      ? (sortingColumn.sortingField as RecordSortField)
      : undefined;

  const { data, error, isLoading, isFetching, refetch } = useRecords(zone.id, {
    q: debouncedQ.trim() || undefined,
    types:
      typeFilter.length > 0
        ? typeFilter.map((option) => option.value).join(",")
        : undefined,
    routingPolicy:
      routingFilter.value === "all" ? undefined : routingFilter.value,
    alias:
      aliasFilter.value === "all" ? undefined : aliasFilter.value === "yes",
    page,
    pageSize: preferences.pageSize,
    sortBy,
    sortOrder: sortingDescending ? "desc" : "asc",
  });

  usePageShortcuts({
    focusFilter: () => filterRef.current?.querySelector("input")?.focus(),
    create: () =>
      router.push(`/route53/v2/hostedzones/${zone.id}/records/create`),
    refresh: () => void refetch(),
    importZone: () => router.push(`/route53/v2/hostedzones/${zone.id}/import`),
  });

  const total = data?.total ?? 0;
  const totalUnfiltered = data?.total_unfiltered ?? 0;
  const pagesCount = Math.max(1, Math.ceil(total / preferences.pageSize));

  // Deletes can shrink the page count under us — clamp to the last page.
  useEffect(() => {
    if (data && page > pagesCount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp reacts to server data shrinking
      setPage(pagesCount);
    }
  }, [data, page, pagesCount]);
  const isFiltered =
    debouncedQ.trim().length > 0 ||
    typeFilter.length > 0 ||
    routingFilter.value !== "all" ||
    aliasFilter.value !== "all";

  const openRecordPanel = (record: RecordOut) => {
    splitPanel.openPanel({
      header: "Record details",
      content: (
        <RecordDetailsPanel
          record={record}
          onEdit={() =>
            router.push(
              `/route53/v2/hostedzones/${zone.id}/records/${record.id}/edit`,
            )
          }
          onDelete={() => setDeleteTargets([record])}
        />
      ),
    });
  };

  const resetToFirstPage = () => {
    setPage(1);
    setSelectedItems([]);
    splitPanel.closePanel();
  };

  const columnDefinitions: TableProps.ColumnDefinition<RecordOut>[] = [
    {
      id: "name",
      header: "Record name",
      sortingField: "name",
      cell: (record) => (
        <Link
          onFollow={(event) => {
            event.preventDefault();
            setSelectedItems([record]);
            openRecordPanel(record);
          }}
        >
          {displayZoneName(record.name)}
        </Link>
      ),
    },
    { id: "type", header: "Type", sortingField: "type", cell: (r) => r.type },
    {
      id: "routing_policy",
      header: "Routing policy",
      sortingField: "routing_policy",
      cell: (record) => routingPolicyLabel(record.routing_policy),
    },
    {
      id: "differentiator",
      header: "Differentiator",
      cell: (record) => differentiator(record),
    },
    {
      id: "alias",
      header: "Alias",
      cell: (record) => (record.is_alias ? "Yes" : "No"),
    },
    {
      id: "value",
      header: "Value/Route traffic to",
      cell: (record) =>
        record.is_alias ? (
          (record.alias_dns_name ?? "-")
        ) : (
          <SpaceBetween size="xxxs">
            {record.values.map((value, index) => (
              <span key={`${index}-${value}`}>{value}</span>
            ))}
          </SpaceBetween>
        ),
    },
    {
      id: "ttl",
      header: "TTL (seconds)",
      sortingField: "ttl",
      cell: (record) => (record.ttl === null ? "-" : record.ttl),
    },
    {
      id: "health_check_id",
      header: "Health check ID",
      cell: (record) => record.health_check_id ?? "-",
    },
    {
      id: "evaluate_target_health",
      header: "Evaluate target health",
      cell: (record) =>
        record.is_alias
          ? record.alias_evaluate_target_health
            ? "Yes"
            : "No"
          : "-",
    },
    {
      id: "record_id",
      header: "Record ID",
      cell: (record) => record.set_identifier ?? "-",
    },
  ];

  return (
    <>
      <Table
        items={data?.items ?? []}
        columnDefinitions={columnDefinitions}
        columnDisplay={preferences.contentDisplay}
        wrapLines={preferences.wrapLines}
        stripedRows={preferences.stripedRows}
        trackBy="id"
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => {
          setSelectedItems([...detail.selectedItems]);
          if (detail.selectedItems.length === 1) {
            openRecordPanel(detail.selectedItems[0]);
          } else {
            splitPanel.closePanel();
          }
        }}
        loading={isLoading || manualRefreshing}
        loadingText="Loading records"
        sortingColumn={sortingColumn}
        sortingDescending={sortingDescending}
        onSortingChange={({ detail }) => {
          setSortingColumn(detail.sortingColumn);
          setSortingDescending(detail.isDescending ?? false);
          setPage(1);
        }}
        ariaLabels={{
          selectionGroupLabel: "Record selection",
          itemSelectionLabel: (_detail, record) =>
            `${displayZoneName(record.name)} ${record.type}`,
          tableLabel: "Records",
        }}
        header={
          <Header
            variant="h2"
            counter={data ? `(${totalUnfiltered})` : ""}
            info={<InfoLink topic="records" />}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Refresh records"
                  loading={manualRefreshing || (isFetching && !isLoading)}
                  onClick={() => {
                    setManualRefreshing(true);
                    void refetch().finally(() => setManualRefreshing(false));
                  }}
                />
                <Button
                  disabled={selectedItems.length === 0}
                  onClick={() => setDeleteTargets(selectedItems)}
                >
                  Delete record
                </Button>
                <Button
                  onClick={() =>
                    router.push(`/route53/v2/hostedzones/${zone.id}/import`)
                  }
                >
                  Import zone file
                </Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    router.push(
                      `/route53/v2/hostedzones/${zone.id}/records/create`,
                    )
                  }
                >
                  Create record
                </Button>
              </SpaceBetween>
            }
          >
            Records
          </Header>
        }
        filter={
          <div className="r53-filter-row" ref={filterRef}>
            <TextFilter
              filteringText={filteringText}
              filteringPlaceholder="Filter records by property or value"
              filteringAriaLabel="Filter records"
              countText={isFiltered ? `${total} matches` : ""}
              onChange={({ detail }) => {
                setFilteringText(detail.filteringText);
                resetToFirstPage();
              }}
            />
            <div className="r53-filter-select-wide">
              <Multiselect
                options={TYPE_OPTIONS}
                selectedOptions={typeFilter}
                placeholder="Type"
                ariaLabel="Filter by record type"
                onChange={({ detail }) => {
                  setTypeFilter(detail.selectedOptions);
                  resetToFirstPage();
                }}
              />
            </div>
            <div className="r53-filter-select">
              <Select
                options={ROUTING_FILTER_OPTIONS}
                selectedOption={routingFilter}
                ariaLabel="Filter by routing policy"
                onChange={({ detail }) => {
                  setRoutingFilter(detail.selectedOption);
                  resetToFirstPage();
                }}
              />
            </div>
            <div className="r53-filter-select">
              <Select
                options={ALIAS_FILTER_OPTIONS}
                selectedOption={aliasFilter}
                ariaLabel="Filter by alias"
                onChange={({ detail }) => {
                  setAliasFilter(detail.selectedOption);
                  resetToFirstPage();
                }}
              />
            </div>
          </div>
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={pagesCount}
            disabled={isLoading}
            onChange={({ detail }) => {
              setPage(detail.currentPageIndex);
              setSelectedItems([]);
              splitPanel.closePanel();
            }}
            ariaLabels={{
              nextPageLabel: "Next page",
              previousPageLabel: "Previous page",
              pageLabel: (pageNumber) => `Page ${pageNumber} of all pages`,
            }}
          />
        }
        preferences={
          <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={preferences}
            onConfirm={({ detail }) => {
              setPreferences({
                pageSize: detail.pageSize ?? DEFAULT_PREFERENCES.pageSize,
                wrapLines: detail.wrapLines ?? false,
                stripedRows: detail.stripedRows ?? false,
                contentDisplay: [
                  ...(detail.contentDisplay ??
                    DEFAULT_PREFERENCES.contentDisplay),
                ],
              });
              resetToFirstPage();
            }}
            pageSizePreference={{
              title: "Page size",
              options: [10, 25, 50, 100].map((size) => ({
                value: size,
                label: `${size} records`,
              })),
            }}
            wrapLinesPreference={{
              label: "Wrap lines",
              description: "Select to see all the text and wrap the lines",
            }}
            stripedRowsPreference={{
              label: "Striped rows",
              description: "Select to add alternating shaded rows",
            }}
            contentDisplayPreference={{
              title: "Column preferences",
              description: "Customize the columns visibility and order.",
              options: columnDefinitions.map((column) => ({
                id: column.id as string,
                label: column.header as string,
                alwaysVisible: column.id === "name",
              })),
            }}
          />
        }
        empty={
          error ? (
            <Alert type="error" header="Couldn't load records">
              <SpaceBetween size="xs">
                <Box variant="span">{errorMessage(error)}</Box>
                <Button onClick={() => void refetch()}>Retry</Button>
              </SpaceBetween>
            </Alert>
          ) : isFiltered ? (
            <Box textAlign="center" color="inherit">
              <Box variant="strong" textAlign="center" color="inherit">
                No matches
              </Box>
              <Box variant="p" padding={{ bottom: "s" }} color="inherit">
                We can&apos;t find a match.
              </Box>
              <Button
                onClick={() => {
                  setFilteringText("");
                  setTypeFilter([]);
                  setRoutingFilter(ROUTING_FILTER_OPTIONS[0]);
                  setAliasFilter(ALIAS_FILTER_OPTIONS[0]);
                  resetToFirstPage();
                }}
              >
                Clear filters
              </Button>
            </Box>
          ) : (
            <Box textAlign="center" color="inherit">
              <Box variant="strong" textAlign="center" color="inherit">
                No records
              </Box>
              <Box variant="p" padding={{ bottom: "s" }} color="inherit">
                You don&apos;t have any records in this hosted zone.
              </Box>
              <Button
                onClick={() =>
                  router.push(
                    `/route53/v2/hostedzones/${zone.id}/records/create`,
                  )
                }
              >
                Create record
              </Button>
            </Box>
          )
        }
      />
      <DeleteRecordsModal
        zone={zone}
        records={deleteTargets ?? []}
        visible={deleteTargets !== null}
        onDismiss={() => setDeleteTargets(null)}
        onDeleted={(count, changeId) => {
          setDeleteTargets(null);
          setSelectedItems([]);
          splitPanel.closePanel();
          notify({
            type: "success",
            content: `${count} record(s) deleted.`,
            action: <ViewStatusAction changeId={changeId} />,
          });
        }}
      />
    </>
  );
}

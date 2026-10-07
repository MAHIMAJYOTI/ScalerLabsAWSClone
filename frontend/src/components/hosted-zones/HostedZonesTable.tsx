"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import Select, {
  type SelectProps,
} from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BulkDeleteZonesModal } from "./BulkDeleteZonesModal";
import { DeleteZoneModal } from "./DeleteZoneModal";
import { InfoLink } from "@/components/common/InfoLink";
import { usePageShortcuts } from "@/components/shell/shortcuts";
import { errorMessage } from "@/lib/api/client";
import {
  useHostedZones,
  type ZoneSortField,
} from "@/lib/api/hooks/hostedZones";
import type { HostedZoneListItem } from "@/lib/api/types";
import { displayZoneName, formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { usePersistedPreferences } from "@/lib/hooks/usePersistedPreferences";
import { useNotifications } from "@/providers/NotificationsProvider";

const BASE = "/route53/v2/hostedzones";

type Preferences = Required<
  Pick<
    CollectionPreferencesProps.Preferences,
    "pageSize" | "wrapLines" | "stripedRows" | "contentDisplay"
  >
>;

const DEFAULT_PREFERENCES: Preferences = {
  pageSize: 10,
  wrapLines: false,
  stripedRows: false,
  contentDisplay: [
    { id: "name", visible: true },
    { id: "type", visible: true },
    { id: "created_by", visible: true },
    { id: "record_count", visible: true },
    { id: "comment", visible: true },
    { id: "id", visible: true },
    { id: "created_at", visible: false },
  ],
};

const TYPE_OPTIONS: SelectProps.Option[] = [
  { label: "All types", value: "all" },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
];

const SORTABLE_FIELDS: ZoneSortField[] = [
  "name",
  "record_count",
  "comment",
  "created_at",
];

export function HostedZonesTable() {
  const router = useRouter();
  const { notify } = useNotifications();

  const [preferences, setPreferences] = usePersistedPreferences<Preferences>(
    "r53.hostedZones.tablePreferences",
    DEFAULT_PREFERENCES,
  );
  const [filteringText, setFilteringText] = useState("");
  const debouncedQ = useDebouncedValue(filteringText, 300);
  const [typeOption, setTypeOption] = useState<SelectProps.Option>(
    TYPE_OPTIONS[0],
  );
  const [page, setPage] = useState(1);
  const [sortingColumn, setSortingColumn] = useState<
    TableProps.SortingColumn<HostedZoneListItem>
  >({ sortingField: "name" });
  const [sortingDescending, setSortingDescending] = useState(false);
  const [selectedItems, setSelectedItems] = useState<HostedZoneListItem[]>([]);
  const [zoneToDelete, setZoneToDelete] = useState<HostedZoneListItem | null>(
    null,
  );
  const [bulkZones, setBulkZones] = useState<HostedZoneListItem[] | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const sortBy = SORTABLE_FIELDS.includes(
    sortingColumn.sortingField as ZoneSortField,
  )
    ? (sortingColumn.sortingField as ZoneSortField)
    : "name";

  const { data, error, isLoading, isFetching, refetch } = useHostedZones({
    q: debouncedQ.trim() || undefined,
    type:
      typeOption.value === "all"
        ? undefined
        : (typeOption.value as "public" | "private"),
    page,
    pageSize: preferences.pageSize,
    sortBy,
    sortOrder: sortingDescending ? "desc" : "asc",
  });

  usePageShortcuts({
    focusFilter: () => filterRef.current?.querySelector("input")?.focus(),
    create: () => router.push(`${BASE}/create`),
    refresh: () => void refetch(),
  });

  const selected = selectedItems.length === 1 ? selectedItems[0] : undefined;
  const total = data?.total ?? 0;
  const pagesCount = Math.max(1, Math.ceil(total / preferences.pageSize));

  // Deletes can shrink the page count under us — clamp to the last page.
  useEffect(() => {
    if (data && page > pagesCount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp reacts to server data shrinking
      setPage(pagesCount);
    }
  }, [data, page, pagesCount]);
  const isFiltered =
    debouncedQ.trim().length > 0 || typeOption.value !== "all";

  const columnDefinitions: TableProps.ColumnDefinition<HostedZoneListItem>[] = [
    {
      id: "name",
      header: "Hosted zone name",
      sortingField: "name",
      cell: (zone) => (
        <Link
          href={`${BASE}/${zone.id}`}
          onFollow={(event) => {
            event.preventDefault();
            router.push(`${BASE}/${zone.id}`);
          }}
        >
          {displayZoneName(zone.name)}
        </Link>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (zone) => (zone.private_zone ? "Private" : "Public"),
    },
    { id: "created_by", header: "Created by", cell: (zone) => zone.created_by },
    {
      id: "record_count",
      header: "Record count",
      sortingField: "record_count",
      cell: (zone) => zone.record_count,
    },
    {
      id: "comment",
      header: "Description",
      sortingField: "comment",
      cell: (zone) => zone.comment || "-",
    },
    { id: "id", header: "Hosted zone ID", cell: (zone) => zone.id },
    {
      id: "created_at",
      header: "Date created",
      sortingField: "created_at",
      cell: (zone) => formatDate(zone.created_at),
    },
  ];

  const resetToFirstPage = () => {
    setPage(1);
    setSelectedItems([]);
  };

  return (
    <>
      <Table
        variant="full-page"
        stickyHeader
        items={data?.items ?? []}
        columnDefinitions={columnDefinitions}
        columnDisplay={preferences.contentDisplay}
        wrapLines={preferences.wrapLines}
        stripedRows={preferences.stripedRows}
        trackBy="id"
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) =>
          setSelectedItems([...detail.selectedItems])
        }
        loading={isLoading || manualRefreshing}
        loadingText="Loading hosted zones"
        sortingColumn={sortingColumn}
        sortingDescending={sortingDescending}
        onSortingChange={({ detail }) => {
          setSortingColumn(detail.sortingColumn);
          setSortingDescending(detail.isDescending ?? false);
          resetToFirstPage();
        }}
        ariaLabels={{
          selectionGroupLabel: "Hosted zone selection",
          itemSelectionLabel: (_detail, zone) => displayZoneName(zone.name),
          tableLabel: "Hosted zones",
        }}
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={data ? `(${total})` : ""}
            info={<InfoLink topic="hostedZones" />}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Refresh hosted zones"
                  loading={manualRefreshing || (isFetching && !isLoading)}
                  onClick={() => {
                    setManualRefreshing(true);
                    void refetch().finally(() => setManualRefreshing(false));
                  }}
                />
                <Button
                  disabled={!selected}
                  onClick={() => selected && router.push(`${BASE}/${selected.id}`)}
                >
                  View details
                </Button>
                <Button
                  disabled={!selected}
                  onClick={() =>
                    selected && router.push(`${BASE}/${selected.id}/edit`)
                  }
                >
                  Edit
                </Button>
                <Button
                  disabled={selectedItems.length === 0}
                  onClick={() => {
                    if (selectedItems.length === 1) {
                      setZoneToDelete(selectedItems[0]);
                    } else {
                      setBulkZones(selectedItems);
                    }
                  }}
                >
                  Delete
                </Button>
                <Button
                  variant="primary"
                  onClick={() => router.push(`${BASE}/create`)}
                >
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        filter={
          <div className="r53-filter-row" ref={filterRef}>
            <TextFilter
              filteringText={filteringText}
              filteringPlaceholder="Filter hosted zones by property or value"
              filteringAriaLabel="Filter hosted zones"
              countText={isFiltered ? `${total} matches` : ""}
              onChange={({ detail }) => {
                setFilteringText(detail.filteringText);
                resetToFirstPage();
              }}
            />
            <div className="r53-filter-select">
              <Select
                options={TYPE_OPTIONS}
                selectedOption={typeOption}
                ariaLabel="Filter by hosted zone type"
                onChange={({ detail }) => {
                  setTypeOption(detail.selectedOption);
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
                label: `${size} hosted zones`,
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
              description:
                "Customize the columns visibility and order.",
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
            <Alert type="error" header="Couldn't load hosted zones">
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
                  setTypeOption(TYPE_OPTIONS[0]);
                  resetToFirstPage();
                }}
              >
                Clear filter
              </Button>
            </Box>
          ) : (
            <Box textAlign="center" color="inherit">
              <Box variant="strong" textAlign="center" color="inherit">
                No hosted zones
              </Box>
              <Box variant="p" padding={{ bottom: "s" }} color="inherit">
                You don&apos;t have any hosted zones.
              </Box>
              <Button onClick={() => router.push(`${BASE}/create`)}>
                Create hosted zone
              </Button>
            </Box>
          )
        }
      />
      {zoneToDelete !== null && (
        <DeleteZoneModal
          zone={zoneToDelete}
          visible
          onDismiss={() => setZoneToDelete(null)}
          onDeleted={(zoneName) => {
            setZoneToDelete(null);
            setSelectedItems([]);
            notify({
              type: "success",
              content: `Hosted zone ${zoneName} was deleted.`,
            });
          }}
        />
      )}
      {bulkZones !== null && (
        <BulkDeleteZonesModal
          zones={bulkZones}
          visible
        onDismiss={() => setBulkZones(null)}
        onDone={(outcome) => {
          setBulkZones(null);
          setSelectedItems([]);
          if (outcome.deleted.length > 0) {
            notify({
              type: "success",
              content: `${outcome.deleted.length} hosted zones deleted.`,
            });
          }
          if (outcome.failed.length > 0) {
            notify({
              type: "error",
              header: "Some hosted zones couldn't be deleted",
              content: (
                <ul>
                  {outcome.failed.map((failure) => (
                    <li key={failure.name}>
                      {failure.name}: {failure.reason}
                    </li>
                  ))}
                </ul>
              ),
            });
          }
          }}
        />
      )}
    </>
  );
}

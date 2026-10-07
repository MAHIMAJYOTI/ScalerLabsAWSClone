"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "../client";
import { zoneKeys } from "./hostedZones";
import type {
  ChangeResponse,
  RecordBatchCreatePayload,
  RecordBatchDeleteResponse,
  RecordCreateResponse,
  RecordListResponse,
  RecordOut,
  RecordUpdatePayload,
  RecordUpdateResponse,
  ZoneFileImportResponse,
} from "../types";

export type RecordSortField = "name" | "type" | "ttl" | "routing_policy";

export interface RecordListParams {
  q?: string;
  /** CSV of record types, e.g. "A,MX". */
  types?: string;
  routingPolicy?: string;
  alias?: boolean;
  page: number;
  pageSize: number;
  sortBy?: RecordSortField;
  sortOrder?: "asc" | "desc";
}

export const recordKeys = {
  all: (zoneId: string) => ["records", zoneId] as const,
  list: (zoneId: string, params: RecordListParams) =>
    [...recordKeys.all(zoneId), "list", params] as const,
  detail: (zoneId: string, recordId: string) =>
    [...recordKeys.all(zoneId), "detail", recordId] as const,
};

function recordsPath(zoneId: string): string {
  return `/api/v1/hostedzones/${zoneId}/records`;
}

export function useRecords(zoneId: string, params: RecordListParams) {
  const search = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  });
  if (params.q) search.set("q", params.q);
  if (params.types) search.set("type", params.types);
  if (params.routingPolicy) search.set("routing_policy", params.routingPolicy);
  if (params.alias !== undefined) search.set("alias", String(params.alias));
  if (params.sortBy) {
    search.set("sort_by", params.sortBy);
    search.set("sort_order", params.sortOrder ?? "asc");
  }
  return useQuery({
    queryKey: recordKeys.list(zoneId, params),
    queryFn: () =>
      api.get<RecordListResponse>(`${recordsPath(zoneId)}?${search.toString()}`),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export function useRecord(zoneId: string, recordId: string) {
  return useQuery({
    queryKey: recordKeys.detail(zoneId, recordId),
    queryFn: () => api.get<RecordOut>(`${recordsPath(zoneId)}/${recordId}`),
  });
}

function useInvalidateRecords(zoneId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: recordKeys.all(zoneId) });
    void queryClient.invalidateQueries({ queryKey: zoneKeys.detail(zoneId) });
    void queryClient.invalidateQueries({ queryKey: zoneKeys.all });
  };
}

export function useCreateRecords(zoneId: string) {
  const invalidate = useInvalidateRecords(zoneId);
  return useMutation({
    mutationFn: (payload: RecordBatchCreatePayload) =>
      api.post<RecordCreateResponse>(recordsPath(zoneId), payload),
    onSuccess: invalidate,
  });
}

export function useUpdateRecord(zoneId: string) {
  const invalidate = useInvalidateRecords(zoneId);
  return useMutation({
    mutationFn: ({
      recordId,
      payload,
    }: {
      recordId: string;
      payload: RecordUpdatePayload;
    }) =>
      api.put<RecordUpdateResponse>(
        `${recordsPath(zoneId)}/${recordId}`,
        payload,
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteRecord(zoneId: string) {
  const invalidate = useInvalidateRecords(zoneId);
  return useMutation({
    mutationFn: (recordId: string) =>
      api.delete<ChangeResponse>(`${recordsPath(zoneId)}/${recordId}`),
    onSuccess: invalidate,
  });
}

export function useBatchDeleteRecords(zoneId: string) {
  const invalidate = useInvalidateRecords(zoneId);
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post<RecordBatchDeleteResponse>(
        `${recordsPath(zoneId)}/batch-delete`,
        { ids },
      ),
    onSuccess: invalidate,
  });
}

export function useImportZoneFile(zoneId: string) {
  const invalidate = useInvalidateRecords(zoneId);
  return useMutation({
    mutationFn: (zoneFile: string) =>
      api.post<ZoneFileImportResponse>(`${recordsPath(zoneId)}/import`, {
        zone_file: zoneFile,
      }),
    onSuccess: invalidate,
  });
}

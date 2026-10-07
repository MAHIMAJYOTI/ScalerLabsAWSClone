"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "../client";
import type {
  ChangeResponse,
  HostedZoneCreate,
  HostedZoneCreateResponse,
  HostedZoneDetail,
  HostedZoneListResponse,
} from "../types";

export type ZoneSortField = "name" | "record_count" | "comment" | "created_at";

export interface HostedZoneListParams {
  q?: string;
  type?: "public" | "private";
  page: number;
  pageSize: number;
  sortBy: ZoneSortField;
  sortOrder: "asc" | "desc";
}

export const zoneKeys = {
  all: ["hostedzones"] as const,
  list: (params: HostedZoneListParams) =>
    [...zoneKeys.all, "list", params] as const,
  detail: (zoneId: string) => [...zoneKeys.all, "detail", zoneId] as const,
};

export function useHostedZones(params: HostedZoneListParams) {
  const search = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
    sort_by: params.sortBy,
    sort_order: params.sortOrder,
  });
  if (params.q) search.set("q", params.q);
  if (params.type) search.set("type", params.type);

  return useQuery({
    queryKey: zoneKeys.list(params),
    queryFn: () =>
      api.get<HostedZoneListResponse>(`/api/v1/hostedzones?${search.toString()}`),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}

export function useHostedZone(zoneId: string | null) {
  return useQuery({
    queryKey: zoneKeys.detail(zoneId ?? ""),
    queryFn: () => api.get<HostedZoneDetail>(`/api/v1/hostedzones/${zoneId}`),
    enabled: Boolean(zoneId),
  });
}

export function useCreateHostedZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: HostedZoneCreate) =>
      api.post<HostedZoneCreateResponse>("/api/v1/hostedzones", payload),
    onSuccess: (response) => {
      queryClient.setQueryData(
        zoneKeys.detail(response.hosted_zone.id),
        response.hosted_zone,
      );
      void queryClient.invalidateQueries({ queryKey: zoneKeys.all });
    },
  });
}

export function useUpdateHostedZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      zoneId,
      comment,
    }: {
      zoneId: string;
      comment: string | null;
    }) => api.patch<HostedZoneDetail>(`/api/v1/hostedzones/${zoneId}`, { comment }),
    onSuccess: (zone) => {
      queryClient.setQueryData(zoneKeys.detail(zone.id), zone);
      void queryClient.invalidateQueries({ queryKey: zoneKeys.all });
    },
  });
}

export function useDeleteHostedZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string) =>
      api.delete<ChangeResponse>(`/api/v1/hostedzones/${zoneId}`),
    onSuccess: (_response, zoneId) => {
      queryClient.removeQueries({ queryKey: zoneKeys.detail(zoneId) });
      void queryClient.invalidateQueries({ queryKey: zoneKeys.all });
    },
  });
}

export interface BatchDeleteZoneResult {
  id: string;
  ok: boolean;
  change_id?: string;
  error?: { code: string; message: string };
}

export function useBatchDeleteZones() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post<{ results: BatchDeleteZoneResult[] }>(
        "/api/v1/hostedzones/batch-delete",
        { ids },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: zoneKeys.all });
    },
  });
}

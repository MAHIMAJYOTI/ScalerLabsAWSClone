"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "../client";
import type { ChangeOut } from "../types";

export function useChange(changeId: string, enabled = true) {
  return useQuery({
    queryKey: ["changes", changeId],
    queryFn: () => api.get<ChangeOut>(`/api/v1/changes/${changeId}`),
    enabled,
    staleTime: 0,
  });
}

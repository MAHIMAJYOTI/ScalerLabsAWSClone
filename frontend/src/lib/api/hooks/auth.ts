"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../client";
import type { LoginRequest, UserOut } from "../types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<UserOut>("/api/v1/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginRequest) =>
      api.post<UserOut>("/api/v1/auth/login", credentials),
    onSuccess: (user) => {
      queryClient.setQueryData(["me"], user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/api/v1/auth/logout"),
    onSettled: () => {
      queryClient.clear();
    },
  });
}

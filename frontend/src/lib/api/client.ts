import type { ApiErrorDetail } from "./types";

export class ApiError extends Error {
  readonly name = "ApiError";

  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: ApiErrorDetail[];
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Try again.";
}

// Generous timeout: a free-tier backend can cold-start for 30-60s, so the
// client must never abort a request prematurely while it warms up.
const REQUEST_TIMEOUT_MS = 75_000;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  // Session gone anywhere in the console → back to the login page.
  if (response.status === 401 && typeof window !== "undefined") {
    const onLoginPage = window.location.pathname === "/login";
    const isLoginCall = path.endsWith("/auth/login");
    if (!onLoginPage && !isLoginCall) {
      // Intentional full navigation: drops all in-memory state (query cache,
      // form state) when the session dies. This module isn't a component, so
      // the Next router isn't available here anyway.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let data: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // non-JSON body (e.g. proxy error page) — fall through to status error
    }
  }

  if (!response.ok) {
    const envelope = (data ?? {}) as ErrorEnvelope;
    throw new ApiError(
      envelope.error?.code ?? "UnknownError",
      envelope.error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      envelope.error?.details ?? [],
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

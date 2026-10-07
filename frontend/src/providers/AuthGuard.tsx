"use client";

import Spinner from "@cloudscape-design/components/spinner";

import { useMe } from "@/lib/api/hooks/auth";

/**
 * Client-side gate for the console: blocks rendering until GET /auth/me
 * resolves. A 401 triggers the api client's redirect to /login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const me = useMe();

  if (me.isPending) {
    return (
      <div className="r53-center-fill">
        <Spinner size="large" />
      </div>
    );
  }
  if (me.isError) {
    // The api client is already navigating to /login; render nothing meanwhile.
    return null;
  }
  return <>{children}</>;
}

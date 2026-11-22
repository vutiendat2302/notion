"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { fetchCurrentUser } from "@/features/users/api";
import { ApiClientError } from "@/lib/api/client";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchCurrentUser,
    retry: false,
  });

  useEffect(() => {
    if (
      meQuery.isError &&
      meQuery.error instanceof ApiClientError &&
      meQuery.error.status === 401
    ) {
      const nextParam =
        pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${nextParam}`);
    }
  }, [meQuery.error, meQuery.isError, pathname, router]);

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-6">
          <div className="h-4 w-28 animate-pulse rounded bg-secondary" />
          <div className="h-3 w-full animate-pulse rounded bg-secondary" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
        </div>
      </div>
    );
  }

  if (meQuery.isError && meQuery.error instanceof ApiClientError && meQuery.error.status === 401) {
    return null;
  }

  return <>{children}</>;
}

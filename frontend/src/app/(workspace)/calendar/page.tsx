"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";

import { fetchCategories, fetchOccurrenceCatalog, fetchProjects } from "@/features/tasks/api";
import { fetchCurrentUser } from "@/features/users/api";
import { ApiClientError } from "@/lib/api/client";

const CalendarBoard = dynamic(() => import("@/features/calendar/calendar-board"), {
  ssr: false,
  loading: () => <div className="h-[34rem] animate-pulse rounded-xl border border-border bg-card" />,
});

export default function CalendarPage() {
  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const catalog = useQuery({ queryKey: ["occurrence-catalog"], queryFn: fetchOccurrenceCatalog });
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const projects = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  if (user.error instanceof ApiClientError && user.error.status === 401) {
    return <section className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-2xl font-semibold">Lịch của bạn</h1>
      <p className="mt-2 text-sm text-muted-foreground">Đăng nhập để xem và sắp xếp task.</p>
      <Link href="/login" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Đăng nhập</Link>
    </section>;
  }

  return <div className="space-y-5">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Calendar</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Lịch & khung giờ</h1>
      <p className="mt-1 text-sm text-muted-foreground">Thả task từ Inbox vào lịch, hoặc dời một lần thực hiện trên lịch.</p>
    </header>
    {catalog.isLoading || user.isLoading ?
      <div className="h-[34rem] animate-pulse rounded-xl border border-border bg-card" aria-busy="true" /> :
      catalog.isError || user.isError ?
        <div className="rounded-xl border border-destructive/30 bg-card p-5 text-sm text-destructive">
          Không tải được lịch. <button type="button" className="underline" onClick={() => void catalog.refetch()}>Thử lại</button>
        </div> : <>
          {catalog.data?.truncated && <p className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">Đang hiển thị {catalog.data.items.length}/{catalog.data.total} lần thực hiện.</p>}
          <CalendarBoard
            items={catalog.data?.items ?? []}
            categories={categories.data ?? []}
            projects={projects.data ?? []}
            timezone={user.data?.settings?.timezone ?? "Asia/Ho_Chi_Minh"}
            firstDay={(user.data?.settings?.week_starts_on ?? 1) % 7}
          />
        </>}
  </div>;
}

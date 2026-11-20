"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { createCategory, fetchCategories, updateCategory } from "@/features/tasks/api";
import { fetchCurrentUser, updateSettings } from "@/features/users/api";
import { ApiClientError } from "@/lib/api/client";
import type { AccentToken, Category, UserSettings } from "@/types/domain";

const ACCENTS: AccentToken[] = ["LAVENDER", "SAGE", "PEACH", "ROSE", "BUTTER", "SKY", "SLATE"];

function CategorySettings() {
  const client = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const [name, setName] = useState("");
  const [accent, setAccent] = useState<AccentToken>("SKY");
  const add = useMutation({ mutationFn: () => createCategory({ name: name.trim(), accent_token: accent }), onSuccess: async () => { setName(""); await client.invalidateQueries({ queryKey: ["categories"] }); toast.success("Đã tạo danh mục."); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Không tạo được danh mục.") });
  const update = useMutation({ mutationFn: ({ item, payload }: { item: Category; payload: { name?: string; accent_token?: AccentToken; archived?: boolean } }) => updateCategory(item.id, payload), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["categories"] }); toast.success("Đã cập nhật danh mục."); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Không cập nhật được danh mục.") });
  return <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-sm font-semibold">Danh mục</h2><p className="mt-1 text-xs text-muted-foreground">Màu được dùng nhất quán cho task và project.</p>
    {categories.isLoading ? <p className="mt-4 text-sm text-muted-foreground" aria-busy="true">Đang tải…</p> : categories.isError ? <p className="mt-4 text-sm text-destructive">Không tải được danh mục. <button type="button" onClick={() => void categories.refetch()} className="underline">Thử lại</button></p> : <div className="mt-4 space-y-2">{categories.data?.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm"><span className="min-w-0 flex-1 font-medium">{item.name}</span><select aria-label={`Màu của ${item.name}`} value={item.accent_token} onChange={(event) => update.mutate({ item, payload: { accent_token: event.target.value as AccentToken } })} className="min-h-9 rounded-md border border-border bg-background px-2 text-xs">{ACCENTS.map((color) => <option key={color} value={color}>{color}</option>)}</select><button type="button" disabled={update.isPending} onClick={() => { const value = window.prompt("Tên danh mục", item.name)?.trim(); if (value && value !== item.name) update.mutate({ item, payload: { name: value } }); }} className="min-h-9 rounded-md px-2 text-xs hover:bg-secondary">Đổi tên</button><button type="button" disabled={update.isPending} onClick={() => { if (window.confirm(`Lưu trữ danh mục “${item.name}”?`)) update.mutate({ item, payload: { archived: true } }); }} className="min-h-9 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary">Lưu trữ</button></div>)}</div>}
    <form onSubmit={(event) => { event.preventDefault(); add.mutate(); }} className="mt-4 flex flex-wrap gap-2"><input aria-label="Tên danh mục mới" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Tên danh mục" className="min-h-10 min-w-40 flex-1 rounded-lg border border-border bg-background px-3 text-sm" /><select aria-label="Màu danh mục mới" value={accent} onChange={(event) => setAccent(event.target.value as AccentToken)} className="min-h-10 rounded-lg border border-border bg-background px-2 text-sm">{ACCENTS.map((color) => <option key={color} value={color}>{color}</option>)}</select><button type="submit" disabled={!name.trim() || add.isPending} className="min-h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">Thêm</button></form>
  </section>;
}

function SettingsContent({ settings }: { settings: UserSettings }) {
  const client = useQueryClient();
  const [timezone, setTimezone] = useState(settings.timezone);
  const [weekStarts, setWeekStarts] = useState(settings.week_starts_on);
  const [workStart, setWorkStart] = useState(typeof settings.working_hours_json?.start === "string" ? settings.working_hours_json.start : "");
  const [workEnd, setWorkEnd] = useState(typeof settings.working_hours_json?.end === "string" ? settings.working_hours_json.end : "");
  const save = useMutation({ mutationFn: () => updateSettings({ timezone: timezone.trim(), week_starts_on: weekStarts, working_hours_json: workStart && workEnd ? { start: workStart, end: workEnd } : null }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["me"] }); await client.invalidateQueries({ queryKey: ["planning-period"] }); await client.invalidateQueries({ queryKey: ["calendar-events"] }); toast.success("Đã lưu cài đặt."); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Không lưu được cài đặt.") });
  const validTimezone = (() => { try { new Intl.DateTimeFormat("en", { timeZone: timezone }); return true; } catch { return false; } })();
  const validHours = (!workStart && !workEnd) || (Boolean(workStart && workEnd) && workStart < workEnd);
  return <div className="space-y-5"><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Settings</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Cài đặt</h1><p className="mt-1 text-sm text-muted-foreground">Giao diện, múi giờ và cách bắt đầu tuần.</p></header>
      <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-sm font-semibold">Giao diện</h2><p className="mt-1 text-xs text-muted-foreground">Theme được lưu vào tài khoản và dùng trên các thiết bị.</p><div className="mt-3"><ThemeSwitcher /></div></section>
      <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-sm font-semibold">Thời gian & lịch</h2><form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} className="mt-4 grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium">Múi giờ IANA<input required value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Asia/Ho_Chi_Minh" className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal" />{!validTimezone && <span className="text-destructive">Múi giờ không hợp lệ.</span>}</label><label className="grid gap-1 text-xs font-medium">Ngày đầu tuần<select value={weekStarts} onChange={(event) => setWeekStarts(Number(event.target.value))} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal">{[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>{["", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"][day]}</option>)}</select></label><label className="grid gap-1 text-xs font-medium">Bắt đầu làm việc<input type="time" value={workStart} onChange={(event) => setWorkStart(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal" /></label><label className="grid gap-1 text-xs font-medium">Kết thúc làm việc<input type="time" value={workEnd} onChange={(event) => setWorkEnd(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal" />{!validHours && <span className="text-destructive">Giờ kết thúc phải sau giờ bắt đầu, hoặc để trống cả hai.</span>}</label><div className="sm:col-span-2 flex justify-end"><button type="submit" disabled={!validTimezone || !validHours || save.isPending} className="min-h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">{save.isPending ? "Đang lưu…" : "Lưu cài đặt"}</button></div></form></section>
      <CategorySettings />
  </div>;
}

export default function SettingsPage() {
  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  if (user.error instanceof ApiClientError && user.error.status === 401) return <section className="rounded-xl border border-border bg-card p-6"><h1 className="text-xl font-semibold">Settings</h1><p className="mt-2 text-sm text-muted-foreground">Đăng nhập để cập nhật cài đặt.</p><Link href="/login" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Đăng nhập</Link></section>;
  if (user.isLoading) return <div className="h-40 animate-pulse rounded-xl bg-card" aria-busy="true" />;
  if (user.isError || !user.data?.settings) return <p className="rounded-xl border border-destructive/30 bg-card p-5 text-sm text-destructive">Không tải được cài đặt. <button type="button" onClick={() => void user.refetch()} className="underline">Thử lại</button></p>;
  return <SettingsContent settings={user.data.settings} />;
}

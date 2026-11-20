"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { createProject, updateProject, type ProjectInput } from "@/features/projects/api";
import { fetchCategories, fetchOccurrences, fetchProjects } from "@/features/tasks/api";
import { fetchCurrentUser } from "@/features/users/api";
import { ApiClientError } from "@/lib/api/client";
import type { Project } from "@/types/domain";

const EMPTY: ProjectInput = { title: "", description: null, category_id: null, status: "ACTIVE", start_date: null, target_date: null };
const STATUS_LABELS: Record<Project["status"], string> = { PLANNED: "Dự kiến", ACTIVE: "Đang làm", ON_HOLD: "Tạm dừng", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy" };

function ProjectForm({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const client = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const [form, setForm] = useState<ProjectInput>(project ? { title: project.title, description: project.description, category_id: project.category_id, status: project.status, start_date: project.start_date, target_date: project.target_date } : EMPTY);
  const mutation = useMutation({
    mutationFn: () => project ? updateProject(project.id, { ...form, title: form.title.trim(), expected_version: project.version }) : createProject({ ...form, title: form.title.trim() }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["projects"] }); toast.success(project ? "Đã cập nhật project." : "Đã tạo project."); onClose(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Không lưu được project."),
  });
  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  return <section className="rounded-xl border border-primary/30 bg-card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{project ? "Sửa project" : "Project mới"}</h2><button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Đóng</button></div>
    <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-medium sm:col-span-2">Tên project<input required maxLength={160} value={form.title} onChange={(event) => set("title", event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal" /></label>
      <label className="grid gap-1 text-xs font-medium sm:col-span-2">Mô tả<textarea rows={3} value={form.description ?? ""} onChange={(event) => set("description", event.target.value || null)} className="rounded-lg border border-border bg-background p-3 text-sm font-normal" /></label>
      <label className="grid gap-1 text-xs font-medium">Trạng thái<select value={form.status} onChange={(event) => set("status", event.target.value as Project["status"])} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal">{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium">Danh mục<select value={form.category_id ?? ""} onChange={(event) => set("category_id", event.target.value || null)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal"><option value="">Không có</option>{(categories.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium">Ngày bắt đầu<input type="date" value={form.start_date ?? ""} onChange={(event) => set("start_date", event.target.value || null)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal" /></label>
      <label className="grid gap-1 text-xs font-medium">Ngày mục tiêu<input type="date" min={form.start_date ?? undefined} value={form.target_date ?? ""} onChange={(event) => set("target_date", event.target.value || null)} className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal" /></label>
      <div className="sm:col-span-2 flex justify-end"><button type="submit" disabled={!form.title.trim() || mutation.isPending} className="min-h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">{mutation.isPending ? "Đang lưu…" : "Lưu project"}</button></div>
    </form>
  </section>;
}

function ProjectDetail({ project, onEdit, onArchived }: { project: Project; onEdit: () => void; onArchived: () => void }) {
  const client = useQueryClient();
  const occurrences = useQuery({ queryKey: ["project-occurrences", project.id], queryFn: () => fetchOccurrences("all", { project_id: project.id, limit: 200 }) });
  const archive = useMutation({ mutationFn: () => updateProject(project.id, { archived: true, expected_version: project.version }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["projects"] }); toast.success("Đã lưu trữ project."); onArchived(); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Không lưu trữ được project.") });
  const items = occurrences.data?.items ?? [];
  const eligible = items.filter((item) => item.status !== "SKIPPED" && item.status !== "CANCELLED");
  const done = eligible.filter((item) => item.status === "DONE").length;
  const estimated = eligible.reduce((total, item) => total + (item.estimated_minutes ?? 0), 0);
  return <section className="rounded-xl border border-border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wider text-primary">{STATUS_LABELS[project.status]}</p><h2 className="mt-1 text-xl font-semibold">{project.title}</h2><p className="mt-1 text-sm text-muted-foreground">{project.description || "Chưa có mô tả."}</p></div><div className="flex gap-2"><button type="button" onClick={onEdit} className="min-h-10 rounded-lg border border-border px-3 text-sm">Sửa</button><button type="button" disabled={archive.isPending} onClick={() => { if (window.confirm(`Lưu trữ project “${project.title}”? Các task vẫn được giữ lại.`)) archive.mutate(); }} className="min-h-10 rounded-lg border border-border px-3 text-sm text-muted-foreground disabled:opacity-50">Lưu trữ</button></div></div>
    <div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3"><div><span className="block text-xs text-muted-foreground">Tiến độ lần thực hiện</span><strong className="text-lg tabular-nums">{occurrences.isLoading ? "…" : eligible.length ? `${Math.round(done / eligible.length * 100)}%` : "—"}</strong><span className="ml-1 text-xs text-muted-foreground">{done}/{eligible.length}</span></div><div><span className="block text-xs text-muted-foreground">Thời gian dự kiến</span><strong className="text-lg tabular-nums">{occurrences.isLoading ? "…" : `${estimated} phút`}</strong></div><div><span className="block text-xs text-muted-foreground">Ngày mục tiêu</span><strong className="text-lg">{project.target_date ?? "—"}</strong></div></div>
    {occurrences.data && occurrences.data.pagination.total > items.length && <p className="mt-3 text-xs text-muted-foreground">Hiển thị {items.length}/{occurrences.data.pagination.total} lần thực hiện. Mở Tasks để xem đầy đủ.</p>}
    {occurrences.isError && <p className="mt-3 text-sm text-destructive">Không tải được task. <button type="button" onClick={() => void occurrences.refetch()} className="underline">Thử lại</button></p>}
    <div className="mt-5 border-t border-border pt-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Lần thực hiện</h3><Link href={`/tasks?scope=all&project_id=${project.id}`} className="text-xs font-medium text-primary underline">Mở Tasks</Link></div>{items.length === 0 && !occurrences.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Chưa có task thuộc project.</p> : <div className="mt-3 space-y-2">{items.slice(0, 20).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"><span className="truncate">{item.task.title}</span><span className="shrink-0 text-xs text-muted-foreground">{item.status === "DONE" ? "Đã xong" : item.scheduled_date ?? "Chưa xếp lịch"}</span></div>)}</div>}</div>
    <p className="mt-4 text-xs text-muted-foreground">Tiến độ dựa trên lần thực hiện đã xong / lần hợp lệ đang hiển thị. Thời gian thực tế sẽ có sau khi Time Tracking API hoạt động.</p>
  </section>;
}

export default function ProjectsPage() {
  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const projects = useQuery({ queryKey: ["projects"], queryFn: fetchProjects, enabled: Boolean(user.data) });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | null | "new">(null);
  const selected = projects.data?.find((item) => item.id === selectedId) ?? null;
  if (user.error instanceof ApiClientError && user.error.status === 401) return <section className="rounded-xl border border-border bg-card p-6"><h1 className="text-xl font-semibold">Projects</h1><p className="mt-2 text-sm text-muted-foreground">Đăng nhập để quản lý project.</p><Link href="/login" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Đăng nhập</Link></section>;
  return <div className="space-y-5"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Projects</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Dự án của bạn</h1><p className="mt-1 text-sm text-muted-foreground">Nhóm task theo mục tiêu và theo dõi tiến độ thực hiện.</p></div><button type="button" onClick={() => setEditing("new")} className="min-h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground">Tạo project</button></header>
    {editing && <ProjectForm key={editing === "new" ? "new" : `${editing.id}-${editing.version}`} project={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    {projects.isLoading || user.isLoading ? <div className="h-40 animate-pulse rounded-xl bg-card" aria-busy="true" /> : projects.isError || user.isError ? <p className="rounded-xl border border-destructive/30 bg-card p-5 text-sm text-destructive">Không tải được project. <button type="button" onClick={() => void projects.refetch()} className="underline">Thử lại</button></p> : <div className="grid gap-4 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]"><section className="rounded-xl border border-border bg-card p-3"><h2 className="px-2 pb-2 text-sm font-semibold">Danh sách · {projects.data?.length ?? 0}</h2>{projects.data?.length === 0 ? <p className="px-2 py-4 text-sm text-muted-foreground">Chưa có project.</p> : <div className="space-y-1">{projects.data?.map((project) => <button key={project.id} type="button" onClick={() => setSelectedId(project.id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary ${selectedId === project.id ? "bg-accent" : ""}`}><span className="block truncate font-medium">{project.title}</span><span className="text-xs text-muted-foreground">{STATUS_LABELS[project.status]}</span></button>)}</div>}</section>{selected ? <ProjectDetail project={selected} onEdit={() => setEditing(selected)} onArchived={() => setSelectedId(null)} /> : <section className="grid min-h-48 place-items-center rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Chọn một project để xem chi tiết.</section>}</div>}
  </div>;
}

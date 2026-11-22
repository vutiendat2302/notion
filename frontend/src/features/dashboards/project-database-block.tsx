"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { dateInTimeZone } from "@/features/planning/period";
import {
  completeOccurrence,
  createProject,
  createTask,
  deleteProject,
  fetchOccurrences,
  fetchProjects,
  reopenOccurrence,
  updateProject,
} from "@/features/tasks/api";
import { fetchCurrentUser } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import type { OccurrenceWithTask, Project } from "@/types/domain";

const PROJECT_STATUS_STYLES: Record<Project["status"], string> = {
  PLANNED: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  ACTIVE: "bg-sky-500/20 text-sky-600 dark:text-sky-300",
  ON_HOLD: "bg-amber-500/20 text-amber-600 dark:text-amber-300",
  COMPLETED: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
  CANCELLED: "bg-rose-500/20 text-rose-600 dark:text-rose-300",
};

export function ProjectDatabaseBlock({ initialTitle = "DB Project" }: { initialTitle?: string }) {
  const { locale } = useI18n();
  const client = useQueryClient();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const timezone = meQuery.data?.settings?.timezone ?? "Asia/Ho_Chi_Minh";
  const todayIso = dateInTimeZone(new Date(), timezone);

  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const occsQuery = useQuery({
    queryKey: ["occurrences", "all", "dashboard-notion"],
    queryFn: () => fetchOccurrences("all", { limit: 250 }),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | Project["status"]>("");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [newProjTitle, setNewProjTitle] = useState("");
  const [newProjTarget, setNewProjTarget] = useState("");
  const [childTaskDrafts, setChildTaskDrafts] = useState<Record<string, string>>({});

  const tasksByProject = useMemo(() => {
    const map = new Map<string, OccurrenceWithTask[]>();
    for (const occ of occsQuery.data?.items ?? []) {
      const pid = occ.task.project_id;
      if (!pid) continue;
      const list = map.get(pid) ?? [];
      list.push(occ);
      map.set(pid, list);
    }
    return map;
  }, [occsQuery.data?.items]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projectsQuery.data ?? []).filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projectsQuery.data, search, statusFilter]);

  const createProjMut = useMutation({
    mutationFn: () =>
      createProject({
        title: newProjTitle.trim(),
        status: "ACTIVE",
        start_date: todayIso,
        target_date: newProjTarget || null,
      }),
    onSuccess: async () => {
      setNewProjTitle("");
      setNewProjTarget("");
      await client.invalidateQueries({ queryKey: ["projects"] });
      toast.success(locale === "en" ? "Project created" : "Đã tạo Project");
    },
  });

  const patchProjMut = useMutation({
    mutationFn: ({
      proj,
      patch,
    }: {
      proj: Project;
      patch: Partial<{ title: string; status: Project["status"]; target_date: string | null }>;
    }) =>
      updateProject(proj.id, {
        ...patch,
        expected_version: proj.version,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const archiveProjMut = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const createChildTaskMut = useMutation({
    mutationFn: ({ projectId, title }: { projectId: string; title: string }) =>
      createTask({
        title,
        project_id: projectId,
        scheduled_date: todayIso,
        priority: "MEDIUM",
        status: "NOT_STARTED",
      }),
    onSuccess: async (_data, vars) => {
      setChildTaskDrafts((p) => ({ ...p, [vars.projectId]: "" }));
      await client.invalidateQueries({ queryKey: ["occurrences"] });
      toast.success(locale === "en" ? "Child task added" : "Đã thêm Task con");
    },
  });

  function handleCreateProj(e: FormEvent) {
    e.preventDefault();
    if (!newProjTitle.trim() || createProjMut.isPending) return;
    createProjMut.mutate();
  }

  return (
    <section className="w-full space-y-3 text-xs">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{initialTitle}</h2>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={locale === "en" ? "Search projects..." : "Tìm dự án..."}
              className="h-8 w-40 rounded-lg border border-input bg-background pr-2.5 pl-8 text-xs outline-none focus:border-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | Project["status"])}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
          >
            <option value="">{locale === "en" ? "All Status" : "Mọi trạng thái"}</option>
            <option value="PLANNED">PLANNED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ON_HOLD">ON_HOLD</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
      </div>

      {/* Inline Create Project Row */}
      <form onSubmit={handleCreateProj} className="flex flex-wrap gap-2">
        <input
          value={newProjTitle}
          onChange={(e) => setNewProjTitle(e.target.value)}
          placeholder={locale === "en" ? "+ New project title..." : "+ Tên dự án mới..."}
          className="h-8 min-w-48 flex-1 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
        />
        <input
          type="date"
          value={newProjTarget}
          onChange={(e) => setNewProjTarget(e.target.value)}
          aria-label="Target date"
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
        />
        <button
          type="submit"
          disabled={!newProjTitle.trim() || createProjMut.isPending}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{locale === "en" ? "New Project" : "Tạo Project"}</span>
        </button>
      </form>

      {/* Projects Table with Expandable Child Tasks */}
      <div className="w-full overflow-x-auto border-t border-border/70">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/70 text-[11px] font-normal text-muted-foreground">
              <th className="w-[40%] py-2 pr-3 font-normal">Aa Project (Click to view Tasks)</th>
              <th className="w-[18%] border-l border-border/50 px-3 py-2 font-normal">Status</th>
              <th className="w-[16%] border-l border-border/50 px-3 py-2 font-normal">Target Date</th>
              <th className="w-[20%] border-l border-border/50 px-3 py-2 font-normal">Progress</th>
              <th className="w-[6%] border-l border-border/50 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  {locale === "en" ? "No projects yet." : "Chưa có Project nào."}
                </td>
              </tr>
            ) : (
              filteredProjects.map((proj) => {
                const children = tasksByProject.get(proj.id) ?? [];
                const doneCount = children.filter((t) => t.status === "DONE").length;
                const pct = children.length ? Math.round((doneCount / children.length) * 100) : 0;
                const isExpanded = expandedProjectId === proj.id;

                return (
                  <FragmentWithChildren
                    key={proj.id}
                    proj={proj}
                    childrenTasks={children}
                    doneCount={doneCount}
                    pct={pct}
                    isExpanded={isExpanded}
                    onToggleExpand={() =>
                      setExpandedProjectId((prev) => (prev === proj.id ? null : proj.id))
                    }
                    onPatchStatus={(nextStatus) =>
                      patchProjMut.mutate({ proj, patch: { status: nextStatus } })
                    }
                    onDelete={() => archiveProjMut.mutate(proj.id)}
                    childDraft={childTaskDrafts[proj.id] ?? ""}
                    onChildDraftChange={(val) =>
                      setChildTaskDrafts((p) => ({ ...p, [proj.id]: val }))
                    }
                    onAddChildTask={() => {
                      const title = (childTaskDrafts[proj.id] ?? "").trim();
                      if (title) createChildTaskMut.mutate({ projectId: proj.id, title });
                    }}
                    onToggleTaskDone={async (occ) => {
                      if (occ.status === "DONE") await reopenOccurrence(occ.id);
                      else await completeOccurrence(occ.id);
                      await client.invalidateQueries({ queryKey: ["occurrences"] });
                    }}
                    locale={locale}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FragmentWithChildren({
  proj,
  childrenTasks,
  doneCount,
  pct,
  isExpanded,
  onToggleExpand,
  onPatchStatus,
  onDelete,
  childDraft,
  onChildDraftChange,
  onAddChildTask,
  onToggleTaskDone,
  locale,
}: {
  proj: Project;
  childrenTasks: OccurrenceWithTask[];
  doneCount: number;
  pct: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPatchStatus: (status: Project["status"]) => void;
  onDelete: () => void;
  childDraft: string;
  onChildDraftChange: (v: string) => void;
  onAddChildTask: () => void;
  onToggleTaskDone: (occ: OccurrenceWithTask) => Promise<void>;
  locale: "vi" | "en";
}) {
  return (
    <>
      <tr className="hover:bg-secondary/35">
        <td className="py-2 pr-3 font-medium text-foreground">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex w-full items-center gap-1.5 text-left hover:text-primary"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-primary" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{proj.title}</span>
            <span className="ml-1 shrink-0 text-[10px] text-muted-foreground">
              ({childrenTasks.length})
            </span>
          </button>
        </td>

        <td className="border-l border-border/50 px-3 py-1.5">
          <select
            value={proj.status}
            onChange={(e) => onPatchStatus(e.target.value as Project["status"])}
            className={cn(
              "h-6 cursor-pointer rounded-full px-2 text-[11px] font-medium outline-none",
              PROJECT_STATUS_STYLES[proj.status]
            )}
          >
            <option value="PLANNED" className="bg-card text-foreground">
              PLANNED
            </option>
            <option value="ACTIVE" className="bg-card text-foreground">
              ACTIVE
            </option>
            <option value="ON_HOLD" className="bg-card text-foreground">
              ON_HOLD
            </option>
            <option value="COMPLETED" className="bg-card text-foreground">
              COMPLETED
            </option>
            <option value="CANCELLED" className="bg-card text-foreground">
              CANCELLED
            </option>
          </select>
        </td>

        <td className="border-l border-border/50 px-3 py-2 text-muted-foreground">
          {proj.target_date ?? "—"}
        </td>

        <td className="border-l border-border/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div style={{ width: `${pct}%` }} className="h-full bg-primary" />
            </div>
            <span className="w-14 text-right font-mono text-[10px] text-muted-foreground">
              {doneCount}/{childrenTasks.length}
            </span>
          </div>
        </td>

        <td className="border-l border-border/50 px-2 py-2 text-right">
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Archive project"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-secondary/15">
          <td colSpan={5} className="px-6 py-3">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "en" ? "Child Tasks" : "Task con thuộc Project này"}
              </p>
              {childrenTasks.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {locale === "en" ? "No child tasks yet." : "Chưa có task con nào."}
                </p>
              ) : (
                <div className="space-y-1">
                  {childrenTasks.map((occ) => (
                    <label
                      key={occ.id}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 hover:bg-background/60"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={occ.status === "DONE"}
                          onChange={() => void onToggleTaskDone(occ)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        <span
                          className={
                            occ.status === "DONE" ? "line-through text-muted-foreground" : ""
                          }
                        >
                          {occ.task.title}
                        </span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {occ.scheduled_date ?? "—"} · {occ.status}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex gap-1.5 pt-1">
                <input
                  value={childDraft}
                  onChange={(e) => onChildDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onAddChildTask();
                    }
                  }}
                  placeholder={locale === "en" ? "+ Add task to this project..." : "+ Thêm Task con vào Project này..."}
                  className="h-7 flex-1 rounded border border-input bg-background px-2 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={onAddChildTask}
                  className="h-7 rounded bg-primary px-2.5 text-[11px] font-medium text-primary-foreground"
                >
                  + Task
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

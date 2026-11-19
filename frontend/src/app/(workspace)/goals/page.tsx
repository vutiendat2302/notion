export default function GoalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Goals
        </h1>
        <p className="text-sm text-muted-foreground">
          Measured by real evidence & unit targets (hours, sessions, tasks, milestones).
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm font-medium text-foreground">
          No goals configured yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Goal creation and anti-double-count progress calculation connect to <code>/api/v1/goals</code> in Phase BE-4 / FE-3.
        </p>
      </div>
    </div>
  );
}

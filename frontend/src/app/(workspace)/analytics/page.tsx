export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Grounded metrics from Backend Metric Registry. Planned time never counts as actual active time.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Completion Rate</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">
            N/A
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            No eligible occurrences in period
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Actual Focus Time</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">
            0m
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Derived strictly from time_entries
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Activity Heatmap</p>
          <p className="mt-2 text-sm font-medium text-foreground">
            No recorded activity
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start a focus timer or complete occurrences to populate.
          </p>
        </div>
      </div>
    </div>
  );
}

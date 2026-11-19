export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Calendar & Timeline
        </h1>
        <p className="text-sm text-muted-foreground">
          Projection of task occurrences (All-day vs Time-blocked) without duplicating schedule tables.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm font-medium text-foreground">
          FullCalendar v7 Time-blocking Shell
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Lazy-loaded Day / Week / Month views will bind to <code>GET /api/v1/calendar/events</code> in Phase FE-2.
        </p>
      </div>
    </div>
  );
}

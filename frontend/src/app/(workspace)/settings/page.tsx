import { ThemeSwitcher } from "@/components/layout/theme-switcher";

const PASTEL_PALETTE = [
  { name: "Lavender — Study / Creative", tokenClass: "bg-[var(--category-lavender)]" },
  { name: "Sage — Habit / Health", tokenClass: "bg-[var(--category-sage)]" },
  { name: "Peach — Personal", tokenClass: "bg-[var(--category-peach)]" },
  { name: "Rose — Goals / Reflection", tokenClass: "bg-[var(--category-rose)]" },
  { name: "Butter — Reminder / Attention", tokenClass: "bg-[var(--category-butter)]" },
  { name: "Sky — Calendar / Time Blocks", tokenClass: "bg-[var(--category-sky)]" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Appearance, timezone defaults, and semantic Soft Blue palette.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Theme</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Light Soft Blue (#F7F9FC) or Dark Slate Blue (#111925).
          </p>
          <div className="mt-3">
            <ThemeSwitcher />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h2 className="text-sm font-semibold text-foreground">
            Time & Calendar Defaults
          </h2>
          <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              Default Timezone: <span className="font-mono text-foreground">Asia/Ho_Chi_Minh</span>
            </div>
            <div>
              Week Starts On: <span className="font-medium text-foreground">Monday</span>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h2 className="text-sm font-semibold text-foreground">
            Category Pastel Palette
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PASTEL_PALETTE.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground"
              >
                <span className={`h-3 w-3 rounded-full ${item.tokenClass}`} aria-hidden="true" />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";

export default function TimeTrackingPage() {
  return <div className="space-y-5"><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Focus</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Theo dõi thời gian</h1><p className="mt-1 text-sm text-muted-foreground">Thời gian thực tế được ghi qua timer trên máy chủ.</p></header><section className="rounded-xl border border-dashed border-border bg-card p-8"><h2 className="text-sm font-semibold">Timer chưa khả dụng</h2><p className="mt-2 text-sm text-muted-foreground">Time Tracking API thuộc BE Phase 4 và hiện chưa hoạt động. Khi backend sẵn sàng, phiên làm việc và thời lượng sẽ được lưu đồng bộ trên máy chủ.</p><Link href="/tasks" className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm hover:bg-secondary">Mở Tasks</Link></section></div>;
}

import Link from "next/link";

export default function GoalsPage() {
  return <div className="space-y-5"><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Goals</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Mục tiêu</h1><p className="mt-1 text-sm text-muted-foreground">Tiến độ theo đơn vị đo và bằng chứng thực tế.</p></header><section className="rounded-xl border border-dashed border-border bg-card p-8"><h2 className="text-sm font-semibold">Mục tiêu chưa khả dụng</h2><p className="mt-2 text-sm text-muted-foreground">Goals API và phép tính tiến độ thuộc BE Phase 4. Giao diện tạo và theo dõi mục tiêu sẽ kết nối khi API hoạt động.</p><Link href="/projects" className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm hover:bg-secondary">Xem Projects</Link></section></div>;
}

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/layout/brand-logo";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

export default function PolicyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <BrandLogo variant="full" />
          <div className="flex items-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Quay lại đăng ký</span>
            </Link>
            <ThemeSwitcher compact />
          </div>
        </header>

        <article className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8">
          <div className="border-b border-border pb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Chính sách & Điều khoản sử dụng
            </h1>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Cập nhật lần cuối: 22/11/2026
            </p>
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">1. Mục đích dịch vụ</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ứng dụng hỗ trợ lập kế hoạch cá nhân theo chu kỳ Năm, Quý, Tháng, Tuần, Ngày và theo
              dõi tiến độ công việc tập trung. Người dùng chịu trách nhiệm về tính chính xác của
              thông tin tài khoản đã đăng ký.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">2. Dữ liệu tài khoản</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Hệ thống lưu trữ Tên tài khoản, Tên hiển thị, Email và/hoặc Số điện thoại ở dạng chuẩn
              hóa nhằm xác thực danh tính và đảm bảo mỗi thông tin liên hệ chỉ gắn với một tài khoản
              duy nhất. Mật khẩu được băm một chiều trước khi lưu và không bao giờ hiển thị lại.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">3. Bảo mật phiên & Cookie</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Phiên đăng nhập sử dụng cookie HttpOnly kèm cơ chế làm mới token xoay vòng và kiểm tra
              CSRF trên các yêu cầu thay đổi dữ liệu. Bạn có thể xem lại hoặc thu hồi phiên hoạt
              động bất kỳ lúc nào trong phần Cài đặt.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">4. Quyền kiểm soát dữ liệu</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Dữ liệu kế hoạch, ghi chú và tệp đính kèm thuộc toàn quyền sở hữu của người tạo. Chúng
              tôi không chia sẻ thông tin cá nhân cho bên thứ ba ngoài phạm vi vận hành kỹ thuật của
              hệ thống.
            </p>
          </section>

          <div className="border-t border-border pt-5">
            <Link
              href="/register"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Quay lại trang đăng ký</span>
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}

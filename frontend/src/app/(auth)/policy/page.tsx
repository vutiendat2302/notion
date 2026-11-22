"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/layout/brand-logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { useI18n } from "@/i18n/i18n-provider";

export default function PolicyPage() {
  const { locale, t } = useI18n();

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <BrandLogo variant="full" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </header>

        <article className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8">
          <div className="border-b border-border pb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {locale === "en" ? "Privacy Policy & Terms of Use" : "Chính sách & Điều khoản sử dụng"}
            </h1>
            <p className="mt-1.5 text-xs text-muted-foreground">22/11/2026</p>
          </div>

          <section className="space-y-2.5">
            <h2 className="text-sm font-semibold text-foreground">
              {locale === "en"
                ? "1. About LumiPlan — Intelligent Personal Productivity Platform"
                : "1. Giới thiệu LumiPlan — Intelligent Personal Productivity Platform"}
            </h2>
            <p className="text-xs font-medium italic text-primary">Illuminate Your Plans.</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {locale === "en"
                ? "LumiPlan is an AI-integrated personal productivity and planning platform designed to help users organize tasks, manage time, track goals, and build habits scientifically."
                : "LumiPlan là nền tảng quản lý năng suất và lập kế hoạch cá nhân tích hợp trí tuệ nhân tạo, được thiết kế nhằm giúp người dùng tổ chức công việc, quản lý thời gian, theo dõi mục tiêu và phát triển thói quen một cách khoa học."}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {locale === "en"
                ? "Instead of switching across separate apps for tasks, schedules, notes, focus timers, and analytics, LumiPlan brings them together in one unified, intuitive, and highly customizable workspace."
                : "Thay vì sử dụng nhiều ứng dụng riêng biệt cho công việc, lịch trình, ghi chú, đồng hồ tập trung và thống kê, LumiPlan kết hợp những chức năng này trong một không gian làm việc thống nhất, trực quan và có khả năng cá nhân hóa cao."}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              {locale === "en" ? "2. Account Data" : "2. Dữ liệu tài khoản"}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {locale === "en"
                ? "Passwords are one-way hashed using Argon2. Email, phone number, and username are normalized to prevent duplicates."
                : "Hệ thống lưu Tên tài khoản, Email, Số điện thoại ở dạng chuẩn hóa chống trùng lặp và băm mật khẩu một chiều bằng Argon2."}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              {locale === "en" ? "3. Sessions & Cookies" : "3. Bảo mật phiên & Cookie"}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {locale === "en"
                ? "Authentication uses HttpOnly cookies with rotating refresh tokens and CSRF protection. You can revoke active sessions anytime in Settings."
                : "Phiên đăng nhập sử dụng cookie HttpOnly kèm refresh token xoay vòng và bảo vệ CSRF. Bạn có thể thu hồi phiên bất kỳ lúc nào trong Cài đặt."}
            </p>
          </section>

          <div className="border-t border-border pt-5">
            <Link
              href="/register"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>{t.common.back}</span>
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}

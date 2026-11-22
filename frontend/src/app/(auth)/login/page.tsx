"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/layout/brand-logo";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { PasswordInput } from "@/components/ui/password-input";
import { loginAccount } from "@/features/users/api";
import { ApiClientError } from "@/lib/api/client";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage("Vui lòng nhập tên tài khoản và mật khẩu.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await loginAccount({
        identifier: identifier.trim(),
        password,
        device_label: "web-browser",
      });

      toast.success("Đăng nhập thành công.");
      const nextPath = searchParams.get("next");
      const target =
        nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
          ? nextPath
          : "/today";
      router.replace(target);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Không kết nối được tới máy chủ Backend.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col justify-between bg-background px-4 py-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <BrandLogo variant="full" />
        <ThemeSwitcher />
      </header>

      <section className="mx-auto my-auto flex w-full max-w-[400px] flex-col py-8">
        <div className="rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandLogo variant="compact" className="mb-3" />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Đăng nhập</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-xs font-medium text-foreground">
                Tên tài khoản
              </label>
              <input
                id="identifier"
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Tên tài khoản"
                className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-foreground">
                Mật khẩu
              </label>
              <PasswordInput
                id="password"
                required
                minLength={1}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                wrapperClassName="mt-1.5"
                className="h-10"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Đăng ký
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-5xl items-center justify-center text-xs text-muted-foreground">
        <Link href="/policy" className="hover:text-foreground hover:underline">
          Chính sách của chúng tôi
        </Link>
      </footer>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <LoginFormContent />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/layout/brand-logo";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { PasswordInput } from "@/components/ui/password-input";
import { registerAccount } from "@/features/users/api";
import { ApiClientError } from "@/lib/api/client";
import { validateEmail, validatePhone, validateUsername } from "@/lib/validation";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const usernameError = validateUsername(username);
  const emailError = validateEmail(email);
  const phoneError = validatePhone(phone);
  const passwordError =
    password && password.length < 8 ? "Mật khẩu phải có ít nhất 8 ký tự." : null;
  const confirmError =
    confirmPassword && confirmPassword !== password ? "Mật khẩu xác nhận không khớp." : null;

  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setTouched({
      username: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
    });

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (!cleanEmail && !cleanPhone) {
      setErrorMessage("Vui lòng nhập Email hoặc Số điện thoại.");
      return;
    }
    if (usernameError || emailError || phoneError || passwordError) {
      setErrorMessage("Vui lòng kiểm tra lại thông tin đã nhập.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (!acceptedPolicy) {
      setErrorMessage("Vui lòng đồng ý với Chính sách của chúng tôi để tiếp tục.");
      return;
    }

    setSubmitting(true);
    try {
      await registerAccount({
        username: cleanUsername || null,
        display_name: displayName.trim(),
        email: cleanEmail || null,
        phone: cleanPhone || null,
        password,
        confirm_password: confirmPassword,
        accepted_policy: acceptedPolicy,
        device_label: "web-register",
      });

      toast.success("Đăng ký tài khoản thành công.");
      router.replace("/today");
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

      <section className="mx-auto my-auto flex w-full max-w-[440px] flex-col py-6">
        <div className="rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandLogo variant="compact" className="mb-3" />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Đăng ký</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label htmlFor="username" className="block text-xs font-medium text-foreground">
                  Tên tài khoản
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={() => markTouched("username")}
                  placeholder="Tên tài khoản"
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                />
                {touched.username && usernameError && (
                  <p className="mt-1 text-[11px] text-destructive">{usernameError}</p>
                )}
              </div>

              <div>
                <label htmlFor="display_name" className="block text-xs font-medium text-foreground">
                  Tên hiển thị
                </label>
                <input
                  id="display_name"
                  type="text"
                  required
                  maxLength={120}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tên hiển thị"
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-foreground">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => markTouched("email")}
                  placeholder="Email"
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                />
                {touched.email && emailError && (
                  <p className="mt-1 text-[11px] text-destructive">{emailError}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-foreground">
                  Số điện thoại
                </label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => markTouched("phone")}
                  placeholder="Số điện thoại"
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                />
                {touched.phone && phoneError && (
                  <p className="mt-1 text-[11px] text-destructive">{phoneError}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-foreground">
                Mật khẩu
              </label>
              <PasswordInput
                id="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => markTouched("password")}
                placeholder="Mật khẩu"
                wrapperClassName="mt-1.5"
                className="h-10"
              />
              {touched.password && passwordError && (
                <p className="mt-1 text-[11px] text-destructive">{passwordError}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirm_password"
                className="block text-xs font-medium text-foreground"
              >
                Xác nhận mật khẩu
              </label>
              <PasswordInput
                id="confirm_password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => markTouched("confirmPassword")}
                placeholder="Xác nhận mật khẩu"
                wrapperClassName="mt-1.5"
                className="h-10"
              />
              {touched.confirmPassword && confirmError && (
                <p className="mt-1 text-[11px] text-destructive">{confirmError}</p>
              )}
            </div>

            <label className="flex items-start gap-2.5 pt-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={acceptedPolicy}
                onChange={(e) => setAcceptedPolicy(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <span>
                Tôi đồng ý với{" "}
                <Link href="/policy" className="font-medium text-primary hover:underline">
                  Chính sách của chúng tôi
                </Link>
              </span>
            </label>

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
              disabled={submitting || !acceptedPolicy}
              className="mt-1 h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? "Đang tạo tài khoản…" : "Đăng ký"}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            Đã có tài khoản?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>

      <div className="h-4" />
    </main>
  );
}

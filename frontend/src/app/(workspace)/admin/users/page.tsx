"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/ui/password-input";
import {
  adminCreateUser,
  adminDisableUser,
  adminListUsers,
  adminUpdateUser,
  fetchCurrentUser,
} from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { validateEmail, validatePhone, validateUsername } from "@/lib/validation";
import type { User } from "@/types/domain";

export default function AdminUsersPage() {
  const { locale } = useI18n();
  const client = useQueryClient();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "ADMIN" | "USER">("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DISABLED" | "PENDING_DELETION">(
    ""
  );

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");

  // Edit Modal (password reset hidden behind toggle to prevent browser autofill dots)
  const [editing, setEditing] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<"ADMIN" | "USER">("USER");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "DISABLED" | "PENDING_DELETION">(
    "ACTIVE"
  );
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [editPassword, setEditPassword] = useState("");

  useEffect(() => {
    if (!createOpen && !editing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCreateOpen(false);
        setEditing(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createOpen, editing]);

  const usersQuery = useQuery({
    queryKey: ["admin-users", search, roleFilter, statusFilter],
    queryFn: () =>
      adminListUsers({
        search,
        role: roleFilter,
        status: statusFilter,
        limit: 100,
      }),
    enabled: meQuery.data?.role === "ADMIN",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateUser({
        username: newUsername.trim() || null,
        display_name: newName.trim(),
        email: newEmail.trim() || null,
        phone: newPhone.trim() || null,
        password: newPassword,
        role: newRole,
        status: "ACTIVE",
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setNewUsername("");
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewPassword("");
      setNewRole("USER");
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Đã tạo tài khoản.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed"),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("No user selected");
      return adminUpdateUser(editing.id, {
        username: editUsername.trim() || null,
        display_name: editName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        role: editRole,
        status: editStatus,
        ...(showResetPassword && editPassword ? { password: editPassword } : {}),
      });
    },
    onSuccess: async () => {
      setEditing(null);
      setShowResetPassword(false);
      setEditPassword("");
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Đã cập nhật tài khoản.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed"),
  });

  const disableMutation = useMutation({
    mutationFn: (userId: string) => adminDisableUser(userId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Đã khóa tài khoản.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed"),
  });

  if (meQuery.isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-card" aria-busy="true" />;
  }

  if (meQuery.data?.role !== "ADMIN") {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-lg font-semibold text-foreground">
          {locale === "en" ? "Access denied" : "Không có quyền truy cập"}
        </h1>
      </section>
    );
  }

  function startEdit(user: User) {
    setEditing(user);
    setEditUsername(user.username ?? "");
    setEditName(user.display_name);
    setEditEmail(user.email ?? "");
    setEditPhone(user.phone ?? "");
    setEditRole(user.role);
    setEditStatus(user.status);
    setShowResetPassword(false);
    setEditPassword("");
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    const uErr = validateUsername(newUsername);
    const eErr = validateEmail(newEmail);
    const pErr = validatePhone(newPhone);
    if (uErr || eErr || pErr) {
      toast.error(uErr ?? eErr ?? pErr ?? "Dữ liệu không hợp lệ.");
      return;
    }
    if (!newEmail.trim() && !newPhone.trim()) {
      toast.error("Phải nhập ít nhất Email hoặc Số điện thoại.");
      return;
    }
    createMutation.mutate();
  }

  function handleUpdate(event: FormEvent) {
    event.preventDefault();
    const uErr = validateUsername(editUsername);
    const eErr = validateEmail(editEmail);
    const pErr = validatePhone(editPhone);
    if (uErr || eErr || pErr) {
      toast.error(uErr ?? eErr ?? pErr ?? "Dữ liệu không hợp lệ.");
      return;
    }
    if (!editEmail.trim() && !editPhone.trim()) {
      toast.error("Tài khoản phải giữ ít nhất Email hoặc Số điện thoại.");
      return;
    }
    updateMutation.mutate();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {locale === "en" ? "Users" : "Quản lý người dùng"}
          </h1>
          <nav className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
            <span className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">
              {locale === "en" ? "Users" : "Tài khoản"}
            </span>
            <Link
              href="/admin/templates"
              className="rounded-md px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground"
            >
              {locale === "en" ? "Form & Card Templates" : "Form & Card mẫu"}
            </Link>
          </nav>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          <span>{locale === "en" ? "Create account" : "Tạo tài khoản"}</span>
        </button>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Tìm kiếm người dùng"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={locale === "en" ? "Search..." : "Tìm kiếm..."}
              className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm"
            />
          </div>
          <select
            aria-label="Vai trò"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "" | "ADMIN" | "USER")}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">{locale === "en" ? "All roles" : "Tất cả vai trò"}</option>
            <option value="ADMIN">ADMIN</option>
            <option value="USER">USER</option>
          </select>
          <select
            aria-label="Trạng thái"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "" | "ACTIVE" | "DISABLED" | "PENDING_DELETION")
            }
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">{locale === "en" ? "All statuses" : "Tất cả trạng thái"}</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </div>

        {usersQuery.isLoading ? (
          <p className="py-6 text-sm text-muted-foreground" aria-busy="true">
            {locale === "en" ? "Loading…" : "Đang tải…"}
          </p>
        ) : !usersQuery.data?.items.length ? (
          <p className="py-6 text-sm text-muted-foreground">
            {locale === "en" ? "No users found." : "Không có tài khoản."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Tên tài khoản</th>
                  <th className="py-2 pr-4 font-medium">Tên hiển thị</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Số điện thoại</th>
                  <th className="py-2 pr-4 font-medium">Vai trò</th>
                  <th className="py-2 pr-4 font-medium">Trạng thái</th>
                  <th className="py-2 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usersQuery.data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                      {item.username ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-foreground">
                      {item.display_name}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{item.email ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{item.phone ?? "—"}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                        {item.role}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={
                          item.status === "ACTIVE"
                            ? "rounded bg-[var(--category-sage-soft)] px-2 py-0.5 text-xs font-medium text-[var(--category-sage-text)]"
                            : "rounded bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive"
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium hover:bg-secondary"
                      >
                        Sửa
                      </button>
                      {item.status === "ACTIVE" && item.id !== meQuery.data?.id && (
                        <button
                          type="button"
                          disabled={disableMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Khóa tài khoản “${item.display_name}”?`)) {
                              disableMutation.mutate(item.id);
                            }
                          }}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          Khóa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Centered Create Modal */}
      {createOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreate}
            className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-semibold text-foreground">Tạo tài khoản</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium">
                Tên tài khoản
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Tên tài khoản"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Tên hiển thị
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Tên hiển thị"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Email
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Số điện thoại
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Số điện thoại"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Mật khẩu
                <PasswordInput
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mật khẩu"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Vai trò
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "ADMIN" | "USER")}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="h-9 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {createMutation.isPending ? "Đang tạo…" : "Lưu"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Centered Edit Modal */}
      {editing && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleUpdate}
            autoComplete="off"
            className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-semibold text-foreground">{editing.display_name}</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium">
                Tên tài khoản
                <input
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Tên hiển thị
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Email
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Số điện thoại
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Vai trò
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as "ADMIN" | "USER")}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Trạng thái
                <select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as "ACTIVE" | "DISABLED" | "PENDING_DELETION")
                  }
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                  <option value="PENDING_DELETION">PENDING_DELETION</option>
                </select>
              </label>
            </div>

            <div className="pt-1">
              {!showResetPassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditPassword("");
                    setShowResetPassword(true);
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  + Đặt lại mật khẩu mới (thu hồi phiên đăng nhập)
                </button>
              ) : (
                <label className="grid gap-1 text-xs font-medium">
                  Mật khẩu mới
                  <PasswordInput
                    minLength={8}
                    autoComplete="new-password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                  />
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="h-9 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {updateMutation.isPending ? "Đang lưu…" : "Cập nhật"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

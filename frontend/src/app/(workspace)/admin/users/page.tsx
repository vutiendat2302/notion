"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/ui/password-input";
import {
  adminCreateUser,
  adminDisableUser,
  adminListUsers,
  adminUpdateUser,
  fetchCurrentUser,
} from "@/features/users/api";
import { validateEmail, validatePhone, validateUsername } from "@/lib/validation";
import type { User } from "@/types/domain";

export default function AdminUsersPage() {
  const client = useQueryClient();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "ADMIN" | "USER">("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DISABLED" | "PENDING_DELETION">(
    ""
  );

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");

  // Edit modal state
  const [editing, setEditing] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<"ADMIN" | "USER">("USER");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "DISABLED" | "PENDING_DELETION">(
    "ACTIVE"
  );
  const [editPassword, setEditPassword] = useState("");

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
      setShowCreate(false);
      setNewUsername("");
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewPassword("");
      setNewRole("USER");
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Đã tạo tài khoản mới.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Không tạo được tài khoản."),
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
        ...(editPassword ? { password: editPassword } : {}),
      });
    },
    onSuccess: async () => {
      setEditing(null);
      setEditPassword("");
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Đã cập nhật tài khoản.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Không cập nhật được tài khoản."),
  });

  const disableMutation = useMutation({
    mutationFn: (userId: string) => adminDisableUser(userId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Đã khóa tài khoản.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Không khóa được tài khoản."),
  });

  if (meQuery.isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-card" aria-busy="true" />;
  }

  if (meQuery.data?.role !== "ADMIN") {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-lg font-semibold text-foreground">Không có quyền truy cập</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trang quản lý người dùng chỉ dành cho tài khoản vai trò ADMIN.
        </p>
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Admin Console
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Quản lý người dùng</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tạo, chỉnh sửa, phân quyền ADMIN/USER và khóa/mở khóa tài khoản.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((prev) => !prev)}
          className="min-h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95"
        >
          {showCreate ? "Đóng form" : "+ Tạo tài khoản"}
        </button>
      </header>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-border bg-card p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold">Tạo tài khoản mới</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium">
              Tên tài khoản
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Tên tài khoản"
                className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Tên hiển thị
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tên hiển thị"
                className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Email
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email"
                className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Số điện thoại
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Số điện thoại"
                className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Mật khẩu
              <PasswordInput
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Vai trò
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "ADMIN" | "USER")}
                className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="min-h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="min-h-9 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {createMutation.isPending ? "Đang tạo…" : "Lưu tài khoản"}
            </button>
          </div>
        </form>
      )}

      {editing && (
        <form
          onSubmit={handleUpdate}
          className="rounded-xl border border-primary/40 bg-card p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Chỉnh sửa: {editing.display_name}</h2>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Đóng
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium">
              Tên tài khoản
              <input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Tên tài khoản"
                className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Tên hiển thị
              <input
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Email
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Số điện thoại
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Vai trò
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as "ADMIN" | "USER")}
                className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
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
                className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="DISABLED">DISABLED</option>
                <option value="PENDING_DELETION">PENDING_DELETION</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Đặt lại mật khẩu (để trống nếu giữ nguyên)
              <PasswordInput
                minLength={8}
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Mật khẩu mới (nếu đổi)"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="min-h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="min-h-9 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {updateMutation.isPending ? "Đang lưu…" : "Cập nhật"}
            </button>
          </div>
        </form>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            aria-label="Tìm kiếm người dùng"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email, SĐT…"
            className="min-h-10 min-w-52 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <select
            aria-label="Lọc theo vai trò"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "" | "ADMIN" | "USER")}
            className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">Tất cả vai trò</option>
            <option value="ADMIN">ADMIN</option>
            <option value="USER">USER</option>
          </select>
          <select
            aria-label="Lọc theo trạng thái"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "" | "ACTIVE" | "DISABLED" | "PENDING_DELETION"
              )
            }
            className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </div>

        {usersQuery.isLoading ? (
          <p className="py-6 text-sm text-muted-foreground" aria-busy="true">
            Đang tải danh sách tài khoản…
          </p>
        ) : usersQuery.isError ? (
          <p className="py-6 text-sm text-destructive">Không tải được danh sách người dùng.</p>
        ) : !usersQuery.data?.items.length ? (
          <p className="py-6 text-sm text-muted-foreground">Không tìm thấy tài khoản nào.</p>
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
    </div>
  );
}

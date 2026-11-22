"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { fetchCurrentUser, logoutAccount } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { resolveMediaUrl } from "@/lib/api/client";

export function UserAvatarMenu() {
  const { t } = useI18n();
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchCurrentUser,
    retry: false,
  });

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const logoutMutation = useMutation({
    mutationFn: logoutAccount,
    onSuccess: () => {
      client.clear();
      toast.success(t.account.logout);
      router.replace("/login");
      router.refresh();
    },
    onError: () => {
      client.clear();
      router.replace("/login");
      router.refresh();
    },
  });

  const user = meQuery.data;
  const initials = (user?.display_name || user?.username || "U").slice(0, 2).toUpperCase();
  const avatarSrc = user?.avatar_file_id
    ? resolveMediaUrl(`/api/v1/storage/files/${user.avatar_file_id}/stream`)
    : null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.account.settings}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-accent text-xs font-semibold text-accent-foreground transition-transform hover:scale-105"
      >
        {avatarSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={avatarSrc}
            alt={user?.display_name ?? "Avatar"}
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl"
        >
          {user && (
            <div className="mb-1 border-b border-border px-2.5 py-2">
              <p className="truncate text-xs font-semibold text-foreground">{user.display_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user.username ? `@${user.username}` : user.email ?? user.phone}
              </p>
            </div>
          )}

          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary"
          >
            <Settings className="h-3.5 w-3.5 text-primary" />
            <span>{t.account.settings}</span>
          </Link>

          <button
            type="button"
            role="menuitem"
            disabled={logoutMutation.isPending}
            onClick={() => {
              setOpen(false);
              logoutMutation.mutate();
            }}
            className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{t.account.logout}</span>
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Camera, KeyRound, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/ui/password-input";
import { fetchAvailableAIAgents } from "@/features/ai/api";
import {
  changeMyPassword,
  fetchCurrentUser,
  logoutAccount,
  updateMyProfile,
  updateSettings,
  uploadUserFile,
} from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { resolveMediaUrl } from "@/lib/api/client";
import { validateEmail, validatePhone, validateUsername } from "@/lib/validation";
import type { AIAgentOption, User, UserSettings } from "@/types/domain";

type AgentChoice = "local" | "claude" | "codex" | "gemini";

const FALLBACK_AGENTS: AIAgentOption[] = [
  {
    id: "local",
    label: "AI Local (Ollama)",
    model_id: "qwen3:8b",
    requires_api_key: false,
    server_configured: true,
  },
  {
    id: "claude",
    label: "Claude (Anthropic)",
    model_id: "claude-sonnet-4-6",
    requires_api_key: true,
    server_configured: false,
  },
  {
    id: "codex",
    label: "Codex (OpenAI)",
    model_id: "gpt-5.4",
    requires_api_key: true,
    server_configured: false,
  },
  {
    id: "gemini",
    label: "Gemini (Google)",
    model_id: "gemini-3-flash-preview",
    requires_api_key: true,
    server_configured: false,
  },
];

function SettingsBody({ user, settings }: { user: User; settings: UserSettings }) {
  const { t, locale } = useI18n();
  const client = useQueryClient();
  const router = useRouter();

  const agentsQuery = useQuery({
    queryKey: ["ai-agents"],
    queryFn: fetchAvailableAIAgents,
    retry: false,
  });
  const agentOptions = agentsQuery.data?.length ? agentsQuery.data : FALLBACK_AGENTS;

  // Account Profile state
  const [displayName, setDisplayName] = useState(user.display_name);
  const [username, setUsername] = useState(user.username ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [avatarFileId, setAvatarFileId] = useState<string | null>(user.avatar_file_id ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // AI Agent (strictly 2 boxes: 1 dropdown + 1 API key input for selected agent)
  const savedAi = (settings.preferences_json?.ai ?? {}) as Record<string, unknown>;
  const [preferredAgent, setPreferredAgent] = useState<AgentChoice>(
    ((savedAi.preferred_agent as AgentChoice | undefined) ?? "local")
  );
  const [apiKeyInput, setApiKeyInput] = useState("");

  const activeAgentMeta =
    agentOptions.find((a) => a.id === preferredAgent) ?? agentOptions[0];
  const hasSavedUserKey =
    preferredAgent !== "local" && Boolean(savedAi[`has_${preferredAgent}_key`]);
  const savedKeyHint =
    preferredAgent !== "local" ? (savedAi[`${preferredAgent}_key_hint`] as string | undefined) : undefined;

  const saveProfile = useMutation({
    mutationFn: () =>
      updateMyProfile({
        display_name: displayName.trim(),
        username: username.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        avatar_file_id: avatarFileId,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["me"] });
      toast.success(t.account.saveProfile);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const savePassword = useMutation({
    mutationFn: () =>
      changeMyPassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      toast.success(t.account.updatePassword);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const saveAiSettings = useMutation({
    mutationFn: (opts?: { clearSelectedKey?: boolean }) => {
      const aiPayload: Record<string, unknown> = { preferred_agent: preferredAgent };
      if (preferredAgent !== "local") {
        if (opts?.clearSelectedKey) {
          aiPayload[`${preferredAgent}_api_key`] = null;
        } else if (apiKeyInput.trim()) {
          aiPayload[`${preferredAgent}_api_key`] = apiKeyInput.trim();
        }
      }
      return updateSettings({ preferences_json: { ai: aiPayload } });
    },
    onSuccess: async () => {
      setApiKeyInput("");
      await client.invalidateQueries({ queryKey: ["me"] });
      toast.success(t.common.save);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const logoutMutation = useMutation({
    mutationFn: logoutAccount,
    onSuccess: () => {
      client.clear();
      router.replace("/login");
      router.refresh();
    },
  });

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadUserFile(file, "avatars");
      setAvatarFileId(uploaded.id);
      await updateMyProfile({ avatar_file_id: uploaded.id });
      await client.invalidateQueries({ queryKey: ["me"] });
      toast.success(t.account.changeAvatar);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  }

  function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    const uErr = validateUsername(username);
    const eErr = validateEmail(email);
    const pErr = validatePhone(phone);
    if (uErr || eErr || pErr) {
      toast.error(uErr ?? eErr ?? pErr ?? "Invalid input");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      toast.error("Cần ít nhất Email hoặc Số điện thoại.");
      return;
    }
    saveProfile.mutate();
  }

  function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp.");
      return;
    }
    savePassword.mutate();
  }

  const avatarSrc = avatarFileId
    ? resolveMediaUrl(`/api/v1/storage/files/${avatarFileId}/stream`)
    : null;
  const initials = (user.display_name || user.username || "U").slice(0, 2).toUpperCase();

  const keyPlaceholder =
    preferredAgent === "local"
      ? locale === "en"
        ? "System AI Local — no API key required"
        : "AI Local hệ thống — không cần API Key"
      : hasSavedUserKey
        ? `${savedKeyHint || "••••"} (${locale === "en" ? "Saved" : "Đã lưu"})`
        : activeAgentMeta.server_configured
          ? locale === "en"
            ? "Server default key configured (optional override)"
            : "Đã cấu hình sẵn ở hệ thống (nhập nếu muốn ghi đè)"
          : preferredAgent === "claude"
            ? "sk-ant-..."
            : preferredAgent === "codex"
              ? "sk-..."
              : "AIza...";

  return (
    <div className="w-full space-y-9">
      <h1 className="sr-only">{t.nav.settings}</h1>

      {/* 1. Account Profile & Security (Enlarged balanced Avatar on left, Form on right) */}
      <section className="grid items-center gap-6 lg:grid-cols-[13.5rem_1fr]">
        <div className="flex flex-col items-center gap-3.5 text-center">
          <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-border bg-accent text-accent-foreground shadow-sm sm:h-36 sm:w-36">
            {avatarSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatarSrc} alt={user.display_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-semibold">
                {initials}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <p className="text-base font-semibold text-foreground">{user.display_name}</p>
              <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {user.role}
              </span>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary">
              <Camera className="h-3.5 w-3.5 text-primary" />
              <span>{uploadingAvatar ? t.common.loading : t.account.changeAvatar}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="space-y-5">
          <form onSubmit={handleSaveProfile} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium">
              {t.account.displayName}
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              {t.account.username}
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              {t.account.email}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              {t.account.phone}
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
              <button
                type="button"
                onClick={() => setShowPasswordForm((p) => !p)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary"
              >
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                <span>{t.account.changePassword}</span>
              </button>
              <button
                type="submit"
                disabled={saveProfile.isPending}
                className="h-9 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {saveProfile.isPending ? t.common.loading : t.account.saveProfile}
              </button>
            </div>
          </form>

          {showPasswordForm && (
            <form
              onSubmit={handlePasswordSubmit}
              className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-3"
            >
              <PasswordInput
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t.account.currentPassword}
                className="h-10 text-xs"
              />
              <PasswordInput
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.account.newPassword}
                className="h-10 text-xs"
              />
              <PasswordInput
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.account.confirmPassword}
                className="h-10 text-xs"
              />
              <div className="flex justify-end sm:col-span-3">
                <button
                  type="submit"
                  disabled={savePassword.isPending}
                  className="h-9 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground"
                >
                  {t.account.updatePassword}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* 2. AI Agent (2 Boxes full-width; Language & Theme removed as they live in Topbar) */}
      <section className="border-t border-border/70 pt-7">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveAiSettings.mutate({});
          }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">AI Agent</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Box 1: Agent Selector Dropdown */}
            <label className="grid gap-1.5 text-xs font-medium text-foreground">
              <span>{locale === "en" ? "Select Agent" : "Chọn Agent"}</span>
              <select
                aria-label={locale === "en" ? "Select Agent" : "Chọn Agent"}
                value={preferredAgent}
                onChange={(e) => {
                  setPreferredAgent(e.target.value as AgentChoice);
                  setApiKeyInput("");
                }}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary"
              >
                {agentOptions.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.label} — {agent.model_id}
                  </option>
                ))}
              </select>
            </label>

            {/* Box 2: API Key Input */}
            <div className="grid gap-1.5 text-xs font-medium text-foreground">
              <div className="flex items-center justify-between">
                <span>API Key</span>
                {hasSavedUserKey && (
                  <button
                    type="button"
                    onClick={() => saveAiSettings.mutate({ clearSelectedKey: true })}
                    className="text-[11px] font-medium text-destructive hover:underline"
                  >
                    {locale === "en" ? "Clear" : "Xóa key"}
                  </button>
                )}
              </div>
              <PasswordInput
                value={apiKeyInput}
                disabled={preferredAgent === "local"}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={keyPlaceholder}
                className="h-10 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saveAiSettings.isPending}
              className="h-9 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {saveAiSettings.isPending ? t.common.loading : t.common.save}
            </button>
          </div>
        </form>
      </section>

      {/* 3. Sign out (Last, Left-aligned) */}
      <div className="flex justify-start border-t border-border/70 pt-5">
        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-destructive/40 bg-background px-4 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          <span>{t.account.logout}</span>
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser });

  if (meQuery.isLoading || !meQuery.data || !meQuery.data.settings) {
    return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  }

  return <SettingsBody user={meQuery.data} settings={meQuery.data.settings} />;
}

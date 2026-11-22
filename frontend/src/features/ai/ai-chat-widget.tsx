"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, Send, X } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/layout/brand-logo";
import { confirmAIProposal, rejectAIProposal, sendAIChat } from "@/features/ai/api";
import { uploadUserFile } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import type { AIChatResponse, ProposedTaskItem } from "@/types/domain";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  imageName?: string;
  previewUrl?: string;
  response?: AIChatResponse;
}

export function AIChatWidget() {
  const { locale } = useI18n();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [attachedFileId, setAttachedFileId] = useState<string | null>(null);
  const [attachedName, setAttachedName] = useState<string | null>(null);
  const [attachedPreviewUrl, setAttachedPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    return () => {
      if (attachedPreviewUrl) URL.revokeObjectURL(attachedPreviewUrl);
    };
  }, [attachedPreviewUrl]);

  const chatMutation = useMutation({
    mutationFn: () =>
      sendAIChat({
        message:
          input.trim() ||
          (locale === "en"
            ? "Analyze this image and propose tasks"
            : "Phân tích ảnh và lên nhiệm vụ cho hôm nay"),
        image_file_id: attachedFileId,
        conversation_id: conversationId,
        locale,
      }),
    onSuccess: (res) => {
      if (res.conversation_id) setConversationId(res.conversation_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: res.reply_message, response: res },
      ]);
      setAttachedFileId(null);
      setAttachedName(null);
      setAttachedPreviewUrl(null);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "AI service unavailable";
      setMessages((prev) => [...prev, { role: "assistant", text: msg }]);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: ({ proposalId, items }: { proposalId: string; items: ProposedTaskItem[] }) =>
      confirmAIProposal(proposalId, { edited_items: items }),
    onSuccess: async (res) => {
      setConfirmedIds((prev) => ({ ...prev, [res.proposal_id]: true }));
      await Promise.all([
        client.invalidateQueries({ queryKey: ["occurrences"] }),
        client.invalidateQueries({ queryKey: ["tasks"] }),
        client.invalidateQueries({ queryKey: ["streak"] }),
      ]);
      toast.success(
        locale === "en"
          ? `Created ${res.created_count} task(s)`
          : `Đã tạo ${res.created_count} nhiệm vụ`
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Confirm failed"),
  });

  async function uploadImageFile(file: File) {
    const ext = file.type.split("/")[1] || "png";
    const normalizedFile = file.name
      ? file
      : new File([file], `clipboard-${Date.now()}.${ext}`, { type: file.type || "image/png" });
    const preview = URL.createObjectURL(normalizedFile);
    setAttachedPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });
    setAttachedName(normalizedFile.name);
    setUploading(true);
    try {
      const uploaded = await uploadUserFile(normalizedFile, "ai-uploads");
      setAttachedFileId(uploaded.id);
      setAttachedName(uploaded.original_filename);
    } catch (err) {
      URL.revokeObjectURL(preview);
      setAttachedPreviewUrl(null);
      setAttachedName(null);
      setAttachedFileId(null);
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadImageFile(file);
  }

  async function handlePaste(e: ClipboardEvent<HTMLElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await uploadImageFile(file);
          return;
        }
      }
    }
  }

  function clearAttachment() {
    if (attachedPreviewUrl) URL.revokeObjectURL(attachedPreviewUrl);
    setAttachedPreviewUrl(null);
    setAttachedFileId(null);
    setAttachedName(null);
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if ((!input.trim() && !attachedFileId) || chatMutation.isPending || uploading) return;
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: input.trim() || (attachedName ? `[${attachedName}]` : ""),
        imageName: attachedName ?? undefined,
        previewUrl: attachedPreviewUrl ?? undefined,
      },
    ]);
    chatMutation.mutate();
    setInput("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label="AI Assistant"
        className="fixed right-5 bottom-20 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-transform hover:scale-105 md:bottom-6"
      >
        {open ? <X className="h-5 w-5" /> : <BrandLogo variant="compact" />}
      </button>

      {open && (
        <aside
          aria-label="AI Assistant"
          onPaste={handlePaste}
          className="fixed right-4 bottom-36 z-40 flex h-[32rem] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:right-6 md:bottom-20"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <BrandLogo variant="compact" className="scale-90" />
              <span className="text-sm font-semibold text-foreground">AI Planner</span>
            </div>
            <Link href="/todo-list" className="text-[11px] text-primary hover:underline">
              {locale === "en" ? "Quick Todo" : "Tạo nhanh"}
            </Link>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 text-xs">
            {messages.length === 0 && (
              <p className="rounded-xl bg-secondary/60 p-3 text-muted-foreground">
                {locale === "en"
                  ? "Describe tasks, upload an image, or paste a screenshot (Ctrl+V) to propose tasks."
                  : "Nhập yêu cầu, tải ảnh hoặc dán ảnh trực tiếp (Ctrl+V) để AI lên danh sách nhiệm vụ."}
              </p>
            )}

            {messages.map((m, idx) => (
              <div
                key={idx}
                className={
                  m.role === "user"
                    ? "ml-8 rounded-xl bg-primary px-3 py-2 text-primary-foreground"
                    : "mr-4 space-y-2 rounded-xl border border-border bg-background p-3 text-foreground"
                }
              >
                {m.previewUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={m.previewUrl}
                    alt={m.imageName || "Attached preview"}
                    className="mb-1.5 max-h-32 w-auto rounded-lg object-cover"
                  />
                )}
                {m.imageName && !m.previewUrl && (
                  <span className="mb-1 block text-[10px] opacity-80">📎 {m.imageName}</span>
                )}
                <p className="whitespace-pre-wrap">{m.text}</p>

                {m.response?.proposal_id &&
                  m.response.proposed_tasks.length > 0 &&
                  !confirmedIds[m.response.proposal_id] && (
                    <div className="space-y-2 border-t border-border pt-2">
                      {m.response.proposed_tasks.map((task, tidx) => (
                        <div key={tidx} className="rounded-lg bg-secondary/60 px-2.5 py-1.5">
                          <p className="font-medium text-foreground">{task.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {task.scheduled_date ?? "Today"} · {task.priority} ·{" "}
                            {task.estimated_minutes ?? 30}m
                          </p>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={confirmMutation.isPending}
                          onClick={() =>
                            confirmMutation.mutate({
                              proposalId: m.response!.proposal_id!,
                              items: m.response!.proposed_tasks,
                            })
                          }
                          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary text-xs font-medium text-primary-foreground disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{locale === "en" ? "Confirm & Create" : "Xác nhận tạo"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void rejectAIProposal(m.response!.proposal_id!);
                            setConfirmedIds((prev) => ({
                              ...prev,
                              [m.response!.proposal_id!]: true,
                            }));
                          }}
                          className="h-8 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-secondary"
                        >
                          {locale === "en" ? "Dismiss" : "Bỏ qua"}
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            ))}

            {chatMutation.isPending && (
              <p className="text-muted-foreground">
                {locale === "en" ? "Analyzing…" : "Đang phân tích…"}
              </p>
            )}
          </div>

          <form onSubmit={handleSend} className="border-t border-border p-2.5">
            {(attachedName || attachedPreviewUrl) && (
              <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg bg-secondary px-2 py-1.5 text-[11px]">
                <div className="flex min-w-0 items-center gap-2">
                  {attachedPreviewUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={attachedPreviewUrl}
                      alt={attachedName ?? "Clipboard preview"}
                      className="h-8 w-8 shrink-0 rounded object-cover"
                    />
                  )}
                  <span className="truncate">{attachedName || "clipboard-image.png"}</span>
                </div>
                <button type="button" onClick={clearAttachment} aria-label="Remove attachment">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <label
                title={locale === "en" ? "Upload image" : "Tải ảnh"}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary"
              >
                <ImagePlus className="h-4 w-4 text-muted-foreground" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImagePick}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                placeholder={
                  locale === "en"
                    ? "Ask AI or Ctrl+V image..."
                    : "Nhắn AI hoặc Ctrl+V dán ảnh..."
                }
                className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={chatMutation.isPending || uploading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </aside>
      )}
    </>
  );
}

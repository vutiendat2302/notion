"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Square, Upload, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import {
  completeTimer,
  fetchActiveTimer,
  fetchSoundCatalog,
  listTimeEntries,
  pauseTimer,
  resumeTimer,
  startTimer,
} from "@/features/time-tracking/api";
import { fetchCurrentUser, updateSettings, uploadUserFile } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { fetchBinaryWithRefresh } from "@/lib/api/client";
import type { TimeEntry } from "@/types/domain";

const FINISH_SOUND_SRC = "/sounds/default-finish.mp3";

function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function secondsToHMS(totalSeconds: number): { h: number; m: number; s: number } {
  const safe = Math.max(1, Math.min(86399, Math.floor(totalSeconds)));
  return {
    h: Math.floor(safe / 3600),
    m: Math.floor((safe % 3600) / 60),
    s: safe % 60,
  };
}

/**
 * For lossless PCM (.wav), keep exact [0, buffer.duration] sample bounds.
 * For compressed MP3/M4A files, trim up to 60ms of encoder padding silence
 * so compressed frame padding never causes a stutter at the loop seam.
 */
function findGaplessLoopBounds(
  buffer: AudioBuffer,
  url: string
): { loopStart: number; loopEnd: number } {
  if (url.toLowerCase().split("?")[0].endsWith(".wav")) {
    return { loopStart: 0, loopEnd: buffer.duration };
  }
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const maxPad = Math.min(Math.floor(sr * 0.06), Math.floor(data.length / 4));
  const threshold = 0.002;
  let startSample = 0;
  let endSample = data.length - 1;

  while (startSample < maxPad && Math.abs(data[startSample] ?? 0) < threshold) {
    startSample += 1;
  }
  while (
    data.length - 1 - endSample < maxPad &&
    endSample > startSample &&
    Math.abs(data[endSample] ?? 0) < threshold
  ) {
    endSample -= 1;
  }

  return { loopStart: startSample / sr, loopEnd: endSample / sr };
}

export default function CountdownPage() {
  const { locale } = useI18n();
  const client = useQueryClient();

  const userQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const activeQuery = useQuery({
    queryKey: ["active-timer"],
    queryFn: fetchActiveTimer,
    refetchInterval: 30_000,
  });
  const soundsQuery = useQuery({ queryKey: ["sound-catalog"], queryFn: fetchSoundCatalog });
  const historyQuery = useQuery({
    queryKey: ["time-entries-recent"],
    queryFn: () => listTimeEntries({ limit: 3 }),
  });

  const [sessionName, setSessionName] = useState("");
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);

  // Sound state (local override takes precedence over saved preferences)
  const [volumeOverride, setVolume] = useState<number | null>(null);
  const [mutedOverride, setMuted] = useState<boolean | null>(null);
  const [countdownSoundUrlOverride, setCountdownSoundUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [tickNow, setTickNow] = useState(() => Date.now());

  // Web Audio API gapless loop engine refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());
  const fallbackLoopAudioRef = useRef<HTMLAudioElement | null>(null);
  const finishAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoCompletedEntryRef = useRef<string | null>(null);

  const unlockAudioContext = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
        gainNodeRef.current = audioCtxRef.current.createGain();
        gainNodeRef.current.connect(audioCtxRef.current.destination);
      }
      if (audioCtxRef.current.state === "suspended") {
        void audioCtxRef.current.resume().catch(() => {});
      }
    } catch {
      // Ignore if AudioContext cannot initialize synchronously
    }
  }, []);

  const activeEntry = activeQuery.data?.active_entry ?? null;

  const savedTimerPrefs = (userQuery.data?.settings?.preferences_json?.timer ?? null) as
    | Record<string, unknown>
    | null;
  const volume =
    volumeOverride ?? (typeof savedTimerPrefs?.volume === "number" ? savedTimerPrefs.volume : 0.7);
  const muted =
    mutedOverride ?? (typeof savedTimerPrefs?.muted === "boolean" ? savedTimerPrefs.muted : false);
  const countdownSoundUrl =
    countdownSoundUrlOverride ??
    (typeof savedTimerPrefs?.countdown_sound_url === "string" &&
    savedTimerPrefs.countdown_sound_url !== "/sounds/default-countdown.mp3"
      ? savedTimerPrefs.countdown_sound_url
      : "/sounds/default-countdown.wav");

  const stopGaplessAudio = useCallback(() => {
    if (bufferSourceRef.current) {
      try {
        bufferSourceRef.current.stop();
        bufferSourceRef.current.disconnect();
      } catch {
        // Ignore already-stopped source
      }
      bufferSourceRef.current = null;
    }
    if (fallbackLoopAudioRef.current) {
      fallbackLoopAudioRef.current.pause();
    }
  }, []);

  // Multi-tab BroadcastChannel sync
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("productivity_focus_timer");
    ch.onmessage = () => {
      void client.invalidateQueries({ queryKey: ["active-timer"] });
    };
    return () => ch.close();
  }, [client]);

  const notifyOtherTabs = useCallback(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("productivity_focus_timer");
    ch.postMessage({ type: "SYNC" });
    ch.close();
  }, []);

  // Live 1s tick interval while RUNNING
  useEffect(() => {
    if (!activeEntry || activeEntry.status !== "RUNNING") {
      return;
    }
    const id = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeEntry]);

  // Adjust volume live without restarting loop
  useEffect(() => {
    const targetGain = muted ? 0 : volume;
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(targetGain, audioCtxRef.current.currentTime, 0.03);
    }
    if (fallbackLoopAudioRef.current) {
      fallbackLoopAudioRef.current.volume = targetGain;
    }
  }, [muted, volume]);

  // Gapless sample-accurate audio loop via Web Audio API while RUNNING
  useEffect(() => {
    if (activeEntry?.status !== "RUNNING") {
      stopGaplessAudio();
      return;
    }

    let cancelled = false;

    async function ensureBlobUrl(): Promise<string> {
      const existing = blobUrlCacheRef.current.get(countdownSoundUrl);
      if (existing) return existing;
      const { buffer, contentType } = await fetchBinaryWithRefresh(countdownSoundUrl);
      const blob = new Blob([buffer], { type: contentType });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCacheRef.current.set(countdownSoundUrl, blobUrl);
      return blobUrl;
    }

    async function startGapless() {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) throw new Error("WebAudio unavailable");

        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
          gainNodeRef.current = audioCtxRef.current.createGain();
          gainNodeRef.current.connect(audioCtxRef.current.destination);
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        let decoded = bufferCacheRef.current.get(countdownSoundUrl);
        if (!decoded) {
          const { buffer, contentType } = await fetchBinaryWithRefresh(countdownSoundUrl);
          if (!blobUrlCacheRef.current.has(countdownSoundUrl)) {
            const blob = new Blob([buffer.slice(0)], { type: contentType });
            blobUrlCacheRef.current.set(countdownSoundUrl, URL.createObjectURL(blob));
          }
          decoded = await ctx.decodeAudioData(buffer);
          bufferCacheRef.current.set(countdownSoundUrl, decoded);
        }
        if (cancelled) return;

        stopGaplessAudio();
        const { loopStart, loopEnd } = findGaplessLoopBounds(decoded, countdownSoundUrl);
        const src = ctx.createBufferSource();
        src.buffer = decoded;
        src.loop = true;
        src.loopStart = loopStart;
        src.loopEnd = loopEnd;
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = muted ? 0 : volume;
          src.connect(gainNodeRef.current);
        }
        src.start(0, loopStart);
        bufferSourceRef.current = src;
      } catch {
        if (cancelled || !fallbackLoopAudioRef.current) return;
        try {
          const blobUrl = await ensureBlobUrl();
          if (cancelled || !fallbackLoopAudioRef.current) return;
          fallbackLoopAudioRef.current.src = blobUrl;
          fallbackLoopAudioRef.current.volume = muted ? 0 : volume;
          fallbackLoopAudioRef.current.loop = true;
          await fallbackLoopAudioRef.current.play();
        } catch {
          if (!cancelled) {
            toast.error(
              locale === "en"
                ? "Could not play selected countdown audio."
                : "Không phát được file nhạc đếm đang chọn."
            );
          }
        }
      }
    }

    void startGapless();
    return () => {
      cancelled = true;
      stopGaplessAudio();
    };
    // Note: volume/muted changes handled smoothly via separate GainNode effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntry?.status, countdownSoundUrl, stopGaplessAudio]);

  useEffect(() => {
    const blobMap = blobUrlCacheRef.current;
    return () => {
      stopGaplessAudio();
      for (const u of blobMap.values()) {
        URL.revokeObjectURL(u);
      }
      blobMap.clear();
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopGaplessAudio]);

  const plannedTotalSeconds = Math.max(1, hours * 3600 + minutes * 60 + seconds);
  let displaySeconds = plannedTotalSeconds;

  if (activeEntry) {
    const serverTs = Date.parse(activeEntry.server_now);
    const liveDelta =
      activeEntry.status === "RUNNING" && Number.isFinite(serverTs)
        ? Math.max(0, Math.floor((tickNow - serverTs) / 1000))
        : 0;
    const elapsedSeconds = activeEntry.effective_elapsed_seconds + liveDelta;
    displaySeconds = activeEntry.planned_duration_seconds
      ? Math.max(0, activeEntry.planned_duration_seconds - elapsedSeconds)
      : elapsedSeconds;
  }

  const refreshAll = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["active-timer"] }),
      client.invalidateQueries({ queryKey: ["time-entries-recent"] }),
      client.invalidateQueries({ queryKey: ["streak"] }),
    ]);
    notifyOtherTabs();
  }, [client, notifyOtherTabs]);

  const startMut = useMutation({
    mutationFn: (opts?: { durationSeconds?: number; name?: string | null }) =>
      startTimer({
        planned_duration_seconds: opts?.durationSeconds ?? plannedTotalSeconds,
        note: (opts?.name ?? sessionName).trim() || null,
        stop_existing: true,
      }),
    onSuccess: refreshAll,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to start"),
  });

  const pauseMut = useMutation({
    mutationFn: (id: string) => pauseTimer(id, new Date().toISOString()),
    onSuccess: refreshAll,
  });

  const resumeMut = useMutation({
    mutationFn: (id: string) => resumeTimer(id, new Date().toISOString()),
    onSuccess: refreshAll,
  });

  const completeMut = useMutation({
    mutationFn: (id: string) =>
      completeTimer(id, {
        mark_occurrence_done: false,
        client_event_at: new Date().toISOString(),
      }),
    onSuccess: async () => {
      stopGaplessAudio();
      setSessionName("");
      await refreshAll();
    },
  });

  // Play fixed default-finish.mp3 once when countdown reaches 00:00:00
  useEffect(() => {
    if (
      activeEntry &&
      activeEntry.status === "RUNNING" &&
      activeEntry.planned_duration_seconds &&
      displaySeconds === 0 &&
      autoCompletedEntryRef.current !== activeEntry.id
    ) {
      autoCompletedEntryRef.current = activeEntry.id;
      stopGaplessAudio();
      if (finishAudioRef.current) {
        finishAudioRef.current.volume = muted ? 0 : volume;
        finishAudioRef.current.currentTime = 0;
        void finishAudioRef.current.play().catch(() => {});
      }
      completeMut.mutate(activeEntry.id);
    }
  }, [activeEntry, completeMut, displaySeconds, muted, stopGaplessAudio, volume]);

  function persistAudioPrefs(next: {
    volume?: number;
    muted?: boolean;
    countdown_sound_url?: string;
  }) {
    const merged = {
      volume,
      muted,
      countdown_sound_url: countdownSoundUrl,
      ...next,
    };
    void updateSettings({ preferences_json: { timer: merged } });
  }

  async function handleUploadSound(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadUserFile(file, "sounds/countdown");
      bufferCacheRef.current.delete(res.stream_url);
      setCountdownSoundUrl(res.stream_url);
      await updateSettings({
        preferences_json: {
          timer: {
            volume,
            muted,
            countdown_sound_url: res.stream_url,
          },
        },
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["sound-catalog"] }),
        client.invalidateQueries({ queryKey: ["me"] }),
      ]);
      toast.success(locale === "en" ? "Sound uploaded" : "Đã tải âm thanh lên");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function applyRecentSession(entry: TimeEntry, startImmediately: boolean) {
    const targetDur = entry.planned_duration_seconds || Math.max(60, entry.duration_seconds);
    const label = entry.note || entry.task_title || "";
    const { h, m, s } = secondsToHMS(targetDur);
    setHours(h);
    setMinutes(m);
    setSeconds(s);
    setSessionName(label);
    if (startImmediately) {
      unlockAudioContext();
      startMut.mutate({ durationSeconds: targetDur, name: label });
    }
  }

  const allSounds = [
    ...(soundsQuery.data?.defaults ?? []),
    ...(soundsQuery.data?.custom ?? []),
  ];
  const countdownSounds = allSounds.filter((s) => s.kind === "countdown");
  const recentThree = (historyQuery.data ?? []).slice(0, 3);
  const activeSessionLabel = activeEntry?.note || activeEntry?.task_title || null;

  return (
    <div className="flex min-h-[calc(100dvh-7.5rem)] w-full flex-col justify-between">
      <h1 className="sr-only">{locale === "en" ? "Countdown" : "Đếm ngược"}</h1>
      <audio ref={fallbackLoopAudioRef} preload="auto" />
      <audio ref={finishAudioRef} src={FINISH_SOUND_SRC} preload="auto" />

      {/* Active Session Name pinned cleanly high & centered */}
      {activeEntry && activeSessionLabel && (
        <div className="pt-2 text-center">
          <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {activeSessionLabel}
          </p>
        </div>
      )}

      {/* Center Hero Clock — Pure Zen Mode when running */}
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        {/* Double-sized Hero Digits (x2) */}
        <div className="font-mono text-[5.25rem] leading-none font-bold tracking-tight text-foreground tabular-nums sm:text-[9rem] md:text-[13rem] xl:text-[15.5rem]">
          {formatHMS(displaySeconds)}
        </div>

        {/* Setup Controls (Hidden completely once START is pressed) */}
        {!activeEntry && (
          <div className="mt-8 flex w-full max-w-md flex-col items-center gap-4">
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              maxLength={120}
              placeholder={locale === "en" ? "Session name" : "Đặt tên phiên"}
              className="h-10 w-full rounded-lg border border-input bg-background px-3.5 text-center text-sm outline-none focus:border-primary"
            />

            <div className="flex items-center justify-center gap-3 text-xs">
              <label className="flex flex-col items-center gap-1">
                <span className="text-[11px] text-muted-foreground">
                  {locale === "en" ? "Hours" : "Giờ"}
                </span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hours}
                  onChange={(e) =>
                    setHours(Math.min(23, Math.max(0, Number(e.target.value) || 0)))
                  }
                  className="h-10 w-16 rounded-lg border border-input bg-background text-center font-mono text-base"
                />
              </label>
              <span className="pt-5 font-mono text-xl text-muted-foreground">:</span>
              <label className="flex flex-col items-center gap-1">
                <span className="text-[11px] text-muted-foreground">
                  {locale === "en" ? "Minutes" : "Phút"}
                </span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(Math.min(59, Math.max(0, Number(e.target.value) || 0)))
                  }
                  className="h-10 w-16 rounded-lg border border-input bg-background text-center font-mono text-base"
                />
              </label>
              <span className="pt-5 font-mono text-xl text-muted-foreground">:</span>
              <label className="flex flex-col items-center gap-1">
                <span className="text-[11px] text-muted-foreground">
                  {locale === "en" ? "Seconds" : "Giây"}
                </span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={seconds}
                  onChange={(e) =>
                    setSeconds(Math.min(59, Math.max(0, Number(e.target.value) || 0)))
                  }
                  className="h-10 w-16 rounded-lg border border-input bg-background text-center font-mono text-base"
                />
              </label>
            </div>
          </div>
        )}

        {/* Action Buttons: START when idle; ONLY PAUSE/RESUME + Kết thúc when active (no Reset) */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {!activeEntry ? (
            <button
              type="button"
              disabled={startMut.isPending}
              onClick={() => {
                unlockAudioContext();
                startMut.mutate({});
              }}
              className="inline-flex h-12 min-w-44 items-center justify-center gap-2 rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95 disabled:opacity-50"
            >
              <Play className="h-5 w-5" />
              <span>START</span>
            </button>
          ) : (
            <>
              {activeEntry.status === "RUNNING" ? (
                <button
                  type="button"
                  disabled={pauseMut.isPending}
                  onClick={() => pauseMut.mutate(activeEntry.id)}
                  className="inline-flex h-12 min-w-36 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-7 text-sm font-semibold text-foreground hover:bg-secondary/80"
                >
                  <Pause className="h-4 w-4" />
                  <span>PAUSE</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={resumeMut.isPending}
                  onClick={() => {
                    unlockAudioContext();
                    resumeMut.mutate(activeEntry.id);
                  }}
                  className="inline-flex h-12 min-w-36 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground"
                >
                  <Play className="h-4 w-4" />
                  <span>RESUME</span>
                </button>
              )}

              <button
                type="button"
                disabled={completeMut.isPending}
                onClick={() => completeMut.mutate(activeEntry.id)}
                className="inline-flex h-12 min-w-36 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-accent px-7 text-sm font-semibold text-accent-foreground"
              >
                <Square className="h-4 w-4" />
                <span>{locale === "en" ? "Finish" : "Kết thúc"}</span>
              </button>
            </>
          )}
        </div>

        {/* Single Horizontal Audio Bar (Hidden completely during active countdown) */}
        {!activeEntry && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-border/70 pt-6 text-xs">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
              <button
                type="button"
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  persistAudioPrefs({ muted: next });
                }}
                className="text-foreground hover:text-primary"
                aria-label="Mute"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4 text-destructive" />
                ) : (
                  <Volume2 className="h-4 w-4 text-primary" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  setMuted(v === 0);
                  persistAudioPrefs({ volume: v, muted: v === 0 });
                }}
                className="w-24 accent-primary"
                aria-label="Volume"
              />
              <span className="w-8 text-right font-mono text-[11px] text-muted-foreground">
                {Math.round((muted ? 0 : volume) * 100)}%
              </span>
            </div>

            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 hover:bg-secondary">
              <Upload className="h-3.5 w-3.5 text-primary" />
              <span>
                {uploading
                  ? "…"
                  : locale === "en"
                    ? "Upload sound"
                    : "Tải nhạc đếm"}
              </span>
              <input
                type="file"
                accept=".mp3,.mp4,.wav,.ogg,.m4a,audio/*,video/mp4"
                onChange={handleUploadSound}
                className="hidden"
              />
            </label>

            <select
              aria-label={locale === "en" ? "Countdown sound" : "Chọn nhạc đếm"}
              value={countdownSoundUrl}
              onChange={(e) => {
                setCountdownSoundUrl(e.target.value);
                persistAudioPrefs({ countdown_sound_url: e.target.value });
              }}
              className="h-9 min-w-44 rounded-lg border border-input bg-background px-2.5 text-xs"
            >
              {countdownSounds.map((s) => (
                <option key={s.id} value={s.stream_url}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* Max 3 Reusable Recent Sessions (Hidden when active) */}
      {!activeEntry && recentThree.length > 0 && (
        <section className="mt-8 w-full border-t border-border/70 pt-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {locale === "en" ? "Recent Sessions" : "Phiên gần đây"}
          </h2>
          <div className="divide-y divide-border/50 text-xs">
            {recentThree.map((e) => {
              const label =
                e.note ||
                e.task_title ||
                (locale === "en" ? "Untitled session" : "Phiên chưa đặt tên");
              const presetSecs = e.planned_duration_seconds || Math.max(60, e.duration_seconds);
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <button
                    type="button"
                    onClick={() => applyRecentSession(e, false)}
                    title={locale === "en" ? "Load settings" : "Nạp lại thời gian & tên phiên"}
                    className="truncate text-left font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {label}
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-muted-foreground">
                      {formatHMS(presetSecs)} · {formatHMS(e.duration_seconds)}
                    </span>
                    <button
                      type="button"
                      disabled={startMut.isPending}
                      onClick={() => applyRecentSession(e, true)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary"
                    >
                      <Play className="h-3 w-3" />
                      <span>{locale === "en" ? "Run again" : "Chạy lại"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

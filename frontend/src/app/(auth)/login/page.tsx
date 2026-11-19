"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { apiRequest, ApiClientError } from "@/lib/api/client";
import type { User } from "@/types/domain";

interface AuthPayload {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/bootstrap";
      const body =
        mode === "login"
          ? { email, password, device_label: "web-browser" }
          : { email, password, display_name: displayName };

      await apiRequest<AuthPayload>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      toast.success(
        mode === "login" ? "Signed in successfully." : "Owner workspace initialized."
      );
      router.push("/today");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Cannot reach Backend API. Check if backend is running.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xs">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            Productivity OS
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            {mode === "login" ? "Sign in to your workspace" : "Initialize Owner Account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "HttpOnly cookie session with Backend FastAPI."
              : "First-time single-user bootstrap (locked automatically once created)."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-md py-1.5 transition-colors ${
              mode === "login"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("bootstrap")}
            className={`rounded-md py-1.5 transition-colors ${
              mode === "bootstrap"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            First-time Bootstrap
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "bootstrap" && (
            <div>
              <label
                htmlFor="display_name"
                className="block text-xs font-medium text-foreground"
              >
                Display name
              </label>
              <input
                id="display_name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-foreground"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
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
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            {submitting
              ? "Processing..."
              : mode === "login"
                ? "Sign in"
                : "Create Owner Workspace"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/today" className="text-xs text-muted-foreground hover:text-primary">
            Back to Today workspace
          </Link>
        </div>
      </div>
    </main>
  );
}

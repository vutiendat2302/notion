"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import { DocumentTitleSync } from "@/components/layout/document-title-sync";
import { I18nProvider } from "@/i18n/i18n-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <NuqsAdapter>
            <DocumentTitleSync />
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </NuqsAdapter>
        </I18nProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

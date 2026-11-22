import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { AppProviders } from "@/providers/app-providers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LumiPlan",
    template: "LumiPlan | %s",
  },
  description:
    "Illuminate Your Plans. LumiPlan là nền tảng quản lý năng suất và lập kế hoạch cá nhân tích hợp trí tuệ nhân tạo, giúp tổ chức công việc, quản lý thời gian, theo dõi mục tiêu và phát triển thói quen một cách khoa học.",
  icons: {
    icon: [
      { url: "/logo/logo_mark_light.png", media: "(prefers-color-scheme: light)" },
      { url: "/logo/logo_mark_dark.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/logo/logo_mark_light.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

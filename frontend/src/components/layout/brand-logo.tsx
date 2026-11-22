"use client";

import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "compact" | "full";
  className?: string;
}

export function BrandLogo({ variant = "full", className }: BrandLogoProps) {
  if (variant === "compact") {
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo_mark_light.png"
          alt="LumiPlan"
          width={28}
          height={28}
          className="block h-7 w-7 object-contain dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo_mark_dark.png"
          alt="LumiPlan"
          width={28}
          height={28}
          className="hidden h-7 w-7 object-contain dark:block"
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo/logo_text_ngang_full.png"
        alt="LumiPlan"
        className="block h-8 w-auto max-w-[132px] object-contain dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo/logo_text_nang_den_full.png"
        alt="LumiPlan"
        className="hidden h-8 w-auto max-w-[132px] object-contain dark:block"
      />
    </span>
  );
}

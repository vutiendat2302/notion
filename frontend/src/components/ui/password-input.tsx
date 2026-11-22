"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  wrapperClassName?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, wrapperClassName, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);

    return (
      <div className={cn("relative", wrapperClassName)}>
        <input
          {...props}
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          className={cn(
            "w-full rounded-lg border border-input bg-background px-3 py-2 pr-12 text-sm text-foreground outline-none transition-colors focus:border-primary",
            className
          )}
        />
        <button
          type="button"
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-controls={inputId}
          aria-pressed={visible}
          onClick={() => setVisible((prev) => !prev)}
          className="absolute inset-y-0 right-1 my-auto inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

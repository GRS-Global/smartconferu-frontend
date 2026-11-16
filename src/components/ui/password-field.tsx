"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** A password box with an eye button to show or hide what was typed. Takes the usual input props. */
export function PasswordField({ label = "password", className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={cn(className, "pr-11")} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? `Hide ${label}` : `Show ${label}`}
        title={shown ? `Hide ${label}` : `Show ${label}`}
        aria-pressed={shown}
        className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-faint hover:bg-canvas hover:text-primary"
      >
        {shown ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}

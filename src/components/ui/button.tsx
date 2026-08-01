import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "bg-[var(--primary)] text-slate-900 hover:bg-[var(--primary-dark)]",
  secondary: "border border-[var(--border)] bg-transparent text-white hover:bg-[var(--border)]",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-gray-400 hover:bg-[var(--border)] hover:text-white",
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
};

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

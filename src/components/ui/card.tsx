import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-[var(--border)] px-4 py-3",
        className,
      )}
    >
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

/** Compact KPI tile for dashboards - pill-shaped with teal background. */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-full bg-[var(--primary)] px-6 py-4 shadow-lg">
      <p className="text-xs font-medium uppercase tracking-wide text-cyan-900">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-cyan-100">{hint}</p> : null}
    </div>
  );
}

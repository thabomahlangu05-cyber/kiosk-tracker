import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { JOB_STATUS, KINDS } from "@/lib/enums";

const TONES = {
  slate: "bg-gray-700 text-gray-100",
  blue: "bg-blue-900 text-blue-200",
  green: "bg-green-900 text-green-200",
  amber: "bg-amber-900 text-amber-200",
  red: "bg-red-900 text-red-200",
  violet: "bg-violet-900 text-violet-200",
} as const;

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  return (
    <Badge tone={kind === KINDS.BUILD ? "blue" : "violet"}>
      {kind === KINDS.BUILD ? "Build" : "Repair"}
    </Badge>
  );
}

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  [JOB_STATUS.IN_PROGRESS]: "amber",
  [JOB_STATUS.ON_HOLD]: "slate",
  [JOB_STATUS.COMPLETED]: "green",
  [JOB_STATUS.CANCELLED]: "red",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "slate"}>
      {status.replace("_", " ").toLowerCase()}
    </Badge>
  );
}

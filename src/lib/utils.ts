import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, de-duplicating conflicting Tailwind classes. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Pin locale so formatting is deterministic regardless of the server's locale.
const dateFmt = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const moneyFmt = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

/** Format a Date (or ISO string) for shop-floor display. */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return dateFmt.format(date);
}

/** Format a monetary amount (PHP) for display, e.g. "₱1,250.00". */
export function formatMoney(n: number): string {
  return moneyFmt.format(n);
}

/** Human-friendly duration between two instants (e.g. "3h 12m"). */
export function formatDuration(fromMs: number, toMs: number): string {
  const total = Math.max(0, Math.round((toMs - fromMs) / 60000)); // minutes
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(" ");
}

/** Format milliseconds as hours (e.g. 5400000 → "1.5 h"). */
export function formatHours(ms: number): string {
  const hours = ms / 3600000;
  return hours.toFixed(1) + " h";
}

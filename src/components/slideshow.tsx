"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Crossfading rotator. Slides are stacked and toggled by opacity so there's no
 * flash of an unloaded image mid-transition. `extra` is rendered as a final
 * slide after the images — the floor screen uses it for the live leaderboard.
 */
export function Slideshow({
  images,
  extra,
  intervalMs = 6000,
  className,
  fit = "contain",
  showDots = true,
}: {
  images: string[];
  extra?: ReactNode;
  intervalMs?: number;
  className?: string;
  fit?: "contain" | "cover";
  showDots?: boolean;
}) {
  const count = images.length + (extra ? 1 : 0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (count < 2) return;

    let id: ReturnType<typeof setInterval>;
    const start = () => {
      clearInterval(id);
      id = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    };

    // Browsers throttle timers and stop compositing in a hidden tab, so a
    // screen that was in the background comes back mid-cycle. Restarting on
    // wake gives the returning slide a full turn instead of a snap.
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [count, intervalMs]);

  if (count === 0) return null;

  return (
    <div className={cn("relative overflow-hidden bg-black", className)}>
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={cn(
            "absolute inset-0 h-full w-full will-change-[opacity] transition-opacity duration-[1200ms] ease-in-out",
            fit === "cover" ? "object-cover" : "object-contain",
            i === index ? "opacity-100" : "opacity-0",
          )}
        />
      ))}

      {extra ? (
        <div
          className={cn(
            "absolute inset-0 overflow-auto will-change-[opacity] transition-opacity duration-[1200ms] ease-in-out",
            index === images.length
              ? "opacity-100"
              : "pointer-events-none opacity-0",
          )}
        >
          {extra}
        </div>
      ) : null}

      {showDots && count > 1 ? (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                i === index ? "bg-[var(--primary)]" : "bg-white/40",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

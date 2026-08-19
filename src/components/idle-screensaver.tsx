"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Slideshow } from "@/components/slideshow";
import { LeaderboardSlide } from "@/components/leaderboard-slide";
import {
  getLeaderboardSnapshot,
  type LeaderboardSnapshot,
} from "@/app/actions/leaderboard";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "wheel",
  "scroll",
] as const;

/**
 * Sleep mode: after a stretch with no input, the floor screen fades into a
 * full-screen slideshow. Any interaction wakes it.
 *
 * The standings are fetched when it falls asleep, not on every page load —
 * doing that work up front made each render pay for three table scans against
 * a one-connection pool.
 */
export function IdleScreensaver({
  images,
  idleMs = 3 * 60 * 1000,
}: {
  images: string[];
  idleMs?: number;
}) {
  const [asleep, setAsleep] = useState(false);
  const [board, setBoard] = useState<LeaderboardSnapshot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sleep = useCallback(() => {
    setAsleep(true);
    // Best effort: if the standings can't be loaded the pictures still show.
    getLeaderboardSnapshot()
      .then(setBoard)
      .catch(() => setBoard(null));
  }, []);

  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(sleep, idleMs);
    };

    const wake = () => {
      setAsleep(false);
      reset();
    };

    for (const e of ACTIVITY_EVENTS) {
      window.addEventListener(e, wake, { passive: true });
    }
    reset();

    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, wake);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [idleMs, sleep]);

  if (!asleep) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      role="presentation"
      onClick={() => setAsleep(false)}
    >
      <Slideshow
        images={images}
        extra={
          board ? (
            <LeaderboardSlide
              rows={board.rows}
              best={board.best}
              totals={board.totals}
            />
          ) : undefined
        }
        intervalMs={7000}
        fit="cover"
        showDots={false}
        className="h-full w-full"
      />
      <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-xs uppercase tracking-widest text-white/50">
        Touch or move the mouse to resume
      </p>
    </div>
  );
}

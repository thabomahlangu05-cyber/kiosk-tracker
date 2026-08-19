"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Slideshow } from "@/components/slideshow";

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
 * full-screen slideshow. Any interaction wakes it. Nothing is rendered until
 * it actually sleeps, so this costs nothing while somebody is working.
 */
export function IdleScreensaver({
  images,
  extra,
  idleMs = 3 * 60 * 1000,
}: {
  images: string[];
  extra?: ReactNode;
  idleMs?: number;
}) {
  const [asleep, setAsleep] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (images.length === 0 && !extra) return;

    const sleep = () => setAsleep(true);
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(sleep, idleMs);
    };

    const wake = () => {
      setAsleep((was) => {
        if (was) return false;
        return was;
      });
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
  }, [images.length, extra, idleMs]);

  if (!asleep) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      role="presentation"
      onClick={() => setAsleep(false)}
    >
      <Slideshow
        images={images}
        extra={extra}
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

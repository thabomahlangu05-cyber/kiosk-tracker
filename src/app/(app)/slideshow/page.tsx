import { requireUser } from "@/lib/auth";
import { getSlideshowImages } from "@/lib/slideshow";
import { getPerformance } from "@/lib/performance";
import { Slideshow } from "@/components/slideshow";
import { LeaderboardSlide } from "@/components/leaderboard-slide";
import { Card, CardBody } from "@/components/ui/card";

export default async function SlideshowPage() {
  await requireUser();
  const [images, perf] = await Promise.all([
    getSlideshowImages(),
    getPerformance(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Slideshow</h1>
        <p className="text-sm text-gray-400">
          Floor display — the same rotation the screen shows when it sleeps
        </p>
      </div>

      {images.length === 0 ? (
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm text-gray-300">
              No pictures added yet — the rotation is showing the team
              leaderboard only.
            </p>
            <p className="text-sm text-gray-500">
              Drop image files into{" "}
              <code className="rounded bg-[var(--border)] px-1.5 py-0.5 text-xs text-gray-300">
                public/slideshow/
              </code>{" "}
              in the project and they appear here automatically — no code change
              needed. JPG, PNG, WebP, AVIF and GIF are picked up, in filename
              order.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Slideshow
        images={images}
        extra={
          <LeaderboardSlide
            rows={perf.rows}
            best={perf.best}
            totals={perf.totals}
          />
        }
        intervalMs={7000}
        fit="contain"
        className="aspect-video w-full rounded-lg border border-[var(--border)]"
      />

      <p className="text-xs text-gray-500">
        {images.length} picture{images.length === 1 ? "" : "s"} plus the live
        team leaderboard. The screen falls into this rotation after three
        minutes without input; any touch or key wakes it.
      </p>
    </div>
  );
}

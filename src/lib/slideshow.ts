import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";

const FOLDER = "slideshow";
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

/**
 * Image URLs for the slideshow, read from `public/slideshow` at request time so
 * new pictures appear by dropping a file in — no code change, no redeploy of a
 * hard-coded list. next.config.ts traces that folder into the serverless
 * bundle; without it the directory reads as empty in production.
 */
export async function getSlideshowImages(): Promise<string[]> {
  try {
    const dir = path.join(process.cwd(), "public", FOLDER);
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isFile() && EXTENSIONS.has(path.extname(e.name).toLowerCase()),
      )
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `/${FOLDER}/${encodeURIComponent(name)}`);
  } catch {
    // Folder missing (fresh clone, or nothing added yet) — not an error.
    return [];
  }
}

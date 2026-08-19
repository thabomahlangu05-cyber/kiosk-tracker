import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ANNOUNCEMENT_CATEGORIES, ROLES, humanise } from "@/lib/enums";
import {
  postAnnouncementAction,
  deleteAnnouncementAction,
} from "@/app/actions/board";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

const CATEGORY_TONES: Record<string, "slate" | "red" | "amber" | "blue"> = {
  GENERAL: "slate",
  URGENT: "red",
  CHANGE: "amber",
  REMINDER: "blue",
};

export default async function CommunicationsPage() {
  const user = await requireUser();
  const updates = await prisma.announcement.findMany({
    include: { author: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const isManager =
    user.role === ROLES.PRODUCTION_MANAGER || user.role === ROLES.TEAM_LEADER;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">
          Production Communications
        </h1>
        <p className="text-sm text-gray-400">
          Share updates, changes, and reminders with the whole team
        </p>
      </div>

      <Card>
        <CardBody>
          <form action={postAnnouncementAction} className="space-y-3">
            <textarea
              name="body"
              required
              rows={3}
              placeholder="Share an update with the team…"
              className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <select
                name="category"
                defaultValue="GENERAL"
                aria-label="Category"
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              >
                {ANNOUNCEMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {humanise(c)}
                  </option>
                ))}
              </select>
              <input
                name="kioskRef"
                placeholder="Kiosk serial (optional)"
                className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
              <button
                type="submit"
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-slate-900 hover:bg-[var(--primary-dark)]"
              >
                Post Update
              </button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          All updates
        </p>
        {updates.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-6 text-center text-sm text-gray-500">
                No updates yet. Be the first to post!
              </p>
            </CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {updates.map((u) => (
              <li key={u.id}>
                <Card>
                  <CardBody className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={CATEGORY_TONES[u.category] ?? "slate"}>
                        {humanise(u.category)}
                      </Badge>
                      {u.kioskRef ? (
                        <Badge tone="violet">{u.kioskRef}</Badge>
                      ) : null}
                      <span className="text-xs text-gray-500">
                        {u.author.name} · {formatDateTime(u.createdAt)}
                      </span>
                      {u.authorId === user.id || isManager ? (
                        <form
                          action={deleteAnnouncementAction}
                          className="ml-auto"
                        >
                          <input type="hidden" name="id" value={u.id} />
                          <button
                            type="submit"
                            title="Delete update"
                            className="text-gray-600 hover:text-red-400"
                          >
                            ×
                          </button>
                        </form>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-gray-200">
                      {u.body}
                    </p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

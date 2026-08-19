import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { IDEA_STATUSES, ROLES, humanise } from "@/lib/enums";
import {
  submitIdeaAction,
  voteIdeaAction,
  setIdeaStatusAction,
  deleteIdeaAction,
} from "@/app/actions/board";
import { StatCard, Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_TONES: Record<string, "slate" | "amber" | "green" | "blue" | "red"> =
  {
    SUBMITTED: "slate",
    UNDER_REVIEW: "amber",
    APPROVED: "green",
    IMPLEMENTED: "blue",
    REJECTED: "red",
  };

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status: rawStatus } = await searchParams;
  const activeStatus =
    rawStatus && IDEA_STATUSES.includes(rawStatus as (typeof IDEA_STATUSES)[number])
      ? rawStatus
      : "all";

  const ideas = await prisma.idea.findMany({
    include: { author: true, votes: true },
    orderBy: { createdAt: "desc" },
  });

  const visible =
    activeStatus === "all"
      ? ideas
      : ideas.filter((i) => i.status === activeStatus);
  // Most-supported first; ties fall back to the newest.
  const sorted = [...visible].sort((a, b) => b.votes.length - a.votes.length);

  const isManager =
    user.role === ROLES.PRODUCTION_MANAGER || user.role === ROLES.TEAM_LEADER;
  const countBy = (s: string) => ideas.filter((i) => i.status === s).length;

  const tabs = [
    { key: "all", label: "All", count: ideas.length },
    ...IDEA_STATUSES.map((s) => ({
      key: s,
      label: humanise(s),
      count: countBy(s),
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Ideas</h1>
        <p className="text-sm text-gray-400">
          {ideas.length} idea{ideas.length === 1 ? "" : "s"} submitted · vote for
          the best ones
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Submitted" value={countBy("SUBMITTED")} />
        <StatCard label="Under review" value={countBy("UNDER_REVIEW")} />
        <StatCard label="Approved" value={countBy("APPROVED")} />
        <StatCard label="Implemented" value={countBy("IMPLEMENTED")} />
      </div>

      <Card>
        <CardHeader title="Submit an idea" />
        <CardBody>
          <form action={submitIdeaAction} className="space-y-3">
            <input
              name="title"
              required
              placeholder="What would make the floor work better?"
              className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            <textarea
              name="description"
              rows={2}
              placeholder="Any detail worth adding (optional)"
              className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            <button
              type="submit"
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-slate-900 hover:bg-[var(--primary-dark)]"
            >
              + Submit Idea
            </button>
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-2 rounded-lg bg-[var(--surface)] p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/ideas" : `/ideas?status=${tab.key}`}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeStatus === tab.key
                ? "bg-[var(--primary)] text-slate-900"
                : "text-gray-300 hover:bg-[var(--border)]",
            )}
          >
            {tab.label} ({tab.count})
          </Link>
        ))}
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-8 text-center text-sm text-gray-500">
              No ideas yet — be the first!
            </p>
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {sorted.map((idea) => {
            const voted = idea.votes.some((v) => v.userId === user.id);
            return (
              <li key={idea.id}>
                <Card>
                  <CardBody className="flex flex-wrap items-start gap-4">
                    <form action={voteIdeaAction} className="shrink-0">
                      <input type="hidden" name="ideaId" value={idea.id} />
                      <button
                        type="submit"
                        title={voted ? "Withdraw your vote" : "Vote for this"}
                        className={cn(
                          "flex w-14 flex-col items-center rounded-md border px-2 py-1.5",
                          voted
                            ? "border-[var(--primary)] bg-[var(--primary)] text-slate-900"
                            : "border-[var(--border)] text-gray-300 hover:border-[var(--primary)]",
                        )}
                      >
                        <span className="text-xs leading-none">▲</span>
                        <span className="text-sm font-semibold">
                          {idea.votes.length}
                        </span>
                      </button>
                    </form>

                    <div className="min-w-40 flex-1">
                      <p className="font-medium text-white">{idea.title}</p>
                      {idea.description ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-400">
                          {idea.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-gray-500">
                        {idea.author.name} · {formatDateTime(idea.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge tone={STATUS_TONES[idea.status] ?? "slate"}>
                        {humanise(idea.status)}
                      </Badge>
                      {isManager ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          {IDEA_STATUSES.filter((s) => s !== idea.status).map(
                            (s) => (
                              <form key={s} action={setIdeaStatusAction}>
                                <input
                                  type="hidden"
                                  name="ideaId"
                                  value={idea.id}
                                />
                                <input type="hidden" name="status" value={s} />
                                <button
                                  type="submit"
                                  className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-gray-400 hover:bg-[var(--border)] hover:text-white"
                                >
                                  {humanise(s)}
                                </button>
                              </form>
                            ),
                          )}
                        </div>
                      ) : null}
                      {idea.authorId === user.id || isManager ? (
                        <form action={deleteIdeaAction}>
                          <input type="hidden" name="id" value={idea.id} />
                          <button
                            type="submit"
                            title="Delete idea"
                            className="text-xs text-gray-600 hover:text-red-400"
                          >
                            Remove
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

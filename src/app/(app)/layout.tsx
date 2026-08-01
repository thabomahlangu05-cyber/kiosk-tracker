import { requireUser } from "@/lib/auth";
import { can, NAV } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/enums";
import { Sidebar } from "@/components/sidebar";
import { logout } from "@/app/actions/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const items = NAV.filter((n) => can(user.role, n.action)).map((n) => ({
    href: n.href,
    label: n.label,
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
          <div className="text-sm text-gray-400">
            {ROLE_LABELS[user.role] ?? user.role}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-white">
              {user.name}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-[var(--border)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

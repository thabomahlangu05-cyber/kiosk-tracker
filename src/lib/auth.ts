import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./session";
import { can, type Action } from "./rbac";

/** Current session user, or null. */
export async function auth(): Promise<SessionUser | null> {
  return getSession();
}

/** Require an authenticated user; redirect to login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

/** Require a user who is permitted to perform `action`; bounce to dashboard otherwise. */
export async function requireAction(action: Action): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, action)) redirect("/dashboard");
  return user;
}

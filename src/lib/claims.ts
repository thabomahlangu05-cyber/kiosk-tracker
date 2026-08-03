import { ROLES, BUILD_STAGES, REPAIR_STAGES } from "./enums";

// Kept out of the server-actions file because a "use server" module may only
// export async functions.

/** Roles allowed to claim work off the open queue, at any stage. */
export const CLAIM_ROLES: string[] = [
  ROLES.REPAIR_TECHNICIAN,
  ROLES.QA_TECHNICIAN,
];

/** Stage names that end a job — nothing sitting here is claimable. */
export const TERMINAL_STAGES = [...BUILD_STAGES, ...REPAIR_STAGES]
  .filter((s) => s.isTerminal)
  .map((s) => s.name);

export function canClaimWork(role: string | undefined | null): boolean {
  return !!role && CLAIM_ROLES.includes(role);
}

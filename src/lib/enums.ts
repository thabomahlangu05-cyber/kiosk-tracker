// Central definitions for enum-like string fields (SQLite has no native enums)
// and the configurable production workflows.

export const ROLES = {
  PRODUCTION_MANAGER: "PRODUCTION_MANAGER",
  TEAM_LEADER: "TEAM_LEADER",
  INVENTORY_MANAGER: "INVENTORY_MANAGER",
  INVENTORY_OFFICER: "INVENTORY_OFFICER",
  REPAIR_TECHNICIAN: "REPAIR_TECHNICIAN",
  QA_TECHNICIAN: "QA_TECHNICIAN",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  PRODUCTION_MANAGER: "Production Manager",
  TEAM_LEADER: "Team Leader",
  INVENTORY_MANAGER: "Inventory Manager",
  INVENTORY_OFFICER: "Inventory Officer",
  REPAIR_TECHNICIAN: "Repair Technician",
  QA_TECHNICIAN: "QA Technician",
};

export const KINDS = { BUILD: "BUILD", REPAIR: "REPAIR" } as const;
export type Kind = (typeof KINDS)[keyof typeof KINDS];

/** Customer groups a kiosk can belong to — replaces the old kiosk model. */
export const GROUPS = ["Sanlam", "TFG", "AKD"] as const;
export type Group = (typeof GROUPS)[number];

/** Housekeeping task categories, in the order they appear as tabs. */
export const HOUSEKEEPING_CATEGORIES = [
  "CLEANING",
  "TOOLS",
  "STOCK",
  "SAFETY",
  "GENERAL",
] as const;
export type HousekeepingCategory = (typeof HOUSEKEEPING_CATEGORIES)[number];

/** How often a housekeeping task recurs. */
export const HOUSEKEEPING_FREQUENCIES = [
  "ONCE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
] as const;
export type HousekeepingFrequency = (typeof HOUSEKEEPING_FREQUENCIES)[number];

/** Title-case a SCREAMING_CASE enum value for display ("DAILY" -> "Daily"). */
export function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/** Which checklist a RepairChecklistItem belongs to. */
export const CHECKLIST_PHASE = { REPAIR: "REPAIR", QA: "QA" } as const;
export type ChecklistPhase =
  (typeof CHECKLIST_PHASE)[keyof typeof CHECKLIST_PHASE];

export const JOB_STATUS = {
  IN_PROGRESS: "IN_PROGRESS",
  ON_HOLD: "ON_HOLD",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const PRIORITIES = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type Priority = (typeof PRIORITIES)[keyof typeof PRIORITIES];

export const MOVEMENT_TYPES = {
  RECEIPT: "RECEIPT",
  ISSUE: "ISSUE",
  ADJUSTMENT: "ADJUSTMENT",
  RETURN: "RETURN",
} as const;
export type MovementType = (typeof MOVEMENT_TYPES)[keyof typeof MOVEMENT_TYPES];

export const MOVEMENT_LABELS: Record<string, string> = {
  RECEIPT: "Received",
  ISSUE: "Issued",
  ADJUSTMENT: "Adjusted",
  RETURN: "Returned",
};

/** Effect of a movement on quantity-on-hand (ISSUE is negative; ADJUSTMENT is stored signed). */
export function movementSignedQty(type: string, quantity: number): number {
  if (type === MOVEMENT_TYPES.ISSUE) return -Math.abs(quantity);
  if (type === MOVEMENT_TYPES.ADJUSTMENT) return quantity;
  return Math.abs(quantity); // RECEIPT, RETURN
}

export const QA_RESULT = { PASS: "PASS", FAIL: "FAIL" } as const;
export type QaResult = (typeof QA_RESULT)[keyof typeof QA_RESULT];

// Lives here rather than in the server-actions file: a "use server" module may
// only export async functions.
export const PART_REQUEST_STATUS = {
  REQUESTED: "REQUESTED",
  ISSUED: "ISSUED",
  CANCELLED: "CANCELLED",
} as const;
export type PartRequestStatus =
  (typeof PART_REQUEST_STATUS)[keyof typeof PART_REQUEST_STATUS];

// ---- Workflows ------------------------------------------------------------
export interface StageDef {
  name: string; // stable key stored in Job.currentStage & StageDefinition.name
  label: string;
  sequence: number;
  isQa?: boolean;
  isTerminal?: boolean;
}

// Both paths converge from Power On onwards: Power On → QA → Boxing → Dispatch.
export const BUILD_STAGES: StageDef[] = [
  { name: "KITTING", label: "Kitting", sequence: 1 },
  { name: "ASSEMBLY", label: "Assembly", sequence: 2 },
  { name: "POWER_ON", label: "Power On", sequence: 3 },
  { name: "QA", label: "QA", sequence: 4, isQa: true },
  { name: "BOXING", label: "Boxing / Packing", sequence: 5 },
  { name: "DISPATCH", label: "Dispatch", sequence: 6, isTerminal: true },
];

export const REPAIR_STAGES: StageDef[] = [
  { name: "RECEIVING", label: "Receiving", sequence: 1 },
  { name: "REPAIR", label: "Repair", sequence: 2 },
  { name: "POWER_ON", label: "Power On", sequence: 3 },
  { name: "QA", label: "QA", sequence: 4, isQa: true },
  { name: "BOXING", label: "Boxing / Packing", sequence: 5 },
  { name: "DISPATCH", label: "Dispatch", sequence: 6, isTerminal: true },
];

export function stagesFor(kind: string): StageDef[] {
  return kind === KINDS.BUILD ? BUILD_STAGES : REPAIR_STAGES;
}

export function stageLabel(kind: string, name: string): string {
  return stagesFor(kind).find((s) => s.name === name)?.label ?? name;
}

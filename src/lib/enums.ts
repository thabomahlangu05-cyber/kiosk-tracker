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

// ---- Workflows ------------------------------------------------------------
export interface StageDef {
  name: string; // stable key stored in Job.currentStage & StageDefinition.name
  label: string;
  sequence: number;
  isQa?: boolean;
  isTerminal?: boolean;
}

export const BUILD_STAGES: StageDef[] = [
  { name: "KITTING", label: "Kitting", sequence: 1 },
  { name: "ASSEMBLY", label: "Assembly", sequence: 2 },
  { name: "TEST", label: "Test", sequence: 3 },
  { name: "QA", label: "QA", sequence: 4, isQa: true },
  { name: "DISPATCH", label: "Dispatch", sequence: 5, isTerminal: true },
];

export const REPAIR_STAGES: StageDef[] = [
  { name: "DIAGNOSIS", label: "Diagnosis", sequence: 1 },
  { name: "REPAIR", label: "Repair", sequence: 2 },
  { name: "TEST", label: "Test", sequence: 3 },
  { name: "QA", label: "QA", sequence: 4, isQa: true },
  { name: "DISPATCH", label: "Dispatch", sequence: 5, isTerminal: true },
];

export function stagesFor(kind: string): StageDef[] {
  return kind === KINDS.BUILD ? BUILD_STAGES : REPAIR_STAGES;
}

export function stageLabel(kind: string, name: string): string {
  return stagesFor(kind).find((s) => s.name === name)?.label ?? name;
}

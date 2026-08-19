import { ROLES, type Role } from "./enums";

// Actions that can be gated. Keep these coarse-grained and readable.
export type Action =
  | "dashboard:view"
  | "units:viewAll" // see every unit (else only own assigned)
  | "intake:create"
  | "job:assign"
  | "job:advanceStage"
  | "qa:inspect"
  | "inventory:view"
  | "inventory:manage" // catalog, reorder levels, adjustments
  | "inventory:move" // receive / issue stock
  | "reports:view"
  | "admin:manage"; // users, teams, models, workflow config

const {
  PRODUCTION_MANAGER,
  TEAM_LEADER,
  INVENTORY_MANAGER,
  INVENTORY_OFFICER,
  REPAIR_TECHNICIAN,
  QA_TECHNICIAN,
} = ROLES;

// Which roles may perform each action.
const MATRIX: Record<Action, Role[]> = {
  "dashboard:view": [
    PRODUCTION_MANAGER,
    TEAM_LEADER,
    INVENTORY_MANAGER,
    INVENTORY_OFFICER,
    REPAIR_TECHNICIAN,
    QA_TECHNICIAN,
  ],
  "units:viewAll": [
    PRODUCTION_MANAGER,
    TEAM_LEADER,
    INVENTORY_MANAGER,
    QA_TECHNICIAN,
  ],
  // Anyone on the floor can log a kiosk in at Receiving.
  "intake:create": [
    PRODUCTION_MANAGER,
    TEAM_LEADER,
    INVENTORY_MANAGER,
    INVENTORY_OFFICER,
    REPAIR_TECHNICIAN,
    QA_TECHNICIAN,
  ],
  "job:assign": [PRODUCTION_MANAGER, TEAM_LEADER],
  // Both technician roles can claim and move work at any stage, so both need
  // this (it also gates the "My Work" queue in NAV below).
  "job:advanceStage": [
    PRODUCTION_MANAGER,
    TEAM_LEADER,
    REPAIR_TECHNICIAN,
    QA_TECHNICIAN,
  ],
  "qa:inspect": [PRODUCTION_MANAGER, QA_TECHNICIAN],
  "inventory:view": [
    PRODUCTION_MANAGER,
    INVENTORY_MANAGER,
    INVENTORY_OFFICER,
    TEAM_LEADER,
  ],
  "inventory:manage": [PRODUCTION_MANAGER, INVENTORY_MANAGER],
  "inventory:move": [INVENTORY_MANAGER, INVENTORY_OFFICER],
  "reports:view": [PRODUCTION_MANAGER, INVENTORY_MANAGER, TEAM_LEADER],
  "admin:manage": [PRODUCTION_MANAGER],
};

/** True if the given role may perform the action. */
export function can(role: string | undefined | null, action: Action): boolean {
  if (!role) return false;
  return MATRIX[action]?.includes(role as Role) ?? false;
}

// Navigation entries, filtered by capability in the sidebar.
export interface NavItem {
  href: string;
  label: string;
  action: Action;
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", action: "dashboard:view" },
  { href: "/units", label: "Units", action: "dashboard:view" },
  { href: "/queue", label: "My Work", action: "job:advanceStage" },
  { href: "/intake", label: "Intake", action: "intake:create" },
  { href: "/qa", label: "QA", action: "qa:inspect" },
  { href: "/inventory", label: "Inventory", action: "inventory:view" },
  { href: "/reports", label: "Reports", action: "reports:view" },
  { href: "/team-performance", label: "Team Performance", action: "dashboard:view" },
  // Open to the whole floor — dashboard:view covers every role.
  { href: "/housekeeping", label: "Housekeeping", action: "dashboard:view" },
  { href: "/stock", label: "Stock", action: "dashboard:view" },
  { href: "/communications", label: "Communications", action: "dashboard:view" },
  { href: "/ideas", label: "Ideas", action: "dashboard:view" },
  { href: "/admin", label: "Admin", action: "admin:manage" },
];

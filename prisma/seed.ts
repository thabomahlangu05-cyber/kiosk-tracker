import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  ROLES,
  KINDS,
  BUILD_STAGES,
  REPAIR_STAGES,
} from "../src/lib/enums";

// Seed runs standalone via `tsx`; load .env for DATABASE_URL.
try {
  process.loadEnvFile();
} catch {
  /* optional */
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// All seeded accounts share this password (development only).
const DEFAULT_PASSWORD = "changeme123";

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // --- Workflow stage definitions -----------------------------------------
  // Replaced wholesale rather than upserted: these rows are derived from the
  // arrays in src/lib/enums.ts, and @@unique([kind, sequence]) means any
  // reordering (inserting a stage mid-pipeline) collides on an in-place update.
  await prisma.stageDefinition.deleteMany({});
  for (const [kind, stages] of [
    [KINDS.BUILD, BUILD_STAGES],
    [KINDS.REPAIR, REPAIR_STAGES],
  ] as const) {
    await prisma.stageDefinition.createMany({
      data: stages.map((s) => ({
        kind,
        name: s.name,
        sequence: s.sequence,
        isQa: !!s.isQa,
        isTerminal: !!s.isTerminal,
      })),
    });
  }

  // --- Defect catalog ------------------------------------------------------
  const defectTypes = [
    "Cosmetic damage",
    "Display fault",
    "Card reader fault",
    "Thermal printer fault",
    "Power fault",
    "Connectivity fault",
    "Software / configuration",
  ];
  for (const name of defectTypes) {
    await prisma.defectType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // --- Parts inventory -----------------------------------------------------
  const parts = [
    { sku: "DISP-001", name: "LCD Display Panel", category: "Display", quantityOnHand: 40, reorderLevel: 10, unitCost: 120, binLocation: "A1" },
    { sku: "CRD-002", name: "Card Reader Module", category: "Peripherals", quantityOnHand: 25, reorderLevel: 8, unitCost: 85, binLocation: "A2" },
    { sku: "PRN-003", name: "Thermal Printer", category: "Peripherals", quantityOnHand: 15, reorderLevel: 5, unitCost: 60, binLocation: "A3" },
    { sku: "PSU-004", name: "Power Supply Unit", category: "Power", quantityOnHand: 30, reorderLevel: 10, unitCost: 45, binLocation: "B1" },
    { sku: "TCH-005", name: "Touch Controller", category: "Display", quantityOnHand: 20, reorderLevel: 6, unitCost: 35, binLocation: "B2" },
    { sku: "NET-006", name: "Network Module", category: "Connectivity", quantityOnHand: 18, reorderLevel: 6, unitCost: 50, binLocation: "B3" },
    { sku: "ENC-007", name: "Enclosure Panel", category: "Chassis", quantityOnHand: 12, reorderLevel: 4, unitCost: 90, binLocation: "C1" },
    { sku: "CBL-008", name: "Cable Harness", category: "Chassis", quantityOnHand: 50, reorderLevel: 15, unitCost: 12, binLocation: "C2" },
  ];
  for (const p of parts) {
    await prisma.part.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        category: p.category,
        reorderLevel: p.reorderLevel,
        unitCost: p.unitCost,
        binLocation: p.binLocation,
      },
      create: p,
    });
  }

  // --- Users ---------------------------------------------------------------
  async function upsertUser(email: string, name: string, role: string) {
    return prisma.user.upsert({
      where: { email },
      update: { name, role, teamId: null },
      create: { email, name, role, passwordHash, teamId: null },
    });
  }

  // Production Manager (the app owner) + standalone roles.
  await upsertUser("thabo.mahlangu@tymedigital.com", "Thabo Mahlangu", ROLES.PRODUCTION_MANAGER);
  await upsertUser("inventory.manager@kiosk.local", "Ivy Ngwenya", ROLES.INVENTORY_MANAGER);
  await upsertUser("io1@kiosk.local", "Officer Dlamini", ROLES.INVENTORY_OFFICER);
  await upsertUser("io2@kiosk.local", "Officer Botha", ROLES.INVENTORY_OFFICER);
  await upsertUser("qa1@kiosk.local", "Quality Naidoo", ROLES.QA_TECHNICIAN);
  await upsertUser("qa2@kiosk.local", "Quality Pillay", ROLES.QA_TECHNICIAN);

  // Team leaders (a permission level; there are no Team records any more).
  const leaderNames = ["Lead Khumalo", "Lead Sithole", "Lead Adams"];
  for (let i = 0; i < 3; i++) {
    await upsertUser(`tl${i + 1}@kiosk.local`, leaderNames[i], ROLES.TEAM_LEADER);
  }

  // 15 repair/build technicians.
  for (let i = 0; i < 15; i++) {
    await upsertUser(
      `tech${i + 1}@kiosk.local`,
      `Technician ${i + 1}`,
      ROLES.REPAIR_TECHNICIAN,
    );
  }

  console.log(
    `Seed complete. ${await prisma.user.count()} users, ${await prisma.part.count()} parts. Default password: ${DEFAULT_PASSWORD}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

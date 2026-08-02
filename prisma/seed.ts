import { PrismaClient } from "@prisma/client";
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

const prisma = new PrismaClient();

// All seeded accounts share this password (development only).
const DEFAULT_PASSWORD = "changeme123";

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // --- Workflow stage definitions -----------------------------------------
  for (const [kind, stages] of [
    [KINDS.BUILD, BUILD_STAGES],
    [KINDS.REPAIR, REPAIR_STAGES],
  ] as const) {
    for (const s of stages) {
      await prisma.stageDefinition.upsert({
        where: { kind_name: { kind, name: s.name } },
        update: {
          sequence: s.sequence,
          isQa: !!s.isQa,
          isTerminal: !!s.isTerminal,
        },
        create: {
          kind,
          name: s.name,
          sequence: s.sequence,
          isQa: !!s.isQa,
          isTerminal: !!s.isTerminal,
        },
      });
    }
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

  // --- Kiosk models --------------------------------------------------------
  const models = [
    { name: "GoTyme Kiosk G1", description: "First-generation banking kiosk" },
    { name: "GoTyme Kiosk G2", description: "Second-generation banking kiosk" },
  ];
  const modelIds: Record<string, string> = {};
  for (const m of models) {
    const rec = await prisma.kioskModel.upsert({
      where: { name: m.name },
      update: { description: m.description },
      create: m,
    });
    modelIds[m.name] = rec.id;
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
  async function upsertUser(
    email: string,
    name: string,
    role: string,
    teamId?: string | null,
  ) {
    return prisma.user.upsert({
      where: { email },
      update: { name, role, teamId: teamId ?? null },
      create: { email, name, role, passwordHash, teamId: teamId ?? null },
    });
  }

  // Production Manager (the app owner) + standalone roles.
  await upsertUser("thabo.mahlangu@tymedigital.com", "Thabo Mahlangu", ROLES.PRODUCTION_MANAGER);
  await upsertUser("inventory.manager@kiosk.local", "Ivy Ngwenya", ROLES.INVENTORY_MANAGER);
  await upsertUser("io1@kiosk.local", "Officer Dlamini", ROLES.INVENTORY_OFFICER);
  await upsertUser("io2@kiosk.local", "Officer Botha", ROLES.INVENTORY_OFFICER);
  await upsertUser("qa1@kiosk.local", "Quality Naidoo", ROLES.QA_TECHNICIAN);
  await upsertUser("qa2@kiosk.local", "Quality Pillay", ROLES.QA_TECHNICIAN);

  // Team leaders (created before teams so we can set leaderId).
  const leaderNames = ["Lead Khumalo", "Lead Sithole", "Lead Adams"];
  const leaders = [];
  for (let i = 0; i < 3; i++) {
    leaders.push(
      await upsertUser(`tl${i + 1}@kiosk.local`, leaderNames[i], ROLES.TEAM_LEADER),
    );
  }

  // Teams led by the team leaders.
  const teamNames = ["Line A", "Line B", "Line C"];
  const teams = [];
  for (let i = 0; i < 3; i++) {
    const team = await prisma.team.upsert({
      where: { name: teamNames[i] },
      update: { leaderId: leaders[i].id },
      create: { name: teamNames[i], leaderId: leaders[i].id },
    });
    teams.push(team);
    // Put the leader on their own team.
    await prisma.user.update({
      where: { id: leaders[i].id },
      data: { teamId: team.id },
    });
  }

  // 15 repair/build technicians, distributed round-robin across the 3 teams.
  for (let i = 0; i < 15; i++) {
    const team = teams[i % 3];
    await upsertUser(
      `tech${i + 1}@kiosk.local`,
      `Technician ${i + 1}`,
      ROLES.REPAIR_TECHNICIAN,
      team.id,
    );
  }

  // --- Demo units (only if none exist yet) --------------------------------
  const existingJobs = await prisma.job.count();
  if (existingJobs === 0) {
    const teamA = teams[0];
    const teamB = teams[1];
    const techA = await prisma.user.findFirst({
      where: { role: ROLES.REPAIR_TECHNICIAN, teamId: teamA.id },
    });
    const techB = await prisma.user.findFirst({
      where: { role: ROLES.REPAIR_TECHNICIAN, teamId: teamB.id },
    });

    // Build unit at first build stage.
    const buildKiosk = await prisma.kiosk.create({
      data: {
        serialNumber: "DEMO-BUILD-0001",
        modelId: modelIds["GoTyme Kiosk G2"],
        kind: KINDS.BUILD,
      },
    });
    await prisma.job.create({
      data: {
        kioskId: buildKiosk.id,
        kind: KINDS.BUILD,
        currentStage: BUILD_STAGES[0].name,
        buildOrderRef: "BO-2026-001",
        assignedTeamId: teamA.id,
        assignedTechId: techA?.id ?? null,
        transitions: {
          create: { stage: BUILD_STAGES[0].name, userId: techA?.id ?? null },
        },
      },
    });

    // Repair unit at first repair stage.
    const repairKiosk = await prisma.kiosk.create({
      data: {
        serialNumber: "DEMO-REPAIR-0001",
        modelId: modelIds["GoTyme Kiosk G1"],
        kind: KINDS.REPAIR,
      },
    });
    await prisma.job.create({
      data: {
        kioskId: repairKiosk.id,
        kind: KINDS.REPAIR,
        currentStage: REPAIR_STAGES[0].name,
        faultReport: "Card reader not responding; intermittent display flicker.",
        assignedTeamId: teamB.id,
        assignedTechId: techB?.id ?? null,
        transitions: {
          create: { stage: REPAIR_STAGES[0].name, userId: techB?.id ?? null },
        },
      },
    });
  }

  console.log(
    `Seed complete. ${await prisma.user.count()} users, ${await prisma.team.count()} teams, ${await prisma.part.count()} parts. Default password: ${DEFAULT_PASSWORD}`,
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

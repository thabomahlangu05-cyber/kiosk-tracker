import { KINDS, stagesFor, type StageDef } from "./enums";

export function firstStage(kind: string): StageDef {
  return stagesFor(kind)[0];
}

export function getStage(kind: string, name: string): StageDef | undefined {
  return stagesFor(kind).find((s) => s.name === name);
}

/** The next stage in sequence, or null if the current stage is terminal/last. */
export function nextStage(kind: string, name: string): StageDef | null {
  const stages = stagesFor(kind);
  const idx = stages.findIndex((s) => s.name === name);
  if (idx < 0 || idx >= stages.length - 1) return null;
  return stages[idx + 1];
}

/** Where a unit goes when it FAILS QA — back to the main hands-on stage. */
export function reworkStage(kind: string): StageDef {
  const target = kind === KINDS.BUILD ? "ASSEMBLY" : "REPAIR";
  return getStage(kind, target) ?? firstStage(kind);
}

export function isQaStage(kind: string, name: string): boolean {
  return !!getStage(kind, name)?.isQa;
}

export function isTerminalStage(kind: string, name: string): boolean {
  return !!getStage(kind, name)?.isTerminal;
}

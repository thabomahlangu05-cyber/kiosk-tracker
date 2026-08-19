"use client";

import { useActionState, useState } from "react";
import { createUnit, type IntakeState } from "@/app/actions/jobs";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { KINDS, PRIORITIES } from "@/lib/enums";

interface Option {
  id: string;
  name: string;
}
interface Tech extends Option {
  teamId: string | null;
}

const initial: IntakeState = {};

export function IntakeForm({
  models,
  teams,
  techs,
}: {
  models: Option[];
  teams: Option[];
  techs: Tech[];
}) {
  const [state, formAction, pending] = useActionState(createUnit, initial);
  // No default: picking Build by accident sends the unit down the build
  // pipeline, which has no Repair stage and so no repair checklist.
  const [kind, setKind] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");

  const availableTechs = techs.filter((t) => !teamId || t.teamId === teamId);

  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="serialNumber">Serial number</Label>
          <Input id="serialNumber" name="serialNumber" required placeholder="KSK-2026-0001" />
        </div>
        <div>
          <Label htmlFor="modelId">Model</Label>
          <Select id="modelId" name="modelId" required defaultValue="">
            <option value="" disabled>
              Select a model…
            </option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="kind">Type</Label>
          <Select
            id="kind"
            name="kind"
            required
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="" disabled>
              Select build or repair…
            </option>
            <option value={KINDS.REPAIR}>Repair / refurbish</option>
            <option value={KINDS.BUILD}>Build (new)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" name="priority" defaultValue={PRIORITIES.NORMAL}>
            {Object.values(PRIORITIES).map((p) => (
              <option key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="assignedTeamId">Team (optional)</Label>
          <Select
            id="assignedTeamId"
            name="assignedTeamId"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="assignedTechId">Technician (optional)</Label>
          <Select id="assignedTechId" name="assignedTechId" defaultValue="">
            <option value="">Unassigned</option>
            {availableTechs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {kind === KINDS.BUILD ? (
        <div>
          <Label htmlFor="buildOrderRef">Build order reference (optional)</Label>
          <Input id="buildOrderRef" name="buildOrderRef" placeholder="BO-2026-001" />
        </div>
      ) : kind === KINDS.REPAIR ? (
        <div>
          <Label htmlFor="faultReport">Fault report</Label>
          <Textarea
            id="faultReport"
            name="faultReport"
            placeholder="Describe the reported fault…"
          />
          <p className="mt-1 text-xs text-gray-500">
            Repair units get the standard repair checklist automatically.
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create unit"}
      </Button>
    </form>
  );
}

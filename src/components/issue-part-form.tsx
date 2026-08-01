"use client";

import { useActionState } from "react";
import { issuePart, type FormState } from "@/app/actions/inventory";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

interface PartOption {
  id: string;
  label: string;
}

const initial: FormState = {};

export function IssuePartForm({
  jobId,
  parts,
}: {
  jobId: string;
  parts: PartOption[];
}) {
  const [state, formAction, pending] = useActionState(issuePart, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="min-w-56 flex-1">
        <Label htmlFor="issue-part">Part</Label>
        <Select id="issue-part" name="partId" required defaultValue="">
          <option value="" disabled>
            Select a part…
          </option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-28">
        <Label htmlFor="issue-qty">Qty</Label>
        <Input id="issue-qty" name="quantity" type="number" min="1" defaultValue={1} required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Issuing…" : "Issue"}
      </Button>
      {state.error ? (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="w-full text-sm text-green-600">Part issued to this unit.</p>
      ) : null}
    </form>
  );
}

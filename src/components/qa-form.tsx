"use client";

import { useActionState, useState } from "react";
import { recordInspection, type QaState } from "@/app/actions/qa";
import { Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { QA_RESULT } from "@/lib/enums";

interface DefectType {
  id: string;
  name: string;
}

const initial: QaState = {};

export function QaForm({
  jobId,
  defectTypes,
}: {
  jobId: string;
  defectTypes: DefectType[];
}) {
  const [state, formAction, pending] = useActionState(recordInspection, initial);
  const [result, setResult] = useState<string>("");

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <input type="hidden" name="jobId" value={jobId} />

      <div>
        <Label>Result</Label>
        <div className="flex gap-3">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
            <input
              type="radio"
              name="result"
              value={QA_RESULT.PASS}
              onChange={(e) => setResult(e.target.value)}
            />
            Pass
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm has-[:checked]:border-red-500 has-[:checked]:bg-red-50">
            <input
              type="radio"
              name="result"
              value={QA_RESULT.FAIL}
              onChange={(e) => setResult(e.target.value)}
            />
            Fail
          </label>
        </div>
      </div>

      <div>
        <Label>
          Defects{" "}
          <span className="font-normal text-slate-400">
            (required when failing)
          </span>
        </Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {defectTypes.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <input type="checkbox" name="defectTypeIds" value={d.id} />
              {d.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" placeholder="Inspection notes…" />
      </div>

      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        variant={result === QA_RESULT.FAIL ? "danger" : "primary"}
      >
        {pending ? "Saving…" : "Record inspection"}
      </Button>
    </form>
  );
}

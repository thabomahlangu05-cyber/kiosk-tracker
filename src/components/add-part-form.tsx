"use client";

import { useActionState } from "react";
import { createPart, type FormState } from "@/app/actions/inventory";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initial: FormState = {};

export function AddPartForm() {
  const [state, formAction, pending] = useActionState(createPart, initial);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" required placeholder="DISP-009" />
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="LCD Display Panel" />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" placeholder="Display" />
        </div>
        <div>
          <Label htmlFor="binLocation">Bin</Label>
          <Input id="binLocation" name="binLocation" placeholder="A1" />
        </div>
        <div>
          <Label htmlFor="reorderLevel">Reorder level</Label>
          <Input id="reorderLevel" name="reorderLevel" type="number" min="0" defaultValue={0} />
        </div>
        <div>
          <Label htmlFor="unitCost">Unit cost (₱)</Label>
          <Input id="unitCost" name="unitCost" type="number" min="0" step="0.01" defaultValue={0} />
        </div>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add part"}
      </Button>
    </form>
  );
}

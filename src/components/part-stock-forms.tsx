"use client";

import { useActionState } from "react";
import {
  receiveStock,
  adjustStock,
  type FormState,
} from "@/app/actions/inventory";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initial: FormState = {};

export function ReceiveForm({ partId }: { partId: string }) {
  const [state, formAction, pending] = useActionState(receiveStock, initial);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="partId" value={partId} />
      <div>
        <Label htmlFor="rcv-qty">Quantity received</Label>
        <Input id="rcv-qty" name="quantity" type="number" min="1" required />
      </div>
      <div>
        <Label htmlFor="rcv-note">Note (optional)</Label>
        <Input id="rcv-note" name="note" placeholder="PO / supplier" />
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">Stock received.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Receive stock"}
      </Button>
    </form>
  );
}

export function AdjustForm({ partId }: { partId: string }) {
  const [state, formAction, pending] = useActionState(adjustStock, initial);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="partId" value={partId} />
      <div>
        <Label htmlFor="adj-delta">Adjustment (+/−)</Label>
        <Input
          id="adj-delta"
          name="delta"
          type="number"
          required
          placeholder="e.g. -2 for shrinkage"
        />
      </div>
      <div>
        <Label htmlFor="adj-note">Reason</Label>
        <Input id="adj-note" name="note" placeholder="Stock count / damage" />
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">Stock adjusted.</p> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Adjust stock"}
      </Button>
    </form>
  );
}

"use client";

import { useFormStatus } from "react-dom";

import type { SalesFormOption } from "@/server/sales/types";

export function DeliverySourceLocationAutosave({
  deliveryId,
  sourceLocationId,
  locations,
  action,
}: {
  deliveryId: string;
  sourceLocationId: string;
  locations: SalesFormOption[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="flex flex-col gap-1 text-sm font-medium">
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <span className="text-xs font-medium uppercase text-muted-foreground">Source Location</span>
      <AutosaveSelect sourceLocationId={sourceLocationId} locations={locations} />
    </form>
  );
}

function AutosaveSelect({
  sourceLocationId,
  locations,
}: {
  sourceLocationId: string;
  locations: SalesFormOption[];
}) {
  const { pending } = useFormStatus();

  return (
    <div className="grid gap-1">
      <select
        name="sourceLocationId"
        defaultValue={sourceLocationId}
        disabled={pending}
        className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-wait disabled:opacity-70"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.code} / {location.name}
          </option>
        ))}
      </select>
      {pending ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
    </div>
  );
}

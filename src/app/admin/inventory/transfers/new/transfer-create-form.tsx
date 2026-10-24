"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Building2, MapPin, Truck, Users } from "lucide-react";

import { createTransfer } from "@/app/admin/inventory/transfers/actions";
import { TransferLinesEditor } from "@/app/admin/inventory/transfers/transfer-lines-editor";
import { Button } from "@/components/ui/button";
import { T } from "@/components/ui/t";
import type { TransferFormOptions } from "@/server/transfers/types";

function inputClass() {
  return "h-10 w-full rounded-xl border border-input bg-background px-3 text-xs sm:text-sm font-medium outline-none transition-all focus:border-[#0B5D4B] focus:ring-2 focus:ring-[#0B5D4B]/20";
}

export function TransferCreateForm({ options }: { options: TransferFormOptions }) {
  const [fromLocationId, setFromLocationId] = useState(options.locations[0]?.id ?? "");
  const [transitLocationId, setTransitLocationId] = useState(options.transitLocations[0]?.id ?? "");
  const [toLocationId, setToLocationId] = useState("");
  const [ownerId, setOwnerId] = useState(options.owners[0]?.id ?? "");
  const [toOwnerId, setToOwnerId] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  // Owners assigned to the receiver location
  const receiverLocationOwners = useMemo(() => {
    if (!toLocationId) return [];
    return options.owners.filter((owner) => owner.locationIds?.includes(toLocationId));
  }, [options.owners, toLocationId]);

  const hasMultipleReceiverOwners = receiverLocationOwners.length > 1;

  function handleToLocationChange(newToLocId: string) {
    setToLocationId(newToLocId);
    setClientError(null);

    const matching = options.owners.filter((owner) => owner.locationIds?.includes(newToLocId));

    if (matching.length === 1) {
      // Exactly one owner for receiver location: auto-select it!
      setToOwnerId(matching[0].id);
    } else if (matching.length > 1) {
      // Multiple owners: require user selection!
      setToOwnerId("");
    } else {
      // No specific owner linked: fallback to current source owner
      setToOwnerId(ownerId || (options.owners[0]?.id ?? ""));
    }
  }

  function handleFromLocationChange(newFromLocId: string) {
    setFromLocationId(newFromLocId);
    setClientError(null);

    if (toLocationId === newFromLocId) {
      setToLocationId("");
      setToOwnerId("");
    }

    // Auto-select source owner if location has an assigned owner
    const matchingFrom = options.owners.filter((owner) => owner.locationIds?.includes(newFromLocId));
    if (matchingFrom.length === 1) {
      setOwnerId(matchingFrom[0].id);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setClientError(null);

    if (hasMultipleReceiverOwners && !toOwnerId) {
      event.preventDefault();
      setClientError("Multiple owners exist for the destination location. You must explicitly select the receiver owner.");
      return;
    }

    if (!toOwnerId) {
      // Default to source owner if nothing was set
      setToOwnerId(ownerId);
    }
  }

  return (
    <form action={createTransfer} onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-xs space-y-6">
      {clientError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
          {clientError}
        </div>
      ) : null}

      {/* Locations & Ownership Bento Card Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Source Location */}
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <MapPin className="size-3.5 text-primary" />
            <span><T k="field.from" fallback="From Location" /></span>
            <span className="text-destructive">*</span>
          </span>
          <select
            name="fromLocationId"
            required
            value={fromLocationId}
            onChange={(e) => handleFromLocationChange(e.target.value)}
            className={inputClass()}
          >
            <option value="" disabled><T k="field.selectSource" fallback="Select source" /></option>
            {options.locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code ? `${loc.code} · ${loc.name}` : loc.name}
              </option>
            ))}
          </select>
        </label>

        {/* Source Owner */}
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Users className="size-3.5 text-primary" />
            <span><T k="field.owner" fallback="Source Owner" /></span>
            <span className="text-destructive">*</span>
          </span>
          <select
            name="ownerId"
            required
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className={inputClass()}
          >
            <option value="" disabled><T k="field.selectOwner" fallback="Select owner" /></option>
            {options.owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>

        {/* Transit Location */}
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Truck className="size-3.5 text-primary" />
            <span><T k="field.transit" fallback="Transit Location" /></span>
            <span className="text-destructive">*</span>
          </span>
          <select
            name="transitLocationId"
            required
            value={transitLocationId}
            onChange={(e) => setTransitLocationId(e.target.value)}
            className={inputClass()}
          >
            <option value="" disabled><T k="field.selectTransit" fallback="Select transit" /></option>
            {options.transitLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code ? `${loc.code} · ${loc.name}` : loc.name}
              </option>
            ))}
          </select>
        </label>

        {/* Destination Location */}
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Building2 className="size-3.5 text-primary" />
            <span><T k="field.to" fallback="To (Receiver) Location" /></span>
            <span className="text-destructive">*</span>
          </span>
          <select
            name="toLocationId"
            required
            value={toLocationId}
            onChange={(e) => handleToLocationChange(e.target.value)}
            className={inputClass()}
          >
            <option value="" disabled><T k="field.selectDestination" fallback="Select destination" /></option>
            {options.locations
              .filter((loc) => loc.id !== fromLocationId)
              .map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code ? `${loc.code} · ${loc.name}` : loc.name}
                </option>
              ))}
          </select>
        </label>

        {/* Receiver Owner */}
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>To Owner (Receiver)</span>
              {hasMultipleReceiverOwners ? (
                <span className="text-destructive">*</span>
              ) : null}
            </span>
            {hasMultipleReceiverOwners ? (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                Multiple
              </span>
            ) : null}
          </span>
          <select
            name="toOwnerId"
            required={hasMultipleReceiverOwners}
            value={toOwnerId}
            onChange={(e) => {
              setToOwnerId(e.target.value);
              setClientError(null);
            }}
            className={inputClass()}
          >
            <option value="" disabled>
              {hasMultipleReceiverOwners ? "-- Select Receiver Owner (Required) --" : "-- Select receiver owner --"}
            </option>
            {options.owners.map((owner) => {
              const isAssigned = owner.locationIds?.includes(toLocationId);
              return (
                <option key={owner.id} value={owner.id}>
                  {owner.name} {isAssigned ? "★ (Assigned to location)" : ""}
                </option>
              );
            })}
          </select>
          {hasMultipleReceiverOwners ? (
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Multiple owners exist for this receiver location. Selection is mandatory.
            </span>
          ) : null}
        </label>
      </div>

      {/* Transfer Lines Table */}
      <div className="border-t border-border/70 pt-5">
        <TransferLinesEditor products={options.products} />
      </div>

      {/* Notes & Submission */}
      <div className="border-t border-border/70 pt-4 flex flex-col gap-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <T k="inventory.notes" fallback="Notes & Internal Reference" />
          </span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Add transfer justification, carrier info, or routing instructions..."
            className="w-full rounded-xl border border-input bg-background p-3 text-xs sm:text-sm outline-none transition-all focus:border-[#0B5D4B] focus:ring-2 focus:ring-[#0B5D4B]/20 resize-y"
          />
        </label>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {toOwnerId && ownerId !== toOwnerId ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                <span>Ownership transfer:</span>
                <span className="font-bold">{options.owners.find((o) => o.id === ownerId)?.name}</span>
                <ArrowRight className="size-3" />
                <span className="font-bold">{options.owners.find((o) => o.id === toOwnerId)?.name}</span>
              </span>
            ) : null}
          </div>

          <Button
            type="submit"
            className="gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 hover:brightness-110 active:scale-[0.99] px-6 py-2.5"
          >
            <span><T k="inventory.createDraft" fallback="Create Draft Transfer" /></span>
          </Button>
        </div>
      </div>
    </form>
  );
}

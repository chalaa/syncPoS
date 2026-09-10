"use client";

import { EditIcon, PlusIcon, RotateCcwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  createStockLocation,
  restoreStockLocation,
  softDeleteStockLocation,
  updateStockLocation,
} from "@/app/admin/inventory/locations/actions";
import { InventoryNavTabs } from "@/app/admin/inventory/inventory-nav-tabs";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
  formatStockLocationType,
  stockLocationTypeOptions,
  type StockLocationRecord,
} from "@/server/inventory/location-types";

type LocationMutation = (formData: FormData) => Promise<void>;

type LocationManagerProps = {
  records: StockLocationRecord[];
  query: string;
  showDeleted: boolean;
  notice?: string;
  error?: string;
  returnPath: string;
};

const inputClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass =
  "min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function LocationForm({
  title,
  action,
  record,
  returnPath,
}: {
  title: string;
  action: LocationMutation;
  record?: StockLocationRecord;
  returnPath: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Manage stock locations used by opening stock, transfers, counts, and sales.
        </DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-[0.7fr_1fr]">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Code
          <input name="code" placeholder={record ? undefined : "Auto"} defaultValue={record?.code} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input name="name" required defaultValue={record?.name} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Type
        <select
          name="locationType"
          required
          defaultValue={record?.locationType ?? "warehouse"}
          className={inputClass}
        >
          {stockLocationTypeOptions.map((option) => (
            <option key={option} value={option}>
              {formatStockLocationType(option)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Address / notes
        <textarea
          name="addressText"
          defaultValue={record?.addressText ?? ""}
          className={textareaClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="offlineSalesEnabled"
            defaultChecked={record?.offlineSalesEnabled ?? false}
            className="size-4 rounded border-input"
          />
          Offline sales
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="allowNegativeStock"
            defaultChecked={record?.allowNegativeStock ?? false}
            className="size-4 rounded border-input"
          />
          Negative stock
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={record?.isActive ?? true}
            className="size-4 rounded border-input"
          />
          Active
        </label>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button>{record ? "Save changes" : "Create"}</Button>
      </DialogFooter>
    </form>
  );
}

function LocationDialog({
  label,
  action,
  record,
  returnPath,
  children,
}: {
  label: string;
  action: LocationMutation;
  record?: StockLocationRecord;
  returnPath: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <LocationForm
          title={label}
          action={action}
          record={record}
          returnPath={returnPath}
        />
      </DialogContent>
    </Dialog>
  );
}

export function LocationManager({
  records,
  query,
  showDeleted,
  notice,
  error,
  returnPath,
}: LocationManagerProps) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory"
        title="Warehouse Locations"
        actions={
          <LocationDialog
            label="New location"
            action={createStockLocation}
            returnPath={returnPath}
          >
            <Button size="sm">
              <PlusIcon className="size-4" data-icon="inline-start" />
              New location
            </Button>
          </LocationDialog>
        }
      />

      <InventoryNavTabs currentHref="/admin/inventory/locations" />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <form className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search code or name..."
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring"
            />
            {showDeleted ? <input type="hidden" name="show" value="deleted" /> : null}
            <Button variant="outline" size="sm">
              <SearchIcon className="size-3.5" data-icon="inline-start" />
              Search
            </Button>
          </form>
          <div className="flex rounded-lg border border-border bg-muted/60 p-1 text-sm">
            <Button asChild variant={!showDeleted ? "secondary" : "ghost"} size="sm" className="h-7 text-xs">
              <Link href="/admin/inventory/locations">Active</Link>
            </Button>
            <Button asChild variant={showDeleted ? "secondary" : "ghost"} size="sm" className="h-7 text-xs">
              <Link href="/admin/inventory/locations?show=deleted">Deleted</Link>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Location Name</th>
                <th className="px-4 py-3">Facility Type</th>
                <th className="px-4 py-3">Offline Sales</th>
                <th className="px-4 py-3">Negative Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((record) => (
                <tr
                  key={record.id}
                  className="transition-colors hover:bg-[rgba(235,239,234,0.45)] dark:hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                    {record.code}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{record.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {record.addressText || "No address specified"}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-foreground">
                    {formatStockLocationType(record.locationType)}
                  </td>
                  <td className="px-4 py-3 text-foreground">{record.offlineSalesEnabled ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-foreground">{record.allowNegativeStock ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={record.isActive ? "active" : "inactive"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {!showDeleted ? (
                        <>
                          <LocationDialog
                            label={`Edit ${record.name}`}
                            action={updateStockLocation}
                            record={record}
                            returnPath={returnPath}
                          >
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              <EditIcon className="size-3.5" data-icon="inline-start" />
                              Edit
                            </Button>
                          </LocationDialog>
                          <form action={softDeleteStockLocation}>
                            <input type="hidden" name="id" value={record.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <Button variant="destructive" size="sm" className="h-7 text-xs">
                              <Trash2Icon className="size-3.5" data-icon="inline-start" />
                              Delete
                            </Button>
                          </form>
                        </>
                      ) : (
                        <form action={restoreStockLocation}>
                          <input type="hidden" name="id" value={record.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            <RotateCcwIcon className="size-3.5" data-icon="inline-start" />
                            Restore
                          </Button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No locations found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}

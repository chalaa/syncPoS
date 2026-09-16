"use client";

import { EditIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSearchInput } from "@/components/ui/table-search-input";
import {
  createStockLocation,
  restoreStockLocation,
  softDeleteStockLocation,
  updateStockLocation,
} from "@/app/admin/inventory/locations/actions";
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
  type StockLocationUserOption,
} from "@/server/inventory/location-types";

type LocationMutation = (formData: FormData) => Promise<void>;

type LocationManagerProps = {
  records: StockLocationRecord[];
  users: StockLocationUserOption[];
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
  users,
  returnPath,
}: {
  title: string;
  action: LocationMutation;
  record?: StockLocationRecord;
  users: StockLocationUserOption[];
  returnPath: string;
}) {
  const selectedApproverIds = new Set(record?.approverIds ?? []);

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

      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input name="name" required defaultValue={record?.name} className={inputClass} />
      </label>
      {record ? <input type="hidden" name="code" value={record.code} /> : null}

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

      <div className="grid gap-2 text-sm font-medium">
        Approvers
        <div className="max-h-44 overflow-y-auto rounded-md border border-input bg-background p-2">
          {users.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No active users found.</p>
          ) : (
            <div className="grid gap-1">
              {users.map((user) => (
                <label key={user.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-accent">
                  <input
                    type="checkbox"
                    name="approverIds"
                    value={user.id}
                    defaultChecked={selectedApproverIds.has(user.id)}
                    className="size-4 rounded border-input"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{user.username}</span>
                    {user.email ? <span className="block truncate text-xs text-muted-foreground">{user.email}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

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
  users,
  returnPath,
  children,
}: {
  label: string;
  action: LocationMutation;
  record?: StockLocationRecord;
  users: StockLocationUserOption[];
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
          users={users}
          returnPath={returnPath}
        />
      </DialogContent>
    </Dialog>
  );
}

export function LocationManager({
  records,
  users,
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
            users={users}
            returnPath={returnPath}
          >
            <Button size="sm">
              <PlusIcon className="size-4" data-icon="inline-start" />
              New location
            </Button>
          </LocationDialog>
        }
      />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 sm:max-w-md">
            <TableSearchInput
              placeholder="Search code or name..."
              defaultValue={query}
              paramName="q"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TableFilterSelect
              paramName="type"
              label="Type"
              options={stockLocationTypeOptions.map((t) => ({
                value: t,
                label: formatStockLocationType(t),
              }))}
              allLabel="All Types"
            />
            <TableFilterSelect
              paramName="status"
              label="Status"
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              allLabel="All Statuses"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Offline</th>
                <th className="px-4 py-3">Negative</th>
                <th className="px-4 py-3">Approvers</th>
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
                  <td className="px-4 py-3">{record.offlineSalesEnabled ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{record.allowNegativeStock ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">
                    {record.approverNames.length > 0 ? (
                      <div className="flex max-w-64 flex-wrap gap-1">
                        {record.approverNames.map((name) => (
                          <span key={name} className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </td>
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
                            users={users}
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
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
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

"use client";

import { EditIcon, PlusIcon, RotateCcwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
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
import type { TaxRecord } from "@/server/catalog/types";

type TaxMutation = (formData: FormData) => void | Promise<void>;

const inputClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass =
  "min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function displayAmount(value: number) {
  return (value / 100).toFixed(2);
}

function formatTax(record: TaxRecord) {
  if (record.computation === "fixed") {
    return `Fixed ${displayAmount(record.amountMinor)}`;
  }

  return `${Number(record.rate).toFixed(2)}%`;
}

function TaxForm({
  title,
  action,
  record,
  returnPath,
}: {
  title: string;
  action: TaxMutation;
  record?: TaxRecord;
  returnPath: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Configure the tax used by purchase and sales document lines.</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Code
          <input name="code" required defaultValue={record?.code} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input name="name" required defaultValue={record?.name} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Scope
          <select name="scope" defaultValue={record?.scope ?? "purchase"} className={inputClass}>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Computation
          <select name="computation" defaultValue={record?.computation ?? "percent"} className={inputClass}>
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Rate %
          <input
            name="rate"
            type="number"
            min="0"
            max="100"
            step="0.0001"
            defaultValue={record?.rate ?? "0"}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Fixed amount
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={record ? displayAmount(record.amountMinor) : "0"}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Description
        <textarea name="description" defaultValue={record?.description ?? ""} className={textareaClass} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="priceIncluded"
            defaultChecked={record?.priceIncluded ?? false}
            className="size-4 rounded border-input"
          />
          Price included
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

function TaxDialog({
  label,
  action,
  record,
  returnPath,
  children,
}: {
  label: string;
  action: TaxMutation;
  record?: TaxRecord;
  returnPath: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <TaxForm title={label} action={action} record={record} returnPath={returnPath} />
      </DialogContent>
    </Dialog>
  );
}

export function TaxManager({
  records,
  query,
  showDeleted,
  notice,
  error,
  returnPath,
  createAction,
  updateAction,
  softDeleteAction,
  restoreAction,
}: {
  records: TaxRecord[];
  query: string;
  showDeleted: boolean;
  notice?: string;
  error?: string;
  returnPath: string;
  createAction: TaxMutation;
  updateAction: TaxMutation;
  softDeleteAction: TaxMutation;
  restoreAction: TaxMutation;
}) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog"
        title="Taxes"
        actions={
          <TaxDialog label="New tax" action={createAction} returnPath={returnPath}>
            <Button>
              <PlusIcon data-icon="inline-start" />
              New tax
            </Button>
          </TaxDialog>
        }
      />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <form className="flex min-w-0 flex-1 gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search code or name"
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            />
            {showDeleted ? <input type="hidden" name="show" value="deleted" /> : null}
            <Button variant="outline">
              <SearchIcon data-icon="inline-start" />
              Search
            </Button>
          </form>
          <div className="flex rounded-md border border-border bg-muted p-1 text-sm">
            <Button asChild variant={!showDeleted ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/products/taxes">Active</Link>
            </Button>
            <Button asChild variant={showDeleted ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/products/taxes?show=deleted">Deleted</Link>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Tax</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3">Included</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{record.code}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{record.name}</div>
                    <div className="text-xs text-muted-foreground">{record.description || "No description"}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{record.scope}</td>
                  <td className="px-4 py-3 text-right">{formatTax(record)}</td>
                  <td className="px-4 py-3">{record.priceIncluded ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{record.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {!showDeleted ? (
                        <>
                          <TaxDialog
                            label={`Edit ${record.name}`}
                            action={updateAction}
                            record={record}
                            returnPath={returnPath}
                          >
                            <Button variant="outline" size="sm">
                              <EditIcon data-icon="inline-start" />
                              Edit
                            </Button>
                          </TaxDialog>
                          <form action={softDeleteAction}>
                            <input type="hidden" name="id" value={record.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <Button variant="destructive" size="sm">
                              <Trash2Icon data-icon="inline-start" />
                              Delete
                            </Button>
                          </form>
                        </>
                      ) : (
                        <form action={restoreAction}>
                          <input type="hidden" name="id" value={record.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <Button variant="outline" size="sm">
                            <RotateCcwIcon data-icon="inline-start" />
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
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No taxes found.
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

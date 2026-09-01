"use client";

import { EditIcon, PlusIcon, RotateCcwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type {
  PaymentTermMutation,
  PaymentTermsManagerProps,
} from "@/app/admin/partners/payment-term-types";
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
import type { PaymentTermOption } from "@/server/partners/types";

const inputClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass =
  "min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function PaymentTermForm({
  title,
  action,
  record,
  returnPath,
}: {
  title: string;
  action: PaymentTermMutation;
  record?: PaymentTermOption;
  returnPath: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Define payment timing and notes used when assigning terms to partners.
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
        Due days
        <input
          name="dueDays"
          type="number"
          min="0"
          max="3650"
          required
          defaultValue={record?.dueDays ?? 0}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Description
        <textarea
          name="description"
          defaultValue={record?.description ?? ""}
          className={textareaClass}
        />
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

function PaymentTermDialog({
  label,
  action,
  record,
  returnPath,
  children,
}: {
  label: string;
  action: PaymentTermMutation;
  record?: PaymentTermOption;
  returnPath: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <PaymentTermForm
          title={label}
          action={action}
          record={record}
          returnPath={returnPath}
        />
      </DialogContent>
    </Dialog>
  );
}

export function PaymentTermsManager({
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
}: PaymentTermsManagerProps) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Partners"
        title="Payment Terms"
        actions={
          <PaymentTermDialog
            label="New payment term"
            action={createAction}
            returnPath={returnPath}
          >
            <Button>
              <PlusIcon data-icon="inline-start" />
              New payment term
            </Button>
          </PaymentTermDialog>
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
              placeholder="Search code, name, or description"
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
              <Link href="/admin/partners/payment-terms">Active</Link>
            </Button>
            <Button asChild variant={showDeleted ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/partners/payment-terms?show=deleted">Deleted</Link>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Term</th>
                <th className="px-4 py-3">Due days</th>
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
                    <div className="text-xs text-muted-foreground">
                      {record.description || "No description"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{record.dueDays}</td>
                  <td className="px-4 py-3">{record.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {!showDeleted ? (
                        <>
                          <PaymentTermDialog
                            label={`Edit ${record.name}`}
                            action={updateAction}
                            record={record}
                            returnPath={returnPath}
                          >
                            <Button variant="outline" size="sm">
                              <EditIcon data-icon="inline-start" />
                              Edit
                            </Button>
                          </PaymentTermDialog>
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
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No payment terms found.
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

"use client";

import { EditIcon, PlusIcon, RotateCcwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ReferenceManagerProps, ReferenceMutation } from "@/app/admin/products/reference-types";
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
import type { CatalogReferenceRecord } from "@/server/catalog/types";

const inputClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const readonlyInputClass =
  "h-10 rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground outline-none";
const textareaClass =
  "min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ReferenceForm({
  title,
  description,
  action,
  record,
  returnPath,
  showPrecision,
}: {
  title: string;
  description: string;
  action: ReferenceMutation;
  record?: CatalogReferenceRecord;
  returnPath: string;
  showPrecision: boolean;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {record ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Code
            <input
              name="code"
              defaultValue={record.code}
              readOnly
              className={readonlyInputClass}
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input
            name="name"
            required
            defaultValue={record?.name}
            className={inputClass}
          />
        </label>
      </div>

      {showPrecision ? (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Precision
          <input
            name="precision"
            type="number"
            step="0.000001"
            min="0.000001"
            defaultValue={record?.precision ?? "1"}
            className={inputClass}
          />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Description
          <textarea
            name="description"
            defaultValue={record?.description ?? ""}
            className={textareaClass}
          />
        </label>
      )}

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

function ReferenceDialog({
  label,
  action,
  record,
  returnPath,
  showPrecision,
  children,
}: {
  label: string;
  action: ReferenceMutation;
  record?: CatalogReferenceRecord;
  returnPath: string;
  showPrecision: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <ReferenceForm
          title={label}
          description="Changes are saved immediately after submitting this form."
          action={action}
          record={record}
          returnPath={returnPath}
          showPrecision={showPrecision}
        />
      </DialogContent>
    </Dialog>
  );
}

export function CatalogReferenceManager({
  records,
  query,
  showDeleted,
  notice,
  error,
  returnPath,
  afterContent,
  eyebrow,
  title,
  description,
  createLabel,
  showPrecision,
  basePath,
  createAction,
  updateAction,
  softDeleteAction,
  restoreAction,
}: ReferenceManagerProps) {
  return (
    <PageShell>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        actions={
          <ReferenceDialog
            label={createLabel}
            action={createAction}
            returnPath={returnPath}
            showPrecision={showPrecision}
          >
            <Button>
              <PlusIcon data-icon="inline-start" />
              {createLabel}
            </Button>
          </ReferenceDialog>
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
              <Link href={basePath}>Active</Link>
            </Button>
            <Button asChild variant={showDeleted ? "secondary" : "ghost"} size="sm">
              <Link href={`${basePath}?show=deleted`}>Deleted</Link>
            </Button>
          </div>
        </div>

        <div className="border-b border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                {showPrecision ? <th className="px-4 py-3">Precision</th> : null}
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
                    {!showPrecision ? (
                      <div className="text-xs text-muted-foreground">
                        {record.description || "No description"}
                      </div>
                    ) : null}
                  </td>
                  {showPrecision ? <td className="px-4 py-3">{record.precision ?? 0}</td> : null}
                  <td className="px-4 py-3">{record.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {!showDeleted ? (
                        <>
                          <ReferenceDialog
                            label={`Edit ${record.name}`}
                            action={updateAction}
                            record={record}
                            returnPath={returnPath}
                            showPrecision={showPrecision}
                          >
                            <Button variant="outline" size="sm">
                              <EditIcon data-icon="inline-start" />
                              Edit
                            </Button>
                          </ReferenceDialog>
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
                  <td
                    colSpan={showPrecision ? 5 : 4}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {afterContent}
    </PageShell>
  );
}

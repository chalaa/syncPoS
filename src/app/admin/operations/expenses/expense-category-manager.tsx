"use client";

import { EditIcon, PlusIcon, RotateCcwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  createExpenseCategory,
  restoreExpenseCategory,
  softDeleteExpenseCategory,
  updateExpenseCategory,
} from "@/app/admin/operations/expenses/actions";
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
import type { ExpenseCategoryRow } from "@/server/expenses/types";

type ExpenseCategoryMutation = (formData: FormData) => Promise<void>;

type ExpenseCategoryManagerProps = {
  records: ExpenseCategoryRow[];
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

function CategoryForm({
  title,
  action,
  record,
  returnPath,
}: {
  title: string;
  action: ExpenseCategoryMutation;
  record?: ExpenseCategoryRow;
  returnPath: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Define categories used to classify non-inventory business costs.</DialogDescription>
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
        Description
        <textarea name="description" defaultValue={record?.description ?? ""} className={textareaClass} />
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

function CategoryDialog({
  label,
  action,
  record,
  returnPath,
  children,
}: {
  label: string;
  action: ExpenseCategoryMutation;
  record?: ExpenseCategoryRow;
  returnPath: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <CategoryForm title={label} action={action} record={record} returnPath={returnPath} />
      </DialogContent>
    </Dialog>
  );
}

export function ExpenseCategoryManager({
  records,
  query,
  showDeleted,
  notice,
  error,
  returnPath,
}: ExpenseCategoryManagerProps) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations"
        title="Expense Categories"
        actions={
          <CategoryDialog label="New expense category" action={createExpenseCategory} returnPath={returnPath}>
            <Button>
              <PlusIcon data-icon="inline-start" />
              New category
            </Button>
          </CategoryDialog>
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
              <Link href="/admin/operations/expenses/categories">Active</Link>
            </Button>
            <Button asChild variant={showDeleted ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/operations/expenses/categories?show=deleted">Deleted</Link>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-border/70">
                  <td className="px-4 py-3 font-medium">{record.code}</td>
                  <td className="px-4 py-3">{record.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{record.description ?? "-"}</td>
                  <td className="px-4 py-3">{record.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {showDeleted ? (
                        <form action={restoreExpenseCategory}>
                          <input type="hidden" name="id" value={record.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <Button variant="outline" size="sm">
                            <RotateCcwIcon data-icon="inline-start" />
                            Restore
                          </Button>
                        </form>
                      ) : (
                        <>
                          <CategoryDialog label={`Edit ${record.name}`} action={updateExpenseCategory} record={record} returnPath={returnPath}>
                            <Button variant="outline" size="sm">
                              <EditIcon data-icon="inline-start" />
                              Edit
                            </Button>
                          </CategoryDialog>
                          <form action={softDeleteExpenseCategory}>
                            <input type="hidden" name="id" value={record.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <Button variant="danger" size="sm">
                              <Trash2Icon data-icon="inline-start" />
                              Delete
                            </Button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No expense categories found.
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

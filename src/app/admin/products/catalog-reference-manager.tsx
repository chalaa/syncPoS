"use client";

import { EditIcon, PlusIcon, RotateCcwIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ReferenceManagerProps, ReferenceMutation } from "@/app/admin/products/reference-types";
import { ProductNavTabs } from "@/app/admin/products/product-nav-tabs";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountrySelectField } from "@/components/ui/country-select-field";
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
import type { CatalogReferenceRecord, ProductSpecificationField } from "@/server/catalog/types";
import { useState } from "react";

const inputClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass =
  "min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function SpecificationTags({
  fields,
}: {
  fields: ProductSpecificationField[];
}) {
  const [tags, setTags] = useState(() => fields.map((field) => field.label).filter(Boolean));
  const [draft, setDraft] = useState("");

  function addTag(value = draft) {
    const label = value.trim();

    if (!label) {
      return;
    }

    setTags((currentTags) => {
      const exists = currentTags.some((tag) => tag.toLowerCase() === label.toLowerCase());

      return exists ? currentTags : [...currentTags, label];
    });
    setDraft("");
  }

  function removeTag(index: number) {
    setTags((currentTags) => currentTags.filter((_, tagIndex) => tagIndex !== index));
  }

  return (
    <div className="grid gap-2">
      {tags.map((tag) => (
        <input key={tag} type="hidden" name="specificationLabel" value={tag} />
      ))}
      <div className="flex min-h-10 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1">
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex h-7 max-w-56 items-center gap-1 rounded-md border border-border bg-muted px-2 text-xs font-medium"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => removeTag(index)}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 ? (
          <span className="px-1 text-xs text-muted-foreground">No specifications added</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder="Power"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => addTag()} disabled={!draft.trim()}>
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </div>
    </div>
  );
}

function ReferenceForm({
  title,
  description,
  action,
  record,
  returnPath,
  showPrecision,
  showSpecifications,
  showCountry,
}: {
  title: string;
  description: string;
  action: ReferenceMutation;
  record?: CatalogReferenceRecord;
  returnPath: string;
  showPrecision: boolean;
  showSpecifications?: boolean;
  showCountry?: boolean;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      {record ? <input type="hidden" name="code" value={record.code} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input
            name="name"
            required
            defaultValue={record?.name}
            className={inputClass}
          />
        </label>
        {showCountry ? (
          <CountrySelectField name="country" label="Country" defaultValue={record?.country ?? ""} />
        ) : null}
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
      ) : showSpecifications ? (
        <div className="grid gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Description
            <textarea
              name="description"
              defaultValue={record?.description ?? ""}
              className={textareaClass}
            />
          </label>
          <SpecificationTags fields={record?.specificationSchema ?? []} />
        </div>
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
  showSpecifications,
  showCountry,
  children,
}: {
  label: string;
  action: ReferenceMutation;
  record?: CatalogReferenceRecord;
  returnPath: string;
  showPrecision: boolean;
  showSpecifications?: boolean;
  showCountry?: boolean;
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
          showSpecifications={showSpecifications}
          showCountry={showCountry}
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
  showSpecifications,
  showCountry,
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
            showSpecifications={showSpecifications}
            showCountry={showCountry}
          >
            <Button>
              <PlusIcon data-icon="inline-start" />
              {createLabel}
            </Button>
          </ReferenceDialog>
        }
      />

      <ProductNavTabs currentHref={basePath} />

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
              <Link href={basePath}>Active</Link>
            </Button>
            <Button asChild variant={showDeleted ? "secondary" : "ghost"} size="sm" className="h-7 text-xs">
              <Link href={`${basePath}?show=deleted`}>Deleted</Link>
            </Button>
          </div>
        </div>

        <div className="border-b border-border bg-muted/20 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                {showPrecision ? <th className="px-4 py-3">Precision</th> : null}
                {showCountry ? <th className="px-4 py-3">Country</th> : null}
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
                    {!showPrecision ? (
                      <div className="text-xs text-muted-foreground">
                        {record.description || "No description"}
                      </div>
                    ) : null}
                  </td>
                  {showPrecision ? (
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {record.precision ?? 0}
                    </td>
                  ) : null}
                  {showCountry ? (
                    <td className="px-4 py-3 text-foreground">{record.country || "—"}</td>
                  ) : null}
                  <td className="px-4 py-3">
                    <StatusBadge status={record.isActive ? "active" : "inactive"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {!showDeleted ? (
                        <>
                          <ReferenceDialog
                            label={`Edit ${record.name}`}
                            action={updateAction}
                            record={record}
                            returnPath={returnPath}
                            showPrecision={showPrecision}
                            showSpecifications={showSpecifications}
                            showCountry={showCountry}
                          >
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              <EditIcon className="size-3.5" data-icon="inline-start" />
                              Edit
                            </Button>
                          </ReferenceDialog>
                          <form action={softDeleteAction}>
                            <input type="hidden" name="id" value={record.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <Button variant="destructive" size="sm" className="h-7 text-xs">
                              <Trash2Icon className="size-3.5" data-icon="inline-start" />
                              Delete
                            </Button>
                          </form>
                        </>
                      ) : (
                        <form action={restoreAction}>
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
                  <td
                    colSpan={4 + (showPrecision ? 1 : 0) + (showCountry ? 1 : 0)}
                    className="px-4 py-12 text-center text-muted-foreground"
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

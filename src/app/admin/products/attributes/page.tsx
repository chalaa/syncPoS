import { PlusIcon } from "lucide-react";

import {
  createCatalogAttribute,
  createCatalogAttributeValue,
  updateCatalogAttribute,
} from "@/app/admin/products/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getCatalogAttributeList } from "@/server/catalog/products";
import type { CatalogAttributeRecord } from "@/server/catalog/types";

export const dynamic = "force-dynamic";

type AttributesPageProps = {
  searchParams: Promise<{ notice?: string; error?: string }>;
};

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

function AttributeForm({ attribute }: { attribute?: CatalogAttributeRecord }) {
  return (
    <form action={attribute ? updateCatalogAttribute : createCatalogAttribute} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{attribute ? "Edit Attribute" : "New Attribute"}</DialogTitle>
      </DialogHeader>
      <input type="hidden" name="returnPath" value="/admin/products/attributes" />
      {attribute ? <input type="hidden" name="id" value={attribute.id} /> : null}
      {attribute ? (
        <label className="grid gap-1 text-sm font-medium">
          Code
          <input name="code" defaultValue={attribute.code} readOnly className="h-10 rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground" />
        </label>
      ) : null}
      <label className="grid gap-1 text-sm font-medium">
        Name
        <input name="name" defaultValue={attribute?.name} required className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="isActive" defaultChecked={attribute?.isActive ?? true} className="size-4" />
        Active
      </label>
      <DialogFooter>
        <Button>{attribute ? "Save changes" : "Create"}</Button>
      </DialogFooter>
    </form>
  );
}

function ValueForm({ attribute }: { attribute: CatalogAttributeRecord }) {
  return (
    <form action={createCatalogAttributeValue} className="grid gap-3 rounded-md border border-border bg-muted/30 p-3">
      <input type="hidden" name="returnPath" value="/admin/products/attributes" />
      <input type="hidden" name="attributeId" value={attribute.id} />
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem_auto]">
        <input name="value" placeholder={`New ${attribute.name} value`} required className={inputClass} />
        <input name="sortOrder" type="number" min="0" defaultValue="0" className={inputClass} />
        <Button>
          <PlusIcon data-icon="inline-start" />
          Add value
        </Button>
      </div>
    </form>
  );
}

export default async function ProductAttributesPage({ searchParams }: AttributesPageProps) {
  await requirePermission("product.view");
  const [params, attributes] = await Promise.all([searchParams, getCatalogAttributeList()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog"
        title="Product Attributes"
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon data-icon="inline-start" />
                New attribute
              </Button>
            </DialogTrigger>
            <DialogContent>
              <AttributeForm />
            </DialogContent>
          </Dialog>
        }
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <section className="grid gap-4">
        {attributes.map((attribute) => (
          <article key={attribute.id} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{attribute.name}</h2>
                <p className="text-sm text-muted-foreground">{attribute.code} / {attribute.isActive ? "Active" : "Inactive"}</p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Edit</Button>
                </DialogTrigger>
                <DialogContent>
                  <AttributeForm attribute={attribute} />
                </DialogContent>
              </Dialog>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {attribute.values.map((value) => (
                <span key={value.id} className="rounded-md border border-border bg-background px-3 py-1 text-sm">
                  {value.value}
                </span>
              ))}
              {attribute.values.length === 0 ? <span className="text-sm text-muted-foreground">No values yet.</span> : null}
            </div>
            <ValueForm attribute={attribute} />
          </article>
        ))}
        {attributes.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
            No attributes found.
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}

import { EditIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getProductTemplateList } from "@/server/catalog/products";

export const dynamic = "force-dynamic";

type ProductTemplatesPageProps = {
  searchParams: Promise<{ notice?: string; error?: string }>;
};

export default async function ProductTemplatesPage({ searchParams }: ProductTemplatesPageProps) {
  await requirePermission("product.view");
  const [params, templates] = await Promise.all([searchParams, getProductTemplateList()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog"
        title="Product Templates"
        actions={
          <ButtonLink href="/admin/products/templates/new">
            <PlusIcon data-icon="inline-start" />
            New template
          </ButtonLink>
        }
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <section className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Tracking</th>
                <th className="px-4 py-3">Variants</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/admin/products/templates/${template.id}`} className="hover:underline">
                      {template.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{template.categoryName || "-"}</td>
                  <td className="px-4 py-3">{template.brandName || "-"}</td>
                  <td className="px-4 py-3">{template.unitCode || "-"}</td>
                  <td className="px-4 py-3">{template.trackingMode}</td>
                  <td className="px-4 py-3">{template.variantCount}</td>
                  <td className="px-4 py-3">{template.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3 text-right">
                    <ButtonLink href={`/admin/products/templates/${template.id}`} variant="outline" size="sm">
                      <EditIcon data-icon="inline-start" />
                      Edit
                    </ButtonLink>
                  </td>
                </tr>
              ))}
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    No product templates found.
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

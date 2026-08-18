import {
  createTax,
  restoreTax,
  softDeleteTax,
  updateTax,
} from "@/app/admin/products/actions";
import { TaxManager } from "@/app/admin/products/tax-manager";
import { requirePermission } from "@/server/auth/session";
import { getTaxList } from "@/server/catalog/products";

export const dynamic = "force-dynamic";

type TaxesPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
  }>;
};

export default async function TaxesPage({ searchParams }: TaxesPageProps) {
  await requirePermission("product.view");

  const params = await searchParams;
  const query = params.q ?? "";
  const showDeleted = params.show === "deleted";
  const records = await getTaxList({ query, showDeleted });
  const returnPath = `/admin/products/taxes${showDeleted ? "?show=deleted" : ""}`;

  return (
    <TaxManager
      records={records}
      query={query}
      showDeleted={showDeleted}
      notice={params.notice}
      error={params.error}
      returnPath={returnPath}
      createAction={createTax}
      updateAction={updateTax}
      softDeleteAction={softDeleteTax}
      restoreAction={restoreTax}
    />
  );
}

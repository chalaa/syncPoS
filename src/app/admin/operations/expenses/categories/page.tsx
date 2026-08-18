import { ExpenseCategoryManager } from "@/app/admin/operations/expenses/expense-category-manager";
import { requirePermission } from "@/server/auth/session";
import { getExpenseCategoryList } from "@/server/expenses/expenses";

export const dynamic = "force-dynamic";

type ExpenseCategoriesPageProps = {
  searchParams: Promise<{ q?: string; show?: string; notice?: string; error?: string }>;
};

export default async function ExpenseCategoriesPage({ searchParams }: ExpenseCategoriesPageProps) {
  await requirePermission("company.manage");

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const showDeleted = params.show === "deleted";
  const records = await getExpenseCategoryList({ query, showDeleted });
  const returnPath = `/admin/operations/expenses/categories${showDeleted ? "?show=deleted" : ""}`;

  return (
    <ExpenseCategoryManager
      records={records}
      query={query}
      showDeleted={showDeleted}
      notice={params.notice}
      error={params.error}
      returnPath={returnPath}
    />
  );
}

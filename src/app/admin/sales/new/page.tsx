import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type NewSalesOrderPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewSalesOrderPage({ searchParams }: NewSalesOrderPageProps) {
  const params = await searchParams;
  const queryString = params.error ? `?new=1&error=${encodeURIComponent(params.error)}` : "?new=1";
  redirect(`/admin/sales${queryString}`);
}

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type NewPurchaseOrderPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewPurchaseOrderPage({ searchParams }: NewPurchaseOrderPageProps) {
  const params = await searchParams;
  const queryString = params.error ? `?new=1&error=${encodeURIComponent(params.error)}` : "?new=1";
  redirect(`/admin/purchasing${queryString}`);
}

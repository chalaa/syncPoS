import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type NewDirectVendorSalePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewDirectVendorSalePage({ searchParams }: NewDirectVendorSalePageProps) {
  const params = await searchParams;
  const queryString = params.error ? `?new=1&error=${encodeURIComponent(params.error)}` : "?new=1";
  redirect(`/admin/sales/direct-vendor${queryString}`);
}

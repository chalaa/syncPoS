import { redirect } from "next/navigation";

import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

type NewProductPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
    name?: string;
  }>;
};

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  await requirePermission("product.manage");

  const params = await searchParams;
  const search = new URLSearchParams();
  search.set("new", "1");
  if (params.name) search.set("name", params.name);
  if (params.notice) search.set("notice", params.notice);
  if (params.error) search.set("error", params.error);

  redirect(`/admin/products?${search.toString()}`);
}

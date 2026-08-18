import { notFound } from "next/navigation";

import { requirePermission } from "@/server/auth/session";
import { getPartnerById, getPartnerFormOptions } from "@/server/partners/partners";
import { PartnerForm } from "../../partner-form";

export const dynamic = "force-dynamic";

type EditPartnerPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function EditPartnerPage({ params, searchParams }: EditPartnerPageProps) {
  await requirePermission("partner.manage");

  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const [partner, options] = await Promise.all([getPartnerById(id), getPartnerFormOptions()]);

  if (!partner) {
    notFound();
  }

  return (
    <PartnerForm
      mode="edit"
      partner={partner}
      paymentTerms={options.paymentTerms}
      error={queryParams.error}
    />
  );
}

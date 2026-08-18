import { getPartnerFormOptions } from "@/server/partners/partners";
import { requirePermission } from "@/server/auth/session";
import { PartnerForm } from "../partner-form";

export const dynamic = "force-dynamic";

type NewPartnerPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewPartnerPage({ searchParams }: NewPartnerPageProps) {
  await requirePermission("partner.manage");

  const [params, options] = await Promise.all([searchParams, getPartnerFormOptions()]);

  return (
    <PartnerForm
      mode="create"
      paymentTerms={options.paymentTerms}
      error={params.error}
    />
  );
}

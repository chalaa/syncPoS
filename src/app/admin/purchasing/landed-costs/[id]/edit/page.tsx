import { notFound } from "next/navigation";

import { updateLandedCost } from "@/app/admin/purchasing/actions";
import { LandedCostForm } from "@/app/admin/purchasing/landed-costs/landed-cost-form";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import {
  getPurchaseLandedCostDetail,
  getPurchaseLandedCostFormOptions,
} from "@/server/purchasing/purchasing";

export const dynamic = "force-dynamic";

type EditLandedCostPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditLandedCostPage({ params, searchParams }: EditLandedCostPageProps) {
  await requirePermission("inventory.receive");

  const [{ id }, query, options] = await Promise.all([
    params,
    searchParams,
    getPurchaseLandedCostFormOptions(),
  ]);
  const cost = await getPurchaseLandedCostDetail(id);

  if (!cost) {
    notFound();
  }

  if (cost.status === "posted") {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Purchasing / Landed Cost"
        title={`Edit ${cost.costNo}`}
        actions={<ButtonLink href={`/admin/purchasing/landed-costs/${cost.id}`} variant="outline">Back to landed cost</ButtonLink>}
      />

      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <LandedCostForm
        action={updateLandedCost}
        options={options}
        cost={cost}
        submitLabel="Save Allocation"
      />
    </PageShell>
  );
}

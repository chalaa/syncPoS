import {
  createPaymentTerm,
  restorePaymentTerm,
  softDeletePaymentTerm,
  updatePaymentTerm,
} from "@/app/admin/partners/actions";
import { PaymentTermsManager } from "@/app/admin/partners/payment-terms-manager";
import { requirePermission } from "@/server/auth/session";
import { getPaymentTermList } from "@/server/partners/partners";

export const dynamic = "force-dynamic";

type PaymentTermsPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
  }>;
};

export default async function PaymentTermsPage({ searchParams }: PaymentTermsPageProps) {
  await requirePermission("partner.view");

  const params = await searchParams;
  const query = params.q ?? "";
  const showDeleted = params.show === "deleted";
  const records = await getPaymentTermList({ query, showDeleted });
  const returnPath = `/admin/partners/payment-terms${showDeleted ? "?show=deleted" : ""}`;

  return (
    <PaymentTermsManager
      records={records}
      query={query}
      showDeleted={showDeleted}
      notice={params.notice}
      error={params.error}
      returnPath={returnPath}
      createAction={createPaymentTerm}
      updateAction={updatePaymentTerm}
      softDeleteAction={softDeletePaymentTerm}
      restoreAction={restorePaymentTerm}
    />
  );
}

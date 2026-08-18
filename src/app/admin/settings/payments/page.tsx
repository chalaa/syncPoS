import {
  createPaymentAccount,
  createPaymentMethod,
  restorePaymentAccount,
  restorePaymentMethod,
  softDeletePaymentAccount,
  softDeletePaymentMethod,
  updatePaymentAccount,
  updatePaymentMethod,
} from "@/app/admin/settings/payments/actions";
import { PaymentConfigManager } from "@/app/admin/settings/payments/payment-config-manager";
import { requirePermission } from "@/server/auth/session";
import {
  getPaymentAccountList,
  getPaymentConfigOptions,
  getPaymentMethodList,
} from "@/server/payments/payments";

export const dynamic = "force-dynamic";

type PaymentSettingsPageProps = {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
  }>;
};

export default async function PaymentSettingsPage({ searchParams }: PaymentSettingsPageProps) {
  await requirePermission("company.manage");

  const params = await searchParams;
  const tab = params.tab === "accounts" ? "accounts" : "methods";
  const query = params.q ?? "";
  const showDeleted = params.show === "deleted";
  const returnPath = `/admin/settings/payments${tab === "accounts" ? "?tab=accounts" : ""}${showDeleted ? `${tab === "accounts" ? "&" : "?"}show=deleted` : ""}`;

  const [methods, accounts, options] = await Promise.all([
    getPaymentMethodList({ query, showDeleted }),
    getPaymentAccountList({ query, showDeleted }),
    getPaymentConfigOptions(),
  ]);

  return (
    <PaymentConfigManager
      tab={tab}
      methods={methods}
      accounts={accounts}
      methodOptions={options.methods}
      query={query}
      showDeleted={showDeleted}
      notice={params.notice}
      error={params.error}
      returnPath={returnPath}
      createMethodAction={createPaymentMethod}
      updateMethodAction={updatePaymentMethod}
      deleteMethodAction={softDeletePaymentMethod}
      restoreMethodAction={restorePaymentMethod}
      createAccountAction={createPaymentAccount}
      updateAccountAction={updatePaymentAccount}
      deleteAccountAction={softDeletePaymentAccount}
      restoreAccountAction={restorePaymentAccount}
    />
  );
}

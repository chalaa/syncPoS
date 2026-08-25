import Link from "next/link";
import { redirect } from "next/navigation";

import {
  formatPartnerRoles,
  getPartnerList,
  minorToDisplay,
} from "@/server/partners/partners";
import { requirePermission } from "@/server/auth/session";
import { restorePartner, softDeletePartner } from "./actions";

export const dynamic = "force-dynamic";

type PartnersPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    role?: string;
    view?: string;
    notice?: string;
    error?: string;
  }>;
};

export default async function PartnersPage({ searchParams }: PartnersPageProps) {
  await requirePermission("partner.view");

  const params = await searchParams;

  if (params.view === "payment-terms") {
    redirect("/admin/partners/payment-terms");
  }

  const showDeleted = params.show === "deleted";
  const role = params.role === "customer" || params.role === "supplier" ? params.role : undefined;
  const query = params.q ?? "";
  const partners = await getPartnerList({ query, showDeleted, role });

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-[#172026]">
      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#d7dcdf] pb-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-[#58706f]">
              Partners
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Customers and Suppliers</h1>
          </div>
          <Link
            href="/admin/partners/new"
            className="rounded-md bg-[#1f6b5c] px-4 py-2 text-sm font-semibold text-white"
          >
            New partner
          </Link>
        </header>

        {params.notice ? (
          <div className="mb-5 rounded-md border border-[#a9d6bf] bg-[#f1fbf5] px-4 py-3 text-sm text-[#22613e]">
            {params.notice}
          </div>
        ) : null}
        {params.error ? (
          <div className="mb-5 rounded-md border border-[#e0a6a6] bg-[#fff7f7] px-4 py-3 text-sm text-[#8a2626]">
            {params.error}
          </div>
        ) : null}

        <div className="grid gap-5">
          <section className="rounded-lg border border-[#d7dcdf] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1e6e8] p-4">
              <form className="flex min-w-0 flex-1 gap-2">
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Search code, name, legal name, TIN"
                  className="h-10 min-w-0 flex-1 rounded-md border border-[#c9d1d4] px-3 text-sm"
                />
                {showDeleted ? <input type="hidden" name="show" value="deleted" /> : null}
                {role ? <input type="hidden" name="role" value={role} /> : null}
                <button className="rounded-md border border-[#c9d1d4] px-3 py-2 text-sm font-medium">
                  Search
                </button>
              </form>
              <div className="flex rounded-md border border-[#c9d1d4] bg-[#f8faf9] p-1 text-sm">
                <Link
                  href="/admin/partners"
                  className={`rounded px-3 py-1.5 ${!showDeleted ? "bg-white font-semibold shadow-sm" : ""}`}
                >
                  Active
                </Link>
                <Link
                  href="/admin/partners?show=deleted"
                  className={`rounded px-3 py-1.5 ${showDeleted ? "bg-white font-semibold shadow-sm" : ""}`}
                >
                  Deleted
                </Link>
              </div>
            </div>

            <div className="flex gap-2 border-b border-[#e1e6e8] px-4 py-3 text-sm">
              <Link className={`rounded-md px-3 py-1.5 ${!role ? "bg-[#e7efec] font-semibold" : ""}`} href="/admin/partners">
                All
              </Link>
              <Link className={`rounded-md px-3 py-1.5 ${role === "customer" ? "bg-[#e7efec] font-semibold" : ""}`} href="/admin/partners?role=customer">
                Customers
              </Link>
              <Link className={`rounded-md px-3 py-1.5 ${role === "supplier" ? "bg-[#e7efec] font-semibold" : ""}`} href="/admin/partners?role=supplier">
                Suppliers
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-[#f8faf9] text-xs uppercase tracking-wide text-[#58706f]">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Partner</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3 text-right">Credit limit</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((partner) => (
                    <tr key={partner.id} className="border-t border-[#eef1f2]">
                      <td className="px-4 py-3 font-medium">{partner.code}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/partners/${partner.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {partner.displayName}
                        </Link>
                        <div className="text-xs text-[#6a787d]">
                          {[partner.legalName, partner.tin ? `TIN ${partner.tin}` : null]
                            .filter(Boolean)
                            .join(" / ") || "No legal detail"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{formatPartnerRoles(partner)}</td>
                      <td className="px-4 py-3">{partner.status}</td>
                      <td className="px-4 py-3">
                        <div>{partner.primaryContactName ?? "No contact"}</div>
                        <div className="text-xs text-[#6a787d]">
                          {[partner.primaryContactPhone, partner.primaryContactEmail]
                            .filter(Boolean)
                            .join(" / ")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {partner.currencyCode} {minorToDisplay(partner.creditLimitMinor)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!showDeleted ? (
                            <>
                              <Link
                                href={`/admin/partners/${partner.id}/edit`}
                                className="rounded-md border border-[#c9d1d4] px-3 py-1.5 text-xs font-medium"
                              >
                                Edit
                              </Link>
                              <form action={softDeletePartner}>
                                <input type="hidden" name="id" value={partner.id} />
                                <button className="rounded-md border border-[#d9b0a8] px-3 py-1.5 text-xs font-medium text-[#8a3426]">
                                  Delete
                                </button>
                              </form>
                            </>
                          ) : (
                            <form action={restorePartner}>
                              <input type="hidden" name="id" value={partner.id} />
                              <button className="rounded-md border border-[#a9d6bf] px-3 py-1.5 text-xs font-medium text-[#22613e]">
                                Restore
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {partners.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[#6a787d]">
                        No partners found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

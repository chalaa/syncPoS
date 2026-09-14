import Link from "next/link";
import { Plus, Search, RotateCcw, Trash2, Check, Store } from "lucide-react";
import { and, asc, eq, isNull } from "drizzle-orm";

import {
  createOwner,
  restoreOwner,
  softDeleteOwner,
  updateOwner,
} from "@/app/admin/settings/owners/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import { locations } from "@/server/db/schema";
import { getOwnerList } from "@/server/owners/owners";

export const dynamic = "force-dynamic";

type OwnersPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
  }>;
};

const inputClass = "h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring";

export default async function OwnersPage({ searchParams }: OwnersPageProps) {
  await requirePermission("company:settings:manage");

  const params = await searchParams;
  const query = params.q ?? "";
  const showDeleted = params.show === "deleted";
  const returnPath = `/admin/settings/owners${showDeleted ? "?show=deleted" : ""}`;

  const company = await getDefaultCompany();
  const [records, allLocations] = await Promise.all([
    getOwnerList({ query, showDeleted }),
    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
      })
      .from(locations)
      .where(and(eq(locations.companyId, company.id), eq(locations.isActive, true), isNull(locations.deletedAt)))
      .orderBy(asc(locations.name)),
  ]);

  return (
    <PageShell maxWidth="max-w-5xl">
      <PageHeader
        eyebrow="Settings"
        title="Beneficial Owners & Shop Assignments"
        description="Configure registered company stakeholders and associate them with specific shops & locations."
      />

      <div className="grid gap-5">
        {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
        {params.error ? <Alert kind="error">{params.error}</Alert> : null}

        {/* New Owner Registration */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <form action={createOwner} className="flex flex-col gap-4">
            <input type="hidden" name="returnPath" value={returnPath} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                New Owner Name
                <input
                  name="name"
                  required
                  className={inputClass}
                  placeholder="e.g. Dawit Haile"
                />
              </label>
              <Button type="submit" size="sm">
                <Plus className="size-4" data-icon="inline-start" />
                Add Owner
              </Button>
            </div>

            {allLocations.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Store className="size-3.5 text-primary" />
                  Assign Connected Shops / Locations:
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {allLocations.map((loc) => (
                    <label
                      key={loc.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground cursor-pointer hover:bg-muted transition-colors"
                    >
                      <input
                        type="checkbox"
                        name="locationIds"
                        value={loc.id}
                        defaultChecked
                        className="rounded border-input text-primary focus:ring-primary"
                      />
                      <span>{loc.code} - {loc.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Owners & Linked Shops List */}
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <form className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
              {showDeleted ? <input type="hidden" name="show" value="deleted" /> : null}
              <input
                name="q"
                defaultValue={query}
                className={inputClass}
                placeholder="Search owner names..."
              />
              <Button type="submit" variant="outline" size="sm">
                <Search className="size-3.5" data-icon="inline-start" />
                Search
              </Button>
            </form>
            <div className="flex rounded-lg border border-border bg-muted/60 p-1 text-sm">
              <Button asChild variant={!showDeleted ? "secondary" : "ghost"} size="sm" className="h-7 text-xs">
                <Link href="/admin/settings/owners">Active</Link>
              </Button>
              <Button asChild variant={showDeleted ? "secondary" : "ghost"} size="sm" className="h-7 text-xs">
                <Link href="/admin/settings/owners?show=deleted">Deleted</Link>
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Owner Details & Shop Assignments</th>
                  <th className="w-48 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-12 text-center text-muted-foreground">
                      No owners found.
                    </td>
                  </tr>
                ) : (
                  records.map((owner) => (
                    <tr
                      key={owner.id}
                      className="transition-colors hover:bg-[rgba(235,239,234,0.45)] dark:hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        {showDeleted ? (
                          <div className="space-y-1">
                            <span className="font-semibold text-foreground">{owner.name}</span>
                            <div className="flex flex-wrap gap-1">
                              {owner.locations.map((loc) => (
                                <Badge key={loc.id} variant="outline" className="text-[10px]">
                                  {loc.code} / {loc.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <form action={updateOwner} className="flex flex-col gap-2.5 py-1">
                            <input type="hidden" name="ownerId" value={owner.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />

                            <div className="flex max-w-sm gap-2">
                              <input
                                name="name"
                                defaultValue={owner.name}
                                className={inputClass}
                                placeholder="Owner Name"
                              />
                              <Button type="submit" variant="secondary" size="sm" className="h-9 shrink-0">
                                <Check className="size-3.5" data-icon="inline-start" />
                                Save
                              </Button>
                            </div>

                            {/* Connected Shops check boxes */}
                            {allLocations.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                  Linked Shops:
                                </span>
                                {allLocations.map((loc) => {
                                  const isChecked = owner.locationIds.includes(loc.id);
                                  return (
                                    <label
                                      key={loc.id}
                                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium border transition-colors cursor-pointer ${
                                        isChecked
                                          ? "bg-[#0B5D4B]/10 border-[#0B5D4B]/30 text-[#0B5D4B] dark:text-emerald-300"
                                          : "bg-muted/30 border-border text-muted-foreground hover:bg-muted"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        name="locationIds"
                                        value={loc.id}
                                        defaultChecked={isChecked}
                                        className="rounded border-input text-[#0B5D4B] focus:ring-[#0B5D4B]"
                                      />
                                      <span>{loc.code}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </form>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-top pt-4">
                        {showDeleted ? (
                          <form action={restoreOwner}>
                            <input type="hidden" name="ownerId" value={owner.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <Button type="submit" variant="outline" size="sm" className="h-8 text-xs">
                              <RotateCcw className="size-3.5" data-icon="inline-start" />
                              Restore
                            </Button>
                          </form>
                        ) : (
                          <form action={softDeleteOwner}>
                            <input type="hidden" name="ownerId" value={owner.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <Button type="submit" variant="destructive" size="sm" className="h-8 text-xs">
                              <Trash2 className="size-3.5" data-icon="inline-start" />
                              Delete
                            </Button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

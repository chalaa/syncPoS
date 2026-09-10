import Link from "next/link";
import { Plus, Search, RotateCcw, Trash2, Check } from "lucide-react";

import {
  createOwner,
  restoreOwner,
  softDeleteOwner,
  updateOwner,
} from "@/app/admin/settings/owners/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
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
  const records = await getOwnerList({ query, showDeleted });

  return (
    <PageShell maxWidth="max-w-5xl">
      <PageHeader
        eyebrow="Settings"
        title="Beneficial Owners"
        description="Configure registered company stakeholders and equity owners."
      />

      <div className="grid gap-5">
        {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
        {params.error ? <Alert kind="error">{params.error}</Alert> : null}

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <form action={createOwner} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="returnPath" value={returnPath} />
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
          </form>
        </div>

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
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Owner Name</th>
                  <th className="w-56 px-4 py-3 text-right">Actions</th>
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
                          <span className="font-medium text-foreground">{owner.name}</span>
                        ) : (
                          <form action={updateOwner} className="flex max-w-sm gap-2">
                            <input type="hidden" name="ownerId" value={owner.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <input
                              name="name"
                              defaultValue={owner.name}
                              className={inputClass}
                            />
                            <Button type="submit" variant="secondary" size="sm" className="h-9">
                              <Check className="size-3.5" data-icon="inline-start" />
                              Save
                            </Button>
                          </form>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
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

import Link from "next/link";

import {
  createOwner,
  restoreOwner,
  softDeleteOwner,
  updateOwner,
} from "@/app/admin/settings/owners/actions";
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

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

export default async function OwnersPage({ searchParams }: OwnersPageProps) {
  await requirePermission("company:settings:manage");

  const params = await searchParams;
  const query = params.q ?? "";
  const showDeleted = params.show === "deleted";
  const returnPath = `/admin/settings/owners${showDeleted ? "?show=deleted" : ""}`;
  const records = await getOwnerList({ query, showDeleted });

  return (
    <PageShell maxWidth="max-w-5xl">
      <PageHeader eyebrow="Settings" title="Owners" />

      <div className="grid gap-4">
        {params.notice ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {params.notice}
          </p>
        ) : null}
        {params.error ? (
          <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
            {params.error}
          </p>
        ) : null}

        <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
          <form action={createOwner} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="returnPath" value={returnPath} />
            <label className="grid gap-1 text-sm font-medium">
              Owner Name
              <input name="name" className={inputClass} placeholder="Owner name" />
            </label>
            <Button type="submit">Create Owner</Button>
          </form>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <form className="flex flex-1 gap-2">
            {showDeleted ? <input type="hidden" name="show" value="deleted" /> : null}
            <input name="q" defaultValue={query} className={inputClass} placeholder="Search owners" />
            <Button type="submit" variant="secondary">Search</Button>
          </form>
          <div className="flex gap-2">
            <Button asChild variant={showDeleted ? "secondary" : "default"}>
              <Link href="/admin/settings/owners">Active</Link>
            </Button>
            <Button asChild variant={showDeleted ? "default" : "secondary"}>
              <Link href="/admin/settings/owners?show=deleted">Deleted</Link>
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="w-56 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                    No owners found.
                  </td>
                </tr>
              ) : (
                records.map((owner) => (
                  <tr key={owner.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3">
                      {showDeleted ? (
                        <span className="font-medium">{owner.name}</span>
                      ) : (
                        <form action={updateOwner} className="flex gap-2">
                          <input type="hidden" name="ownerId" value={owner.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <input name="name" defaultValue={owner.name} className={inputClass} />
                          <Button type="submit" variant="secondary">Save</Button>
                        </form>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {showDeleted ? (
                        <form action={restoreOwner}>
                          <input type="hidden" name="ownerId" value={owner.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <Button type="submit" variant="secondary">Restore</Button>
                        </form>
                      ) : (
                        <form action={softDeleteOwner}>
                          <input type="hidden" name="ownerId" value={owner.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <Button type="submit" variant="destructive">Delete</Button>
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
    </PageShell>
  );
}

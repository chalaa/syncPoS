import { LocationManager } from "@/app/admin/inventory/locations/location-manager";
import { requirePermission } from "@/server/auth/session";
import { paginateRows } from "@/lib/pagination";
import { getStockLocationList, getStockLocationUserOptions } from "@/server/inventory/locations";

export const dynamic = "force-dynamic";

type LocationsPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
    type?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  await requirePermission("location.manage");

  const params = await searchParams;
  const query = params.q ?? "";
  const showDeleted = params.show === "deleted";
  const type = params.type ?? "";
  const status = params.status ?? "";

  const [records, users] = await Promise.all([
    getStockLocationList({ query, showDeleted, type, status }),
    getStockLocationUserOptions(),
  ]);
  const returnPath = `/admin/inventory/locations${showDeleted ? "?show=deleted" : ""}`;
  const locationPage = paginateRows(records, params);

  return (
    <LocationManager
      records={locationPage.rows}
      pagination={locationPage.pagination}
      users={users}
      query={query}
      showDeleted={showDeleted}
      notice={params.notice}
      error={params.error}
      returnPath={returnPath}
    />
  );
}

import { LocationManager } from "@/app/admin/inventory/locations/location-manager";
import { requirePermission } from "@/server/auth/session";
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

  return (
    <LocationManager
      records={records}
      users={users}
      query={query}
      showDeleted={showDeleted}
      notice={params.notice}
      error={params.error}
      returnPath={returnPath}
    />
  );
}

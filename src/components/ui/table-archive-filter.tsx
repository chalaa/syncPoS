import { TableFilterSelect } from "@/components/ui/table-filter-select";

export function TableArchiveFilter({ includeCancelled = false }: { includeCancelled?: boolean }) {
  return <TableFilterSelect paramName="show" label="Archive" allLabel="Active" options={[
    { value: "deleted", label: "Archived" },
    ...(includeCancelled ? [{ value: "cancelled", label: "Cancelled" }] : []),
  ]} />;
}

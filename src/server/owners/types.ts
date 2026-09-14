export type OwnerOption = {
  id: string;
  name: string;
  code?: string;
  locationIds?: string[];
};

export type OwnerListRow = OwnerOption & {
  deletedAt: Date | null;
  locations: { id: string; name: string; code: string }[];
  locationIds: string[];
};

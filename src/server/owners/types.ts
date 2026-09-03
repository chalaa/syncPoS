export type OwnerOption = {
  id: string;
  name: string;
};

export type OwnerListRow = OwnerOption & {
  deletedAt: Date | null;
};

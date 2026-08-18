export type SyncStatus = "online" | "offline" | "syncing";

export type AppState = {
  adminNavOpen: boolean;
  selectedLocationId: string | null;
  syncStatus: SyncStatus;
  setAdminNavOpen: (isOpen: boolean) => void;
  toggleAdminNav: () => void;
  setSelectedLocationId: (locationId: string | null) => void;
  setSyncStatus: (status: SyncStatus) => void;
  resetAppState: () => void;
};

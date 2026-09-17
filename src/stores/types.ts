export type SyncStatus = "online" | "offline" | "syncing";
export type Language = "en" | "am";

export type AppState = {
  adminNavOpen: boolean;
  selectedLocationId: string | null;
  syncStatus: SyncStatus;
  language: Language;
  setAdminNavOpen: (isOpen: boolean) => void;
  toggleAdminNav: () => void;
  setSelectedLocationId: (locationId: string | null) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLanguage: (lang: Language) => void;
  resetAppState: () => void;
};

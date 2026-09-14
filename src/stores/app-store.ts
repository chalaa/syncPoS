"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AppState, SyncStatus } from "@/stores/types";

const initialState = {
  adminNavOpen: true,
  selectedLocationId: null,
  syncStatus: "online" as SyncStatus,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,
      setAdminNavOpen: (isOpen) => set({ adminNavOpen: isOpen }),
      toggleAdminNav: () => set((state) => ({ adminNavOpen: !state.adminNavOpen })),
      setSelectedLocationId: (locationId) => {
        if (typeof window !== "undefined") {
          try {
            if (locationId) {
              localStorage.setItem("syncpos-selected-location", locationId);
            } else {
              localStorage.removeItem("syncpos-selected-location");
            }
          } catch {}
        }
        set({ selectedLocationId: locationId });
      },
      setSyncStatus: (status) => set({ syncStatus: status }),
      resetAppState: () => set(initialState),
    }),
    {
      name: "syncpos-app-state",
      partialize: (state) => ({
        adminNavOpen: state.adminNavOpen,
        selectedLocationId: state.selectedLocationId,
      }),
    },
  ),
);

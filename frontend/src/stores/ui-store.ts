import { create } from "zustand";

interface UiState {
  sidebarCollapsed: boolean;
  commandMenuOpen: boolean;
  selectedOccurrenceId: string | null;
  toggleSidebar: () => void;
  setCommandMenuOpen: (open: boolean) => void;
  setSelectedOccurrenceId: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  commandMenuOpen: false,
  selectedOccurrenceId: null,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setCommandMenuOpen: (open) => set({ commandMenuOpen: open }),
  setSelectedOccurrenceId: (id) => set({ selectedOccurrenceId: id }),
}));

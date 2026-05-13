"use client";

import { createContext, useContext, type ReactNode } from "react";

export type CrmShellValue = {
  sidebarExpanded: boolean;
  toggleSidebar: () => void;
};

const CrmShellContext = createContext<CrmShellValue | null>(null);

export function CrmShellProvider({ children, value }: { children: ReactNode; value: CrmShellValue }) {
  return <CrmShellContext.Provider value={value}>{children}</CrmShellContext.Provider>;
}

export function useCrmShell() {
  return useContext(CrmShellContext);
}

import type { ReactNode } from "react";

export default function FornecedorLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#0d1117] text-white">{children}</div>;
}

import type { Metadata } from "next";
import { HubPublicShell } from "@/components/hub/HubPublicShell";

export const metadata: Metadata = {
  title: "Cadastre a sua empresa | Obra10+ Hub",
  description: "Adira à plataforma Obra10+ Hub — cadastro de empresas com confirmação por e-mail.",
};

export default function CadastreSeLayout({ children }: { children: React.ReactNode }) {
  return <HubPublicShell>{children}</HubPublicShell>;
}

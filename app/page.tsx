import type { Metadata } from "next";
import { HubPublicShell } from "@/components/hub/HubPublicShell";
import { HubHero } from "@/components/hub/HubHero";
import { HubPurposeSection } from "@/components/hub/HubPurposeSection";
import { HubModuleGrid } from "@/components/hub/HubModuleGrid";
import { HubStepsSection } from "@/components/hub/HubStepsSection";
import { HubStatsBand, HubCtaBand } from "@/components/hub/HubCtaBand";
import { HubScrollReveal } from "@/components/hub/HubScrollReveal";

export const metadata: Metadata = {
  title: "Obra10+ Hub — Escritório virtual para construção",
  description:
    "Um só lugar para vender, atender e gerir obras. CRM, WhatsApp, funil com IA e financeiro para construtoras e imobiliárias.",
};

export default function HomePage() {
  return (
    <HubPublicShell>
      <HubScrollReveal />
      <HubHero />
      <HubPurposeSection />
      <HubModuleGrid />
      <HubStepsSection />
      <HubStatsBand />
      <HubCtaBand />
    </HubPublicShell>
  );
}

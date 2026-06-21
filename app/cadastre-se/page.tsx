import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HubLeadForm } from "@/components/hub/HubLeadForm";

export default function CadastreSePage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-xs text-[var(--obra-texto-2,#8b949e)] hover:text-[var(--obra-dourado,#c9a24a)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao Hub
      </Link>
      <HubLeadForm variant="page" />
    </div>
  );
}

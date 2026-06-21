import Link from "next/link";
import { HubLeadFormServer } from "@/components/hub/HubLeadFormServer";

type PageProps = {
  searchParams: Promise<{ ok?: string; erro?: string; email?: string }>;
};

export default async function CadastreSePage({ searchParams }: PageProps) {
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-xs text-[var(--obra-texto-2,#8b949e)] hover:text-[var(--obra-dourado,#c9a24a)]"
      >
        ← Voltar ao Hub
      </Link>
      <HubLeadFormServer ok={sp.ok} erro={sp.erro} email={sp.email} />
    </div>
  );
}

"use client";

/**
 * B1 (E2E DOMÍNIO C): /crm/projetos era um STUB (lista + modal) que duplicava — pior — o
 * módulo REAL de Arquitetura (kanban com funil, KPIs, fila "Em aprovação", "Gerar obra").
 * O menu "Arquitetura" agora aponta para /crm/arquitetura; esta rota vira um REDIRECT
 * permanente para lá, preservando a query (?negocio_id=… abre o criador pré-vinculado).
 * Mantemos a rota viva (em vez de apagar) para não quebrar links/bookmarks antigos.
 */

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirecionarParaArquitetura() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/crm/arquitetura?${qs}` : "/crm/arquitetura");
  }, [router, searchParams]);

  return (
    <div className="min-h-full bg-[#0a140f] p-6 text-sm text-[#8b949e]">
      Abrindo Arquitetura…
    </div>
  );
}

export default function ProjetosPage() {
  return (
    <Suspense
      fallback={<div className="min-h-full bg-[#0a140f] p-6 text-sm text-[#8b949e]">Abrindo Arquitetura…</div>}
    >
      <RedirecionarParaArquitetura />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function CadastreSeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[cadastre-se]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-xl font-bold text-[#f0aba8]">Não foi possível carregar o formulário</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--obra-texto-2,#8b949e)]">
        Ocorreu um erro ao preparar a página de cadastro. Pode tentar novamente ou voltar ao Hub.
      </p>
      {error.message ? (
        <p className="mt-2 rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-xs text-[#8b949e]">
          {error.message}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="min-h-11 rounded-xl bg-[var(--obra-verde,#003b26)] px-5 text-sm font-semibold text-[var(--obra-dourado-light,#e0b86a)]"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--obra-borda,#30363d)] px-5 text-sm font-medium text-[var(--obra-texto,#e6edf3)]"
        >
          Voltar ao Hub
        </Link>
      </div>
    </div>
  );
}

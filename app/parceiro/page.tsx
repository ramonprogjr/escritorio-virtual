import Link from "next/link";

export default function ParceiroHubPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#0d1117] px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Portal do parceiro</h1>
        <p className="text-sm text-[#8b949e]">
          Acesso restrito: use o link com token enviado pelo time Obra10+ ou conclua o cadastro pelo convite.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/parceiro/dashboard"
          className="text-center py-3 rounded-lg font-medium text-[#0d1117] bg-[#c9a24a]"
        >
          Abrir painel (com link assinado)
        </Link>
        <p className="text-xs text-center text-[#484f58]">
          Cadastro por convite: <code className="text-[#8b949e]">/parceiro/cadastro/&lt;token&gt;</code>
        </p>
      </div>
    </div>
  );
}

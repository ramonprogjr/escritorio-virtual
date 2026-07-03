export default function ParceiroHubPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#0d1117] px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Portal do parceiro</h1>
        <p className="text-sm text-[#8b949e]">
          Acesso restrito. O painel abre por um <strong className="text-[#c9a24a]">link assinado</strong>{" "}
          (único, com validade) enviado pelo time Obra10+ — ele já leva você direto para o seu painel.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs text-center">
        <div className="rounded-lg border border-[#21262d] bg-[#161b22] px-4 py-3">
          <p className="text-xs text-[#8b949e]">
            Recebeu um convite? Conclua o cadastro em<br />
            <code className="text-[#c9a24a]">/parceiro/cadastro/&lt;token&gt;</code>
          </p>
        </div>
        <p className="text-xs text-[#484f58]">
          Ainda não tem link? Fale com o gestor que cuida da sua conta.
        </p>
      </div>
    </div>
  );
}

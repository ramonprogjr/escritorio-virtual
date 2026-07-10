"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { CrmButton } from "@/components/crm/CrmButton";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { acaoIaPesada, textoConsumoEstimado, saldoSuficiente } from "@/lib/ia/custo-acao";

/**
 * Aviso ANTES de uma ação de IA que consome muito (regra do dono): a pessoa vê o que vai acontecer,
 * quanto aquilo costuma custar NESTE escritório (média real do histórico — sem histórico, dizemos que
 * não sabemos) e o saldo. Nunca mostra token nem R$ — a conversão é opaca de propósito.
 * O gasto detalhado mora no relatório (Carteira de Tijolos).
 */
export function ConfirmarAcaoIA({
  acaoId,
  aberto,
  onConfirmar,
  onCancelar,
}: {
  acaoId: string;
  aberto: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const acao = acaoIaPesada(acaoId);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [media, setMedia] = useState<number | null>(null);
  const [amostras, setAmostras] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!aberto || !acao) return;
    let vivo = true;
    setCarregando(true);
    (async () => {
      try {
        const res = await fetch(`/api/crm/ia/creditos?origem=${encodeURIComponent(acao.origem)}`, {
          credentials: "include",
          headers: internalApiHeaders(),
        });
        const j = (await res.json().catch(() => ({}))) as { saldo?: number; media?: number | null; amostras?: number };
        if (!vivo) return;
        if (res.ok) {
          setSaldo(typeof j.saldo === "number" ? j.saldo : null);
          setMedia(typeof j.media === "number" ? j.media : null);
          setAmostras(typeof j.amostras === "number" ? j.amostras : 0);
        }
      } catch {
        /* sem estimativa: a UI degrada para "ainda não sabemos" */
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [aberto, acao]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancelar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onCancelar]);

  if (!aberto || !acao) return null;

  const semSaldo = saldo != null && !saldoSuficiente(saldo, media);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmar-ia-titulo"
      onClick={onCancelar}
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-6"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-obra-borda bg-obra-dark-2 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-obra-dourado" aria-hidden />
          <h2 id="confirmar-ia-titulo" className="m-0 flex-1 text-base font-semibold text-obra-texto">
            {acao.rotulo}
          </h2>
          <button type="button" onClick={onCancelar} aria-label="Fechar" className="text-obra-texto-2 hover:text-obra-texto">
            <X size={18} />
          </button>
        </div>

        <p className="m-0 text-sm text-obra-texto-2">{acao.oQueFaz}</p>

        <div className="mt-3 rounded-lg border border-obra-borda bg-obra-dark p-3">
          <p className="m-0 text-xs text-obra-texto-2">
            {carregando ? "Verificando o consumo…" : textoConsumoEstimado(media, amostras)}
          </p>
          {!carregando && saldo != null && (
            <p className="m-0 mt-1 text-xs text-obra-texto-3">
              Seu saldo: <strong className="text-obra-dourado">{saldo.toLocaleString("pt-BR")}</strong> Tijolos.
            </p>
          )}
        </div>

        {semSaldo && (
          <p className="mt-3 rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-xs font-semibold text-[#ff7b72]">
            Sem Tijolos suficientes para esta ação. Recarregue na Carteira.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="rounded-lg px-3 py-2 text-sm font-semibold text-obra-texto-2 hover:text-obra-texto">
            Cancelar
          </button>
          <CrmButton size="sm" disabled={carregando || semSaldo} onClick={onConfirmar} leftIcon={<Sparkles size={14} />}>
            Pode rodar
          </CrmButton>
        </div>
      </div>
    </div>
  );
}

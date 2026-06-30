"use client";

/**
 * E7c (Fase 3a) — Drawer "Medir": registro FORMAL de medição por ITEM (decisão #4 do dono).
 *
 * Coexiste com o slider rápido do ObraItensSecao (slider = rápido; medição = formal com evidência).
 * Click-and-Go, mobile-first, tokens Obra10+. Grava via POST /api/crm/obras/[id]/medicoes:
 *   - quantidade_realizada (físico) → o pct resultante é DERIVADO no servidor quando há qtd planejada;
 *   - foto_url (evidência — a alma da "medição honesta") + observação;
 *   - se NÃO há qtd planejada, o usuário informa o % diretamente (o servidor usa o pct informado).
 *
 * NADA SE PERDE: a medição é append-only no servidor (não há editar/apagar aqui — corrige-se com
 * uma nova medição). TOLERANTE: sem a migração E7c o servidor grava só o avanço e responde
 * migracao_pendente=true → o drawer mostra um aviso honesto ("avanço salvo; registro formal após a migração").
 */

import { useCallback, useMemo, useState } from "react";
import { Ruler, Camera, AlertTriangle, CheckCircle2 } from "lucide-react";
import { CadastroPremiumSideover } from "@/components/crm/cadastro/CadastroPremiumSideover";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { derivarPctAvanco, clampPct } from "@/lib/obras/medicao";

const DOURADO = "#c9a24a";
const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";
const BG_DEEP = "#0a140f";
const TXT = "#e6edf3";
const TXT_DIM = "#8aa99a";

type ItemMedir = {
  id: string;
  nome?: string | null;
  codigo?: string | null;
  quantidade?: number | null;
  unidade?: string | null;
  pct_avanco?: number | null;
};

type Props = {
  open: boolean;
  obraId: string;
  item: ItemMedir | null;
  onClose: () => void;
  /** Chamado após gravar com sucesso (o avanço entrou) — a árvore recarrega. */
  onMedido: () => void;
};

export function DrawerMedir({ open, obraId, item, onClose, onMedido }: Props) {
  const [qtdRealizada, setQtdRealizada] = useState<string>("");
  const [pctManual, setPctManual] = useState<string>("");
  const [fotoUrl, setFotoUrl] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const temPlanejada = useMemo(() => {
    const q = Number(item?.quantidade);
    return Number.isFinite(q) && q > 0;
  }, [item?.quantidade]);

  // Preview do pct resultante AO VIVO (espelha a regra do servidor — derivarPctAvanco).
  const pctPreview = useMemo(() => {
    const qr = qtdRealizada.trim() === "" ? null : Number(qtdRealizada);
    const pm = pctManual.trim() === "" ? null : Number(pctManual);
    const planejada = temPlanejada ? Number(item?.quantidade) : null;
    const derivado = derivarPctAvanco(qr, planejada, pm);
    return derivado == null ? clampPct(item?.pct_avanco) : derivado;
  }, [qtdRealizada, pctManual, temPlanejada, item?.quantidade, item?.pct_avanco]);

  const limpar = useCallback(() => {
    setQtdRealizada("");
    setPctManual("");
    setFotoUrl("");
    setObservacao("");
    setErro(null);
    setOkMsg(null);
  }, []);

  const fechar = useCallback(() => {
    limpar();
    onClose();
  }, [limpar, onClose]);

  const salvar = useCallback(async () => {
    if (!item) return;
    // GUARDA double-tap (Fase 3a): a medição é append-only — um 2º toque registraria OUTRA linha,
    // duplicando o histórico. Enquanto há sucesso na tela, o botão fica desarmado até o usuário
    // mexer no formulário de novo (limpamos os campos no sucesso → onChange reseta okMsg).
    if (salvando || okMsg) return;
    setSalvando(true);
    setErro(null);
    setOkMsg(null);
    try {
      const body: Record<string, unknown> = { item_id: item.id };
      if (qtdRealizada.trim() !== "") {
        const qr = Number(qtdRealizada);
        if (Number.isFinite(qr)) body.quantidade_realizada = Math.max(0, qr);
      }
      // Sem qtd planejada, o % é a fonte do avanço — manda o pct informado.
      if (!temPlanejada && pctManual.trim() !== "") {
        const pm = Number(pctManual);
        if (Number.isFinite(pm)) body.pct_avanco_resultante = clampPct(pm);
      }
      if (fotoUrl.trim()) body.foto_url = fotoUrl.trim();
      if (observacao.trim()) body.observacao = observacao.trim();

      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/medicoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        error?: string;
        pct_avanco_resultante?: number;
        medicao_registrada?: boolean;
        migracao_pendente?: boolean;
        aviso?: string;
      };
      if (!res.ok) {
        setErro(json.error || "Não foi possível registrar a medição.");
        return;
      }
      // Honesto: avisa quando o avanço entrou mas o registro formal ficou para a migração.
      if (json.migracao_pendente) {
        setOkMsg(json.aviso || "Avanço salvo. O registro formal entra após a migração E7c.");
      } else {
        setOkMsg(`Medição registrada. Avanço do item: ${json.pct_avanco_resultante ?? pctPreview}%.`);
      }
      // Anti-duplicação: zera os campos da entrada (o pct/foto/obs desta medição) — sem reabrir o
      // botão para um 2º registro idêntico. O okMsg permanece visível até o usuário fechar ou medir de novo.
      setQtdRealizada("");
      setPctManual("");
      setFotoUrl("");
      setObservacao("");
      onMedido();
    } catch {
      setErro("Falha de rede ao registrar a medição.");
    } finally {
      setSalvando(false);
    }
  }, [item, salvando, okMsg, qtdRealizada, pctManual, temPlanejada, fotoUrl, observacao, obraId, onMedido, pctPreview]);

  if (!open || !item) return null;

  const unidade = item.unidade ? ` ${item.unidade}` : "";

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={fechar}
      kindLabel="MEDIÇÃO FORMAL"
      title={item.nome || "Item"}
      subtitle={item.codigo || undefined}
      Icon={Ruler}
      accent={DOURADO}
      footer={
        <>
          <button
            type="button"
            onClick={fechar}
            className="rounded-md px-4 py-2 text-[13px] font-semibold"
            style={{ border: `1px solid ${BORDA}`, color: TXT_DIM, background: BG_CARD }}
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || Boolean(okMsg)}
            className="rounded-md px-4 py-2 text-[13px] font-bold"
            style={{
              color: "#f0c869",
              background: "linear-gradient(180deg, #1d5c3c, #003b26)",
              border: `1px solid ${DOURADO}`,
              opacity: salvando || okMsg ? 0.6 : 1,
            }}
          >
            {salvando ? "Registrando…" : okMsg ? "Medição registrada ✓" : "Registrar medição"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Estado atual + "medido X de Y" */}
        <div className="rounded-xl border p-3" style={{ borderColor: BORDA, background: BG_CARD }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: TXT_DIM }}>
              Avanço atual
            </span>
            <span className="text-[15px] font-bold tabular-nums" style={{ color: TXT }}>
              {clampPct(item.pct_avanco)}%
            </span>
          </div>
          {temPlanejada ? (
            <p className="mt-1 text-[12px]" style={{ color: TXT_DIM }}>
              Planejado: <span style={{ color: TXT }}>{item.quantidade}{unidade}</span>
            </p>
          ) : (
            <p className="mt-1 text-[12px]" style={{ color: TXT_DIM }}>
              Sem quantidade planejada — informe o avanço em %.
            </p>
          )}
        </div>

        {/* Quantidade realizada (quando há planejada) OU pct manual */}
        {temPlanejada ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: TXT_DIM }}>
              Quantidade realizada{unidade}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={qtdRealizada}
              onChange={(e) => {
                setQtdRealizada(e.target.value);
                if (okMsg) setOkMsg(null); // re-arma o botão p/ uma NOVA medição (não a mesma)
              }}
              placeholder={`ex.: ${item.quantidade}`}
              className="min-h-[44px] rounded-md border px-3 text-[14px] tabular-nums"
              style={{ borderColor: BORDA, background: BG_DEEP, color: TXT }}
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: TXT_DIM }}>
              Avanço (%)
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              value={pctManual}
              onChange={(e) => {
                setPctManual(e.target.value);
                if (okMsg) setOkMsg(null); // re-arma o botão p/ uma NOVA medição (não a mesma)
              }}
              placeholder="0 a 100"
              className="min-h-[44px] rounded-md border px-3 text-[14px] tabular-nums"
              style={{ borderColor: BORDA, background: BG_DEEP, color: TXT }}
            />
          </label>
        )}

        {/* Preview do pct resultante (a conta exposta — honesto) */}
        <div
          className="flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-[13px]"
          style={{ background: BG_CARD, border: `1px solid ${DOURADO}33` }}
        >
          <span style={{ color: TXT_DIM }}>Avanço após esta medição</span>
          <span className="text-[16px] font-bold tabular-nums" style={{ color: "#f0c869" }}>
            {pctPreview}%
          </span>
        </div>

        {/* Evidência: foto (a alma da medição honesta) */}
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: TXT_DIM }}>
            <Camera className="h-3.5 w-3.5" /> Foto da evidência (URL)
          </span>
          <input
            type="url"
            value={fotoUrl}
            onChange={(e) => {
              setFotoUrl(e.target.value);
              if (okMsg) setOkMsg(null); // re-arma o botão p/ uma NOVA medição (não a mesma)
            }}
            placeholder="https://… (link da foto)"
            className="min-h-[44px] rounded-md border px-3 text-[13px]"
            style={{ borderColor: BORDA, background: BG_DEEP, color: TXT }}
          />
        </label>

        {/* Observação */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: TXT_DIM }}>
            Observação
          </span>
          <textarea
            value={observacao}
            onChange={(e) => {
              setObservacao(e.target.value);
              if (okMsg) setOkMsg(null); // re-arma o botão p/ uma NOVA medição (não a mesma)
            }}
            placeholder="O que foi medido, condições, ressalvas…"
            rows={3}
            className="rounded-md border px-3 py-2 text-[13px]"
            style={{ borderColor: BORDA, background: BG_DEEP, color: TXT, resize: "vertical" }}
          />
        </label>

        {/* "Nada se perde": a medição é imutável (append-only). */}
        <p className="text-[11px]" style={{ color: "#5c6b62" }}>
          A medição é um registro permanente (não se apaga). Para corrigir, registre uma nova medição.
        </p>

        {erro ? (
          <p className="flex items-center gap-1 text-[12px]" style={{ color: "#f85149" }}>
            <AlertTriangle className="h-3.5 w-3.5" /> {erro}
          </p>
        ) : null}
        {okMsg ? (
          <p className="flex items-center gap-1 text-[12px]" style={{ color: "#86efac" }}>
            <CheckCircle2 className="h-3.5 w-3.5" /> {okMsg}
          </p>
        ) : null}
      </div>
    </CadastroPremiumSideover>
  );
}

export default DrawerMedir;

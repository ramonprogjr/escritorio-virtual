"use client";

/**
 * A2 — Sideover de confirmação "Gerar obra" (do projeto → obra). Passo ÚNICO, Click-and-Go.
 *
 * A IA/heurística pré-preenche (tipo via mapTipologiaParaTipoObra, cliente/área herdados, EAP do
 * preset); o HUMANO ajusta o que quiser e confirma — o "Gerar obra ✓" é o GATE. Após criar,
 * o caller navega para a obra (router.push), onde a engenharia cai sem redigitar nada.
 *
 * Reusa CadastroPremiumSideover (cabeçalho premium + footer sticky). Mobile: o sideover já é
 * full-width em telas pequenas (width: min(640px,100vw)); DE→PARA empilha; CTA no footer.
 */

import { useMemo, useState } from "react";
import { HardHat, ArrowRight, Check, Mic } from "lucide-react";
import { CadastroPremiumSideover } from "@/components/crm/cadastro/CadastroPremiumSideover";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { toast } from "@/components/crm/toast";
import {
  TIPOS_OBRA,
  TIPOS_OBRA_PRINCIPAIS,
  getPresetPorTipo,
  mapTipologiaParaTipoObra,
  type TipoObraSlug,
} from "@/lib/obras/eap-presets";

export type ProjetoParaObra = {
  id: string;
  titulo: string;
  tipologia: string | null;
  area_m2: number | null;
  cliente_nome: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  projeto: ProjetoParaObra;
  /** nº de cômodos do programa (só para a microcopy de contexto; não persiste na obra). */
  programaCount?: number;
  /** Chamado após criar com sucesso; recebe o id da obra (para router.push). */
  onCriada: (obraId: string) => void;
};

const GOLD = "#c9a24a";

export function GerarObraSideover({ open, onClose, projeto, programaCount = 0, onCriada }: Props) {
  // Tipo pré-marcado pela heurística (humano pode trocar o chip).
  const tipoSugerido = mapTipologiaParaTipoObra(projeto.tipologia);
  const [tipo, setTipo] = useState<TipoObraSlug>(tipoSugerido);
  const [nome, setNome] = useState(projeto.titulo);
  const [salvando, setSalvando] = useState(false);

  // Frentes do preset do tipo selecionado (todas pré-marcadas — Click-and-Go).
  const preset = useMemo(() => getPresetPorTipo(tipo), [tipo]);
  const disciplinasDoPreset = useMemo(() => {
    if (!preset) return [] as { slug: string; nome: string }[];
    const vistos = new Set<string>();
    const out: { slug: string; nome: string }[] = [];
    for (const f of preset.frentes) {
      if (vistos.has(f.disciplina_slug)) continue;
      vistos.add(f.disciplina_slug);
      out.push({ slug: f.disciplina_slug, nome: f.nome });
    }
    return out;
  }, [preset]);

  // Seleção de disciplinas (null = "todas", o default tolerante do backend).
  const [desmarcadas, setDesmarcadas] = useState<Set<string>>(new Set());
  function toggleDisciplina(slug: string) {
    setDesmarcadas((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  // Ao trocar de tipo, zera a seleção (as disciplinas mudam de preset).
  function escolherTipo(novo: TipoObraSlug) {
    setTipo(novo);
    setDesmarcadas(new Set());
  }

  async function confirmar() {
    setSalvando(true);
    // frentes_selecionadas = disciplina_slugs MARCADOS. Se nada foi desmarcado, omite (= todas).
    const marcadas = disciplinasDoPreset.map((d) => d.slug).filter((s) => !desmarcadas.has(s));
    const enviarSelecao = desmarcadas.size > 0 && marcadas.length > 0;
    try {
      const res = await fetch(`/api/crm/projetos/${projeto.id}/gerar-obra`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          tipo_obra: tipo,
          titulo: nome.trim() || projeto.titulo,
          ...(enviarSelecao ? { frentes_selecionadas: marcadas } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Não foi possível gerar a obra.");
        setSalvando(false);
        return;
      }
      const obraId = json?.data?.id as string | undefined;
      const frentes = typeof json?.frentes_criadas === "number" ? json.frentes_criadas : null;
      // R2 (A2): o PATCH do elo pode falhar mesmo com a obra criada (res.ok). O usuário TEM que
      // saber agora — a recuperação ainda é barata (dedup 60s/título). Avisa, mas navega assim mesmo.
      if (json?.elo_ok === false) {
        toast.error("Obra criada, mas o vínculo com o projeto ficou pendente — reabra o projeto para revincular.");
      } else if (json?.idempotente || json?.vinculada) {
        toast.success("Este projeto já tem uma obra. Abrindo…");
      } else {
        toast.success(frentes != null ? `Obra criada · ${frentes} frente${frentes === 1 ? "" : "s"}` : "Obra criada");
      }
      if (obraId) onCriada(obraId);
      else {
        setSalvando(false);
        onClose();
      }
    } catch {
      toast.error("Falha de rede ao gerar a obra.");
      setSalvando(false);
    }
  }

  const tiposChips = TIPOS_OBRA.filter((t) =>
    (TIPOS_OBRA_PRINCIPAIS as string[]).includes(t.slug)
  );
  const totalFrentes = disciplinasDoPreset.length - desmarcadas.size;

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={salvando ? () => {} : onClose}
      kindLabel="ENGENHARIA · HANDOFF"
      title="Gerar obra"
      subtitle={`do projeto ${projeto.titulo}`}
      Icon={HardHat}
      accent={GOLD}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="rounded-lg px-4 py-2 text-sm font-bold text-[#8b949e] disabled:opacity-50"
            style={{ border: "1px solid #344256", background: "#1d2633" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirmar()}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold disabled:opacity-60"
            style={{ background: "linear-gradient(180deg, #1d5c3c, #003b26)", color: "#f0c869", border: `1px solid ${GOLD}` }}
          >
            <Check size={15} /> {salvando ? "Gerando…" : "Gerar obra"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* DE → PARA: o handoff como diagrama */}
        <div className="flex items-stretch gap-2">
          <div className="flex-1 rounded-xl border border-[#1d3a2c] bg-[#0a140f] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6e7681]">📐 Projeto</p>
            <p className="mt-1 truncate text-sm font-bold text-[#e6edf3]">{projeto.titulo}</p>
            <p className="mt-1 text-[11px] text-[#22c55e]">herdado ✓</p>
          </div>
          <div className="flex items-center text-[#6e7681]">
            <ArrowRight size={18} />
          </div>
          <div className="flex-1 rounded-xl p-3" style={{ border: `1px solid ${GOLD}55`, background: "#1a1405" }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: GOLD }}>🏗️ Obra (nova)</p>
            <p className="mt-1 text-sm font-bold text-[#f0c869]">você confirma</p>
            <p className="mt-1 text-[11px] text-[#f3e6c4]">EAP já montada</p>
          </div>
        </div>

        <p className="text-xs text-[#8b949e]">A IA preencheu — ajuste se precisar:</p>

        {/* Tipo (chips) — pré-marcado por mapTipologia */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-[#94a3b8]">Tipo de obra</p>
          <div className="flex flex-wrap gap-2">
            {tiposChips.map((t) => {
              const ativo = t.slug === tipo;
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => escolherTipo(t.slug as TipoObraSlug)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors"
                  style={{
                    border: ativo ? `1px solid ${GOLD}` : "1px solid #1d3a2c",
                    background: ativo ? "rgba(201,162,74,0.14)" : "#0a140f",
                    color: ativo ? "#f0c869" : "#8b949e",
                  }}
                >
                  <span>{t.icone}</span> {t.label}
                  {ativo ? <Check size={13} /> : null}
                </button>
              );
            })}
          </div>
          {tipoSugerido !== tipo ? (
            <p className="mt-1 text-[11px] text-[#6e7681]">Sugerido: {TIPOS_OBRA.find((t) => t.slug === tipoSugerido)?.label}. Confirme o tipo.</p>
          ) : null}
        </div>

        {/* Herdados (read-only) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[#1d3a2c] bg-[#0a140f] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[#6e7681]">Cliente 🔒</p>
            <p className="mt-0.5 truncate text-sm text-[#e6edf3]">{projeto.cliente_nome?.trim() || "—"}</p>
          </div>
          <div className="rounded-lg border border-[#1d3a2c] bg-[#0a140f] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[#6e7681]">Área (herdada)</p>
            <p className="mt-0.5 text-sm text-[#e6edf3]">{projeto.area_m2 ? `${projeto.area_m2} m²` : "—"}</p>
          </div>
        </div>

        {/* Nome da obra (editável) */}
        <label className="block">
          <span className="text-[11px] font-bold text-[#94a3b8]">Nome da obra</span>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#c9a24a]"
          />
        </label>

        {/* EAP do preset — chips de frentes (Click-and-Go: todas marcadas, pode desmarcar) */}
        {disciplinasDoPreset.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[11px] font-bold text-[#94a3b8]">
              EAP já montada ({preset?.nome} · {totalFrentes})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {disciplinasDoPreset.map((d) => {
                const marcada = !desmarcadas.has(d.slug);
                return (
                  <button
                    key={d.slug}
                    type="button"
                    onClick={() => toggleDisciplina(d.slug)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
                    style={{
                      border: marcada ? `1px solid ${GOLD}55` : "1px solid #1d3a2c",
                      background: marcada ? "rgba(201,162,74,0.10)" : "#0a140f",
                      color: marcada ? "#d6b976" : "#6e7681",
                      textDecoration: marcada ? "none" : "line-through",
                    }}
                  >
                    {marcada ? <Check size={11} /> : null} {d.nome}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-[#1d3a2c] bg-[#0a140f] px-3 py-2 text-[11px] text-[#6e7681]">
            Tipo sem preset — você adiciona as frentes na EAP da obra depois.
          </p>
        )}

        {/* Programa (contexto — fica vinculado ao projeto, não redigita) */}
        {programaCount > 0 ? (
          <p className="text-[11px] text-[#6e7681]">
            ▸ Programa ({programaCount} ambiente{programaCount === 1 ? "" : "s"}) fica vinculado ao
            projeto de origem (não redigita).
          </p>
        ) : null}

        <p className="inline-flex items-center gap-1.5 text-[11px] text-[#6e7681]">
          <Mic size={12} style={{ color: GOLD }} /> ou diga “gera a obra do {projeto.titulo}”
        </p>
      </div>
    </CadastroPremiumSideover>
  );
}

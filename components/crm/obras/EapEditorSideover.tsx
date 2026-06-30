"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import {
  CadastroPremiumSideover,
  CadastroSideoverPanel,
  CadastroTipoBadge,
} from "@/components/crm/cadastro/CadastroPremiumSideover";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { EntitySelect, type EntitySelectOption } from "@/components/crm/EntitySelect";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { DISCIPLINAS_PADRAO, type FrenteEapRow } from "@/lib/obras/eap-presets";

type CatalogoItem = {
  id: string;
  codigo: string;
  descricao: string;
  disciplina_slug: string | null;
  cor: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  obraId: string;
  obraTitulo?: string;
  onUpdated?: () => void;
};

const DOURADO = "#c9a24a";

export function EapEditorSideover({ open, onClose, obraId, obraTitulo, onUpdated }: Props) {
  const [frentes, setFrentes] = useState<FrenteEapRow[]>([]);
  const [disciplinas, setDisciplinas] = useState<EntitySelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [migracaoPendente, setMigracaoPendente] = useState(false);
  const [novaDisciplina, setNovaDisciplina] = useState("");
  const [avancado, setAvancado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [eapRes, catRes] = await Promise.all([
        fetch(`/api/crm/obras/${obraId}/eap`, { headers: internalApiHeaders() }),
        fetch("/api/crm/catalogo?categoria=disciplina", { headers: internalApiHeaders() }),
      ]);
      const eapJson = (await eapRes.json()) as {
        data?: FrenteEapRow[];
        migracao_pendente?: boolean;
      };
      const catJson = (await catRes.json()) as { data?: CatalogoItem[] };
      setMigracaoPendente(Boolean(eapJson.migracao_pendente));
      setFrentes((eapJson.data ?? []).slice().sort((a, b) => a.ordem - b.ordem));
      const catItens = catJson.data ?? [];
      const fonte: EntitySelectOption[] = catItens.length
        ? catItens.map((c) => ({
            value: c.disciplina_slug || c.codigo,
            label: c.descricao,
            sub: c.codigo,
          }))
        : DISCIPLINAS_PADRAO.map((d) => ({ value: d.slug, label: d.label, sub: d.codigo }));
      setDisciplinas(fonte);
    } catch {
      setErro("Não foi possível carregar a EAP.");
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => {
    if (open) void carregar();
    else {
      setFrentes([]);
      setNovaDisciplina("");
      setAvancado(false);
      setErro(null);
    }
  }, [open, carregar]);

  async function patchFrente(id: string, patch: Record<string, unknown>) {
    if (migracaoPendente) return;
    const res = await fetch(`/api/crm/obras/${obraId}/eap`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErro(j.error || "Erro ao atualizar frente.");
      return;
    }
    onUpdated?.();
  }

  function toggleAtivo(f: FrenteEapRow, ativo: boolean) {
    setFrentes((prev) => prev.map((x) => (x.id === f.id ? { ...x, ativo } : x)));
    void patchFrente(f.id, { ativo });
  }

  function renomear(f: FrenteEapRow, nome: string) {
    setFrentes((prev) => prev.map((x) => (x.id === f.id ? { ...x, nome } : x)));
  }

  // Reorder por setas: troca a `ordem` de dois vizinhos e persiste ambos.
  async function mover(index: number, dir: -1 | 1) {
    const alvo = index + dir;
    if (alvo < 0 || alvo >= frentes.length) return;
    const a = frentes[index];
    const b = frentes[alvo];
    const novo = frentes.slice();
    novo[index] = { ...b, ordem: a.ordem };
    novo[alvo] = { ...a, ordem: b.ordem };
    setFrentes(novo.sort((x, y) => x.ordem - y.ordem));
    await Promise.all([
      patchFrente(a.id, { ordem: b.ordem }),
      patchFrente(b.id, { ordem: a.ordem }),
    ]);
  }

  async function adicionarFrente() {
    if (migracaoPendente) return;
    const slug = novaDisciplina.trim();
    if (!slug) {
      setErro("Escolha a disciplina da nova frente.");
      return;
    }
    const opt = disciplinas.find((d) => d.value === slug);
    const res = await fetch(`/api/crm/obras/${obraId}/eap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ disciplina_slug: slug, nome: opt?.label }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setErro(j.error || "Erro ao adicionar frente.");
      return;
    }
    setNovaDisciplina("");
    await carregar();
    onUpdated?.();
  }

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel="EAP"
      title="Frentes da obra"
      subtitle={obraTitulo}
      Icon={Layers}
      badge={<CadastroTipoBadge label="Engenharia" tone="gold" />}
    >
      <div className="flex flex-col gap-4 p-1">
        {migracaoPendente ? (
          <div className="rounded-lg border border-[#c9a24a44] bg-[#003b2622] px-3 py-2 text-xs text-[#e6edf3]">
            Personalização de frentes ainda não está ativa (migração E0 pendente). A lista
            abaixo é uma prévia do preset — ative a migração para editar de verdade.
          </div>
        ) : null}

        <CadastroSideoverPanel titulo={null} descricao={null}>
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-[#8b949e]">
              Desative frentes para ocultá-las. Itens já lançados nelas permanecem.
            </p>

            {loading ? (
              <p className="text-sm text-[#8b949e]">Carregando…</p>
            ) : frentes.length === 0 ? (
              <p className="text-sm text-[#8b949e]">
                Nenhuma frente ainda. Adicione a primeira abaixo.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {frentes.map((f, i) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
                    style={{
                      borderColor: f.ativo ? `${f.cor ?? DOURADO}55` : "#1d3a2c",
                      background: f.ativo ? `${f.cor ?? DOURADO}0c` : "#0f1d16",
                    }}
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label="Mover para cima"
                        onClick={() => void mover(i, -1)}
                        disabled={i === 0 || migracaoPendente}
                        className="flex h-9 w-9 items-center justify-center text-[#8b949e] disabled:opacity-30"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="Mover para baixo"
                        onClick={() => void mover(i, 1)}
                        disabled={i === frentes.length - 1 || migracaoPendente}
                        className="flex h-9 w-9 items-center justify-center text-[#8b949e] disabled:opacity-30"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: f.cor ?? DOURADO }}
                    />
                    <div className="min-w-0 flex-1">
                      <input
                        value={f.nome}
                        onChange={(e) => renomear(f, e.target.value)}
                        onBlur={(e) => patchFrente(f.id, { nome: e.target.value.trim() })}
                        disabled={migracaoPendente}
                        className="w-full bg-transparent text-[13px] font-bold text-[#e6edf3] outline-none"
                      />
                      <p className="font-mono text-[10px] text-[#8b949e]">{f.codigo}</p>
                    </div>
                    <CrmToggleSwitch
                      checked={f.ativo}
                      onCheckedChange={(v) => toggleAtivo(f, v)}
                      disabled={migracaoPendente}
                    />
                  </li>
                ))}
              </ul>
            )}

            {/* Nova frente — Click-and-Go (escolhe disciplina do catálogo) */}
            <div className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-3">
              <p className="mb-2 text-xs font-bold text-[#e6edf3]">Nova frente</p>
              <div className="flex flex-col gap-2">
                <EntitySelect
                  value={novaDisciplina}
                  onChange={setNovaDisciplina}
                  options={disciplinas}
                  placeholder="Disciplina (do catálogo)…"
                  searchPlaceholder="Buscar disciplina…"
                  disabled={migracaoPendente}
                />
                <button
                  type="button"
                  onClick={() => void adicionarFrente()}
                  disabled={migracaoPendente}
                  className="rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50"
                  style={{ background: "#003b26", color: DOURADO }}
                >
                  + Adicionar frente
                </button>
              </div>
            </div>

            {/* Avançado: pesos (colapsado — não assusta o leigo) */}
            <button
              type="button"
              onClick={() => setAvancado((v) => !v)}
              className="flex items-center gap-1 text-xs font-bold text-[#8b949e]"
            >
              {avancado ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Avançado (peso físico / financeiro)
            </button>
            {avancado && !migracaoPendente && (
              <div className="space-y-2 rounded-xl border border-[#1d3a2c] bg-[#0a140f] p-3">
                {frentes.map((f) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-[#e6edf3]">{f.nome}</span>
                    <input
                      type="number"
                      defaultValue={f.peso_fisico}
                      onBlur={(e) =>
                        patchFrente(f.id, { peso_fisico: Number(e.target.value) || 0 })
                      }
                      className="w-16 rounded border border-[#1d3a2c] bg-[#0f1d16] px-2 py-1 text-xs text-[#e6edf3]"
                      aria-label={`Peso físico de ${f.nome}`}
                    />
                    <input
                      type="number"
                      defaultValue={f.peso_financeiro}
                      onBlur={(e) =>
                        patchFrente(f.id, { peso_financeiro: Number(e.target.value) || 0 })
                      }
                      className="w-16 rounded border border-[#1d3a2c] bg-[#0f1d16] px-2 py-1 text-xs text-[#e6edf3]"
                      aria-label={`Peso financeiro de ${f.nome}`}
                    />
                  </div>
                ))}
                <p className="text-[10px] text-[#6e7781]">
                  Pesos são opcionais em E0 (a soma 100% só trava na medição/Curva S).
                </p>
              </div>
            )}

            {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
          </div>
        </CadastroSideoverPanel>
      </div>
    </CadastroPremiumSideover>
  );
}

"use client";

/**
 * E5 — Aba "Compras & Estoque" da obra (SC · Cotações · Inventário · Movimentação).
 *
 * Click-and-Go (não digitar): Tipo (segmented) → Descrição (do catálogo dessa categoria) → Qtd (stepper)
 * → Urgência. GATE dourado FIXO: "a compra exige aprovação humana" (a IA prepara, o humano aprova).
 * Inventário da VIEW com fórmula visível (Entr.− Saí.+ Dev.). Movimentação = Saída/Devolução com preview.
 *
 * Mobile-first: steppers ≥44px, segmented scroll-x, gate fixo no rodapé. Marca verde+dourado dark.
 * Tolerante: migração E5 pendente → aviso honesto, não quebra.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Minus,
  X,
  Search,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  ArrowDownToLine,
  Undo2,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  TIPOS_MATERIAL_SC,
  URGENCIAS_SC,
  APRESENTACAO_TIPO_MATERIAL,
  APRESENTACAO_URGENCIA,
  APRESENTACAO_STATUS_SC,
  formulaInventario,
  previewAposMovimento,
  type TipoMaterialSc,
  type UrgenciaSc,
  type InventarioRow,
  type StatusSc,
} from "@/lib/obras/estoque";

const DOURADO = "#c9a24a";
const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";
const BG_INPUT = "#0a140f";
const TEXTO = "#e6edf3";
const TEXTO_FRACO = "#8b949e";

type CatalogoItem = {
  id: string;
  categoria: string;
  codigo: string;
  descricao: string;
  unidade: string | null;
};

type CarrinhoItem = {
  catalogo_id: string | null;
  descricao: string;
  unidade: string | null;
  categoria: string;
  qtd_pedida: number;
  preco_unit_estimado?: number | null;
};

type ScItem = {
  id: string;
  catalogo_id: string | null;
  descricao_snapshot: string;
  unidade: string | null;
  qtd_pedida: number;
  qtd_entregue: number;
};

type ScRow = {
  id: string;
  codigo: string | null;
  descricao: string;
  status: StatusSc;
  urgencia: UrgenciaSc;
  tipo_material: TipoMaterialSc;
  valor_estimado: number | null;
  itens?: ScItem[];
};

type SubAba = "sc" | "inventario";

export function ObraComprasEstoqueSecao({ obraId }: { obraId: string }) {
  const [subAba, setSubAba] = useState<SubAba>("sc");
  const [migracaoPendente, setMigracaoPendente] = useState(false);

  return (
    <div>
      {/* Sub-abas: Solicitações (SC) | Estoque (Inventário) */}
      <div
        role="tablist"
        aria-label="Compras e estoque"
        style={{ display: "flex", gap: 4, marginBottom: 16 }}
      >
        {([
          { id: "sc", rotulo: "Solicitações de compra", Icon: ShoppingCart },
          { id: "inventario", rotulo: "Estoque", Icon: Boxes },
        ] as const).map(({ id, rotulo, Icon }) => {
          const ativo = subAba === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setSubAba(id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 700,
                color: ativo ? "#0a140f" : "#8aa99a",
                background: ativo ? DOURADO : "transparent",
                border: `1px solid ${ativo ? DOURADO : BORDA}`,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <Icon size={15} />
              {rotulo}
            </button>
          );
        })}
      </div>

      {migracaoPendente && (
        <div
          style={{
            marginBottom: 16,
            borderRadius: 10,
            padding: "10px 14px",
            background: "#3a2a0f",
            border: `1px solid ${DOURADO}55`,
            color: "#f0c869",
            fontSize: 13,
          }}
        >
          <AlertTriangle size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
          Compras & estoque ainda não ativos nesta base (migração E5 pendente — janela do dono). A tela
          fica pronta; os dados aparecem após aplicar a migração.
        </div>
      )}

      {subAba === "sc" ? (
        <PainelSc obraId={obraId} onMigracaoPendente={setMigracaoPendente} />
      ) : (
        <PainelInventario obraId={obraId} onMigracaoPendente={setMigracaoPendente} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAINEL SC — lista de solicitações + criação Click-and-Go
// ════════════════════════════════════════════════════════════════════════════
function PainelSc({
  obraId,
  onMigracaoPendente,
}: {
  obraId: string;
  onMigracaoPendente: (v: boolean) => void;
}) {
  const [scs, setScs] = useState<ScRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/sc`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json()) as { data?: ScRow[]; migracao_pendente?: boolean; error?: string };
      if (json.migracao_pendente) onMigracaoPendente(true);
      setScs(Array.isArray(json.data) ? json.data : []);
    } catch {
      setErro("Falha ao carregar as solicitações.");
    } finally {
      setCarregando(false);
    }
  }, [obraId, onMigracaoPendente]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, margin: 0, color: TEXTO }}>Solicitações de compra</h3>
        <button
          type="button"
          onClick={() => setCriando(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: DOURADO,
            color: "#0a140f",
            fontWeight: 700,
            fontSize: 13,
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          <Plus size={15} /> Nova SC
        </button>
      </div>

      {erro && <p style={{ color: "#f85149", fontSize: 13 }}>{erro}</p>}

      {carregando ? (
        <p style={{ color: TEXTO_FRACO, fontSize: 13 }}>Carregando…</p>
      ) : scs.length === 0 ? (
        <p style={{ color: TEXTO_FRACO, fontSize: 13 }}>
          Nenhuma solicitação ainda. Clique em <strong>Nova SC</strong> para pedir material.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {scs.map((sc) => (
            <CardSc key={sc.id} sc={sc} obraId={obraId} onMudou={() => void carregar()} />
          ))}
        </div>
      )}

      {criando && (
        <DrawerNovaSc
          obraId={obraId}
          onFechar={() => setCriando(false)}
          onCriada={() => {
            setCriando(false);
            void carregar();
          }}
          onMigracaoPendente={onMigracaoPendente}
        />
      )}
    </div>
  );
}

// ── Card de uma SC (com gate de aprovação humano + registrar entrega) ─────────
function CardSc({ sc, obraId, onMudou }: { sc: ScRow; obraId: string; onMudou: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const apr = APRESENTACAO_STATUS_SC[sc.status] ?? { cor: TEXTO_FRACO, label: sc.status };
  const urg = APRESENTACAO_URGENCIA[sc.urgencia] ?? null;

  const acao = useCallback(
    async (body: Record<string, unknown>) => {
      setOcupado(true);
      try {
        await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/sc/${encodeURIComponent(sc.id)}`, {
          method: "PATCH",
          headers: { ...internalApiHeaders(), "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        onMudou();
      } finally {
        setOcupado(false);
      }
    },
    [obraId, sc.id, onMudou]
  );

  const entregarTudo = useCallback(() => {
    const itens = (sc.itens ?? [])
      .map((it) => ({ item_id: it.id, qtd: Math.max(0, it.qtd_pedida - it.qtd_entregue) }))
      .filter((x) => x.qtd > 0);
    if (itens.length === 0) return;
    void acao({ acao: "registrar_entrega", itens });
  }, [sc.itens, acao]);

  return (
    <article style={{ background: BG_CARD, border: `1px solid ${BORDA}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: TEXTO_FRACO }}>{sc.codigo}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: 6,
                background: `${apr.cor}22`,
                color: apr.cor,
              }}
            >
              {apr.label}
            </span>
            {urg && sc.urgencia !== "normal" && (
              <span style={{ fontSize: 10, fontWeight: 700, color: urg.cor }}>● {urg.label}</span>
            )}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: TEXTO }}>{sc.descricao}</p>
          {sc.valor_estimado != null && (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: TEXTO_FRACO }}>
              ~ R$ {sc.valor_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
      </div>

      {/* Itens com progresso de entrega */}
      {(sc.itens ?? []).length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 4 }}>
          {sc.itens!.map((it) => (
            <li key={it.id} style={{ fontSize: 12, color: TEXTO_FRACO, display: "flex", justifyContent: "space-between" }}>
              <span>{it.descricao_snapshot}</span>
              <span>
                {it.qtd_entregue}/{it.qtd_pedida} {it.unidade ?? ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Gate dourado + ações por status */}
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {(sc.status === "rascunho" || sc.status === "cotando") && (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: DOURADO }}>
              <ShieldCheck size={13} /> A compra exige aprovação humana
            </span>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void acao({ acao: "aprovar" })}
              style={botaoPrimario}
            >
              Aprovar compra
            </button>
          </>
        )}
        {(sc.status === "aprovado" || sc.status === "entregue_parcial") && (sc.itens ?? []).length > 0 && (
          <button type="button" disabled={ocupado} onClick={entregarTudo} style={botaoPrimario}>
            <ArrowDownToLine size={14} style={{ marginRight: 4, verticalAlign: "-2px" }} />
            Registrar entrega
          </button>
        )}
        {sc.status !== "cancelado" && sc.status !== "entregue" && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void acao({ acao: "cancelar" })}
            style={botaoSecundario}
          >
            Cancelar
          </button>
        )}
      </div>
    </article>
  );
}

// ── Drawer "Nova SC" — Click-and-Go ────────────────────────────────────────────
function DrawerNovaSc({
  obraId,
  onFechar,
  onCriada,
  onMigracaoPendente,
}: {
  obraId: string;
  onFechar: () => void;
  onCriada: () => void;
  onMigracaoPendente: (v: boolean) => void;
}) {
  const [tipo, setTipo] = useState<TipoMaterialSc>("material");
  const [busca, setBusca] = useState("");
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);
  const [urgencia, setUrgencia] = useState<UrgenciaSc>("normal");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Tipo → Descrição filtrada: busca o catálogo dessa categoria.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/crm/catalogo?categoria=${encodeURIComponent(tipo)}`, {
          headers: internalApiHeaders(),
        });
        const json = (await res.json()) as { data?: CatalogoItem[]; migracao_pendente?: boolean };
        if (!vivo) return;
        if (json.migracao_pendente) onMigracaoPendente(true);
        setCatalogo(Array.isArray(json.data) ? json.data : []);
      } catch {
        if (vivo) setCatalogo([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [tipo, onMigracaoPendente]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const base = t ? catalogo.filter((c) => c.descricao.toLowerCase().includes(t)) : catalogo;
    return base.slice(0, 30);
  }, [catalogo, busca]);

  const adicionar = useCallback(
    (item: { catalogo_id: string | null; descricao: string; unidade: string | null }) => {
      setCarrinho((prev) => {
        const ja = prev.find(
          (c) =>
            (item.catalogo_id && c.catalogo_id === item.catalogo_id) ||
            (!item.catalogo_id && c.descricao.toLowerCase() === item.descricao.toLowerCase())
        );
        if (ja) {
          return prev.map((c) => (c === ja ? { ...c, qtd_pedida: c.qtd_pedida + 1 } : c));
        }
        return [
          ...prev,
          {
            catalogo_id: item.catalogo_id,
            descricao: item.descricao,
            unidade: item.unidade,
            categoria: tipo,
            qtd_pedida: 1,
          },
        ];
      });
    },
    [tipo]
  );

  const setQtd = useCallback((idx: number, delta: number) => {
    setCarrinho((prev) =>
      prev
        .map((c, i) => (i === idx ? { ...c, qtd_pedida: Math.max(0, c.qtd_pedida + delta) } : c))
        .filter((c) => c.qtd_pedida > 0)
    );
  }, []);

  const itemForaCatalogo = useCallback(() => {
    const nome = busca.trim();
    if (!nome) return;
    adicionar({ catalogo_id: null, descricao: nome, unidade: null });
    setBusca("");
  }, [busca, adicionar]);

  const salvar = useCallback(async () => {
    if (carrinho.length === 0) {
      setErro("Adicione ao menos um item.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/sc`, {
        method: "POST",
        headers: { ...internalApiHeaders(), "content-type": "application/json" },
        body: JSON.stringify({
          tipo_material: tipo,
          urgencia,
          status: "cotando",
          itens: carrinho.map((c) => ({
            catalogo_id: c.catalogo_id,
            descricao: c.descricao,
            unidade: c.unidade,
            categoria: c.categoria,
            qtd_pedida: c.qtd_pedida,
          })),
        }),
      });
      const json = (await res.json()) as { error?: string; migracao_pendente?: boolean };
      if (!res.ok) {
        if (json.migracao_pendente) onMigracaoPendente(true);
        setErro(json.error ?? "Falha ao criar a SC.");
        return;
      }
      onCriada();
    } catch {
      setErro("Falha de rede ao criar a SC.");
    } finally {
      setSalvando(false);
    }
  }, [carrinho, obraId, tipo, urgencia, onCriada, onMigracaoPendente]);

  return (
    <div style={overlay} role="dialog" aria-label="Nova solicitação de compra" onClick={onFechar}>
      <div style={drawer} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: TEXTO }}>Nova solicitação de compra</h3>
          <button type="button" onClick={onFechar} style={{ background: "none", border: "none", color: TEXTO_FRACO, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* TIPO — segmented (filtra a lista) */}
        <label style={rotulo}>Tipo</label>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
          {TIPOS_MATERIAL_SC.map((t) => {
            const ativo = tipo === t;
            const ap = APRESENTACAO_TIPO_MATERIAL[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                style={{
                  flexShrink: 0,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: ativo ? "#0a140f" : "#8aa99a",
                  background: ativo ? DOURADO : "transparent",
                  border: `1px solid ${ativo ? DOURADO : BORDA}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  minHeight: 40,
                }}
              >
                {ap.icone} {ap.label}
              </button>
            );
          })}
        </div>

        {/* DESCRIÇÃO — busca no catálogo dessa categoria */}
        <label style={rotulo}>Descrição (do catálogo)</label>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 12, color: TEXTO_FRACO }} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar item…"
            style={{ ...input, paddingLeft: 32 }}
          />
        </div>
        <div style={{ maxHeight: 170, overflowY: "auto", marginBottom: 6 }}>
          {filtrados.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => adicionar({ catalogo_id: c.id, descricao: c.descricao, unidade: c.unidade })}
              style={linhaCatalogo}
            >
              <span>{c.descricao}</span>
              <span style={{ color: TEXTO_FRACO, fontSize: 12 }}>{c.unidade ?? ""}</span>
            </button>
          ))}
          {busca.trim() && (
            <button type="button" onClick={itemForaCatalogo} style={{ ...linhaCatalogo, color: DOURADO }}>
              <span>
                <Plus size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                Adicionar &quot;{busca.trim()}&quot; (fora do catálogo)
              </span>
            </button>
          )}
          {filtrados.length === 0 && !busca.trim() && (
            <p style={{ fontSize: 12, color: TEXTO_FRACO, padding: 8 }}>
              {catalogo.length === 0
                ? "Catálogo vazio para esta categoria — digite para adicionar item fora do catálogo."
                : "Digite para buscar."}
            </p>
          )}
        </div>

        {/* CARRINHO — steppers */}
        {carrinho.length > 0 && (
          <div style={{ marginBottom: 14, display: "grid", gap: 6 }}>
            {carrinho.map((c, idx) => (
              <div
                key={`${c.catalogo_id ?? c.descricao}-${idx}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: BG_INPUT,
                  border: `1px solid ${BORDA}`,
                  borderRadius: 8,
                  padding: "6px 10px",
                }}
              >
                <span style={{ flex: 1, fontSize: 13, color: TEXTO }}>
                  {c.descricao}
                  {c.catalogo_id === null && (
                    <span style={{ fontSize: 10, color: DOURADO, marginLeft: 6 }}>fora do catálogo</span>
                  )}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button type="button" onClick={() => setQtd(idx, -1)} style={stepper} aria-label="diminuir">
                    <Minus size={14} />
                  </button>
                  <span style={{ minWidth: 32, textAlign: "center", fontSize: 14, fontWeight: 700, color: TEXTO }}>
                    {c.qtd_pedida}
                  </span>
                  <button type="button" onClick={() => setQtd(idx, +1)} style={stepper} aria-label="aumentar">
                    <Plus size={14} />
                  </button>
                  <span style={{ fontSize: 11, color: TEXTO_FRACO, minWidth: 28 }}>{c.unidade ?? ""}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* URGÊNCIA */}
        <label style={rotulo}>Urgência</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {URGENCIAS_SC.map((u) => {
            const ativo = urgencia === u;
            const ap = APRESENTACAO_URGENCIA[u];
            return (
              <button
                key={u}
                type="button"
                onClick={() => setUrgencia(u)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: ativo ? "#0a140f" : ap.cor,
                  background: ativo ? ap.cor : "transparent",
                  border: `1px solid ${ap.cor}`,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {ap.label}
              </button>
            );
          })}
        </div>

        {/* GATE dourado fixo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#3a2a0f",
            border: `1px solid ${DOURADO}55`,
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 14,
            fontSize: 12,
            color: "#f0c869",
          }}
        >
          <ShieldCheck size={16} />
          A compra exige aprovação humana. Esta SC vai para cotação — você aprova depois.
        </div>

        {erro && <p style={{ color: "#f85149", fontSize: 13, margin: "0 0 10px" }}>{erro}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onFechar} style={{ ...botaoSecundario, flex: 1 }}>
            Cancelar
          </button>
          <button type="button" disabled={salvando || carrinho.length === 0} onClick={salvar} style={{ ...botaoPrimario, flex: 1 }}>
            {salvando ? "Salvando…" : "Enviar p/ cotação"}
            <ChevronRight size={15} style={{ verticalAlign: "-3px", marginLeft: 2 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAINEL INVENTÁRIO — leitura da view + movimentação (saída/devolução)
// ════════════════════════════════════════════════════════════════════════════
function PainelInventario({
  obraId,
  onMigracaoPendente,
}: {
  obraId: string;
  onMigracaoPendente: (v: boolean) => void;
}) {
  const [inv, setInv] = useState<InventarioRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [movItem, setMovItem] = useState<InventarioRow | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/inventario`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json()) as { data?: InventarioRow[]; migracao_pendente?: boolean };
      if (json.migracao_pendente) onMigracaoPendente(true);
      setInv(Array.isArray(json.data) ? json.data : []);
    } finally {
      setCarregando(false);
    }
  }, [obraId, onMigracaoPendente]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return inv;
    return inv.filter((r) => (r.descricao ?? "").toLowerCase().includes(t));
  }, [inv, filtro]);

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={15} style={{ position: "absolute", left: 10, top: 12, color: TEXTO_FRACO }} />
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar no estoque…"
          style={{ ...input, paddingLeft: 32 }}
        />
      </div>

      {carregando ? (
        <p style={{ color: TEXTO_FRACO, fontSize: 13 }}>Carregando estoque…</p>
      ) : filtrados.length === 0 ? (
        <p style={{ color: TEXTO_FRACO, fontSize: 13 }}>
          Estoque vazio. As entradas aparecem ao registrar a entrega de uma SC aprovada.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtrados.map((r, i) => {
            const negativo = Number(r.em_estoque) < 0;
            const zerado = Number(r.em_estoque) === 0;
            return (
              <article
                key={`${r.catalogo_id ?? r.descricao}-${i}`}
                style={{
                  background: BG_CARD,
                  border: `1px solid ${negativo ? "#EF444466" : BORDA}`,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXTO }}>
                      {r.descricao ?? "Item"} <span style={{ fontSize: 12, color: TEXTO_FRACO }}>{r.unidade ?? ""}</span>
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: TEXTO_FRACO }}>{formulaInventario(r)}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: negativo ? "#EF4444" : zerado ? "#F59E0B" : "#3fb950",
                      }}
                    >
                      {Number(r.em_estoque)}
                    </span>
                    {negativo && (
                      <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#EF4444" }}>
                        ⛔ NEGATIVO
                      </span>
                    )}
                    {zerado && (
                      <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#F59E0B" }}>
                        ⚠ zerado
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => setMovItem(r)} style={botaoSecundario}>
                    <ArrowDownToLine size={13} style={{ verticalAlign: "-2px", marginRight: 4, transform: "rotate(180deg)" }} />
                    Saída
                  </button>
                  <button type="button" onClick={() => setMovItem(r)} style={botaoSecundario}>
                    <Undo2 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                    Devolução
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {movItem && (
        <DrawerMovimentacao
          obraId={obraId}
          item={movItem}
          onFechar={() => setMovItem(null)}
          onRegistrada={() => {
            setMovItem(null);
            void carregar();
          }}
          onMigracaoPendente={onMigracaoPendente}
        />
      )}
    </div>
  );
}

// ── Drawer de movimentação (Saída/Devolução) com preview anti-erro ────────────
function DrawerMovimentacao({
  obraId,
  item,
  onFechar,
  onRegistrada,
  onMigracaoPendente,
}: {
  obraId: string;
  item: InventarioRow;
  onFechar: () => void;
  onRegistrada: () => void;
  onMigracaoPendente: (v: boolean) => void;
}) {
  const [tipo, setTipo] = useState<"saida" | "devolucao">("saida");
  const [qtd, setQtd] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const apos = previewAposMovimento(Number(item.em_estoque), tipo, qtd);

  const salvar = useCallback(async () => {
    if (qtd <= 0) {
      setErro("Quantidade deve ser maior que zero.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/estoque`, {
        method: "POST",
        headers: { ...internalApiHeaders(), "content-type": "application/json" },
        body: JSON.stringify({
          tipo,
          quantidade: qtd,
          catalogo_id: item.catalogo_id,
          descricao: item.descricao,
          unidade: item.unidade,
          categoria: item.categoria,
          codigo_catalogo: item.codigo_catalogo,
          motivo: motivo.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: string; migracao_pendente?: boolean };
      if (!res.ok) {
        if (json.migracao_pendente) onMigracaoPendente(true);
        setErro(json.error ?? "Falha ao registrar.");
        return;
      }
      onRegistrada();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }, [qtd, tipo, motivo, obraId, item, onRegistrada, onMigracaoPendente]);

  return (
    <div style={overlay} role="dialog" aria-label="Movimentar estoque" onClick={onFechar}>
      <div style={drawer} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: TEXTO }}>Movimentar: {item.descricao}</h3>
          <button type="button" onClick={onFechar} style={{ background: "none", border: "none", color: TEXTO_FRACO, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <label style={rotulo}>Tipo</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {(["saida", "devolucao"] as const).map((t) => {
            const ativo = tipo === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: ativo ? "#0a140f" : "#8aa99a",
                  background: ativo ? DOURADO : "transparent",
                  border: `1px solid ${ativo ? DOURADO : BORDA}`,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {t === "saida" ? "Saída" : "Devolução"}
              </button>
            );
          })}
        </div>

        <label style={rotulo}>
          Disponível: {Number(item.em_estoque)} {item.unidade ?? ""}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button type="button" onClick={() => setQtd((q) => Math.max(1, q - 1))} style={stepper} aria-label="diminuir">
            <Minus size={16} />
          </button>
          <input
            type="number"
            min={1}
            value={qtd}
            onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))}
            style={{ ...input, width: 90, textAlign: "center" }}
          />
          <button type="button" onClick={() => setQtd((q) => q + 1)} style={stepper} aria-label="aumentar">
            <Plus size={16} />
          </button>
          <span style={{ fontSize: 13, color: TEXTO_FRACO }}>{item.unidade ?? ""}</span>
        </div>

        {/* Preview do efeito (anti-erro) */}
        <p
          style={{
            fontSize: 13,
            color: apos < 0 ? "#EF4444" : TEXTO_FRACO,
            margin: "0 0 14px",
          }}
        >
          Após: ficará <strong style={{ color: apos < 0 ? "#EF4444" : TEXTO }}>{apos}</strong> {item.unidade ?? ""}
          {apos < 0 && " — estoque ficará negativo!"}
        </p>

        <label style={rotulo}>Observação (opcional)</label>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: consumo no andar 8" style={{ ...input, marginBottom: 16 }} />

        {erro && <p style={{ color: "#f85149", fontSize: 13, margin: "0 0 10px" }}>{erro}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onFechar} style={{ ...botaoSecundario, flex: 1 }}>
            Cancelar
          </button>
          <button type="button" disabled={salvando} onClick={salvar} style={{ ...botaoPrimario, flex: 1 }}>
            {salvando ? "Registrando…" : `Registrar ${tipo === "saida" ? "saída" : "devolução"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Estilos compartilhados ──────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "flex-end",
  zIndex: 50,
};
const drawer: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  height: "100%",
  background: "#0a140f",
  borderLeft: `1px solid ${BORDA}`,
  padding: 20,
  overflowY: "auto",
};
const rotulo: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: TEXTO_FRACO,
  marginBottom: 6,
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: BG_INPUT,
  border: `1px solid ${BORDA}`,
  borderRadius: 8,
  color: TEXTO,
  fontSize: 13,
};
const linhaCatalogo: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "9px 10px",
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${BORDA}`,
  color: TEXTO,
  fontSize: 13,
  cursor: "pointer",
  textAlign: "left",
};
const stepper: React.CSSProperties = {
  width: 36,
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: BG_INPUT,
  border: `1px solid ${BORDA}`,
  borderRadius: 8,
  color: DOURADO,
  cursor: "pointer",
};
const botaoPrimario: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 14px",
  background: DOURADO,
  color: "#0a140f",
  fontWeight: 700,
  fontSize: 13,
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};
const botaoSecundario: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 14px",
  background: "transparent",
  color: "#8aa99a",
  fontWeight: 600,
  fontSize: 13,
  border: `1px solid ${BORDA}`,
  borderRadius: 8,
  cursor: "pointer",
};

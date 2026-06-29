"use client";

import { useState } from "react";
import { ArrowRight, MapPin, Mic, ChevronDown, ChevronUp, Unlock } from "lucide-react";
import {
  traduzirConfianca,
  chipsDoMotivo,
  type ChipNegocio,
  PERFIS_DESTINO,
  type DestinoManual,
} from "@/lib/crm/direcionamento-ui";

/**
 * Card ÚNICO de direcionamento (Click-and-Go).
 *
 * Reutilizável nos 3 pontos de entrada (Fila, painel da ficha, drawer da lista).
 * Mostra o lead + o RECOMENDADO já pré-selecionado (1º candidato do motor) com
 * confiança LEGÍVEL e chips de fatores REAIS, CTA dourado grande "Direcionar para
 * {Nome}" (1 toque no caso feliz) e as alternativas atrás de progressive disclosure.
 *
 * Não faz fetch nem conhece endpoints: recebe os candidatos prontos e dispara
 * `onDirecionar(parceiroId)`. Quem usa controla o fluxo /sugerir → /aprovar.
 * Um verbo só: "Direcionar".
 */

export type CandidatoCard = {
  parceiro_id: string;
  nome: string;
  score: number;
  motivo?: string | null;
  mercado?: string | null;
  cidade?: string | null;
  estado?: string | null;
  status_financeiro?: string | null;
};

export type LeadCardInfo = {
  nome: string;
  mercado?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

/** Destino possível p/ o direcionamento manual (lista carregada pelo consumidor). */
export type DestinoOpcao = {
  id: string;
  nome: string;
  mercado?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

type Props = {
  lead: LeadCardInfo;
  candidatos: CandidatoCard[];
  /** Direciona ao parceiro escolhido (top-1 por padrão, ou alternativa). */
  onDirecionar: (parceiroId: string) => void;
  /** True enquanto o direcionamento está em curso (CTA vira "Direcionando…"). */
  enviando?: boolean;
  /** Ponto de entrada de voz (Talk-and-Go) — abre o copiloto global. Opcional. */
  onVoz?: () => void;
  /**
   * Libera o parceiro recomendado bloqueado/pendente por pendência financeira
   * (chama POST /api/crm/parceiros/[id]/liberar no consumidor). Quando ausente,
   * o chip de pendência aparece sem o botão (somente aviso).
   */
  onLiberar?: (parceiroId: string) => void;
  /** True enquanto a liberação está em curso (botão vira "Liberando…"). */
  liberando?: boolean;
  /** Estado-vazio: sem fornecedor que casa. Ações com saída (nunca beco). */
  vazio?: {
    onMaisProximo?: () => void;
    onForaDaRegiao?: () => void;
    onDeixarNaFila?: () => void;
    /**
     * Direcionar MANUAL a outro destino por PERFIL (Click-and-Go), quando o
     * motor não rankeia ninguém. Recebe perfil + destino escolhidos e grava
     * em /encaminhamentos no consumidor. Quando ausente, a opção não aparece.
     */
    onOutroDestino?: (destino: DestinoManual) => void;
    /** Carrega a lista de destinos de um perfil (ex.: fornecedores). */
    carregarDestinos?: (perfilSlug: string) => Promise<DestinoOpcao[]>;
  };
  /** True enquanto o direcionamento manual está sendo gravado. */
  enviandoDestino?: boolean;
  /** Quando a distribuição automática está desligada (flag honesta). */
  desligado?: boolean;
};

const GEO = (x: { cidade?: string | null; estado?: string | null }) =>
  [x.cidade, x.estado].filter(Boolean).join("/") || null;

function Chip({ chip }: { chip: ChipNegocio }) {
  const bom = chip.tom === "bom";
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        color: bom ? "#9ece9c" : "#e3b341",
        background: bom ? "rgba(63,185,80,0.10)" : "rgba(227,179,65,0.10)",
        border: `1px solid ${bom ? "rgba(63,185,80,0.28)" : "rgba(227,179,65,0.30)"}`,
      }}
    >
      {chip.label}
    </span>
  );
}

export function DirecionarLeadCard({
  lead,
  candidatos,
  onDirecionar,
  enviando = false,
  onVoz,
  onLiberar,
  liberando = false,
  vazio,
  enviandoDestino = false,
  desligado = false,
}: Props) {
  const [verOutras, setVerOutras] = useState(false);
  // Escolha local: top-1 por padrão; selecionar alternativa troca o alvo do CTA.
  const [sel, setSel] = useState<string | null>(null);

  const geoLead = GEO(lead);
  const recomendado = candidatos[0];
  const alternativas = candidatos.slice(1);
  const parceiroEscolhido = sel ?? recomendado?.parceiro_id ?? null;
  const alvo = candidatos.find((c) => c.parceiro_id === parceiroEscolhido) ?? recomendado;

  return (
    <div
      style={{
        border: "1px solid #1d3a2c",
        borderRadius: 14,
        background: "#0b0f14",
        padding: 16,
      }}
    >
      {/* Cabeçalho do lead + voz */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 170 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e6edf3" }}>{lead.nome}</p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "#8b949e",
              display: "flex",
              alignItems: "center",
              gap: 7,
              flexWrap: "wrap",
            }}
          >
            {lead.mercado && (
              <span style={{ fontWeight: 700, color: "#c9a24a" }}>{lead.mercado}</span>
            )}
            {geoLead && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <MapPin size={11} aria-hidden /> {geoLead}
              </span>
            )}
          </p>
        </div>
        {onVoz && (
          <button
            type="button"
            onClick={onVoz}
            title="Direcionar por voz"
            aria-label="Direcionar por voz"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: 999,
              border: "1px solid #1d3a2c",
              background: "transparent",
              color: "#c9a24a",
              cursor: "pointer",
            }}
          >
            <Mic size={15} aria-hidden />
          </button>
        )}
      </div>

      {/* Estado-vazio COM saída — nunca um beco. Texto honesto: só promete o que está cabeado. */}
      {!recomendado ? (
        <EstadoVazio
          desligado={desligado}
          vazio={vazio}
          enviandoDestino={enviandoDestino}
        />
      ) : (
        <>
          {/* RECOMENDADO pré-selecionado: confiança legível + chips de negócio reais */}
          <RecomendadoBloco
            candidato={alvo ?? recomendado}
            destacado={(alvo ?? recomendado).parceiro_id === recomendado.parceiro_id}
            onLiberar={onLiberar}
            liberando={liberando}
          />

          {/* CTA grande dourado — 1 toque no caso feliz */}
          <button
            type="button"
            disabled={enviando}
            onClick={() => parceiroEscolhido && onDirecionar(parceiroEscolhido)}
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              width: "100%",
              padding: "13px 18px",
              borderRadius: 11,
              border: "none",
              background: "#c9a24a",
              color: "#003b26",
              fontWeight: 800,
              fontSize: 15,
              cursor: enviando ? "default" : "pointer",
              opacity: enviando ? 0.65 : 1,
            }}
          >
            <ArrowRight size={18} strokeWidth={2.6} aria-hidden />
            {enviando ? "Direcionando…" : `Direcionar para ${(alvo ?? recomendado).nome}`}
          </button>

          {/* Preview do destino ANTES de confirmar */}
          <p
            style={{
              margin: "9px 2px 0",
              fontSize: 11.5,
              color: "#7d8a99",
              lineHeight: 1.45,
              textAlign: "center",
            }}
          >
            Vai avisar <strong style={{ color: "#9aa7b4" }}>{(alvo ?? recomendado).nome}</strong> no
            WhatsApp agora. Se recusar, ofereço ao próximo automaticamente.
          </p>

          {/* Progressive disclosure: outras opções */}
          {alternativas.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setVerOutras((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "transparent",
                  border: "none",
                  color: "#8b949e",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "4px 0",
                }}
              >
                {verOutras ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                {verOutras ? "ocultar opções" : `ver outras opções (${alternativas.length})`}
              </button>

              {verOutras && (
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
                  {candidatos.map((c) => {
                    const escolhido = parceiroEscolhido === c.parceiro_id;
                    const conf = traduzirConfianca(c);
                    return (
                      <button
                        key={c.parceiro_id}
                        type="button"
                        onClick={() => setSel(c.parceiro_id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          width: "100%",
                          textAlign: "left",
                          padding: "9px 11px",
                          borderRadius: 10,
                          cursor: "pointer",
                          border: `1px solid ${escolhido ? "#c9a24a" : "#16271e"}`,
                          background: escolhido ? "rgba(201,162,74,0.10)" : "transparent",
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 999,
                            flexShrink: 0,
                            border: `2px solid ${escolhido ? "#c9a24a" : "#3a4a40"}`,
                            background: escolhido ? "#c9a24a" : "transparent",
                            boxShadow: escolhido ? "inset 0 0 0 2px #0b0f14" : "none",
                          }}
                        />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#e6edf3" }}>{c.nome}</span>
                          <span style={{ display: "block", margin: "2px 0 0", fontSize: 11, color: conf.cor, fontWeight: 600 }}>
                            {conf.rotulo} · {conf.score}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Estado-vazio honesto (sem candidato do motor) + válvula de escape Click-and-Go.
 *
 * Texto promete SÓ o que está cabeado (corrige a copy antiga que prometia 3 botões).
 * O direcionamento manual é GUIADO: escolhe o perfil (chip) → escolhe o destino
 * (lista) → confirma, gravando em /encaminhamentos pelo consumidor. Sem digitação
 * solta — o gestor ESCOLHE e CONFIRMA (e o autorizado-por vem da sessão).
 */
function EstadoVazio({
  desligado,
  vazio,
  enviandoDestino,
}: {
  desligado: boolean;
  vazio: Props["vazio"];
  enviandoDestino: boolean;
}) {
  const [modo, setModo] = useState<"saidas" | "manual">("saidas");
  const [perfil, setPerfil] = useState<string | null>(null);
  const [perfilLabel, setPerfilLabel] = useState<string>("");
  const [destinos, setDestinos] = useState<DestinoOpcao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [destinoSel, setDestinoSel] = useState<DestinoOpcao | null>(null);

  const podeManual = Boolean(vazio?.onOutroDestino);

  async function escolherPerfil(slug: string, label: string) {
    setPerfil(slug);
    setPerfilLabel(label);
    setDestinoSel(null);
    setDestinos([]);
    if (!vazio?.carregarDestinos) return;
    setCarregando(true);
    try {
      const lista = await vazio.carregarDestinos(slug);
      setDestinos(lista);
    } catch {
      setDestinos([]);
    } finally {
      setCarregando(false);
    }
  }

  function confirmarManual() {
    if (!perfil || !vazio?.onOutroDestino) return;
    // Sem digitação solta: se há lista, exige um destino escolhido; o nome do
    // destino vira o critério legível, e o perfil vira o segmento.
    const destinoNome = destinoSel?.nome ?? perfilLabel;
    vazio.onOutroDestino({
      perfil,
      perfilLabel,
      destinoId: destinoSel?.id ?? null,
      destinoNome,
    });
  }

  // Lista carregável + nenhum destino escolhido = não pode confirmar (sem "gravar por fora").
  const exigeDestino = Boolean(vazio?.carregarDestinos);
  const confirmarHabilitado =
    Boolean(perfil) && (!exigeDestino || Boolean(destinoSel)) && !enviandoDestino;

  return (
    <div style={{ marginTop: 14 }}>
      {modo === "saidas" ? (
        <>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#f0883e", lineHeight: 1.5 }}>
            {desligado
              ? "Distribuição automática desligada — ative a Automação para o motor recomendar quem recebe."
              : "Nenhum fornecedor homologado combina com este mercado/região ainda. Você ainda tem saídas:"}
          </p>
          {!desligado && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {podeManual && (
                <button type="button" onClick={() => setModo("manual")} style={btnSaida(true)}>
                  Direcionar a outro destino
                </button>
              )}
              {vazio?.onMaisProximo && (
                <button type="button" onClick={vazio.onMaisProximo} style={btnSaida(false)}>
                  Direcionar ao mais próximo
                </button>
              )}
              {vazio?.onForaDaRegiao && (
                <button type="button" onClick={vazio.onForaDaRegiao} style={btnSaida(false)}>
                  Buscar fora da região
                </button>
              )}
              {vazio?.onDeixarNaFila && (
                <button type="button" onClick={vazio.onDeixarNaFila} style={btnSaida(false)}>
                  Deixar na fila e avisar o Hub
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setModo("saidas")}
              style={{
                background: "transparent",
                border: "none",
                color: "#8b949e",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
              }}
            >
              ← voltar
            </button>
            <p style={{ margin: 0, fontSize: 12.5, color: "#e6edf3", fontWeight: 700 }}>
              Direcionar a outro destino
            </p>
          </div>
          <p style={{ margin: "0 0 8px", fontSize: 11.5, color: "#8b949e", lineHeight: 1.45 }}>
            Escolha o perfil do destino:
          </p>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {PERFIS_DESTINO.map((p) => {
              const sel = perfil === p.slug;
              return (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => void escolherPerfil(p.slug, p.label)}
                  style={{
                    padding: "7px 13px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: `1px solid ${sel ? "#c9a24a" : "#1d3a2c"}`,
                    background: sel ? "rgba(201,162,74,0.12)" : "transparent",
                    color: sel ? "#c9a24a" : "#8b949e",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {perfil && (
            <div style={{ marginTop: 12 }}>
              {carregando ? (
                <p style={{ margin: 0, fontSize: 12, color: "#8b949e" }}>Carregando destinos…</p>
              ) : destinos.length > 0 ? (
                <>
                  <p style={{ margin: "0 0 7px", fontSize: 11.5, color: "#8b949e" }}>
                    Escolha o destino:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 220, overflowY: "auto" }}>
                    {destinos.map((d) => {
                      const escolhido = destinoSel?.id === d.id;
                      const geo = GEO(d);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setDestinoSel(d)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            width: "100%",
                            textAlign: "left",
                            padding: "9px 11px",
                            borderRadius: 10,
                            cursor: "pointer",
                            border: `1px solid ${escolhido ? "#c9a24a" : "#16271e"}`,
                            background: escolhido ? "rgba(201,162,74,0.10)" : "transparent",
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 999,
                              flexShrink: 0,
                              border: `2px solid ${escolhido ? "#c9a24a" : "#3a4a40"}`,
                              background: escolhido ? "#c9a24a" : "transparent",
                              boxShadow: escolhido ? "inset 0 0 0 2px #0b0f14" : "none",
                            }}
                          />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#e6edf3" }}>{d.nome}</span>
                            {(geo || d.mercado) && (
                              <span style={{ display: "block", margin: "2px 0 0", fontSize: 11, color: "#7d8a99" }}>
                                {[d.mercado, geo].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : exigeDestino ? (
                <p style={{ margin: 0, fontSize: 12, color: "#e3b341", lineHeight: 1.45 }}>
                  Nenhum destino cadastrado para este perfil ainda.
                </p>
              ) : null}
            </div>
          )}

          <button
            type="button"
            disabled={!confirmarHabilitado}
            onClick={confirmarManual}
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 10,
              border: "none",
              background: confirmarHabilitado ? "#c9a24a" : "#1d3a2c",
              color: confirmarHabilitado ? "#003b26" : "#5c6570",
              fontWeight: 800,
              fontSize: 14,
              cursor: confirmarHabilitado ? "pointer" : "not-allowed",
            }}
          >
            <ArrowRight size={16} strokeWidth={2.6} aria-hidden />
            {enviandoDestino
              ? "Direcionando…"
              : destinoSel
                ? `Direcionar para ${destinoSel.nome}`
                : "Confirmar destino"}
          </button>
        </>
      )}
    </div>
  );
}

/** Bloco do recomendado em destaque: nome + confiança legível + chips reais. */
function RecomendadoBloco({
  candidato,
  destacado,
  onLiberar,
  liberando = false,
}: {
  candidato: CandidatoCard;
  destacado: boolean;
  onLiberar?: (parceiroId: string) => void;
  liberando?: boolean;
}) {
  const conf = traduzirConfianca(candidato);
  const chips = chipsDoMotivo(candidato);
  const geo = GEO(candidato);
  // Mesma regra do motor/chips: pendente ou bloqueado destrava o botão "Liberar".
  const fin = (candidato.status_financeiro ?? "em_dia").toLowerCase();
  const bloqueadoFinanceiro = fin === "pendente" || fin === "bloqueado";
  return (
    <div
      style={{
        marginTop: 14,
        padding: 13,
        borderRadius: 12,
        border: `1px solid ${destacado ? "#c9a24a55" : "#1d3a2c"}`,
        background: destacado ? "rgba(201,162,74,0.06)" : "#0f1d16",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#e6edf3" }}>{candidato.nome}</span>
        {destacado && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: "#003b26",
              background: "#c9a24a",
              borderRadius: 4,
              padding: "2px 7px",
              letterSpacing: 0.3,
            }}
          >
            RECOMENDADO
          </span>
        )}
      </div>

      {/* Confiança legível no lugar do número cru */}
      <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 700, color: conf.cor }}>
        {conf.rotulo} <span style={{ color: "#6e7681", fontWeight: 600 }}>· {conf.score}</span>
      </p>

      {geo && (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 11.5,
            color: "#8b949e",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <MapPin size={11} aria-hidden /> {geo}
          {candidato.mercado ? ` · ${candidato.mercado}` : ""}
        </p>
      )}

      {/* Chips de negócio a partir dos MESMOS fatores do motor */}
      {chips.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
          {chips.map((chip, i) => (
            <Chip key={`${chip.label}-${i}`} chip={chip} />
          ))}
        </div>
      )}

      {/* "Nós podemos liberar": destrava a pendência financeira e segue o direcionamento */}
      {bloqueadoFinanceiro && onLiberar && (
        <div
          style={{
            marginTop: 11,
            paddingTop: 11,
            borderTop: "1px dashed rgba(227,179,65,0.30)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 11.5, color: "#e3b341", lineHeight: 1.4, flex: 1, minWidth: 150 }}>
            {fin === "bloqueado"
              ? "Bloqueado por pendência financeira."
              : "Pendência financeira em aberto."}{" "}
            O Hub pode liberar e seguir.
          </span>
          <button
            type="button"
            disabled={liberando}
            onClick={() => onLiberar(candidato.parceiro_id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 13px",
              borderRadius: 8,
              border: "1px solid rgba(227,179,65,0.45)",
              background: "rgba(227,179,65,0.12)",
              color: "#e3b341",
              fontSize: 12,
              fontWeight: 800,
              cursor: liberando ? "default" : "pointer",
              opacity: liberando ? 0.65 : 1,
              flexShrink: 0,
            }}
          >
            <Unlock size={13} aria-hidden />
            {liberando ? "Liberando…" : "Liberar"}
          </button>
        </div>
      )}
    </div>
  );
}

function btnSaida(primario: boolean): React.CSSProperties {
  return {
    padding: "9px 14px",
    borderRadius: 9,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    border: primario ? "none" : "1px solid #1d3a2c",
    background: primario ? "#c9a24a" : "transparent",
    color: primario ? "#003b26" : "#8b949e",
  };
}

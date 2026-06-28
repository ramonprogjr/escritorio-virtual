"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { crmApiHeadersWithActor } from "@/lib/internal-api-headers-client";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import type { ParDuplicata, PessoaMergeRow, MotivoDuplicata } from "@/lib/crm/merge-pessoas";

// ── Tokens da marca (verde escuro + dourado) ────────────────────────────────
const C = {
  bg: "#0a140f",
  card: "#0f1c15",
  border: "#1d3a2c",
  gold: "#c9a24a",
  green: "#003b26",
  greenBtn: "#15623f",
  text: "#e6edf3",
  muted: "#8b949e",
  ok: "#3fb950",
  danger: "#EF4444",
};

const MOTIVO_LABEL: Record<MotivoDuplicata, string> = {
  documento: "mesmo CPF/CNPJ",
  telefone: "mesmo telefone",
  email: "mesmo e-mail",
};

function actorFromUser(user: User | null) {
  if (!user) return {};
  const meta = user.user_metadata as { name?: string } | undefined;
  return {
    id: user.id,
    email: user.email ?? undefined,
    name: meta?.name?.trim() || user.email?.split("@")[0],
  };
}

// Campos exibidos lado a lado na comparação.
const CAMPOS_COMPARA: { id: keyof PessoaMergeRow; label: string }[] = [
  { id: "nome", label: "Nome" },
  { id: "documento", label: "CPF/CNPJ" },
  { id: "telefone", label: "Telefone" },
  { id: "email", label: "E-mail" },
  { id: "tipo_pessoa", label: "Tipo" },
  { id: "empresa", label: "Empresa" },
  { id: "cidade", label: "Cidade" },
  { id: "estado", label: "UF" },
  { id: "codigo", label: "Código" },
];

function valor(p: PessoaMergeRow, campo: keyof PessoaMergeRow): string {
  const v = p[campo];
  if (v == null) return "";
  return String(v).trim();
}

export default function DuplicatasPage() {
  const narrow = useNarrowViewport();
  const isMobile = narrow === true;

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [pares, setPares] = useState<ParDuplicata[]>([]);
  const [mergeHabilitado, setMergeHabilitado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Passo: lista (a) → comparar (b) → confirmar (c)
  const [parAtivo, setParAtivo] = useState<ParDuplicata | null>(null);
  const [vencedorEscolhido, setVencedorEscolhido] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [mesclando, setMesclando] = useState(false);

  const actor = useMemo(() => actorFromUser(authUser), [authUser]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setAuthUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/crm/pessoas/duplicatas", {
        credentials: "include",
        headers: await crmApiHeadersWithActor(actor),
      });
      const data = (await res.json().catch(() => ({}))) as {
        data?: ParDuplicata[];
        mergeHabilitado?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setErro(data.error || "Não foi possível carregar as duplicatas.");
        return;
      }
      setPares(data.data ?? []);
      setMergeHabilitado(!!data.mergeHabilitado);
    } catch {
      setErro("Erro de rede ao carregar duplicatas.");
    } finally {
      setCarregando(false);
    }
  }, [actor]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function abrirComparacao(par: ParDuplicata) {
    setParAtivo(par);
    setVencedorEscolhido(par.vencedorId);
    setConfirmar(false);
    setErro(null);
  }

  function fecharComparacao() {
    setParAtivo(null);
    setVencedorEscolhido(null);
    setConfirmar(false);
  }

  async function executarMerge() {
    if (!parAtivo || !vencedorEscolhido) return;
    if (parAtivo.documentosConflitam) return; // documentos diferentes → não mesclável (a RPC também barra)
    const perdedorId =
      vencedorEscolhido === parAtivo.a.id ? parAtivo.b.id : parAtivo.a.id;
    setMesclando(true);
    setErro(null);
    try {
      const res = await fetch("/api/crm/pessoas/merge", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(await crmApiHeadersWithActor(actor)),
        },
        body: JSON.stringify({ vencedor_id: vencedorEscolhido, perdedor_id: perdedorId }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok !== true) {
        setErro(data.error || "Não foi possível mesclar.");
        return;
      }
      setSucesso("Cadastros mesclados. O registo perdedor foi arquivado (reversível).");
      fecharComparacao();
      await carregar();
    } catch {
      setErro("Erro de rede ao mesclar.");
    } finally {
      setMesclando(false);
    }
  }

  const venc = parAtivo
    ? vencedorEscolhido === parAtivo.a.id
      ? parAtivo.a
      : parAtivo.b
    : null;
  const perd = parAtivo
    ? vencedorEscolhido === parAtivo.a.id
      ? parAtivo.b
      : parAtivo.a
    : null;

  return (
    <div style={{ height: "100%", background: C.bg, color: C.text, overflow: "auto" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: isMobile ? "16px" : "24px 24px 48px" }}>
        {/* Cabeçalho */}
        <div style={{ marginBottom: 16 }}>
          <a
            href="/crm/cadastro"
            style={{ color: C.muted, fontSize: 13, textDecoration: "none" }}
          >
            ← Cadastros
          </a>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, margin: "6px 0 4px" }}>
            Duplicatas de contatos
          </h1>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
            Pares com o mesmo CPF/CNPJ, telefone ou e-mail. Reveja e mescle — o
            registo perdedor é arquivado, nunca apagado.
          </p>
        </div>

        {/* Banner de homologação (honesto, não fachada) */}
        {!mergeHabilitado && (
          <div
            role="status"
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(201,162,74,0.10)",
              border: `1px solid ${C.gold}55`,
              color: C.gold,
              fontSize: 13,
            }}
          >
            Em homologação — a fusão real está desativada até a aprovação do dono.
            Você pode revisar os pares; o botão «Mesclar» fica liberado quando a
            equipa ligar a funcionalidade.
          </div>
        )}

        {sucesso && (
          <div
            role="status"
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.35)",
              color: C.ok,
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>{sucesso}</span>
            <button
              type="button"
              onClick={() => setSucesso(null)}
              style={{ border: "none", background: "transparent", color: C.muted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
              aria-label="Fechar aviso"
            >
              ×
            </button>
          </div>
        )}

        {erro && !parAtivo && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.10)",
              border: `1px solid ${C.danger}66`,
              color: "#fca5a5",
              fontSize: 13,
            }}
          >
            {erro}
          </div>
        )}

        {/* PASSO A — lista de pares */}
        {carregando ? (
          <p style={{ color: C.muted, fontSize: 13 }}>Carregando…</p>
        ) : pares.length === 0 ? (
          <div
            style={{
              border: `1px dashed ${C.border}`,
              borderRadius: 12,
              padding: 28,
              textAlign: "center",
              color: C.muted,
              fontSize: 14,
            }}
          >
            Nenhuma duplicata encontrada. Sua base está limpa. 🎉
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ color: C.muted, fontSize: 12, margin: "0 0 2px" }}>
              {pares.length} par(es) candidato(s)
            </p>
            {pares.map((par) => (
              <button
                key={par.chave}
                type="button"
                onClick={() => abrirComparacao(par)}
                style={{
                  textAlign: "left",
                  background: C.card,
                  border: `1px solid ${par.documentosConflitam ? `${C.danger}66` : C.border}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  cursor: "pointer",
                  color: C.text,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <strong style={{ fontSize: 14 }}>{valor(par.a, "nome") || "—"}</strong>
                  <span style={{ color: C.muted }}>↔</span>
                  <strong style={{ fontSize: 14 }}>{valor(par.b, "nome") || "—"}</strong>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {par.motivos.map((m) => (
                    <span
                      key={m}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "rgba(201,162,74,0.12)",
                        color: C.gold,
                      }}
                    >
                      {MOTIVO_LABEL[m]}
                    </span>
                  ))}
                  {par.documentosConflitam && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "rgba(239,68,68,0.12)",
                        color: "#fca5a5",
                      }}
                    >
                      documentos diferentes — não mesclável
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PASSO B/C — comparação lado a lado (modal desktop / bottom-sheet mobile) */}
      {parAtivo && venc && perd && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={fecharComparacao}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            zIndex: 50,
            padding: isMobile ? 0 : 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: isMobile ? "16px 16px 0 0" : 16,
              width: "100%",
              maxWidth: isMobile ? "100%" : 760,
              maxHeight: isMobile ? "90vh" : "85vh",
              overflow: "auto",
              padding: isMobile ? 16 : 22,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Comparar e mesclar</h2>
              <button
                type="button"
                onClick={fecharComparacao}
                style={{ border: "none", background: "transparent", color: C.muted, cursor: "pointer", fontSize: 22, lineHeight: 1 }}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {parAtivo.documentosConflitam ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: "rgba(239,68,68,0.10)",
                  border: `1px solid ${C.danger}66`,
                  color: "#fca5a5",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                Estes dois cadastros têm <strong>documentos diferentes</strong>. Não
                são a mesma pessoa — o merge está bloqueado. Corrija os documentos
                se for um erro de digitação.
              </div>
            ) : (
              <p style={{ color: C.muted, fontSize: 12, margin: "0 0 12px" }}>
                Escolha qual cadastro <strong style={{ color: C.gold }}>vence</strong>{" "}
                (mantém os dados). O outro é arquivado; campos vazios do vencedor são
                preenchidos a partir do perdedor.
              </p>
            )}

            {/* Toggle inverter vencedor */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {[parAtivo.a, parAtivo.b].map((p) => {
                const ativo = vencedorEscolhido === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setVencedorEscolhido(p.id)}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      textAlign: "left",
                      borderRadius: 10,
                      padding: "10px 12px",
                      cursor: "pointer",
                      background: ativo ? "rgba(201,162,74,0.12)" : C.card,
                      border: ativo ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
                      color: C.text,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: ativo ? C.gold : C.muted }}>
                      {ativo ? "✓ VENCEDOR" : "Tornar vencedor"}
                    </span>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                      {valor(p, "nome") || "—"}
                    </div>
                    {valor(p, "codigo") && (
                      <div style={{ fontSize: 11, color: C.gold, fontFamily: "monospace" }}>
                        {valor(p, "codigo")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Comparação lado a lado dos campos */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
              {CAMPOS_COMPARA.map((c, i) => {
                const vv = valor(venc, c.id);
                const pv = valor(perd, c.id);
                const divergente = vv !== "" && pv !== "" && vv !== pv;
                const copiado = vv === "" && pv !== "";
                return (
                  <div
                    key={String(c.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "120px 1fr 1fr",
                      gap: isMobile ? 2 : 10,
                      padding: "8px 12px",
                      background: i % 2 === 0 ? C.card : "transparent",
                      borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                    }}
                  >
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{c.label}</span>
                    <span style={{ fontSize: 13, color: C.text }}>
                      <span style={{ fontSize: 10, color: C.gold, marginRight: 6 }}>VENCE</span>
                      {vv || <span style={{ color: C.muted }}>—</span>}
                    </span>
                    <span style={{ fontSize: 13, color: copiado ? C.ok : C.muted }}>
                      <span style={{ fontSize: 10, color: C.muted, marginRight: 6 }}>perde</span>
                      {pv || "—"}
                      {copiado && <span style={{ marginLeft: 6, fontSize: 10 }}>→ será copiado</span>}
                      {divergente && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: C.muted }}>
                          (guardado no histórico)
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {erro && parAtivo && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(239,68,68,0.10)",
                  border: `1px solid ${C.danger}66`,
                  color: "#fca5a5",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {erro}
              </div>
            )}

            {/* PASSO C — confirmar */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={fecharComparacao}
                style={{
                  background: "transparent",
                  color: C.muted,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

              {!confirmar ? (
                <button
                  type="button"
                  disabled={!mergeHabilitado || parAtivo.documentosConflitam}
                  title={
                    !mergeHabilitado
                      ? "Em homologação — aprovação do dono pendente"
                      : parAtivo.documentosConflitam
                        ? "Documentos diferentes — não mesclável"
                        : undefined
                  }
                  onClick={() => setConfirmar(true)}
                  style={{
                    background: !mergeHabilitado || parAtivo.documentosConflitam ? "#1d3a2c" : C.greenBtn,
                    color: !mergeHabilitado || parAtivo.documentosConflitam ? C.muted : "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: !mergeHabilitado || parAtivo.documentosConflitam ? "not-allowed" : "pointer",
                  }}
                >
                  {!mergeHabilitado ? "Em homologação" : "Mesclar"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={mesclando}
                  onClick={() => void executarMerge()}
                  style={{
                    background: C.greenBtn,
                    color: "#fff",
                    border: `2px solid ${C.gold}`,
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: mesclando ? "wait" : "pointer",
                    opacity: mesclando ? 0.7 : 1,
                  }}
                >
                  {mesclando ? "Mesclando…" : `Confirmar merge → manter ${valor(venc, "nome") || "vencedor"}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

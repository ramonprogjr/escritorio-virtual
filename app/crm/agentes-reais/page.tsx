"use client";

import { useEffect, useState } from "react";
import { Mic, Sparkles, ShieldCheck, Hand } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type ConsumoRow = {
  origem: string;
  modelo: string | null;
  creditos: number | null;
  ref_id: string | null;
  criado_em: string | null;
};

const ORIGEM_LABEL: Record<string, string> = {
  copiloto_intencao: "Comando interpretado",
  copiloto_voz: "Ação executada",
  copiloto_transcricao: "Transcrição de áudio",
};

function quando(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function CopilotoCentralPage() {
  const [rows, setRows] = useState<ConsumoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from("hub_ia_consumo")
        .select("origem, modelo, creditos, ref_id, criado_em")
        .like("origem", "copiloto_%")
        .order("criado_em", { ascending: false })
        .limit(20);
      if (vivo) {
        setRows((data as ConsumoRow[] | null) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const card: React.CSSProperties = {
    background: "#0f1d16",
    border: "1px solid #1d3a2c",
    borderRadius: 16,
    padding: 20,
  };

  return (
    <div style={{ minHeight: "100%", background: "#0a140f", padding: "1.25rem" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Hero */}
        <div style={{ ...card, display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{
            flexShrink: 0, width: 52, height: 52, borderRadius: "50%",
            border: "2px solid #c9a24a", background: "linear-gradient(180deg,#003b26,#1d5c3c)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#f0c869",
          }}>
            <Mic size={24} />
          </div>
          <div>
            <h1 style={{ color: "#e6edf3", fontSize: 19, fontWeight: 800, margin: 0 }}>Copiloto de Voz</h1>
            <p style={{ color: "#8b949e", fontSize: 13, lineHeight: 1.6, margin: "6px 0 0" }}>
              O botão verde flutuante aparece em <strong style={{ color: "#cdd9d2" }}>qualquer tela</strong> do CRM, no
              computador e no celular. Arraste para onde não atrapalhe. Toque, fale, e ele entende — sempre mostrando a
              transcrição ao vivo e confirmando antes de agir.
            </p>
          </div>
        </div>

        {/* Como usar */}
        <div style={card}>
          <h2 style={{ color: "#e6edf3", fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>Como usar</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { icon: <Hand size={16} />, t: "Toque para falar", d: "1 toque no botão verde inicia; toque de novo (ou fique 3s em silêncio) para parar." },
              { icon: <Sparkles size={16} />, t: "Veja em tempo real", d: "O que você fala aparece transcrito na hora. Ex.: «resumo deste lead», «métricas do escritório»." },
              { icon: <ShieldCheck size={16} />, t: "Confirma antes de mudar", d: "Perguntas respondem direto. Ações que alteram dados sempre mostram o que vão fazer e pedem sua confirmação." },
            ].map((it) => (
              <div key={it.t} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                  background: "#16271e", color: "#c9a24a",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{it.icon}</span>
                <div>
                  <p style={{ color: "#e6edf3", fontSize: 13, fontWeight: 700, margin: 0 }}>{it.t}</p>
                  <p style={{ color: "#8b949e", fontSize: 12.5, lineHeight: 1.5, margin: "2px 0 0" }}>{it.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Histórico */}
        <div style={card}>
          <h2 style={{ color: "#e6edf3", fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>Últimos comandos</h2>
          {loading ? (
            <p style={{ color: "#6e7681", fontSize: 12 }}>Carregando…</p>
          ) : rows.length === 0 ? (
            <p style={{ color: "#6e7681", fontSize: 12.5, lineHeight: 1.55, margin: 0 }}>
              Nenhum comando ainda. Toque no botão verde em qualquer tela e experimente: «mostra as métricas do escritório».
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((r, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  padding: "9px 12px", background: "#0a140f", border: "1px solid #1d3a2c", borderRadius: 10,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: "#cdd9d2", fontSize: 12.5, fontWeight: 600, margin: 0 }}>
                      {ORIGEM_LABEL[r.origem] || r.origem}
                    </p>
                    <p style={{ color: "#6e7681", fontSize: 11, margin: "2px 0 0" }}>{quando(r.criado_em)}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {r.modelo && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                        background: /claude/i.test(r.modelo) ? "#e3b34122" : "#2f9e8f22",
                        color: /claude/i.test(r.modelo) ? "#e3b341" : "#2f9e8f",
                      }}>{/claude/i.test(r.modelo) ? "Claude" : "Mistral"}</span>
                    )}
                    {typeof r.creditos === "number" && r.creditos !== 0 && (
                      <span style={{ fontSize: 11, color: "#c9a24a", fontWeight: 700 }}>
                        {Math.abs(r.creditos)} 🧱
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

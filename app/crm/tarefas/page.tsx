"use client";

import { useCallback, useEffect, useState } from "react";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import Link from "next/link";

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string | null;
  vencimento_em: string | null;
  lead_id: string | null;
  negocio_id: string | null;
};

export default function TarefasComerciaisPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/tarefas", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { data?: Tarefa[]; error?: string };
      if (!res.ok) {
        setErro(json.error || "Não foi possível carregar tarefas.");
        setTarefas([]);
        return;
      }
      setTarefas(json.data ?? []);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div style={{ minHeight: "100%", background: "#0d1117", color: "#e6edf3" }}>
      <CrmStickyPageHeader
        title="Tarefas comerciais"
        description="Próximas ações ligadas a leads e negócios (PDF Pt.14)"
      />
      <div style={{ padding: "16px 24px 32px", maxWidth: 960 }}>
        {erro ? (
          <p style={{ color: "#f87171", fontSize: 13 }}>{erro}</p>
        ) : loading ? (
          <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando…</p>
        ) : tarefas.length === 0 ? (
          <p style={{ color: "#8b949e", fontSize: 13 }}>
            Nenhuma tarefa registada. Use próxima ação nos leads/negócios ou crie via API quando a tabela
            estiver migrada.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {tarefas.map((t) => (
              <li
                key={t.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid #30363d",
                }}
              >
                <p style={{ margin: 0, fontWeight: 700 }}>{t.titulo}</p>
                {t.descricao ? (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8b949e" }}>{t.descricao}</p>
                ) : null}
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#8b949e" }}>
                  {t.status}
                  {t.prioridade ? ` · ${t.prioridade}` : ""}
                  {t.vencimento_em
                    ? ` · vence ${new Date(t.vencimento_em).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
                <div style={{ marginTop: 6, display: "flex", gap: 12, fontSize: 12 }}>
                  {t.lead_id ? (
                    <Link href={`/crm/leads/${t.lead_id}`} style={{ color: "#c9a24a" }}>
                      Lead
                    </Link>
                  ) : null}
                  {t.negocio_id ? (
                    <Link href={`/crm/negocios/${t.negocio_id}`} style={{ color: "#c9a24a" }}>
                      Negócio
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

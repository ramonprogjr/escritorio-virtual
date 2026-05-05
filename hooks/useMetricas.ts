"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface Metricas {
  leadsHoje: number;
  leadsAguardando: number;
  aprovacoesPendentes: number;
  conversasAtivas: number;
  agentesAtivos: number;
  receitaPotencial: number;
  loading: boolean;
}

const inicial: Metricas = {
  leadsHoje: 0,
  leadsAguardando: 0,
  aprovacoesPendentes: 0,
  conversasAtivas: 0,
  agentesAtivos: 0,
  receitaPotencial: 0,
  loading: true,
};

export function useMetricas() {
  const [metricas, setMetricas] = useState<Metricas>(inicial);

  const carregar = useCallback(async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const [leads, msgs, aprovs, agentes] = await Promise.all([
      supabase.from("hub_leads_crm").select("id, valor_estimado, estagio, criado_em, humano_responsavel"),
      supabase.from("hub_fila_mensagens").select("id, criado_em").eq("direcao", "entrada").eq("status", "pendente"),
      supabase.from("hub_aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("hub_agente_identidade").select("id", { count: "exact", head: true }).eq("ativo", true),
    ]);

    const todosLeads = leads.data || [];
    const leadsHoje = todosLeads.filter(l => new Date(l.criado_em) >= hoje).length;
    const ativos = todosLeads.filter(l => !["ganho", "perdido"].includes(l.estagio || ""));
    const aguardando = ativos.filter(l => !l.humano_responsavel).length;
    const receitaPotencial = ativos.reduce((s, l) => s + (l.valor_estimado || 0), 0);

    setMetricas({
      leadsHoje,
      leadsAguardando: aguardando,
      aprovacoesPendentes: aprovs.count || 0,
      conversasAtivas: (msgs.data || []).length,
      agentesAtivos: agentes.count || 0,
      receitaPotencial,
      loading: false,
    });
  }, []);

  useEffect(() => {
    carregar();
    const sub = supabase
      .channel("metricas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_fila_mensagens" }, carregar)
      .subscribe();
    const interval = setInterval(carregar, 60000);
    return () => {
      supabase.removeChannel(sub);
      clearInterval(interval);
    };
  }, [carregar]);

  return metricas;
}

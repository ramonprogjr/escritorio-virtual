"use client";

import { useCallback, useEffect, useState } from "react";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { useCrmRole } from "@/hooks/useCrmRole";
import type { TenantSettings } from "@/app/api/crm/tenant-settings/route";

type HealthCheck = {
  name: string;
  required: boolean;
  configured: boolean;
  area: string;
};

type HealthResponse = {
  status: "ok" | "degraded";
  missingRequired: string[];
  checks: HealthCheck[];
};

type FollowupRow = { passo: number; mercado: string; horas_espera: number };

const LABELS: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "Supabase URL",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "Supabase anon key",
  SUPABASE_SERVICE_ROLE_KEY: "Supabase service role",
  INTERNAL_API_KEY: "Chave API interna",
  CRON_SECRET: "Segredo dos ciclos",
  WEBHOOK_SECRET: "Segredo do webhook WhatsApp",
  ANTHROPIC_API_KEY: "Anthropic API key",
  UAZAPI_BASE_URL: "WhatsApp base URL",
  UAZAPI_INSTANCE_TOKEN: "WhatsApp token da instância",
  DEFAULT_TENANT_ID: "Tenant padrão server",
  WINDSOR_API_KEY: "Windsor.ai",
};

export default function Configuracoes() {
  const { isOwner } = useCrmRole();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [followup, setFollowup] = useState<FollowupRow[]>([]);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>({
    horario_inicio: "08:00",
    horario_fim: "18:00",
    timezone: "America/Sao_Paulo",
    distribuicao_auto: true,
    distribuicao_validacao_horas: 24,
  });
  const [salvandoFollowup, setSalvandoFollowup] = useState(false);
  const [salvandoHorario, setSalvandoHorario] = useState(false);
  const [salvandoDistribuicao, setSalvandoDistribuicao] = useState(false);

  const carregar = useCallback(async () => {
    const [f, t] = await Promise.all([
      fetch("/api/hub/followup-config", { headers: internalApiHeaders() }).then((r) =>
        r.json()
      ) as Promise<{ rows?: FollowupRow[] }>,
      fetch("/api/crm/tenant-settings", { headers: internalApiHeaders() }).then((r) =>
        r.json()
      ) as Promise<{ settings?: TenantSettings }>,
    ]);
    setFollowup(f.rows ?? []);
    if (t.settings) setTenantSettings(t.settings);
  }, []);

  useEffect(() => {
    carregar().catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar"));
  }, [carregar]);

  // Ambiente/env vars (segredos da PLATAFORMA) — só owner/super-admin.
  useEffect(() => {
    if (!isOwner) {
      setHealth(null);
      return;
    }
    let cancelled = false;
    fetch("/api/health")
      .then((r) => r.json() as Promise<HealthResponse>)
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => {
        /* bloco de diagnóstico opcional — não bloqueia a tela */
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  async function salvarFollowup() {
    setSalvandoFollowup(true);
    setErro(null);
    try {
      const res = await fetch("/api/hub/followup-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          updates: followup.map((r) => ({
            passo: r.passo,
            mercado: r.mercado,
            horas_espera: r.horas_espera,
          })),
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setErro(j.error || "Falha ao guardar follow-up");
        return;
      }
      const j = (await res.json()) as { rows?: FollowupRow[] };
      setFollowup(j.rows ?? followup);
    } finally {
      setSalvandoFollowup(false);
    }
  }

  async function salvarTenantSettings(
    setBusy: (v: boolean) => void,
    msgErro: string
  ) {
    setBusy(true);
    setErro(null);
    try {
      const res = await fetch("/api/crm/tenant-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify(tenantSettings),
      });
      const j = (await res.json()) as { error?: string; settings?: TenantSettings };
      if (!res.ok) {
        setErro(j.error || msgErro);
        return;
      }
      if (j.settings) setTenantSettings(j.settings);
    } finally {
      setBusy(false);
    }
  }

  const salvarHorario = () =>
    salvarTenantSettings(setSalvandoHorario, "Falha ao guardar horário (requer admin)");
  const salvarDistribuicao = () =>
    salvarTenantSettings(setSalvandoDistribuicao, "Falha ao guardar distribuição (requer admin)");

  return (
    <div className="flex min-h-full flex-col bg-[#0a140f]">
      <CrmStickyPageHeader
        title="Configurações"
        description="Ambiente, follow-up e horário comercial"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {erro && (
          <p className="mb-4 rounded-lg border border-[#f8514966] bg-[#1a0a0a] px-3 py-2 text-sm text-[#ff7b72]">
            {erro}
          </p>
        )}

        {/* Ambiente / env vars = segredos da PLATAFORMA. Só owner/super-admin vê;
            o fornecedor (gestor) não pode ver chaves/tokens do ambiente. */}
        {isOwner && (
          <div className="mb-6 rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-[#e6edf3]">Ambiente e integrações</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  health?.status === "ok" ? "bg-[#23863633] text-[#3fb950]" : "bg-[#d2992226] text-[#e3b341]"
                }`}
              >
                {health?.status === "ok" ? "Completo" : "Atenção"}
              </span>
            </div>
            {health && (
              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                {health.checks.map((check) => (
                  <div
                    key={check.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#1d3a2c] bg-[#0a140f] px-3 py-2"
                  >
                    <p className="truncate text-xs font-bold text-[#e6edf3]">
                      {LABELS[check.name] || check.name}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                        check.configured ? "bg-[#23863633] text-[#3fb950]" : "bg-[#f8514926] text-[#ff7b72]"
                      }`}
                    >
                      {check.configured ? "OK" : "Falta"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-6 rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4">
          <p className="text-sm font-bold text-[#e6edf3]">Horário comercial</p>
          <p className="mt-1 text-xs text-[#8b949e]">Salvo nas configurações do escritório (requer admin).</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold uppercase text-[#8b949e]">
              Início
              <input
                type="time"
                value={tenantSettings.horario_inicio ?? "08:00"}
                onChange={(e) =>
                  setTenantSettings((s) => ({ ...s, horario_inicio: e.target.value }))
                }
                className="mt-1 w-full min-h-10 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-2 text-sm text-[#e6edf3]"
              />
            </label>
            <label className="text-xs font-bold uppercase text-[#8b949e]">
              Fim
              <input
                type="time"
                value={tenantSettings.horario_fim ?? "18:00"}
                onChange={(e) =>
                  setTenantSettings((s) => ({ ...s, horario_fim: e.target.value }))
                }
                className="mt-1 w-full min-h-10 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-2 text-sm text-[#e6edf3]"
              />
            </label>
            <label className="col-span-2 text-xs font-bold uppercase text-[#8b949e] sm:col-span-1">
              Fuso
              <input
                value={tenantSettings.timezone ?? "America/Sao_Paulo"}
                onChange={(e) => setTenantSettings((s) => ({ ...s, timezone: e.target.value }))}
                className="mt-1 w-full min-h-10 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-2 text-sm text-[#e6edf3]"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={salvandoHorario}
            onClick={() => void salvarHorario()}
            className="mt-3 min-h-10 rounded-lg bg-[#c9a24a] px-4 text-xs font-bold text-[#003b26] disabled:opacity-50"
          >
            {salvandoHorario ? "Salvando…" : "Guardar horário"}
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4">
          <p className="text-sm font-bold text-[#e6edf3]">Distribuição de leads</p>
          <p className="mt-1 text-xs text-[#8b949e]">
            IA sugere parceiro após qualificação; gestor valida em Leads → Encaminhamentos pendentes.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-[#e6edf3]">
            <input
              type="checkbox"
              checked={tenantSettings.distribuicao_auto !== false}
              onChange={(e) =>
                setTenantSettings((s) => ({ ...s, distribuicao_auto: e.target.checked }))
              }
            />
            Sugestão automática ativa (deste escritório)
          </label>
          <label className="mt-3 block text-xs font-bold uppercase text-[#8b949e]">
            Prazo validação humana (horas)
            <input
              type="number"
              min={1}
              max={168}
              value={tenantSettings.distribuicao_validacao_horas ?? 24}
              onChange={(e) =>
                setTenantSettings((s) => ({
                  ...s,
                  distribuicao_validacao_horas: Number(e.target.value) || 24,
                }))
              }
              className="mt-1 w-full max-w-[120px] min-h-10 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-2 text-sm text-[#e6edf3]"
            />
          </label>
          <button
            type="button"
            disabled={salvandoDistribuicao}
            onClick={() => void salvarDistribuicao()}
            className="mt-3 min-h-10 rounded-lg bg-[#c9a24a] px-4 text-xs font-bold text-[#003b26] disabled:opacity-50"
          >
            {salvandoDistribuicao ? "Salvando…" : "Guardar distribuição"}
          </button>
        </div>

        <div className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4">
          <p className="text-sm font-bold text-[#e6edf3]">Cadência de follow-up</p>
          <p className="mt-1 text-xs text-[#8b949e]">Horas entre cada passo do follow-up automático.</p>
          {followup.length === 0 ? (
            <p className="mt-3 text-sm text-[#8b949e]">Nenhuma cadência ativa. Configure em Automações.</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {followup.map((r, i) => (
                <li
                  key={`${r.mercado}-${r.passo}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[#1d3a2c] bg-[#0a140f] px-3 py-2 text-xs"
                >
                  <span className="font-bold text-[#c9a24a]">
                    {r.mercado} · passo {r.passo}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={r.horas_espera}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setFollowup((rows) =>
                        rows.map((row, j) => (j === i ? { ...row, horas_espera: v } : row))
                      );
                    }}
                    className="w-20 rounded border border-[#1d3a2c] bg-[#16271e] px-2 py-1 text-[#e6edf3]"
                  />
                  <span className="text-[#8b949e]">h</span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={salvandoFollowup || followup.length === 0}
            onClick={() => void salvarFollowup()}
            className="mt-3 min-h-10 rounded-lg border border-[#c9a24a55] bg-[#16271e] px-4 text-xs font-bold text-[#c9a24a] disabled:opacity-50"
          >
            {salvandoFollowup ? "Salvando…" : "Guardar follow-up"}
          </button>
        </div>
      </div>
    </div>
  );
}

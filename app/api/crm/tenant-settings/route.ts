import { NextRequest, NextResponse } from "next/server";
import { crmDb, crmConfigError } from "@/lib/crm/supabase-server";
import { defaultTenantId, isMissingPgColumn, tenantIdFromRequest } from "@/lib/tenant-default";
import { requireCrmAdmin, requireInternalApiKey } from "@/lib/crm/crm-api-auth";

export type TenantSettings = {
  horario_inicio?: string;
  horario_fim?: string;
  timezone?: string;
  distribuicao_auto?: boolean;
  distribuicao_validacao_horas?: number;
};

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const { data, error } = await crmDb()
    .from("hub_tenants")
    .select("id, slug, nome_exibicao, settings")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) {
    if (isMissingPgColumn(error, "settings")) {
      return NextResponse.json({ settings: {} as TenantSettings });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings = (data?.settings as TenantSettings) ?? {};
  return NextResponse.json({ tenantId, settings });
}

export async function PATCH(request: NextRequest) {
  const adminErr = await requireCrmAdmin(request);
  if (adminErr) return adminErr;

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const body = (await request.json().catch(() => ({}))) as TenantSettings;

  const { data: atual } = await crmDb()
    .from("hub_tenants")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();

  const prev = (atual?.settings as TenantSettings) ?? {};

  const settings: TenantSettings = {
    ...prev,
    horario_inicio: body.horario_inicio?.trim() || prev.horario_inicio || "08:00",
    horario_fim: body.horario_fim?.trim() || prev.horario_fim || "18:00",
    timezone: body.timezone?.trim() || prev.timezone || "America/Sao_Paulo",
    distribuicao_auto:
      typeof body.distribuicao_auto === "boolean"
        ? body.distribuicao_auto
        : prev.distribuicao_auto ?? true,
    distribuicao_validacao_horas:
      typeof body.distribuicao_validacao_horas === "number"
        ? body.distribuicao_validacao_horas
        : prev.distribuicao_validacao_horas ?? 24,
  };

  const { data, error } = await crmDb()
    .from("hub_tenants")
    .update({ settings })
    .eq("id", tenantId)
    .select("settings")
    .maybeSingle();

  if (error) {
    if (isMissingPgColumn(error, "settings")) {
      return NextResponse.json(
        {
          error:
            "Coluna settings em hub_tenants ausente. Aplique a migração 20260522180000_hub_tenants_settings.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data?.settings ?? settings });
}

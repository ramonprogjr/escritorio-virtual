import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId } from "@/lib/tenant-default";
import { checkPortalVerifyRateLimit } from "@/lib/portal-rate-limit";
import { ESPECIALIDADES } from "@/lib/crm/especialidades";

/**
 * Auto-cadastro PÚBLICO de especialista (mão de obra) via link de convite.
 * SEM login. `por` (na query/body) = userId do convidador → grava em cadastrado_por
 * para o rastreio "mão de obra de quem". origem = "link".
 * Hoje single-tenant (defaultTenantId); multi-tenant deriva o tenant do convidador (B3.9).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESP_SET = new Set<string>(ESPECIALIDADES);

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const ip = clientIp(request);
  const rl = checkPortalVerifyRateLimit(`esp-signup:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(body.nome || "").trim();
  const telefone = String(body.telefone || "").trim();
  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (telefone.replace(/\D/g, "").length < 10)
    return NextResponse.json({ error: "Telefone com DDD obrigatório" }, { status: 400 });

  const especialidades = (Array.isArray(body.especialidades) ? body.especialidades : [])
    .map((x) => String(x))
    .filter((x) => ESP_SET.has(x));
  if (especialidades.length === 0)
    return NextResponse.json({ error: "Escolha ao menos uma especialidade" }, { status: 400 });

  const por = String(body.por || "").trim();
  const convidadoPor = UUID_RE.test(por) ? por : null;

  const tenantId = defaultTenantId();
  const year = new Date().getFullYear();
  const { count } = await crmDb().from("hub_especialistas").select("*", { count: "exact", head: true });
  const codigo = `ESP-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

  const row = {
    codigo,
    nome,
    telefone,
    cidade: body.cidade ? String(body.cidade).trim() : null,
    uf: body.uf ? String(body.uf).trim().toUpperCase() : null,
    especialidades,
    especialidade_principal: especialidades[0],
    experiencia: body.experiencia ? String(body.experiencia) : null,
    tem_equipe: body.tem_equipe === true,
    origem: "link",
    cadastrado_por: convidadoPor,
    tenant_id: tenantId,
  };

  const { error } = await crmDb().from("hub_especialistas").insert(row).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, codigo }, { status: 201 });
}

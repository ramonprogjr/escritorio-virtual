import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { normalizarIdUuid } from "@/lib/crm/uuid-crm";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";
import {
  actorFromRequestHeaders,
  registrarAuditoriaCrm,
} from "@/lib/crm/registrar-auditoria-crm";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function configError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL nao esta definida no servidor.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY nao esta definida no servidor.";
  }
  return null;
}

/** Mapeia mensagens da RPC para status HTTP. */
function statusFromRpcMessage(msg: string): number {
  const m = msg.toLowerCase();
  if (m.includes("não encontrad") || m.includes("nao encontrad")) return 404;
  if (
    m.includes("documentos diferentes") ||
    m.includes("tenants diferentes") ||
    m.includes("fora do tenant") ||
    m.includes("já está arquivada") ||
    m.includes("ja esta arquivada") ||
    m.includes("mesmo registo") ||
    m.includes("obrigatórios") ||
    m.includes("obrigatorios")
  ) {
    return 409;
  }
  if (m.includes("does not exist") || m.includes("function")) return 503;
  return 500;
}

/**
 * POST /api/crm/pessoas/merge
 * Gestor/owner-only. GATED pela flag NEXT_PUBLIC_CRM_MERGE_DUPLICATAS — se OFF,
 * retorna 403 "merge em homologação" (detecção/UI seguem ativas; só a ação real
 * fica travada até o dono aprovar o 1º par).
 * Body: { vencedor_id, perdedor_id }.
 */
export async function POST(request: NextRequest) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  // Gate da feature: a ação real de mesclar fica desligada até aprovação do dono.
  if (!crmFeatureFlags.mergeDuplicatas()) {
    return NextResponse.json(
      {
        error:
          "Merge em homologação — a fusão real está desativada até a aprovação do dono.",
        code: "merge_em_homologacao",
      },
      { status: 403 }
    );
  }

  const err = configError();
  if (err) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: err },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const vencedorId = normalizarIdUuid(String(body.vencedor_id ?? ""));
  const perdedorId = normalizarIdUuid(String(body.perdedor_id ?? ""));
  if (!vencedorId || !perdedorId) {
    return NextResponse.json(
      { error: "vencedor_id e perdedor_id são obrigatórios (UUID)." },
      { status: 400 }
    );
  }
  if (vencedorId === perdedorId) {
    return NextResponse.json(
      { error: "Vencedor e perdedor não podem ser o mesmo registo." },
      { status: 400 }
    );
  }

  const supabase = db();

  const { data, error } = await supabase.rpc("crm_merge_pessoas", {
    p_vencedor: vencedorId,
    p_perdedor: perdedorId,
    p_tenant: g.ctx.tenantId,
    p_user: g.ctx.userId,
  });

  if (error) {
    const msg = error.message || "Falha ao mesclar pessoas.";
    return NextResponse.json({ error: msg }, { status: statusFromRpcMessage(msg) });
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.ok !== true) {
    const msg = typeof result.error === "string" ? result.error : "Falha ao mesclar pessoas.";
    return NextResponse.json({ error: msg }, { status: statusFromRpcMessage(msg) });
  }

  // Auditoria (best-effort; não bloqueia o merge se a tabela de log falhar).
  const actor = actorFromRequestHeaders(request.headers);
  await registrarAuditoriaCrm(supabase, {
    tabela: "hub_pessoas",
    operacao: "atualizar",
    motivo: `Merge de pessoas: ${perdedorId} → ${vencedorId}`,
    actor,
    metadata: {
      vencedor_id: vencedorId,
      perdedor_id: perdedorId,
      resultado: result,
    },
  });

  return NextResponse.json({ ok: true, ...result });
}

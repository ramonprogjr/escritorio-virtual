import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { pausarTelefone, retomarTelefone } from "@/lib/whatsapp/pausa-atendimento";
import { sincronizarEtiquetaPausa, resolverTokenInstanciaAtiva } from "@/lib/whatsapp/sync-etiquetas-pausa";

/**
 * Gestão da deny-list de pausa do atendimento (segurança do go-live).
 *  GET                          → lista as pausas atuais.
 *  POST {action:'sync'}         → sincroniza a etiqueta "pausa" do WhatsApp agora (botão click-and-go).
 *  POST {action:'seed', telefones:[...]} → semeia a lista de clientes ativos (fonte='seed').
 *  POST {action:'pausar', telefone}      → pausa manual por telefone (fonte='painel').
 *  POST {action:'retomar', telefone}     → remove pausas comando/painel/seed do número.
 * Operação privilegiada — exige gestor/owner.
 */

export async function GET(request: NextRequest) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;
  const supabase = crmDb();
  const { data, error } = await supabase
    .from("hub_atendimento_pausas")
    .select("telefone, fonte, labelid, motivo, criado_por, criado_em")
    .order("criado_em", { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, total: data?.length ?? 0, pausas: data ?? [] });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;
  const supabase = crmDb();
  const tenantId = g.ctx.tenantId;

  let body: { action?: string; telefone?: string; telefones?: string[]; nomeEtiqueta?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const action = String(body.action || "").trim().toLowerCase();

  if (action === "sync") {
    const tok = await resolverTokenInstanciaAtiva(supabase);
    if (!tok) return NextResponse.json({ error: "Nenhuma instância WhatsApp conectada para sincronizar." }, { status: 409 });
    const res = await sincronizarEtiquetaPausa(supabase, {
      instanceToken: tok.token,
      nomeEtiqueta: typeof body.nomeEtiqueta === "string" ? body.nomeEtiqueta : undefined,
      tenantId,
    });
    return NextResponse.json(res, { status: res.ok ? 200 : 502 });
  }

  if (action === "seed") {
    const tels = Array.isArray(body.telefones) ? body.telefones.filter((t) => typeof t === "string") : [];
    if (!tels.length) return NextResponse.json({ error: "Informe telefones[] (a lista dos clientes ativos)." }, { status: 400 });
    let adicionados = 0;
    const falhas: string[] = [];
    for (const t of tels) {
      const r = await pausarTelefone(supabase, { telefone: t, fonte: "seed", motivo: "cliente_ativo_seed", criadoPor: "wendel", tenantId });
      if (r.ok) adicionados++;
      else falhas.push(String(t));
    }
    return NextResponse.json({ ok: true, recebidos: tels.length, adicionados, falhas });
  }

  if (action === "pausar") {
    if (!body.telefone) return NextResponse.json({ error: "Informe telefone." }, { status: 400 });
    const r = await pausarTelefone(supabase, { telefone: body.telefone, fonte: "painel", motivo: "pausa_manual", criadoPor: "wendel", tenantId });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  if (action === "retomar") {
    if (!body.telefone) return NextResponse.json({ error: "Informe telefone." }, { status: 400 });
    const r = await retomarTelefone(supabase, { telefone: body.telefone });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }

  return NextResponse.json({ error: "action inválida — use sync | seed | pausar | retomar." }, { status: 400 });
}

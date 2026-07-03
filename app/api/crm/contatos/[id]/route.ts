import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

type Params = { params: Promise<{ id: string }> };

const SELECT =
  "id, nome, telefone, email, cargo, canal, ativo, receber_novo_lead, receber_aprovacao, receber_encaminhamento, criado_em";

const CANAIS = new Set(["whatsapp", "email", "ambos"]);

const EDITAVEIS = [
  "nome",
  "telefone",
  "email",
  "cargo",
  "canal",
  "ativo",
  "receber_novo_lead",
  "receber_aprovacao",
  "receber_encaminhamento",
] as const;

/** Pré-checa que o contato pertence ao tenant do chamador (null-safe p/ legado). 404 se divergir. */
async function tenantGuard(id: string, tenantId: string) {
  const { data } = await crmDb()
    .from("hub_contatos_notificacao")
    .select("tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { notFound: true as const };
  const tid = (data as { tenant_id: string | null }).tenant_id;
  if (tid && tid !== tenantId) return { notFound: true as const };
  return { ok: true as const };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const guard = await tenantGuard(id, g.ctx.tenantId);
  if ("notFound" in guard) return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.nome === "string" && !body.nome.trim())
    return NextResponse.json({ error: "Nome não pode ficar vazio." }, { status: 400 });

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const k of EDITAVEIS) {
    if (k in body) {
      if (k === "canal") {
        const canal = String(body.canal || "whatsapp");
        patch.canal = CANAIS.has(canal) ? canal : "whatsapp";
      } else if (k === "email" || k === "cargo") {
        patch[k] = body[k] ? String(body[k]) : null;
      } else {
        patch[k] = body[k];
      }
    }
  }

  // tenant_id nunca é editável aqui (não permitir mover contato de tenant via PATCH).
  const { data, error } = await crmDb()
    .from("hub_contatos_notificacao")
    .update(patch)
    .eq("id", id)
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const guard = await tenantGuard(id, g.ctx.tenantId);
  if ("notFound" in guard) return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });

  // Princípio "só arquiva": nunca hard-delete — desativa (ativo=false) e o registro permanece
  // no banco. A listagem (GET) esconde ativo=false, então o contato some da tela.
  const { error } = await crmDb()
    .from("hub_contatos_notificacao")
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

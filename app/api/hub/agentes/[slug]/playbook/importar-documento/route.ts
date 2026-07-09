import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { requireIaRateLimit } from "@/lib/ia/rate-limit-ia";
import { extrairTextoDocumentoRag } from "@/lib/hub/rag";

/**
 * F3 (plano de agentes) — Documento → instrução. Extrai o TEXTO de um PDF/DOCX/ODT/MD/TXT e devolve, SEM
 * armazenar nem publicar: o cliente mostra o texto no editor para REVISÃO antes de publicar (extração de
 * PDF é imperfeita). Reaproveita extrairTextoDocumentoRag (mesma extração do RAG) — zero nova dependência.
 * requireCrmGestor + isolamento de tenant fail-closed. Não expõe segredos.
 */

const MAX_DOC_BYTES = 8 * 1024 * 1024; // 8 MB — só extração em memória, nada persistido

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "servico_indisponivel" }, { status: 503 });
  }

  const g = await requireCrmGestor(req);
  if ("error" in g) return g.error;

  // Rate-limit (regra da casa): a extração é 100% síncrona (regex sobre 8 MB + inflate) — anti-DoS de CPU.
  const limite = requireIaRateLimit(`importar-documento:${g.ctx.tenantId}`, 10);
  if (limite) return limite;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  // Isolamento fail-closed: só importa para agente do tenant do caller.
  const { data: alvo, error: alvoErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();
  if (alvoErr) {
    console.error("[importar-documento] load agente:", alvoErr.message);
    return NextResponse.json({ error: "erro_interno" }, { status: 500 });
  }
  const t = (alvo as { tenant_id?: string | null } | null)?.tenant_id;
  if (!alvo || String(t ?? "") !== g.ctx.tenantId) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "form_invalido" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "arquivo_obrigatorio" }, { status: 400 });
  }
  // Allowlist server-side espelhando o contrato do cliente (só .pdf/.docx) — não expor parsers extras
  // (xlsx/pptx/odt/rtf/html) que a feature não pretende servir. Defesa contra POST forjado.
  const nome = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  const formatoOk =
    nome.endsWith(".pdf") ||
    nome.endsWith(".docx") ||
    mime === "application/pdf" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!formatoOk) {
    return NextResponse.json({ error: "formato_invalido" }, { status: 400 });
  }
  if (file.size > MAX_DOC_BYTES) {
    return NextResponse.json({ error: "Arquivo acima de 8 MB." }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "leitura_falhou" }, { status: 400 });
  }

  const out = extrairTextoDocumentoRag(file.name, file.type, buffer);
  if (!out.ok) {
    // Erro legível (ex.: PDF digitalizado sem texto) — vem da própria extração, sem segredo.
    return NextResponse.json({ error: out.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, texto: out.texto, nome: file.name });
}

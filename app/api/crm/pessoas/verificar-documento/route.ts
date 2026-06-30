import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { buscarPessoaPorDocumento } from "@/lib/crm/buscar-pessoa-documento";
import {
  documentoCompleto,
  documentoValido,
  mensagemDocumentoInvalido,
  normalizarDocumento,
} from "@/lib/crm/documento-brasil";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** GET ?documento=...&tipo_pessoa=PF|PJ — valida formato e indica se já existe no hub. */
export async function GET(request: NextRequest) {
  // Exige sessão CRM: este endpoint testa CPF/CNPJ contra a base — não pode ser oráculo aberto.
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      { error: "Supabase não configurado no servidor." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo_pessoa");
  const raw = searchParams.get("documento") || "";

  if (tipo !== "PF" && tipo !== "PJ") {
    return NextResponse.json({ error: "tipo_pessoa deve ser PF ou PJ." }, { status: 400 });
  }

  const documento = normalizarDocumento(raw);
  if (!documento) {
    return NextResponse.json({ disponivel: true, valido: false, motivo: "vazio" });
  }

  if (!documentoCompleto(tipo, documento)) {
    return NextResponse.json({
      disponivel: false,
      valido: false,
      error: tipo === "PF" ? "Informe os 11 dígitos do CPF." : "Informe os 14 dígitos do CNPJ.",
    });
  }

  if (!documentoValido(tipo, documento)) {
    return NextResponse.json({
      disponivel: false,
      valido: false,
      error: mensagemDocumentoInvalido(tipo),
    });
  }

  const supabase = db();
  // Escopo por tenant: não confirma documento de outro escritório (anti-enumeração / LGPD).
  const existente = await buscarPessoaPorDocumento(supabase, tipo, documento, g.ctx.tenantId);

  if (existente) {
    const label = tipo === "PF" ? "CPF" : "CNPJ";
    // 409-like: NÃO expõe nome/código/id de outro registo — só o booleano + mensagem genérica.
    return NextResponse.json({
      disponivel: false,
      valido: true,
      duplicado: true,
      error: `${label} já cadastrado neste escritório.`,
    });
  }

  return NextResponse.json({ disponivel: true, valido: true, duplicado: false });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gerarCodigoParceiro } from "@/lib/crm/parceiro-cadastro";
import {
  insertParceiroCaptacaoCompat,
  insertParceiroCompat,
  insertParceiroLogCompat,
} from "@/lib/crm/parceiro-compat";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { checkPortalVerifyRateLimit } from "@/lib/portal-rate-limit";

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function db() {
  // fail-closed: sem fallback para a anon key (Batch 3).
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function buscarParceiroDuplicadoPublico(
  supabase: SupabaseClient,
  params: { field: "telefone" | "cpf" | "cnpj"; value: string }
) {
  let { data, error } = await supabase
    .from("hub_parceiros")
    .select("id, nome, codigo")
    .eq(params.field, params.value)
    .maybeSingle();

  if (error && isMissingPgColumn(error, "codigo")) {
    ({ data, error } = await supabase
      .from("hub_parceiros")
      .select("id, nome")
      .eq(params.field, params.value)
      .maybeSingle());
  }

  if (error) throw error;
  return data as { id: string; nome?: string | null; codigo?: string | null } | null;
}

export async function POST(request: NextRequest) {
  // Rate-limit: máx. 5 cadastros por IP a cada 15 minutos (H-SEC-2).
  const ip = clientIp(request);
  const rl = checkPortalVerifyRateLimit(`parceiro-signup:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { erro: "Muitas tentativas. Tente novamente mais tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const supabase = db();
  if (!supabase) return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });
  const tenantId = defaultTenantId();

  try {
    const body = await request.json();
    const {
      tipo_pessoa,
      perfil,
      nome,
      razao_social,
      nome_contato,
      telefone,
      email,
      cpf,
      cnpj,
      mercado,
      cidade,
      estado,
    } = body as Record<string, string | undefined>;

    const tel = String(telefone || "").replace(/\D/g, "");
    const nomeFinal =
      tipo_pessoa === "PJ"
        ? String(razao_social || nome || "").trim()
        : String(nome || "").trim();

    if (!nomeFinal || tel.length < 10) {
      return NextResponse.json(
        { erro: "Nome e telefone são obrigatórios." },
        { status: 400 }
      );
    }

    const dupTel = await buscarParceiroDuplicadoPublico(supabase, {
      field: "telefone",
      value: tel,
    });

    if (dupTel) {
      // 409 genérico: rota pública não-autenticada não revela id/código internos.
      return NextResponse.json(
        { erro: "Telefone já cadastrado na rede." },
        { status: 409 }
      );
    }

    const cpfDigits = cpf ? String(cpf).replace(/\D/g, "") : null;
    const cnpjDigits = cnpj ? String(cnpj).replace(/\D/g, "") : null;

    if (cpfDigits) {
      const dup = await buscarParceiroDuplicadoPublico(supabase, {
        field: "cpf",
        value: cpfDigits,
      });
      if (dup) {
        return NextResponse.json(
          { erro: "CPF já cadastrado." },
          { status: 409 }
        );
      }
    }
    if (cnpjDigits) {
      const dup = await buscarParceiroDuplicadoPublico(supabase, {
        field: "cnpj",
        value: cnpjDigits,
      });
      if (dup) {
        return NextResponse.json(
          { erro: "CNPJ já cadastrado." },
          { status: 409 }
        );
      }
    }

    const codigo = await gerarCodigoParceiro(supabase);
    const especialidade = String(body.especialidade || "").trim() || null;

    const { data: parceiro, error: errP } = await insertParceiroCompat(supabase, {
        codigo,
        nome: nomeFinal,
        telefone: tel,
        email: email?.trim() || null,
        cpf: tipo_pessoa === "PF" ? cpfDigits : null,
        cnpj: tipo_pessoa === "PJ" ? cnpjDigits : null,
        especialidade,
        mercado: mercado?.trim() || null,
        cidade: cidade?.trim() || null,
        estado: estado?.trim()?.toUpperCase() || null,
        comissao_pct: 5,
        status: "captacao",
      }, tenantId);

    if (errP || !parceiro) {
      return NextResponse.json(
        { erro: errP?.message || "Erro ao gravar cadastro." },
        { status: 500 }
      );
    }

    const captacaoWarn = await insertParceiroCaptacaoCompat(supabase, {
      parceiro_id: parceiro.id,
      estagio: "interessado",
      origem: "link_publico_rede",
      canal: "formulario_web",
    });

    const logWarn = await insertParceiroLogCompat(supabase, {
      parceiro_id: parceiro.id,
      evento: "cadastro_link_publico",
      descricao: `Cadastro via link da rede — ${codigo} (${tipo_pessoa}, ${perfil}, ${mercado || "—"})`,
      feito_por: "parceiro",
    });

    const warnings = [captacaoWarn, logWarn].filter(Boolean);

    // Sucesso público: devolve só o código de rastreio (a UI exibe). Sem UUID interno.
    return NextResponse.json({
      codigo: parceiro.codigo ?? codigo,
      status: "criado",
      warning: warnings.length ? warnings.join(" | ") : null,
    });
  } catch (err) {
    // Rota pública: loga o detalhe no servidor, devolve msg genérica (não vaza schema Postgres).
    console.error("[erro-publico:parceiro-cadastro]", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { erro: "Não foi possível concluir o cadastro. Tente novamente." },
      { status: 500 }
    );
  }
}

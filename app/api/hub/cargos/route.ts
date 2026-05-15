import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { slugifyCargoSlug } from "@/lib/hub/cargo-slug";
import {
  modeloAltoValorForHubInsert,
  modeloCriticoForHubInsert,
  modeloPadraoForHubInsert,
} from "@/lib/ia/hub-model-defaults";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function asTrimmedOrNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function asOptionalTrimPatch(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  return asTrimmedOrNull(v);
}

function asOptionalNumberPatch(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function asStringArrayPatch(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) {
    const out = v.map((x) => String(x).trim()).filter(Boolean);
    return out;
  }
  if (typeof v === "string") {
    return v
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";

  let query = supabase
    .from("hub_cargos_catalogo")
    .select("*")
    .order("segmento")
    .order("especialidade")
    .order("nivel");

  if (!all) query = query.eq("ativo", true);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** Corpo para criar cargo — `titulo` obrigatório; `slug` opcional (derivado do título). */
export async function POST(request: NextRequest) {
  const supabase = db();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const titulo = asTrimmedOrNull(body.titulo);
  if (!titulo) {
    return NextResponse.json({ error: "titulo é obrigatório." }, { status: 400 });
  }

  const slugRaw = body.slug != null ? String(body.slug).trim() : "";
  const slugFinal = slugRaw ? slugifyCargoSlug(slugRaw) : slugifyCargoSlug(titulo);
  if (!slugFinal || slugFinal.length < 2) {
    return NextResponse.json({ error: "slug inválido (mínimo 2 caracteres após normalização)." }, { status: 400 });
  }

  const { data: dupe } = await supabase.from("hub_cargos_catalogo").select("slug").eq("slug", slugFinal).maybeSingle();
  if (dupe) {
    return NextResponse.json({ error: `Já existe cargo com slug «${slugFinal}».` }, { status: 409 });
  }

  const nivelRaw = body.nivel != null ? Number(body.nivel) : 3;
  const nivel = Number.isFinite(nivelRaw) ? Math.min(5, Math.max(1, Math.round(nivelRaw))) : 3;

  const pode = asStringArrayPatch(body.pode_fazer_padrao) ?? [];
  const naoPode = asStringArrayPatch(body.nao_pode_fazer_padrao) ?? [];

  const row: Record<string, unknown> = {
    slug: slugFinal,
    titulo,
    segmento: asTrimmedOrNull(body.segmento),
    especialidade: asTrimmedOrNull(body.especialidade),
    descricao_curta: asTrimmedOrNull(body.descricao_curta),
    area: asTrimmedOrNull(body.area) ?? "geral",
    nivel,
    modelo_padrao: modeloPadraoForHubInsert(typeof body.modelo_padrao === "string" ? body.modelo_padrao : null),
    modelo_critico: modeloCriticoForHubInsert(typeof body.modelo_critico === "string" ? body.modelo_critico : null),
    modelo_alto_valor: modeloAltoValorForHubInsert(
      typeof body.modelo_alto_valor === "string" ? body.modelo_alto_valor : null
    ),
    supervisor_slug: body.supervisor_slug != null ? asTrimmedOrNull(body.supervisor_slug) : null,
    pode_fazer_padrao: pode,
    nao_pode_fazer_padrao: naoPode,
    prompt_template: asTrimmedOrNull(body.prompt_template) ?? "",
    descricao: asTrimmedOrNull(body.descricao) ?? "",
    ativo: body.ativo !== false,
  };

  const lim = asOptionalNumberPatch(body.limite_autonomia_brl);
  if (lim !== undefined && lim !== null) {
    row.limite_autonomia_brl = Math.max(0, lim);
  }

  const { data, error } = await supabase.from("hub_cargos_catalogo").insert(row).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = db();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const slug = String(body.slug || "").trim();
  if (!slug) {
    return NextResponse.json({ error: "slug é obrigatório." }, { status: 400 });
  }

  const propagarTitulo = body.propagar_titulo_para_agentes === true;

  const novoSlugNorm =
    typeof body.novo_slug === "string" && String(body.novo_slug).trim().length > 0
      ? slugifyCargoSlug(String(body.novo_slug))
      : "";

  const { data: oldRow, error: oldErr } = await supabase
    .from("hub_cargos_catalogo")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (oldErr) {
    return NextResponse.json({ error: oldErr.message }, { status: 500 });
  }
  if (!oldRow) {
    return NextResponse.json({ error: "Cargo não encontrado." }, { status: 404 });
  }

  const oldTitulo = String(oldRow.titulo ?? "").trim();

  if (novoSlugNorm && novoSlugNorm !== slug) {
    const { data: clash } = await supabase.from("hub_cargos_catalogo").select("slug").eq("slug", novoSlugNorm).maybeSingle();
    if (clash) {
      return NextResponse.json({ error: `Slug «${novoSlugNorm}» já está em uso.` }, { status: 409 });
    }
  }

  const patch: Record<string, unknown> = {};

  if ("ativo" in body) patch.ativo = !!body.ativo;
  if ("titulo" in body) {
    const tTit = asTrimmedOrNull(body.titulo);
    if (!tTit) {
      return NextResponse.json({ error: "titulo não pode ser vazio." }, { status: 400 });
    }
    patch.titulo = tTit;
  }
  if ("segmento" in body) patch.segmento = asOptionalTrimPatch(body.segmento);
  if ("especialidade" in body) patch.especialidade = asOptionalTrimPatch(body.especialidade);
  if ("descricao_curta" in body) patch.descricao_curta = asOptionalTrimPatch(body.descricao_curta);
  if ("area" in body) patch.area = asOptionalTrimPatch(body.area);
  if ("supervisor_slug" in body) {
    patch.supervisor_slug =
      body.supervisor_slug === null ? null : asOptionalTrimPatch(body.supervisor_slug);
  }
  if ("prompt_template" in body) patch.prompt_template = asOptionalTrimPatch(body.prompt_template);
  if ("descricao" in body) patch.descricao = asOptionalTrimPatch(body.descricao);

  const nivelPatch = asOptionalNumberPatch(body.nivel);
  if (nivelPatch !== undefined && nivelPatch !== null) {
    patch.nivel = Math.min(5, Math.max(1, Math.round(nivelPatch)));
  }

  const limPatch = asOptionalNumberPatch(body.limite_autonomia_brl);
  if (limPatch !== undefined) {
    patch.limite_autonomia_brl = limPatch === null ? null : Math.max(0, limPatch);
  }

  if ("modelo_padrao" in body && typeof body.modelo_padrao === "string") {
    patch.modelo_padrao = modeloPadraoForHubInsert(body.modelo_padrao);
  }
  if ("modelo_critico" in body && typeof body.modelo_critico === "string") {
    patch.modelo_critico = modeloCriticoForHubInsert(body.modelo_critico);
  }
  if ("modelo_alto_valor" in body && typeof body.modelo_alto_valor === "string") {
    patch.modelo_alto_valor = modeloAltoValorForHubInsert(body.modelo_alto_valor);
  }

  const podePatch = asStringArrayPatch(body.pode_fazer_padrao);
  if (podePatch !== undefined) patch.pode_fazer_padrao = podePatch;

  const naoPatch = asStringArrayPatch(body.nao_pode_fazer_padrao);
  if (naoPatch !== undefined) patch.nao_pode_fazer_padrao = naoPatch;

  if (novoSlugNorm && novoSlugNorm !== slug) {
    patch.slug = novoSlugNorm;
  }

  const novosCampos = Object.keys(patch).filter((k) => k !== "slug");
  if (novosCampos.length === 0 && !(patch.slug && patch.slug !== slug)) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hub_cargos_catalogo")
    .update(patch)
    .eq("slug", slug)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Cargo não encontrado após atualização." }, { status: 404 });
  }

  const tituloFinal = String(data.titulo ?? "").trim();
  if (propagarTitulo && tituloFinal && oldTitulo && tituloFinal !== oldTitulo) {
    await supabase.from("hub_agente_identidade").update({ cargo: tituloFinal }).eq("cargo", oldTitulo);
  }

  return NextResponse.json(data);
}

/** Query: ?slug= — elimina via RPC com SET LOCAL app.delete_authorized (trigger delete). */
export async function DELETE(request: NextRequest) {
  const supabase = db();
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Query slug é obrigatória." }, { status: 400 });
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc("hub_delete_cargo_catalogo", { p_slug: slug });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  const row = rpcData as { ok?: boolean; error?: string; slug?: string } | null;
  if (!row?.ok) {
    const msg = typeof row?.error === "string" ? row.error : "Falha ao eliminar.";
    let st = 500;
    if (msg.includes("Não é possível eliminar")) st = 409;
    else if (msg.includes("Cargo não encontrado")) st = 404;
    else if (msg.includes("inválido")) st = 400;
    return NextResponse.json({ error: msg }, { status: st });
  }

  return NextResponse.json({ ok: true, slug: String(row.slug ?? slug) });
}

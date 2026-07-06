/**
 * AUT-6 — Upload da MÍDIA da medição (foto/vídeo) para bucket PRIVADO.
 *
 * Recebe multipart/form-data { file, tipo: "foto"|"video" }, sobe via service_role
 * (crmDb) e devolve { path }. O path é gravado em hub_obra_medicoes.foto_url/video_url
 * pelo POST /medicoes; a EXIBIÇÃO usa URL assinada (gerada no GET /medicoes) — nunca
 * URL pública, pois é evidência sensível do cliente.
 *
 * SEGURANÇA: mesmo nível do POST /medicoes (requireCrmComercial). A obra é validada
 * por posse (404 se o tenant_id não bate). O path é escopado por tenant/obra no helper.
 */
import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { uploadMidiaObra, extDaMidia, type TipoMidiaObra } from "@/lib/obras/storage-obra-midia";

type Params = { params: Promise<{ id: string }> };

// Espelha os limites dos buckets (janela 06/jul): medicoes 25 MB, obra-videos 200 MB.
const LIMITE_BYTES: Record<TipoMidiaObra, number> = {
  foto: 25 * 1024 * 1024,
  video: 200 * 1024 * 1024,
};

async function assertObraDoTenant(obraId: string, tenantId: string): Promise<NextResponse | null> {
  const { data } = await crmDb()
    .from("hub_obras")
    .select("id, tenant_id")
    .eq("id", obraId)
    .maybeSingle();
  if (!data || data.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Obra não encontrada" }, { status: 404 });
  }
  return null;
}

export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Envio inválido (esperado multipart/form-data)." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const tipo = String(form.get("tipo") ?? "foto") as TipoMidiaObra;
  if (tipo !== "foto" && tipo !== "video") {
    return NextResponse.json({ error: "Tipo de mídia inválido." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Arquivo ausente ou vazio." }, { status: 400 });
  }
  if (file.size > LIMITE_BYTES[tipo]) {
    const mb = Math.round(LIMITE_BYTES[tipo] / (1024 * 1024));
    return NextResponse.json({ error: `Arquivo grande demais (máx ${mb} MB).` }, { status: 413 });
  }

  const contentType = file.type || "application/octet-stream";
  if (tipo === "foto" && !contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Esperada uma imagem." }, { status: 415 });
  }
  if (tipo === "video" && !contentType.startsWith("video/")) {
    return NextResponse.json({ error: "Esperado um vídeo." }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extDaMidia(contentType, file.name);
  const res = await uploadMidiaObra({
    tipo,
    tenantId: g.ctx.tenantId,
    obraId,
    buffer,
    ext,
    contentType,
  });
  if ("error" in res) {
    return NextResponse.json({ error: `Falha no upload: ${res.error}` }, { status: 502 });
  }
  return NextResponse.json({ path: res.path, tipo });
}

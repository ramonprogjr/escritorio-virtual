/**
 * Mídia de obra em bucket PRIVADO (medição: foto/vídeo). Buckets criados na janela
 * 06/jul (privados). Escrita/leitura via service_role (crmDb bypassa RLS); exibição
 * por URL ASSINADA (expira) — nunca URL pública, pois é evidência sensível do cliente.
 * Fecha a dívida AUT-6 ("a foto da medição não persiste").
 */
import { crmDb } from "@/lib/crm/supabase-server";

const BUCKET_POR_TIPO = { foto: "medicoes", video: "obra-videos" } as const;
export type TipoMidiaObra = keyof typeof BUCKET_POR_TIPO;

export function bucketDaMidia(tipo: TipoMidiaObra): string {
  return BUCKET_POR_TIPO[tipo];
}

/** Extensão segura a partir do mime (fallback: sanitiza o nome). */
const EXT_POR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function extDaMidia(contentType: string, nomeArquivo?: string): string {
  const byMime = EXT_POR_MIME[(contentType || "").toLowerCase()];
  if (byMime) return byMime;
  const byName = (nomeArquivo?.split(".").pop() ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return byName || "bin";
}

/**
 * Sobe um arquivo para o bucket privado da obra, num path escopado por tenant/obra.
 * Retorna o PATH (não a URL) — a exibição gera a URL assinada no GET.
 */
export async function uploadMidiaObra(params: {
  tipo: TipoMidiaObra;
  tenantId: string;
  obraId: string;
  buffer: Buffer;
  ext: string;
  contentType: string;
}): Promise<{ path: string } | { error: string }> {
  const bucket = bucketDaMidia(params.tipo);
  const path = `${params.tenantId}/${params.obraId}/${crypto.randomUUID()}.${params.ext}`;
  const { error } = await crmDb()
    .storage.from(bucket)
    .upload(path, params.buffer, {
      contentType: params.contentType || "application/octet-stream",
      upsert: false,
    });
  if (error) return { error: error.message };
  return { path };
}

/** URL assinada (expira) para exibir um arquivo do bucket privado. null se não houver path/erro. */
export async function urlAssinadaMidia(
  tipo: TipoMidiaObra,
  path: string | null | undefined,
  expiraSeg = 3600
): Promise<string | null> {
  const p = (path ?? "").trim();
  if (!p) return null;
  const { data, error } = await crmDb().storage.from(bucketDaMidia(tipo)).createSignedUrl(p, expiraSeg);
  if (error) return null;
  return data?.signedUrl ?? null;
}

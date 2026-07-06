import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

const PLAYBOOK_MEDIA_BUCKET = "playbook-media";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

type MediaKind = "document" | "audio" | "image";

const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/mp3",
  "audio/x-m4a",
  "image/png",
  "image/jpeg",
  "application/octet-stream",
]);

async function carregarAgente(
  supabase: ReturnType<typeof db>,
  slug: string,
  tenantId: string
) {
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (error) return { error: error.message };
  const row = data as { agente_slug: string; tenant_id?: string | null } | null;
  if (!row || (row.tenant_id != null && String(row.tenant_id) !== tenantId)) {
    return { error: "Agente não encontrado.", status: 404 };
  }
  return { data: row };
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length ? cleaned : "arquivo";
}

function parseKind(raw: FormDataEntryValue | null): MediaKind | null {
  if (raw === "document" || raw === "audio" || raw === "image") return raw;
  return null;
}

function inferKindFromMime(mime: string): MediaKind {
  if (mime === "application/pdf") return "document";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  return "document";
}

function isBucketMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("bucket not found") || (m.includes("bucket") && m.includes("not found"));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  // Upload de mídia do playbook — operação de escrita, exige gestor ou owner.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  const agente = await carregarAgente(supabase, slug, g.ctx.tenantId);
  if ("error" in agente) {
    return NextResponse.json({ error: agente.error }, { status: agente.status ?? 500 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo no campo file." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 25 MB." }, { status: 413 });
  }

  const kindInformado = parseKind(form.get("kind"));
  const mimeType = file.type || "application/octet-stream";

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: `Tipo de arquivo não suportado (${mimeType}). Aceitamos PDF, áudio (ogg/mp3/m4a) e imagem (png/jpeg).` },
      { status: 415 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const objectPath = `${slug}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

  const { error: uploadErr } = await supabase.storage
    .from(PLAYBOOK_MEDIA_BUCKET)
    .upload(objectPath, bytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadErr) {
    if (isBucketMissingError(uploadErr.message)) {
      return NextResponse.json(
        {
          error:
            "Bucket 'playbook-media' não existe. Rode a migration supabase/migrations/20260628150000_playbook_media_storage.sql.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from(PLAYBOOK_MEDIA_BUCKET).getPublicUrl(objectPath);
  const kindResolvido: MediaKind = kindInformado ?? inferKindFromMime(mimeType);

  return NextResponse.json({
    ok: true,
    media: {
      type: kindResolvido,
      url: pub.publicUrl,
      file_name: file.name,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  // Remoção de mídia — destrutivo, exige gestor ou owner.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const path = new URL(request.url).searchParams.get("path")?.trim();
  if (!path) {
    return NextResponse.json({ error: "Informe o path do arquivo." }, { status: 400 });
  }

  // Segurança: só permite remover dentro da pasta do próprio agente.
  if (!path.startsWith(`${slug}/`)) {
    return NextResponse.json({ error: "Path fora do escopo do agente." }, { status: 400 });
  }

  const supabase = db();

  const agente = await carregarAgente(supabase, slug, g.ctx.tenantId);
  if ("error" in agente) {
    return NextResponse.json({ error: agente.error }, { status: agente.status ?? 500 });
  }

  const { error: removeErr } = await supabase.storage
    .from(PLAYBOOK_MEDIA_BUCKET)
    .remove([path]);

  if (removeErr) {
    if (isBucketMissingError(removeErr.message)) {
      return NextResponse.json(
        {
          error:
            "Bucket 'playbook-media' não existe. Rode a migration supabase/migrations/20260628150000_playbook_media_storage.sql.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: removeErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

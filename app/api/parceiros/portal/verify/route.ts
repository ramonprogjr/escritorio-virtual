import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parceiroPortalValido } from "@/lib/parceiro-portal";
import { checkPortalVerifyRateLimit } from "@/lib/portal-rate-limit";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const max = Number(process.env.PORTAL_VERIFY_RATE_MAX || 40);
  const windowMs = Number(process.env.PORTAL_VERIFY_RATE_WINDOW_MS || 60_000);
  const rl = checkPortalVerifyRateLimit(`portal_verify:${ip}`, max, windowMs);
  if (!rl.ok) {
    console.warn("[portal/verify] rate_limited", { ip, retryAfterSec: rl.retryAfterSec });
    return NextResponse.json(
      { ok: false, erro: "Muitas tentativas. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { id?: string; s?: string };
  try {
    body = await request.json();
  } catch {
    console.warn("[portal/verify] invalid_json", { ip });
    return NextResponse.json({ ok: false, erro: "JSON inválido" }, { status: 400 });
  }

  const id = body.id;
  const s = body.s;
  if (!id || !s || !parceiroPortalValido(id, s)) {
    console.warn("[portal/verify] invalid_signature", { ip, hasId: !!id });
    return NextResponse.json({ ok: false, erro: "Link inválido ou expirado" }, { status: 401 });
  }

  const supabase = db();
  const { data: parceiro, error } = await supabase
    .from("hub_parceiros")
    .select(
      "id, nome, status, modulo_atual, comissao_pct, total_leads_recebidos, total_leads_convertidos, recebe_leads, telefone, cidade, estado"
    )
    .eq("id", id)
    .single();

  if (error || !parceiro) {
    console.warn("[portal/verify] parceiro_not_found", { ip, id });
    return NextResponse.json({ ok: false, erro: "Parceiro não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, parceiro });
}

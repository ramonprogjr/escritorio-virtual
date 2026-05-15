import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function pickInstanceFromResponse(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const inst = p.instance;
  if (inst && typeof inst === "object") return inst as Record<string, unknown>;
  return null;
}

function statusFromPayload(payload: unknown): string {
  const inst = pickInstanceFromResponse(payload);
  const s = inst?.status;
  return typeof s === "string" ? s : "disconnected";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: { action?: string; phone?: string; browser?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const action = String(body.action || "").trim().toLowerCase();
  if (!action) {
    return NextResponse.json(
      { error: "Indique action: create | connect | status | disconnect | delete_remote" },
      { status: 400 }
    );
  }

  const supabase = db();
  const { data: agente, error: loadErr } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, modo_operacao, uazapi_instance_id, uazapi_instance_token, uazapi_instance_name, uazapi_connection_status"
    )
    .eq("agente_slug", slug)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!agente) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  const row = agente as {
    modo_operacao?: string | null;
    uazapi_instance_id?: string | null;
    uazapi_instance_token?: string | null;
    uazapi_instance_name?: string | null;
    uazapi_connection_status?: string | null;
  };

  async function persistUazapi(patch: Record<string, unknown>) {
    const { error } = await supabase.from("hub_agente_identidade").update(patch).eq("agente_slug", slug);
    if (error) throw new Error(error.message);
  }

  try {
    if (action === "create") {
      if (row.modo_operacao !== "canal_whatsapp") {
        return NextResponse.json(
          { error: "Defina o modo de operação «WhatsApp» neste agente antes de criar instância." },
          { status: 409 }
        );
      }
      if (row.uazapi_instance_id?.trim()) {
        return NextResponse.json(
          { error: "Este agente já tem instância UAZAPI. Use «Eliminar na UAZAPI» para remover antes." },
          { status: 409 }
        );
      }

      const name = `obra10-${slug}`.slice(0, 80);
      const out = await uazapiFetchJson<Record<string, unknown>>("/instance/create", {
        method: "POST",
        admin: true,
        body: { name, adminField01: slug },
      });

      if (!out.ok) {
        return NextResponse.json({ error: out.error, uazapi: out.data }, { status: 502 });
      }

      const data = out.data as Record<string, unknown>;
      const inst = pickInstanceFromResponse(data);
      const token =
        (typeof data.token === "string" && data.token.trim()) ||
        (inst && typeof inst.token === "string" && inst.token.trim()) ||
        "";
      const id = inst && typeof inst.id === "string" && inst.id.trim() ? inst.id.trim() : "";

      if (!token || !id) {
        return NextResponse.json(
          { error: "UAZAPI não devolveu id/token da instância; verifique a resposta.", uazapi: data },
          { status: 502 }
        );
      }

      const st = statusFromPayload(data);

      await persistUazapi({
        uazapi_instance_id: id,
        uazapi_instance_token: token,
        uazapi_instance_name: name,
        uazapi_connection_status: st,
      });

      return NextResponse.json({
        ok: true,
        action: "create",
        uazapi_instance_id: id,
        uazapi_connection_status: st,
      });
    }

    const tokenInst = typeof row.uazapi_instance_token === "string" ? row.uazapi_instance_token.trim() : "";
    if (!tokenInst) {
      return NextResponse.json({ error: "Crie primeiro a instância UAZAPI para este agente." }, { status: 409 });
    }

    if (action === "connect") {
      const browser = typeof body.browser === "string" ? body.browser : "auto";
      const phoneRaw = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
      const payload: Record<string, unknown> = { browser };
      if (phoneRaw.length >= 10) payload.phone = phoneRaw;

      const out = await uazapiFetchJson<Record<string, unknown>>("/instance/connect", {
        method: "POST",
        instanceToken: tokenInst,
        body: payload,
      });

      if (!out.ok) {
        return NextResponse.json({ error: out.error, uazapi: out.data }, { status: 502 });
      }

      const st = statusFromPayload(out.data);
      await persistUazapi({ uazapi_connection_status: st });

      const inst = pickInstanceFromResponse(out.data);
      return NextResponse.json({
        ok: true,
        action: "connect",
        uazapi_connection_status: st,
        qrcode: typeof inst?.qrcode === "string" ? inst.qrcode : undefined,
        paircode: typeof inst?.paircode === "string" ? inst.paircode : undefined,
      });
    }

    if (action === "status") {
      const out = await uazapiFetchJson<Record<string, unknown>>("/instance/status", {
        method: "GET",
        instanceToken: tokenInst,
      });

      if (!out.ok) {
        return NextResponse.json({ error: out.error, uazapi: out.data }, { status: 502 });
      }

      const st = statusFromPayload(out.data);
      await persistUazapi({ uazapi_connection_status: st });

      const inst = pickInstanceFromResponse(out.data);
      return NextResponse.json({
        ok: true,
        action: "status",
        uazapi_connection_status: st,
        qrcode: typeof inst?.qrcode === "string" ? inst.qrcode : undefined,
        paircode: typeof inst?.paircode === "string" ? inst.paircode : undefined,
        profileName: typeof inst?.profileName === "string" ? inst.profileName : undefined,
      });
    }

    if (action === "disconnect") {
      const out = await uazapiFetchJson<Record<string, unknown>>("/instance/disconnect", {
        method: "POST",
        instanceToken: tokenInst,
      });

      if (!out.ok) {
        return NextResponse.json({ error: out.error, uazapi: out.data }, { status: 502 });
      }

      const st = statusFromPayload(out.data);
      await persistUazapi({ uazapi_connection_status: st || "disconnected" });

      return NextResponse.json({ ok: true, action: "disconnect", uazapi_connection_status: st });
    }

    if (action === "delete_remote") {
      const out = await uazapiFetchJson<Record<string, unknown>>("/instance", {
        method: "DELETE",
        instanceToken: tokenInst,
      });

      if (!out.ok) {
        return NextResponse.json({ error: out.error, uazapi: out.data }, { status: 502 });
      }

      await persistUazapi({
        uazapi_instance_id: null,
        uazapi_instance_token: null,
        uazapi_instance_name: null,
        uazapi_connection_status: null,
      });

      return NextResponse.json({ ok: true, action: "delete_remote" });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

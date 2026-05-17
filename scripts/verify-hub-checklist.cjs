/**
 * Checklist operacional: Mistral, colunas Hub na BD, amostra de agentes, UAZAPI admin.
 * Lê `.env` e `.env.local` (último sobrescreve). Não imprime segredos.
 *
 * TLS: em máquinas com proxy/antivírus (como `npm run dev`), use o defeito;
 * para verificação estrita: `STRICT_TLS=1 node scripts/verify-hub-checklist.cjs`
 */
if (!process.env.STRICT_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseEnvFile(filePath) {
  const o = {};
  if (!fs.existsSync(filePath)) return o;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    o[k] = v;
  }
  return o;
}

function loadEnv(root) {
  return {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.local")),
  };
}

function normalizarUazapiBase(b) {
  if (!b || typeof b !== "string") return "";
  let x = b.trim().replace(/\/+$/, "");
  x = x.replace(/\/api\/?$/, "");
  return x;
}

async function main() {
  const root = path.join(__dirname, "..");
  const env = loadEnv(root);
  /** @type {Array<{ item: string; ok: boolean; detail?: string }>} */
  const out = [];

  const mk = env.MISTRAL_API_KEY?.trim();
  if (!mk) {
    out.push({ item: "MISTRAL_API_KEY definida", ok: false, detail: "ausente" });
  } else {
    try {
      const r = await fetch("https://api.mistral.ai/v1/models", {
        headers: { Authorization: `Bearer ${mk}` },
      });
      const snippet = r.ok ? "" : (await r.text()).slice(0, 160).replace(/\s+/g, " ");
      out.push({
        item: "API Mistral (GET /v1/models)",
        ok: r.ok,
        detail: r.ok ? `HTTP ${r.status}` : snippet || `HTTP ${r.status}`,
      });
    } catch (e) {
      out.push({
        item: "API Mistral (GET /v1/models)",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const srk = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !srk) {
    out.push({
      item: "Supabase URL + SUPABASE_SERVICE_ROLE_KEY",
      ok: false,
      detail: !url ? "falta URL" : "falta service role",
    });
  } else {
    const sb = createClient(url, srk);
    const tenantId =
      env.DEFAULT_TENANT_ID?.trim() || env.NEXT_PUBLIC_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000001";

    const { count: totalAll, error: errCount } = await sb
      .from("hub_agente_identidade")
      .select("*", { count: "exact", head: true });

    if (errCount) {
      out.push({
        item: "BD: hub_agente_identidade (contagem)",
        ok: false,
        detail: errCount.message.slice(0, 220),
      });
    }

    let q = sb
      .from("hub_agente_identidade")
      .select("agente_slug,motor_ferramentas_habilitado,uso_ferramentas_ia,uazapi_connection_status,tenant_id")
      .limit(12);

    if (tenantId) {
      q = q.eq("tenant_id", tenantId);
    }

    const { data, error } = await q;

    let rows = data || [];
    if (!error && rows.length === 0 && (totalAll ?? 0) > 0) {
      const { data: anyTenant } = await sb
        .from("hub_agente_identidade")
        .select("agente_slug,motor_ferramentas_habilitado,uso_ferramentas_ia,uazapi_connection_status,tenant_id")
        .limit(8);
      rows = anyTenant || [];
      if (rows.length > 0) {
        out.push({
          item: "BD: aviso tenant",
          ok: true,
          detail: `Nenhum agente com tenant_id=${tenantId.slice(0, 8)}…; a usar amostra de qualquer tenant (${rows.length} linhas) para motor/tools`,
        });
      }
    }

    if (error) {
      out.push({
        item: "BD: colunas motor / uso_ferramentas_ia (query teste)",
        ok: false,
        detail: error.message.slice(0, 220),
      });
    } else {
      const sampleCount = (data || []).length;
      out.push({
        item: "BD: migração ferramentas (query sem erro)",
        ok: true,
        detail: `total tabela: ${totalAll ?? "?"} · linhas query tenant: ${sampleCount}`,
      });
      if ((totalAll ?? 0) === 0) {
        out.push({
          item: "Motor + tools na ficha (requer ≥1 agente)",
          ok: false,
          detail: "hub_agente_identidade está vazio — crie um agente no wizard ou no CRM e ligue motor/tools + Salvar",
        });
      } else {
        const motorOn = rows.filter((r) => r.motor_ferramentas_habilitado === true);
        const toolsOn = rows.filter((r) => {
          const u = r.uso_ferramentas_ia;
          if (!u || typeof u !== "object" || Array.isArray(u)) return false;
          return Object.values(u).some((v) => v === true || v === "true" || v === 1);
        });
        const atualizarLeadOn = rows.filter((r) => {
          const u = r.uso_ferramentas_ia;
          if (!u || typeof u !== "object" || Array.isArray(u)) return false;
          return u.hub_atualizar_lead === true || u.hub_atualizar_lead === "true" || u.hub_atualizar_lead === 1;
        });
        out.push({
          item: "Amostra: ≥1 agente com motor ligado",
          ok: motorOn.length > 0,
          detail: `${motorOn.length}/${rows.length} com motor_ferramentas_habilitado=true`,
        });
        out.push({
          item: "Amostra: ≥1 agente com tool activa em uso_ferramentas_ia",
          ok: toolsOn.length > 0,
          detail: `${toolsOn.length}/${rows.length} com algum valor true no mapa`,
        });
        out.push({
          item: "Amostra: hub_atualizar_lead activo (CRM WhatsApp)",
          ok: atualizarLeadOn.length > 0,
          detail: `${atualizarLeadOn.length}/${rows.length} — active hub_atualizar_lead para gravar hub_leads_crm`,
        });
        const waConn = rows.filter(
          (r) => String(r.uazapi_connection_status || "").toLowerCase() === "connected"
        );
        out.push({
          item: "Amostra: alguma instância UAZAPI connected",
          ok: waConn.length > 0,
          detail: `${waConn.length}/${rows.length} (só referência; configure na ficha)`,
        });
      }
    }
  }

  const base = normalizarUazapiBase(env.UAZAPI_BASE_URL);
  const adm = env.UAZAPI_ADMIN_TOKEN?.trim();
  if (!base || !adm) {
    out.push({
      item: "UAZAPI_BASE_URL + UAZAPI_ADMIN_TOKEN",
      ok: false,
      detail: !base ? "falta URL" : "falta admin token",
    });
  } else {
    try {
      const r = await fetch(`${base}/instance/all`, {
        headers: { admintoken: adm, Accept: "application/json" },
      });
      const txt = r.ok ? "" : (await r.text()).slice(0, 200).replace(/\s+/g, " ");
      out.push({
        item: "UAZAPI admin (GET /instance/all)",
        ok: r.ok,
        detail: r.ok ? `HTTP ${r.status}` : txt || `HTTP ${r.status}`,
      });
    } catch (e) {
      out.push({
        item: "UAZAPI admin (GET /instance/all)",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  out.push({
    item: "Webhook público WhatsApp",
    ok: Boolean(appUrl && !appUrl.includes("localhost")),
    detail: appUrl?.includes("localhost")
      ? "NEXT_PUBLIC_APP_URL é localhost — WhatsApp real precisa URL pública (ex. deploy ou túnel) para /api/whatsapp/webhook"
      : appUrl
        ? `Base configurada: apontar UAZAPI para ${appUrl.replace(/\/$/, "")}/api/whatsapp/webhook`
        : "defina NEXT_PUBLIC_APP_URL",
  });

  const allOk = out.every((x) => x.ok);
  console.log("");
  console.log("=== Checklist Hub / agente ===\n");
  for (const row of out) {
    const mark = row.ok ? "[OK]" : "[--]";
    console.log(`${mark} ${row.item}`);
    if (row.detail) console.log(`     ${row.detail}`);
  }
  console.log("");
  console.log(allOk ? "Resumo: todos os itens OK." : "Resumo: há itens a corrigir (ver [--] acima).");
  console.log("");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

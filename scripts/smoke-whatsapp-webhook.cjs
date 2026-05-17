/**
 * Teste rápido (~1 min): saúde do webhook + agente Maria + POST simulado UAZAPI.
 * Lê .env.local. Não imprime segredos.
 */
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
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

async function main() {
  const root = path.join(__dirname, "..");
  const env = loadEnv(root);
  const port = env.PORT || "3001";
  const base = `http://127.0.0.1:${port}`;
  const webhookPath = "/api/whatsapp/webhook";
  const secret = env.WEBHOOK_SECRET?.trim();
  const headerName = (env.WEBHOOK_SECRET_HEADER || "x-webhook-secret").toLowerCase();

  console.log("\n=== Smoke WhatsApp webhook ===\n");

  // 1) GET health
  try {
    const r = await fetch(`${base}${webhookPath}`);
    const j = await r.json().catch(() => ({}));
    console.log(r.ok ? "[OK]" : "[--]", `GET ${webhookPath}`, `→ HTTP ${r.status}`, j.service ? `(${j.service})` : "");
  } catch (e) {
    console.log("[--] GET webhook — servidor offline?", e instanceof Error ? e.message : e);
    console.log("     Inicie: npm run dev\n");
    process.exit(1);
  }

  // 2) Agente maria no Supabase
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const srk = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  let instanceId = "";
  let slug = "maria";
  let waStatus = "";
  let modo = "";

  if (url && srk) {
    const sb = createClient(url, srk);
    const { data, error } = await sb
      .from("hub_agente_identidade")
      .select("agente_slug,modo_operacao,uazapi_instance_id,uazapi_connection_status,motor_ferramentas_habilitado")
      .eq("agente_slug", "maria")
      .maybeSingle();

    if (error) {
      const { data: d2, error: e2 } = await sb
        .from("hub_agente_identidade")
        .select("agente_slug,modo_operacao,uazapi_instance_id,uazapi_connection_status")
        .eq("agente_slug", "maria")
        .maybeSingle();
      if (e2) {
        console.log("[--] Supabase agente maria:", e2.message.slice(0, 120));
      } else if (d2) {
        instanceId = String(d2.uazapi_instance_id || "").trim();
        waStatus = String(d2.uazapi_connection_status || "");
        modo = String(d2.modo_operacao || "");
        slug = d2.agente_slug;
      }
    } else if (data) {
      instanceId = String(data.uazapi_instance_id || "").trim();
      waStatus = String(data.uazapi_connection_status || "");
      modo = String(data.modo_operacao || "");
      slug = data.agente_slug;
    }

    const connOk = waStatus.toLowerCase() === "connected";
    console.log(
      connOk ? "[OK]" : "[--]",
      `Agente «${slug}»`,
      `modo=${modo || "?"} · uazapi=${waStatus || "—"} · instance_id=${instanceId ? instanceId.slice(0, 12) + "…" : "ausente"}`
    );
  } else {
    console.log("[--] Supabase não configurado no .env.local");
  }

  // 3) POST simulado (mensagem inbound)
  const payload = {
    event: "messages",
    instance: instanceId || "test-instance-smoke",
    data: {
      fromMe: false,
      isGroup: false,
      chatid: "5511999990000@s.whatsapp.net",
      sender: "5511999990000@s.whatsapp.net",
      senderName: "Smoke Test",
      messageid: `smoke-${Date.now()}`,
      messageTimestamp: Math.floor(Date.now() / 1000),
      messageType: "conversation",
      text: "oi smoke test hub",
    },
  };

  const body = JSON.stringify(payload);
  const headers = { "Content-Type": "application/json" };
  if (secret) headers[headerName] = secret;

  try {
    const r = await fetch(`${base}${webhookPath}`, { method: "POST", headers, body });
    const txt = await r.text();
    let j;
    try {
      j = JSON.parse(txt);
    } catch {
      j = { raw: txt.slice(0, 200) };
    }

    const mark = r.ok ? "[OK]" : "[--]";
    console.log(mark, `POST webhook simulado → HTTP ${r.status}`);
    if (j.status) console.log(`     status: ${j.status}`);
    if (j.reason) console.log(`     reason: ${j.reason}`);
    if (j.error) console.log(`     error: ${j.error}`);
    if (j.code) console.log(`     code: ${j.code}`);
    if (j.lead_id) console.log(`     lead_id: ${j.lead_id} · agente: ${j.agente || "?"}`);
    if (j.erro) console.log(`     erro: ${j.erro}`);

    if (r.status === 401) {
      console.log("     Dica: alinhe WEBHOOK_SECRET no .env.local com o header que a UAZAPI envia,");
      console.log("     ou em dev: WEBHOOK_SKIP_SIGNATURE_VERIFY=true");
    }
    if (j.reason === "whatsapp_nao_conectado") {
      console.log("     Dica: clique «Actualizar estado» na ficha do agente até CONNECTED.");
    }
    if (j.reason === "instancia_sem_agente_hub") {
      console.log("     Dica: instance no payload não bate com hub_agente_identidade.uazapi_instance_id.");
    }
  } catch (e) {
    console.log("[--] POST webhook falhou:", e instanceof Error ? e.message : e);
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() || "";
  if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    console.log("\n[!] WhatsApp REAL da UAZAPI não alcança localhost.");
    console.log("    Use deploy (Vercel) ou túnel (ngrok/cloudflared) e NEXT_PUBLIC_APP_URL pública.");
    console.log(`    URL alvo: https://<seu-dominio>/api/whatsapp/webhook\n`);
  } else if (appUrl) {
    console.log(`\n[i] Configure UAZAPI webhook: ${appUrl.replace(/\/$/, "")}/api/whatsapp/webhook\n`);
  }

  console.log("Fim do smoke.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

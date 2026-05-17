/**
 * Verifica alinhamento hub_memorias_lead.lead_id ↔ hub_leads_crm (WhatsApp).
 * Lê .env e .env.local. Não imprime segredos.
 *
 * Uso: node scripts/verify-hub-memorias-lead-fk.cjs
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

async function main() {
  const root = path.join(__dirname, "..");
  const env = {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.local")),
  };

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const srk = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !srk) {
    console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sb = createClient(url, srk);
  const out = [];

  const { count: totalMem, error: eMem } = await sb
    .from("hub_memorias_lead")
    .select("*", { count: "exact", head: true });

  if (eMem) {
    out.push({ item: "hub_memorias_lead (contagem)", ok: false, detail: eMem.message.slice(0, 200) });
  } else {
    out.push({ item: "hub_memorias_lead (contagem)", ok: true, detail: String(totalMem ?? 0) });
  }

  const { data: crmIds, error: eCrm } = await sb.from("hub_leads_crm").select("id").limit(5000);
  if (eCrm) {
    out.push({ item: "hub_leads_crm ids", ok: false, detail: eCrm.message.slice(0, 200) });
  } else {
    const setCrm = new Set((crmIds || []).map((r) => r.id));
    const { data: memRows, error: eRows } = await sb
      .from("hub_memorias_lead")
      .select("id, lead_id, chave, valor, criado_por")
      .limit(5000);

    if (eRows) {
      out.push({ item: "hub_memorias_lead amostra", ok: false, detail: eRows.message.slice(0, 200) });
    } else {
      const rows = memRows || [];
      let orfas = 0;
      let okCrm = 0;
      for (const r of rows) {
        if (!r.lead_id) continue;
        if (setCrm.has(r.lead_id)) okCrm++;
        else orfas++;
      }
      out.push({
        item: "Memórias com lead_id em hub_leads_crm",
        ok: rows.length === 0 || okCrm > 0 || orfas === 0,
        detail: `${okCrm} OK · ${orfas} órfãs (lead_id não está em hub_leads_crm) · amostra ${rows.length} linhas`,
      });
      out.push({
        item: "Sem órfãs (recomendado antes da migração FK)",
        ok: orfas === 0,
        detail:
          orfas === 0
            ? "Nenhuma órfã na amostra"
            : "Corrija ou apague memorias com lead_id inválido; depois aplique 20260604120000_hub_memorias_lead_fk_crm.sql",
      });

      const { data: waLeads } = await sb
        .from("hub_leads_crm")
        .select("id, telefone, nome, estagio")
        .eq("origem", "whatsapp")
        .order("atualizado_em", { ascending: false })
        .limit(5);

      if (waLeads?.length) {
        const lid = waLeads[0].id;
        const { count: memLead } = await sb
          .from("hub_memorias_lead")
          .select("*", { count: "exact", head: true })
          .eq("lead_id", lid);
        out.push({
          item: "Último lead WhatsApp tem memórias",
          ok: (memLead ?? 0) > 0,
          detail: `lead ${lid.slice(0, 8)}… · ${memLead ?? 0} memória(s) · tel ${waLeads[0].telefone ?? "—"}`,
        });
      }
    }
  }

  const okAll = out.every((x) => x.ok);
  console.log("\n=== Checklist hub_memorias_lead ↔ hub_leads_crm ===\n");
  for (const row of out) {
    console.log(`${row.ok ? "OK" : "FAIL"}  ${row.item}`);
    if (row.detail) console.log(`     ${row.detail}`);
  }
  console.log(`\n${okAll ? "Tudo OK na amostra." : "Há itens a corrigir."}\n`);
  process.exit(okAll ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";
import { isMissingPgColumn } from "@/lib/tenant-default";

export type OperadorWhatsapp = {
  slug: string;
  nome: string;
};

function telefonesEnvAllowlist(): Set<string> {
  const raw = process.env.WHATSAPP_CMD_PHONES?.trim();
  if (!raw) return new Set();
  const out = new Set<string>();
  for (const part of raw.split(/[,;\s]+/)) {
    const tel = telefoneConversaId(part);
    if (tel.length >= 10) out.add(tel);
  }
  return out;
}

function slugFromNome(nome: string): string {
  const n = nome.trim();
  if (!n) return "operador";
  return n.split(/\s+/)[0]!.toLowerCase().slice(0, 40);
}

/**
 * Operador autorizado a enviar comandos IA via WhatsApp (env + hub_contatos_notificacao).
 */
export async function telefoneOperadorAutorizado(
  supabase: SupabaseClient,
  telefone: string
): Promise<OperadorWhatsapp | null> {
  const tel = telefoneConversaId(telefone);
  if (tel.length < 10) return null;

  const envSet = telefonesEnvAllowlist();
  if (envSet.has(tel)) {
    return { slug: slugFromNome(`cmd_${tel.slice(-4)}`), nome: "Operador WhatsApp" };
  }

  const { data, error } = await supabase
    .from("hub_contatos_notificacao")
    .select("nome, telefone, ativo, pode_comandar_ia")
    .eq("ativo", true)
    .eq("pode_comandar_ia", true);

  if (error) {
    if (isMissingPgColumn(error, "pode_comandar_ia")) {
      return null;
    }
    console.warn("[WHATSAPP][CMD] allowlist contatos:", error.message);
    return null;
  }

  if (!Array.isArray(data)) return null;

  for (const row of data) {
    const rowTel = telefoneConversaId(String(row.telefone ?? ""));
    if (rowTel === tel) {
      const nome = String(row.nome ?? "").trim() || "Operador";
      return { slug: slugFromNome(nome), nome };
    }
  }

  return null;
}

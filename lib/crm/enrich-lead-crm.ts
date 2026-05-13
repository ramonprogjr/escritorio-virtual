/**
 * Unifica campos de exibição entre hub_leads_crm, hub_pessoas e hub_fila_mensagens
 * (duas entradas: WhatsApp + cadastro manual no CRM).
 */

export type PessoaMini = {
  codigo: string | null;
  nome: string | null;
  email: string | null;
  cidade?: string | null;
  estado?: string | null;
};

export type UltimaFilaMini = {
  conteudo: string | null;
  criado_em: string | null;
};

export function emailExibicao(
  emailLead: string | null | undefined,
  pessoa: PessoaMini | null | undefined
): string {
  const a = (emailLead && String(emailLead).trim()) || "";
  if (a) return a;
  const b = (pessoa?.email && String(pessoa.email).trim()) || "";
  return b || "—";
}

export function ultimaMensagemExibicao(
  ultimaNoLead: string | null | undefined,
  fila: UltimaFilaMini | null | undefined,
  maxLen = 120
): string {
  const a = (ultimaNoLead && String(ultimaNoLead).trim()) || "";
  if (a) return a.length > maxLen ? `${a.slice(0, maxLen)}…` : a;
  const b = (fila?.conteudo && String(fila.conteudo).trim()) || "";
  if (b) return b.length > maxLen ? `${b.slice(0, maxLen)}…` : b;
  return "—";
}

export function codigoParticipante(pessoa: PessoaMini | null | undefined): string {
  const c = pessoa?.codigo && String(pessoa.codigo).trim();
  return c || "—";
}

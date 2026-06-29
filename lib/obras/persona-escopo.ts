/**
 * E7 (Fase 2) — Persona de ESCOPO derivada do PAPEL da sessão (server-side).
 *
 * MOTIVO (bloqueador da auditoria adversarial): a visibilidade da faixa-dinheiro (custo/margem)
 * NÃO pode depender do cliente esconder o campo. O servidor decide quem vê/grava custo a partir
 * do `role` da sessão (requireCrm* → ctx.role), nunca de uma prop de componente nem do body.
 *
 * MAPEAMENTO (design §3 — "Fluxo de visibilidade por papel"):
 *   - owner / gestor (admin do tenant + auditor)        → "hub"      (vê custo+preço+margem)
 *   - comercial / financeiro / atendente (equipe da obra) → "executor" (vê custo+preço+margem da SUA obra)
 *   - parceiro (prestador externo)                       → "prestador" (vê só preço; nunca custo/margem)
 *   - role desconhecido / vazio                          → DEFAULT SEGURO = "prestador" (o mais restrito)
 *
 * Não existe role "arquiteto" no RBAC atual (lib/crm/crm-permissoes.ts). Quando o módulo de
 * Arquitetura ganhar papel próprio, mapear aqui para "arquiteto" (faixa-dinheiro some). Até lá, o
 * default cai no MAIS restrito que ainda permite trabalhar (prestador) — NUNCA "executor" por omissão,
 * para não vazar custo/margem a um papel não previsto. (decisão 3b)
 *
 * Puro (sem I/O) → testável e reusado pelo PATCH /itens (gate de escrita) e pelo GET /escopo
 * (persona retornada + defesa em profundidade no payload).
 */

import { crmNivelFromRole } from "@/lib/crm/crm-permissoes";
import {
  personaPodeVerCusto,
  personaPodeVerMargem,
  type PersonaEscopo,
} from "@/lib/obras/escopo";

/**
 * Deriva a persona de escopo a partir do `role` da sessão (ctx.role de requireCrm*).
 * Default seguro = "prestador" (o mais restrito): nenhum papel não previsto vê custo/margem.
 */
export function personaDaSessao(role: string | null | undefined): PersonaEscopo {
  const r = (role ?? "").trim().toLowerCase();

  // Prestador externo: role "parceiro" não tem nível CRM (crmNivelFromRole devolve null),
  // mas é um papel explícito — trata ANTES do fallback para não cair no default por null.
  if (r === "parceiro") return "prestador";

  const nivel = crmNivelFromRole(role);
  if (nivel === "owner" || nivel === "gestor") return "hub";
  if (nivel === "comercial" || nivel === "financeiro" || nivel === "atendente") return "executor";

  // Role desconhecido/vazio → o MAIS restrito (nunca executor por omissão).
  return "prestador";
}

/** Atalho server-side: a persona da sessão pode GRAVAR custo? (gate de escrita do PATCH) */
export function sessaoPodeEscreverCusto(role: string | null | undefined): boolean {
  return personaPodeVerCusto(personaDaSessao(role));
}

/** A persona da sessão pode VER margem? (defesa em profundidade do GET) */
export function sessaoPodeVerMargem(role: string | null | undefined): boolean {
  return personaPodeVerMargem(personaDaSessao(role));
}

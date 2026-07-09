/**
 * Classificação de uma linha de hub_atividades em comentário / atividade_principal / log.
 *
 * ESPELHO em TS da função SQL IMMUTABLE `hub_atividade_categoria` (migração de imutabilidade). A FONTE
 * DE VERDADE é a coluna `categoria` congelada no banco pelo trigger BEFORE INSERT; este TS é usado
 * APENAS como fallback quando a coluna vier NULL (ex.: antes da migração) — a permissão SEMPRE lê a
 * coluna congelada, nunca recomputa. Mantido em paridade com o SQL por teste (classificar-atividade.test.ts)
 * que passa o payload REAL de cada write-site.
 *
 * Fail-closed assimétrico: humano desconhecido → atividade_principal (ação humana NUNCA some);
 * ia/sistema/desconhecido → log (ruído NUNCA polui os registros).
 *
 * Corrigido por F0 (CHECK real do banco): feito_por_tipo ∈ {humano, ia} (não existe 'sistema');
 * tipo NÃO tem 'agendamento' — reunião é `tipo='reuniao'`.
 */

export type CategoriaAtividade = "comentario" | "atividade_principal" | "log";

/** origem (metadata.origem) que marca ruído/log conhecido — confirmadas no código. */
const ORIGENS_LOG = new Set<string>(["playbook_complete_summary", "persistir_dados_lead_whatsapp"]);

/** tipos que são MARCO de negócio por si só (allowlist). reuniao = o exemplo do dono ("agendou reunião"). */
const TIPOS_PRINCIPAIS = new Set<string>(["status_change", "proposta", "reuniao"]);

export function classificarAtividade(
  tipo: string | null | undefined,
  feitoPorTipo: string | null | undefined,
  metadata: unknown
): CategoriaAtividade {
  const t = String(tipo ?? "").trim();
  const fpt = String(feitoPorTipo ?? "").trim();
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const origem = typeof meta.origem === "string" ? meta.origem : "";

  // [A] LOG conhecido (denylist confirmada no código) — qualquer ator
  if (ORIGENS_LOG.has(origem)) return "log";
  if ("skip_ia" in meta || "midia_nao_processada" in meta) return "log";
  // mensagem que NÃO é a primeira (transcript) = log. primeira_mensagem comparada como TEXTO (zero cast).
  if (t === "mensagem" && String(meta.primeira_mensagem ?? "") !== "true") return "log";

  // [B] COMENTÁRIO: exclusivamente nota humana (único caso com edição por autor)
  if (t === "nota" && fpt === "humano") return "comentario";

  // [C] ATIVIDADE PRINCIPAL: allowlist de marcos
  if (TIPOS_PRINCIPAIS.has(t)) return "atividade_principal";
  if (t === "mensagem") return "atividade_principal"; // só chega aqui primeira_mensagem='true' (nascimento WhatsApp)
  if (t === "ia_acao") return "atividade_principal"; // handoff (humano rotulado ia_acao) + auto-avanço/qualificação
  if (t === "nota" && (fpt === "ia" || fpt === "sistema")) return "atividade_principal"; // nota deliberada da IA

  // [D] DEFAULT fail-closed: humano nunca some (principal); ia/sistema/desconhecido nunca polui (log)
  return fpt === "humano" ? "atividade_principal" : "log";
}

/** Uma categoria é editável/arquivável pelo autor? (só comentário). As demais regras (owner) ficam na API. */
export function categoriaPermiteAutor(categoria: CategoriaAtividade): boolean {
  return categoria === "comentario";
}

/** Log nunca é editável/arquivável por ninguém (nem owner). */
export function categoriaEhImutavel(categoria: CategoriaAtividade): boolean {
  return categoria === "log";
}

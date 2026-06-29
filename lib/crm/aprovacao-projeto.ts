/**
 * A1 — Máquina de estados da aprovação do cliente + agregado do projeto.
 *
 * Sem tabela nova (reusa hub_projetos_fases.aprovacao_status e
 * hub_projetos.aprovacao_status). Aqui ficam, em JS (não trigger), as regras
 * que o design A1-DESIGN.md fixou:
 *
 *  - Estados de UMA fase/entregável (coluna hub_projetos_fases.aprovacao_status,
 *    CHECK já existe: 'pendente'|'enviado'|'aprovado'|'rejeitado').
 *  - Agregado do projeto (hub_projetos.aprovacao_status, CHECK:
 *    'sem_aprovacao'|'aguardando'|'aprovado'|'reprovado') derivado das fases
 *    tipo='fase'. Regra de ordem: REPROVADO DOMINA → aguardando → aprovado →
 *    sem_aprovacao (o vermelho é o estado acionável do gargalo do arquiteto).
 *
 * Tudo aditivo e tolerante: nenhuma coluna nova é obrigatória para o MVP.
 */

/** Estado de aprovação de UMA fase/entregável (hub_projetos_fases.aprovacao_status). */
export type FaseAprovacaoStatus = "pendente" | "enviado" | "aprovado" | "rejeitado";

/** Agregado do projeto (hub_projetos.aprovacao_status). */
export type ProjetoAprovacaoStatus = "sem_aprovacao" | "aguardando" | "aprovado" | "reprovado";

export const FASE_APROVACAO_VALIDOS: readonly FaseAprovacaoStatus[] = [
  "pendente",
  "enviado",
  "aprovado",
  "rejeitado",
] as const;

export function isFaseAprovacaoStatus(v: unknown): v is FaseAprovacaoStatus {
  return typeof v === "string" && (FASE_APROVACAO_VALIDOS as readonly string[]).includes(v);
}

/** Ações da rota única de aprovação (POST .../aprovacao). */
export type AcaoAprovacao = "enviar" | "reenviar" | "responder" | "anexar";

export const ACOES_APROVACAO: readonly AcaoAprovacao[] = [
  "enviar",
  "reenviar",
  "responder",
  "anexar",
] as const;

export function isAcaoAprovacao(v: unknown): v is AcaoAprovacao {
  return typeof v === "string" && (ACOES_APROVACAO as readonly string[]).includes(v);
}

/**
 * Resultado de uma transição. `erro` ⇒ a transição é inválida (a rota devolve o
 * status HTTP indicado). `ok` ⇒ aplica `novoStatus` (e os timestamps quando há
 * colunas SLA — a rota é tolerante a ausência delas).
 */
export type TransicaoResultado =
  | { ok: true; novoStatus: FaseAprovacaoStatus }
  | { ok: false; erro: string; http: 400 | 409 | 422 };

/**
 * Decide a próxima `aprovacao_status` da fase para uma ação. Espelha o diagrama
 * do A1-DESIGN.md:
 *   pendente(s/url) ─[anexar]→ pendente(c/url) ─[enviar]→ enviado
 *   enviado ─[responder:aprovado]→ aprovado (terminal; reabrir audita)
 *   enviado ─[responder:rejeitado+MOTIVO]→ rejeitado
 *   rejeitado ─[reenviar]→ enviado (nova versão; append no histórico)
 *   PROIBIDO: pendente→aprovado · aprovado→enviado
 *
 * `temUrl` = existe entregavel_url (após considerar a url enviada na própria ação).
 * `decisao`/`motivo` só importam para acao='responder'.
 */
export function proximaFaseAprovacao(
  acao: AcaoAprovacao,
  atual: FaseAprovacaoStatus,
  opts: { temUrl: boolean; decisao?: "aprovado" | "rejeitado"; motivo?: string }
): TransicaoResultado {
  switch (acao) {
    case "anexar": {
      // Anexar só preenche o arquivo; mantém o estado (faz sentido em 'pendente'
      // ou 'rejeitado' antes de reenviar). Em 'enviado'/'aprovado' é troca de
      // versão sem reabrir — permitido, estado preservado.
      return { ok: true, novoStatus: atual };
    }
    case "enviar": {
      if (!opts.temUrl) {
        return { ok: false, erro: "entregavel_sem_arquivo", http: 422 };
      }
      if (atual === "aprovado") {
        // Reenviar um aprovado é reabertura → use 'reenviar' (auditado). Bloqueia o atalho.
        return { ok: false, erro: "ja_aprovado", http: 409 };
      }
      return { ok: true, novoStatus: "enviado" };
    }
    case "reenviar": {
      // Reenvio só faz sentido de um rejeitado (nova versão). Tolerante: também
      // aceita reabrir um aprovado (auditado) — mas exige arquivo.
      if (atual !== "rejeitado" && atual !== "aprovado") {
        return { ok: false, erro: "reenvio_so_de_rejeitado", http: 409 };
      }
      if (!opts.temUrl) {
        return { ok: false, erro: "entregavel_sem_arquivo", http: 422 };
      }
      return { ok: true, novoStatus: "enviado" };
    }
    case "responder": {
      if (atual !== "enviado") {
        return { ok: false, erro: "resposta_so_de_enviado", http: 409 };
      }
      if (opts.decisao !== "aprovado" && opts.decisao !== "rejeitado") {
        return { ok: false, erro: "decisao_invalida", http: 400 };
      }
      if (opts.decisao === "rejeitado" && !(opts.motivo && opts.motivo.trim())) {
        return { ok: false, erro: "motivo_obrigatorio", http: 400 };
      }
      return { ok: true, novoStatus: opts.decisao };
    }
    default:
      return { ok: false, erro: "acao_invalida", http: 400 };
  }
}

/**
 * Agregado do projeto a partir das fases tipo='fase'. REPROVADO DOMINA.
 *
 * - 0 entregáveis            → sem_aprovacao
 * - algum rejeitado          → reprovado
 * - nenhum rejeitado, algum enviado → aguardando
 * - todos aprovados          → aprovado
 * - resto (só pendentes)     → sem_aprovacao
 */
export function calcularAprovacaoProjeto(
  statusFases: Array<string | null | undefined>
): ProjetoAprovacaoStatus {
  const fases = statusFases.map((s) => (isFaseAprovacaoStatus(s) ? s : "pendente"));
  if (fases.length === 0) return "sem_aprovacao";
  if (fases.some((s) => s === "rejeitado")) return "reprovado";
  if (fases.some((s) => s === "enviado")) return "aguardando";
  if (fases.every((s) => s === "aprovado")) return "aprovado";
  return "sem_aprovacao";
}

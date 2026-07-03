// NOVO ARQUIVO: lib/ia/efeito-aprovacao.ts — módulo PURO (client-safe): importa só o TIPO
// PapelChave de @/lib/obras/financeiro (erasable), NUNCA supabase/service_role. Isso permite que
// page.tsx (client) e o teste unitário importem o mapper sem puxar server code nem tocar o banco.
import type { PapelChave } from "@/lib/obras/financeiro"; // "arquitetura" | "hub"

/**
 * Efeito FIEL da cascata do gate dourado — espelha 1:1 o jsonb REAL das RPCs
 * (rpc_liberar_escrow / rpc_aprovar_orcamento_frente). É a única fonte de verdade do feedback
 * na fila de aprovações. Cada variante mapeia um veredito concreto do banco.
 */
export type EfeitoAprovacao =
  | { kind: "escrow_liberado"; valorLiberado: number }            // rpc_liberar_escrow: { ok:true, valor_liberado }
  | { kind: "escrow_aguardando"; faltam: PapelChave[] }           // { ok:false, erro:"aprovacao_dupla_incompleta", arq, hub }
  | { kind: "escrow_ja_liberado" }                                // { ok:true, idempotente:true, status }
  | { kind: "orcamento_aprovado"; pagamentosLiberados: number }   // rpc_aprovar_orcamento_frente: { ok:true, pagamentos_liberados:N }
  | { kind: "orcamento_ja_aprovado" }                             // { ok:true, idempotente:true }
  | { kind: "cotacao_aprovada" }                                  // update simples em hub_cotacoes_pedidos (sem RPC)
  | { kind: "registrado" }                                        // tipo sem cascata de dinheiro (retorno total honesto)
  | { kind: "ja_processada" }                                     // early-return idempotente do aprovar() (0 linhas afetadas)
  | { kind: "falhou"; motivo?: string }                           // RPC devolveu ok:false REAL (ou erro) — NÃO mente que seguiu
  | { kind: "indisponivel" };                                     // RPC ausente (migração dormente) — honesto: aprovação registrada, cascata inativa

// Mapper PURO efeito -> mensagem PT-BR. `formatarBRL` é INJETADO (default interno) para o teste ser
// determinístico sem Intl/locale. O componente Toast já prefixa "✓ "; por isso as mensagens NÃO
// começam com ✅ — usam 🔑/🔓/🔒 (mesma semântica do pill dourado arq+hub) só onde agregam sentido.
const ROTULO_CHAVE: Record<PapelChave, string> = {
  arquitetura: "a chave da Arquitetura",
  hub: "a chave do Hub",
};

export function mensagemDoEfeito(
  efeito: EfeitoAprovacao | undefined,
  formatarBRL: (v: number) => string = (v) => `R$ ${v.toFixed(2)}`
): string {
  switch (efeito?.kind) {
    case "escrow_liberado":
      return `🔓 Escrow liberado: ${formatarBRL(efeito.valorLiberado)} — as 2 chaves confirmaram, o pagamento segue.`;
    case "escrow_aguardando": {
      const faltam = efeito.faltam.length ? efeito.faltam : (["hub"] as PapelChave[]);
      const alvo = faltam.map((p) => ROTULO_CHAVE[p]).join(" e ");
      // Pós-aprovação, normalmente falta 1 chave (a outra autoridade). Se faltarem AS DUAS,
      // não afirmamos "1 de 2 registrada" (seria contraditório).
      return faltam.length >= 2
        ? `🔑 Aguardando ${alvo} para liberar o pagamento.`
        : `🔑 1 de 2 chaves confirmada — falta ${alvo} para liberar o pagamento.`;
    }
    case "escrow_ja_liberado":
      return "🔒 Este escrow já havia sido liberado — nenhum novo movimento.";
    case "orcamento_aprovado":
      return efeito.pagamentosLiberados <= 0
        ? "Orçamento aprovado."
        : `Orçamento aprovado — ${efeito.pagamentosLiberados} ${efeito.pagamentosLiberados === 1 ? "pagamento desbloqueado" : "pagamentos desbloqueados"}.`;
    case "orcamento_ja_aprovado":
      return "Este orçamento já estava aprovado — nenhum novo movimento.";
    case "cotacao_aprovada":
      return "Cotação aprovada.";
    case "ja_processada":
      return "Já processada — sem novo movimento.";
    case "falhou":
      // Honesto: a aprovação FOI gravada, mas a cascata (liberação) NÃO concluiu — não fingir sucesso.
      return `⚠️ Aprovação registrada, mas a liberação não pôde ser concluída${
        efeito.motivo ? ` (${efeito.motivo})` : ""
      }. Verifique o financeiro da obra.`;
    case "indisponivel":
      return "Aprovação registrada. A liberação será confirmada em instantes.";
    case "registrado":
    default:
      return "Aprovado e registrado.";
  }
}

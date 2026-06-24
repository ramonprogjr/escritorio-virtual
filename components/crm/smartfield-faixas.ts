/**
 * Faixas e helpers puros do SmartField (sem React, para serem testáveis).
 * Princípio de UX (auditoria §2): "faixas em vez de número exato" — o usuário ESCOLHE
 * uma faixa em vez de digitar. Ver components/crm/SmartField.tsx.
 */
export type SmartOption = { value: string; label: string };

/** Faixas de ticket padrão (valor de negócio). */
export const FAIXAS_TICKET: SmartOption[] = [
  { value: "ate-50k", label: "Até R$ 50 mil" },
  { value: "50-120k", label: "R$ 50–120 mil" },
  { value: "120-300k", label: "R$ 120–300 mil" },
  { value: "300k+", label: "R$ 300 mil+" },
];

/**
 * Mapeia um valor numérico (R$) para a chave de faixa de ticket — para exibir um valor já
 * existente como faixa selecionada. Retorna null para valor ausente/negativo/inválido.
 */
export function valorParaFaixaTicket(valor: number | null | undefined): string | null {
  if (valor == null || !Number.isFinite(valor) || valor < 0) return null;
  if (valor < 50_000) return "ate-50k";
  if (valor < 120_000) return "50-120k";
  if (valor < 300_000) return "120-300k";
  return "300k+";
}

/**
 * Rate-limit CENTRALIZADO para rotas que tocam IA/LLM pago (teto de custo — pedido do dono:
 * "teto em TUDO que toca IA/LLM pago").
 *
 * Fino wrapper sobre `rateLimitExcedido` (lib/rate-limit-memoria) com janela fixa de 1 minuto,
 * para que todas as rotas de IA usem a MESMA lógica em vez de reimplementar buckets.
 *
 * Mesmo caveat da base: best-effort, em memória POR INSTÂNCIA (reseta em deploy, não é
 * compartilhado entre réplicas). É a 1ª barreira anti-abuso/anti-flood — para limite forte
 * distribuído, migrar a base para Redis.
 */
import { NextResponse } from "next/server";
import { rateLimitExcedido } from "@/lib/rate-limit-memoria";

/** Janela padrão de rate-limit para IA: 1 minuto. */
export const JANELA_IA_MS = 60_000;

/**
 * Primitiva booleana: `true` quando o teto por-minuto foi ULTRAPASSADO (o chamador deve rejeitar).
 *
 * `chave` deve ser estável e ESPECÍFICA da rota + identidade (ex.: `negocio-copilot:<tenantId>`
 * ou `wa-inbound:<telefone>`) para os buckets não colidirem entre rotas distintas. O prefixo
 * `ia:` é adicionado internamente para isolar do namespace de outros rate-limits.
 */
export function iaRateLimitExcedido(chave: string, maxPorMinuto: number): boolean {
  const max =
    Number.isFinite(maxPorMinuto) && maxPorMinuto > 0 ? Math.floor(maxPorMinuto) : 1;
  return rateLimitExcedido(`ia:${chave}`, max, JANELA_IA_MS);
}

/**
 * Guarda plugável para rotas de API que respondem com `NextResponse`. Se o teto foi
 * ultrapassado, devolve um 429 pronto (com `Retry-After`); caso contrário devolve `null`
 * (pode prosseguir). Uso:
 *
 *   const limite = requireIaRateLimit(`negocio-copilot:${g.ctx.tenantId}`, 20);
 *   if (limite) return limite;
 */
export function requireIaRateLimit(
  chave: string,
  maxPorMinuto: number
): NextResponse | null {
  if (iaRateLimitExcedido(chave, maxPorMinuto)) {
    return NextResponse.json(
      {
        error:
          "Muitas solicitações de IA em pouco tempo. Aguarde alguns segundos e tente novamente.",
      },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  return null;
}

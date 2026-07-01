/**
 * Sanitiza um termo de busca livre (vindo do usuário) ANTES de ser interpolado
 * dentro de um `.or(\`campo.ilike.%${busca}%,...\`)` do PostgREST.
 *
 * Por que: o PostgREST usa `,` para separar condições e `()` para agrupar dentro
 * do `.or()`; `.`/`:` separam coluna/operador; `%`/`*` são wildcards do próprio
 * ilike; `"` pode fechar valores citados. Sem sanitizar, um `busca` malicioso
 * fecha o `ilike` corrente e injeta condições extras (ex.: `,tenant_id.eq.<outro>`
 * ou `,or(...)`), potencialmente contornando o filtro de tenant que vem depois
 * no mesmo `.or()` ou em filtros irmãos combinados via `and`/`or`.
 *
 * Estratégia: blocklist estrita — remove os metacaracteres de sintaxe do
 * PostgREST (`,()".:%*\`) do termo. O resto (letras, dígitos, espaços, acentos,
 * hífen etc.) passa intacto para não quebrar buscas legítimas (nome, cidade,
 * bairro). Trunca em 100 chars como salvaguarda adicional de tamanho.
 */
export function sanitizarBuscaPostgrest(input: string): string {
  if (!input) return "";
  return input
    .replace(/[,()".:%*\\]/g, "")
    .trim()
    .slice(0, 100);
}

import { NextResponse } from "next/server";

/**
 * Extrai a mensagem "de dentro" de um erro desconhecido (Error, erro do PostgREST/Supabase
 * `{ message }`, ou qualquer coisa) para logar NO SERVIDOR — nunca para devolver ao cliente.
 */
function detalheErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (erro && typeof erro === "object" && "message" in erro) {
    return String((erro as { message: unknown }).message);
  }
  return String(erro);
}

/**
 * Resposta 500 para rotas PÚBLICAS / sem sessão (formulários de captação, cadastro por link,
 * webhooks de terceiros). Loga o detalhe real no servidor e devolve uma mensagem GENÉRICA ao
 * cliente anônimo — o erro cru do Postgres vaza nome de tabela/coluna/constraint e ajuda um
 * atacante a mapear o schema (auditoria enterprise #50). Use SOMENTE em superfície pública;
 * rotas autenticadas podem devolver detalhe ao próprio usuário do tenant.
 *
 * @param contexto  rótulo curto p/ achar o log (ex.: "public:especialista").
 * @param erro      o erro capturado (Error | erro Supabase | unknown).
 * @param mensagem  texto seguro exibível ao cliente (default genérico).
 */
export function erroPublico500(
  contexto: string,
  erro: unknown,
  mensagem = "Não foi possível concluir agora. Tente novamente em instantes.",
): NextResponse {
  console.error(`[erro-publico:${contexto}]`, detalheErro(erro));
  return NextResponse.json({ error: mensagem }, { status: 500 });
}

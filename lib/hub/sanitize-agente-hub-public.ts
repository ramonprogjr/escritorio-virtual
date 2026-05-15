/** Resposta Hub ao cliente/browser — não expõe segredo da instância UAZAPI. */
export function sanitizarAgenteHubParaCliente(row: Record<string, unknown>): Record<string, unknown> {
  const { uazapi_instance_token: tok, ...rest } = row;
  return {
    ...rest,
    uazapi_has_instance_token: typeof tok === "string" && tok.trim().length > 0,
  };
}

/** Token fixo — um único link público para todos os parceiros da rede. */
export const PARCEIRO_LINK_TOKEN_REDE = "rede";

export function urlCadastroParceiroPublico(opts?: {
  por?: string;
  sig?: string;
  origin?: string;
}): string {
  const base = opts?.origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const url = `${base}/parceiro/cadastro/${PARCEIRO_LINK_TOKEN_REDE}`;
  // Atribuição ASSINADA de quem convidou: só entra quando AMBOS por+sig existem (a rota
  // pública valida o HMAC; sem os dois, o link permanece o da rede, sem atribuição).
  if (opts?.por && opts?.sig) {
    const q = new URLSearchParams({ por: opts.por, sig: opts.sig });
    return `${url}?${q.toString()}`;
  }
  return url;
}

export function linkParceiroReutilizavel(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false;
  if (metadata.reutilizavel === true) return true;
  return String(metadata.tipo_link || "") === "rede_publica";
}

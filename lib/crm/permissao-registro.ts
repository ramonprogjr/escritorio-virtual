/**
 * Permissões dos REGISTROS (spec do dono) — quem pode editar/arquivar cada categoria. A trava REAL é o
 * trigger no banco (nem service_role fura); esta camada decide o que o servidor devolve (flags pode_editar/
 * pode_arquivar) e o que a API aceita. Pura e testável. Lê a categoria CONGELADA (nunca recomputa aqui).
 *
 * Matriz: comentário → autor real OU owner; atividade_principal → só owner; log → ninguém (owner só extrai).
 */

export type CategoriaRegistro = "comentario" | "atividade_principal" | "log";

/** feito_por que NÃO identifica um autor (sentinelas legadas) → não dá direito de edição por autor. */
const SENTINELAS_AUTOR = new Set(["humano", "sistema", "ia", "wendel", ""]);

/** UUID cru NÃO pode aparecer na UI (regra da casa "esconde o código, chama pelo nome"). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function ehUuid(v: string | null | undefined): boolean {
  return UUID_RE.test(String(v ?? "").trim());
}

export function autorRealDoComentario(
  feitoPor: string | null | undefined,
  userId: string | null | undefined
): boolean {
  const fp = String(feitoPor ?? "").trim();
  const uid = String(userId ?? "").trim();
  return uid.length > 0 && fp === uid && !SENTINELAS_AUTOR.has(fp);
}

/** Pode editar OU arquivar o registro? (mesma matriz p/ os dois — arquivar é o "apagar" soft.) */
export function podeAlterarRegistro(
  categoria: CategoriaRegistro,
  feitoPor: string | null | undefined,
  ctx: { userId: string | null | undefined; isOwner: boolean }
): boolean {
  if (categoria === "log") return false; // nem owner
  if (categoria === "comentario") return autorRealDoComentario(feitoPor, ctx.userId) || ctx.isOwner;
  if (categoria === "atividade_principal") return ctx.isOwner;
  return false;
}

/**
 * Nome humano do autor para a UI (esconde userId cru; regra da casa "chama pelo nome").
 * `nomeResolvido` = nome real do usuário (lookup por id no servidor). NUNCA devolve um UUID cru —
 * se o feito_por for um UUID sem nome resolvido, cai para "Equipe" em vez de vazar o código do colega.
 */
export function autorNomeRegistro(
  feitoPor: string | null | undefined,
  feitoPorTipo: string | null | undefined,
  userId: string | null | undefined,
  nomeResolvido?: string | null
): string {
  const fp = String(feitoPor ?? "").trim();
  const fpt = String(feitoPorTipo ?? "").trim().toLowerCase();
  if (fpt === "ia") return "IA";
  if (fpt === "sistema") return "Sistema";
  if (fp && fp === String(userId ?? "").trim()) return "Você";
  const nome = String(nomeResolvido ?? "").trim();
  if (nome) return nome;
  if (!fp || SENTINELAS_AUTOR.has(fp)) return "Equipe";
  if (ehUuid(fp)) return "Equipe"; // colega sem nome resolvido — nunca expor o UUID cru
  return fp; // nome legível legado (ex.: "Ana Silva")
}

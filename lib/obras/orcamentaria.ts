/**
 * ORÇAMENTÁRIA v1 (a peça orçamentária da obra — design §4 "1 botão Gerar") — funções PURAS que
 * projetam a MESMA árvore de escopo (a "planilha viva") em ARTEFATOS: o Memorial descritivo (HTML
 * printável) e a Planilha orçamentária (CSV). É o "mesmo fio": uma fonte → vários documentos, zero
 * redigitação. (Nome do dono: "orçamentária" = a planilha orçamentária + o memorial, juntos.)
 *
 * Por que aqui (e não num endpoint): a <ArvoreEscopo> já carregou a árvore tenant-scoped do
 * /escopo. Gerar no browser a partir dela = sem novo round-trip pesado, e o documento bate 1:1
 * com o que o usuário vê na tela (memorial e planilha nascem da mesma `NoAmbiente[]`).
 *
 * 🔐 INVARIANTE persona (decisão 3b / design §3):
 *   - MEMORIAL = descrição + quantidade + unidade, SEM dinheiro. É p/ TODOS (inclusive arquiteto).
 *   - PLANILHA orçamentária = custo/preço/margem só p/ quem pode (executor|hub). Para quem NÃO pode
 *     ver custo, as colunas de custo/margem são OMITIDAS do CSV (não escondidas com "—": ausentes).
 *     Para quem não pode ver nem preço (arquiteto), o CSV sai só com descrição/quant/unid.
 *   Reusa `personaPodeVerCusto/Margem/Preco` de escopo.ts — não reimplementa a regra.
 *
 * TOLERANTE (migração E7 pendente): sem custo/preço, os artefatos saem com QUANTIDADE e uma NOTA
 * honesta no topo ("custo/preço entram após aplicar a migração"). Nunca quebram, nunca mentem.
 *
 * Tenant: os dados já chegam tenant-scoped do /escopo. Estas funções não tocam I/O nem rede —
 * só transformam a árvore que o componente já tem em mãos. Nenhum caminho aqui burla o tenant.
 */

import {
  fmtMoeda,
  personaPodeVerCusto,
  personaPodeVerMargem,
  personaPodeVerPreco,
  type NoAmbiente,
  type NoDisciplina,
  type ItemEscopoCalc,
  type PersonaEscopo,
} from "@/lib/obras/escopo";

// Tokens da marca (Obra10+) — fixados aqui p/ o HTML printável ser self-contained (abre em nova
// aba sem CSS externo). Espelham app/globals.css (--brand-*/--obra-*).
const MARCA = {
  verde: "#003b26",
  verdeDeep: "#00281a",
  dourado: "#c9a24a",
  douradoLight: "#e0b86a",
  creme: "#f7f4ec",
  tinta: "#0a140f",
  cinza: "#5c6b62",
  linha: "#d9d2c2",
} as const;

/** Metadados da obra que o cabeçalho dos artefatos usa (tudo opcional → tolerante). */
export type ObraMeta = {
  codigo?: string | null;
  titulo?: string | null;
  cliente?: string | null;
  endereco?: string | null;
};

/**
 * Item enriquecido como o usado na orçamentária. É o `ItemEscopoCalc` da árvore + um `descricao`
 * opcional (a col B da planilha do dono = o parágrafo de memorial). O /escopo hoje devolve `nome`;
 * quando `descricao` existir, o memorial a prefere; senão cai p/ `nome`. Tolerante a ambos.
 */
export type ItemOrcamentaria = ItemEscopoCalc & { descricao?: string | null };

/** Opções de geração (a `migracao_pendente` vem do /escopo — controla a nota honesta). */
export type OpcoesOrcamentaria = {
  persona: PersonaEscopo;
  migracaoPendente?: boolean;
};

// ── Helpers de texto ──────────────────────────────────────────────────────────

/** Escapa para HTML (evita injeção de nome/descrição vindos do banco no documento). */
export function escHtml(v: string | null | undefined): string {
  const s = v == null ? "" : String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escapa um valor de célula CSV (RFC 4180): se contém vírgula, aspas, ; ou quebra de linha,
 * envolve em aspas e duplica as aspas internas. Senão devolve cru. null/undefined → "".
 */
export function escCsv(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",;\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Texto do memorial de um item: prefere `descricao` (col B), cai p/ `nome`, depois um placeholder. */
function textoMemorial(it: ItemOrcamentaria): string {
  const d = (it.descricao ?? "").trim();
  if (d) return d;
  const n = (it.nome ?? "").trim();
  if (n) return n;
  return "Item sem descrição";
}

/** "12 m²" / "3 unid" / "—" se sem quantidade. Quantidade SEM dinheiro (vale p/ o memorial). */
function fmtQtdUnid(it: ItemOrcamentaria): string {
  if (it.quantidade == null || !Number.isFinite(Number(it.quantidade))) return "—";
  const un = (it.unidade ?? "").trim();
  return un ? `${it.quantidade} ${un}` : String(it.quantidade);
}

/** Só os itens-raiz de um nó de disciplina (espelha a regra só-raiz do escopo.ts — sem pai+filho em dobro). */
function raizes(itens: ItemOrcamentaria[]): ItemOrcamentaria[] {
  return itens.filter((i) => i.parent_id == null);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MEMORIAL DESCRITIVO (HTML printável) — descrição + quantidade, SEM dinheiro
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Gera o HTML do MEMORIAL DESCRITIVO: por AMBIENTE → DISCIPLINA → ITEM, a descrição + quantidade +
 * unidade. NUNCA inclui custo/preço/margem (é o documento p/ todos, decisão 3b). Self-contained:
 * traz <style> inline da marca + um botão "Imprimir" (window.print). Abre em nova aba p/ imprimir/PDF.
 *
 * Tolerante: se `migracaoPendente`, adiciona uma nota honesta no topo ("custo/preço após migração") —
 * embora o memorial não tenha dinheiro de qualquer forma, a nota explica que ele é a face descritiva.
 */
export function gerarMemorialHtml(
  arvore: NoAmbiente[],
  obra: ObraMeta,
  opts?: { migracaoPendente?: boolean }
): string {
  const titulo = (obra.titulo ?? "").trim() || "Memorial descritivo";
  const codigo = (obra.codigo ?? "").trim();
  const linhaObra = [codigo, obra.cliente, obra.endereco].filter((x) => (x ?? "").trim()).join(" · ");

  const secoes = arvore
    .map((amb) => memorialAmbiente(amb))
    .join("\n");

  const vazio =
    arvore.length === 0
      ? `<p class="vazio">Nenhum item de escopo ainda. Monte a árvore na aba Escopo para gerar o memorial.</p>`
      : "";

  const nota = opts?.migracaoPendente
    ? `<p class="nota">Documento descritivo (sem valores). Custo, preço e margem entram na planilha orçamentária após aplicar a migração E7.</p>`
    : "";

  // data local pt-BR (estável o suficiente; o documento é p/ leitura humana)
  const data = new Date().toLocaleDateString("pt-BR");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(`Memorial — ${titulo}`)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: ${MARCA.tinta}; background: ${MARCA.creme}; margin: 0; padding: 32px;
    line-height: 1.5;
  }
  .folha { max-width: 880px; margin: 0 auto; background: #fff; padding: 40px 48px;
    box-shadow: 0 8px 32px rgba(0,40,26,0.10); border-radius: 8px; }
  header { border-bottom: 3px solid ${MARCA.verde}; padding-bottom: 16px; margin-bottom: 8px; }
  .kicker { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: ${MARCA.dourado}; margin: 0; }
  h1 { font-size: 26px; margin: 6px 0 4px; color: ${MARCA.verdeDeep}; }
  .sub { font-size: 13px; color: ${MARCA.cinza}; margin: 0; }
  .nota { font-size: 12px; color: ${MARCA.verde}; background: rgba(201,162,74,0.12);
    border: 1px solid rgba(201,162,74,0.4); border-radius: 6px; padding: 8px 12px; margin: 16px 0; }
  .ambiente { margin-top: 28px; }
  .ambiente > h2 { font-size: 16px; text-transform: uppercase; letter-spacing: .04em;
    color: ${MARCA.verde}; border-bottom: 1px solid ${MARCA.linha}; padding-bottom: 6px; margin: 0 0 12px; }
  .disc { margin: 14px 0 14px 4px; }
  .disc > h3 { font-size: 13px; font-weight: 700; margin: 0 0 6px;
    padding-left: 10px; border-left: 3px solid ${MARCA.dourado}; }
  ul.itens { list-style: none; margin: 0; padding: 0; }
  ul.itens li { padding: 6px 0 6px 22px; border-bottom: 1px dotted ${MARCA.linha};
    display: flex; justify-content: space-between; gap: 16px; font-size: 13px; }
  ul.itens li:last-child { border-bottom: none; }
  .desc { flex: 1; }
  .desc .cod { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: ${MARCA.cinza};
    margin-right: 6px; }
  .qtd { white-space: nowrap; font-weight: 600; color: ${MARCA.verdeDeep}; font-variant-numeric: tabular-nums; }
  .vazio { color: ${MARCA.cinza}; font-style: italic; }
  footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid ${MARCA.linha};
    font-size: 11px; color: ${MARCA.cinza}; display: flex; justify-content: space-between; }
  .barra-print { position: sticky; top: 0; text-align: right; margin: -16px 0 16px; }
  .barra-print button { font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
    background: ${MARCA.verde}; color: ${MARCA.douradoLight}; border: 1px solid ${MARCA.dourado};
    border-radius: 8px; padding: 8px 16px; }
  @media print {
    body { background: #fff; padding: 0; }
    .folha { box-shadow: none; border-radius: 0; padding: 0; max-width: none; }
    .barra-print { display: none; }
  }
</style>
</head>
<body>
  <div class="folha">
    <div class="barra-print"><button type="button" onclick="window.print()">Imprimir / salvar PDF</button></div>
    <header>
      <p class="kicker">Memorial descritivo</p>
      <h1>${escHtml(titulo)}</h1>
      ${linhaObra ? `<p class="sub">${escHtml(linhaObra)}</p>` : ""}
    </header>
    ${nota}
    ${vazio}
    ${secoes}
    <footer>
      <span>Gerado pela árvore de escopo · Obra10+</span>
      <span>${escHtml(data)}</span>
    </footer>
  </div>
</body>
</html>`;
}

/** Bloco de um ambiente no memorial (título + suas disciplinas com itens). */
function memorialAmbiente(amb: NoAmbiente): string {
  const discs = amb.disciplinas.map((d) => memorialDisciplina(d)).join("\n");
  return `<section class="ambiente">
      <h2>${escHtml(amb.label)}</h2>
      ${discs}
    </section>`;
}

/** Bloco de uma disciplina no memorial (título + lista de itens-raiz, descrição + qtd/unid). */
function memorialDisciplina(disc: NoDisciplina): string {
  const itens = raizes(disc.itens as ItemOrcamentaria[]);
  if (itens.length === 0) return "";
  const linhas = itens
    .map((it) => {
      const cod = (it.codigo ?? "").trim();
      const codHtml = cod ? `<span class="cod">${escHtml(cod)}</span>` : "";
      return `<li>
        <span class="desc">${codHtml}${escHtml(textoMemorial(it))}</span>
        <span class="qtd">${escHtml(fmtQtdUnid(it))}</span>
      </li>`;
    })
    .join("\n");
  return `<div class="disc">
      <h3>${escHtml(disc.label)}</h3>
      <ul class="itens">${linhas}</ul>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
//  PLANILHA ORÇAMENTÁRIA (CSV) — espelha as colunas da planilha do dono, persona-aware
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Colunas do CSV, na ordem da planilha do dono. As de DINHEIRO são marcadas pelo nível de acesso
 * que exigem; `colunasCsv(persona)` filtra conforme `personaPodeVer*`. Quem não pode custo NÃO
 * recebe as colunas de custo/BDI/margem; quem não pode preço (arquiteto) também perde preço/total.
 */
type NivelColuna = "sempre" | "preco" | "custo" | "margem";

const COLUNAS: Array<{ rotulo: string; nivel: NivelColuna }> = [
  { rotulo: "Ambiente", nivel: "sempre" },
  { rotulo: "Disciplina", nivel: "sempre" },
  { rotulo: "Código", nivel: "sempre" },
  { rotulo: "Descrição", nivel: "sempre" },
  { rotulo: "Quant", nivel: "sempre" },
  { rotulo: "Unid", nivel: "sempre" },
  { rotulo: "Custo Locação", nivel: "custo" },
  { rotulo: "Custo Material", nivel: "custo" },
  { rotulo: "Custo MO", nivel: "custo" },
  { rotulo: "Custo Unit", nivel: "custo" },
  { rotulo: "BDI", nivel: "custo" },
  { rotulo: "Preço Unit", nivel: "preco" },
  { rotulo: "Margem %", nivel: "margem" },
  { rotulo: "Total", nivel: "preco" },
];

/** Decide se a persona recebe uma coluna de determinado nível (reusa a regra de escopo.ts). */
function personaPodeNivel(p: PersonaEscopo, nivel: NivelColuna): boolean {
  switch (nivel) {
    case "sempre":
      return true;
    case "preco":
      return personaPodeVerPreco(p);
    case "custo":
      return personaPodeVerCusto(p);
    case "margem":
      return personaPodeVerMargem(p);
  }
}

/** Colunas efetivas do CSV para a persona (na ordem da planilha do dono). Exportada p/ teste. */
export function colunasCsv(persona: PersonaEscopo): string[] {
  return COLUNAS.filter((c) => personaPodeNivel(persona, c.nivel)).map((c) => c.rotulo);
}

/** Valor numérico de dinheiro p/ CSV: ponto-decimal cru (planilha importa), "" se null. */
function numCsv(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "";
  return String(n);
}

/**
 * Monta a célula de cada coluna p/ um item, respeitando a persona (mesma lista/ordem de COLUNAS).
 * Devolve já-escapado (escCsv). Colunas de dinheiro não permitidas nem entram (filtradas).
 */
function celulasItem(
  amb: NoAmbiente,
  disc: NoDisciplina,
  it: ItemOrcamentaria,
  persona: PersonaEscopo
): string[] {
  // valores brutos por rótulo (depois filtramos pela persona pela mesma lista COLUNAS)
  const v: Record<string, string> = {
    Ambiente: amb.label,
    Disciplina: disc.label,
    Código: it.codigo ?? "",
    Descrição: textoMemorial(it),
    Quant: it.quantidade == null ? "" : String(it.quantidade),
    Unid: it.unidade ?? "",
    "Custo Locação": numCsv(it.custo_locacao_frete),
    "Custo Material": numCsv(it.custo_material),
    "Custo MO": numCsv(it.custo_mao_obra),
    "Custo Unit": numCsv(it.custo_unitario),
    BDI: numCsv(it.bdi_efetivo),
    "Preço Unit": numCsv(it.preco_unitario),
    "Margem %": numCsv(it.margem_pct),
    Total: numCsv(it.preco_total),
  };
  return COLUNAS.filter((c) => personaPodeNivel(persona, c.nivel)).map((c) => escCsv(v[c.rotulo]));
}

/**
 * Gera o CSV da PLANILHA ORÇAMENTÁRIA: espelha as colunas da planilha do dono, agrupado por
 * AMBIENTE → DISCIPLINA → ITEM, com uma LINHA DE SUBTOTAL por ambiente. Persona-aware: colunas de
 * custo/preço/margem que a persona não pode ver são OMITIDAS por completo (não "—").
 *
 * Tolerante: sem custo/preço (migração pendente), as colunas de dinheiro saem VAZIAS mas as de
 * quantidade/descrição vêm preenchidas. Uma linha de NOTA no topo avisa (precedida de "#"). Quem
 * não tem nenhuma coluna de dinheiro (arquiteto) recebe um CSV puramente descritivo — honesto.
 *
 * Separador = vírgula; cada célula passa por escCsv (RFC 4180). Linhas terminam em CRLF (Excel-safe).
 */
export function gerarOrcamentoCsv(
  arvore: NoAmbiente[],
  persona: PersonaEscopo,
  opts?: { migracaoPendente?: boolean }
): string {
  const cols = colunasCsv(persona);
  const linhas: string[] = [];

  // Nota honesta (linha de comentário). Não é coluna — começa com "#" para não confundir o parser.
  if (opts?.migracaoPendente) {
    linhas.push(
      escCsv(
        "# Custo, preço e margem entram após aplicar a migração E7. Esta planilha traz descrição e quantidade."
      )
    );
  } else if (!personaPodeVerPreco(persona)) {
    linhas.push(escCsv("# Planilha descritiva (seu perfil não exibe valores)."));
  } else if (!personaPodeVerCusto(persona)) {
    linhas.push(escCsv("# Planilha com preço (seu perfil não exibe custo nem margem)."));
  }

  // Cabeçalho
  linhas.push(cols.join(","));

  const podePreco = personaPodeVerPreco(persona);
  const podeCusto = personaPodeVerCusto(persona);

  for (const amb of arvore) {
    for (const disc of amb.disciplinas) {
      for (const it of raizes(disc.itens as ItemOrcamentaria[])) {
        linhas.push(celulasItem(amb, disc, it, persona).join(","));
      }
    }
    // Subtotal do ambiente (só faz sentido se houver coluna de dinheiro permitida).
    if (podePreco || podeCusto) {
      linhas.push(linhaSubtotal(amb, persona).join(","));
    }
  }

  return linhas.join("\r\n");
}

/**
 * Linha de subtotal de um ambiente. Marcador "SUBTOTAL · <ambiente>" na coluna Ambiente; o custo
 * TOTAL do ambiente vai na coluna "Custo Unit" e o preço TOTAL na coluna "Total" (as duas colunas de
 * fechamento da planilha do dono — O e I). Margem% do ambiente entra na coluna Margem %. As demais
 * ficam vazias. Tudo respeita a persona (colunas não permitidas já estão fora do conjunto `cols`).
 */
function linhaSubtotal(amb: NoAmbiente, persona: PersonaEscopo): string[] {
  const sub = amb.subtotal;
  const v: Record<string, string> = {
    Ambiente: `SUBTOTAL · ${amb.label}`,
    "Custo Unit": personaPodeVerCusto(persona) ? String(sub.custo) : "",
    "Margem %": sub.margem_pct == null ? "" : String(sub.margem_pct),
    Total: personaPodeVerPreco(persona) ? String(sub.preco) : "",
  };
  return COLUNAS.filter((c) => personaPodeNivel(persona, c.nivel)).map((c) => escCsv(v[c.rotulo] ?? ""));
}

/** Nome de arquivo seguro p/ download (ascii, sem espaços/acentos). Ex.: "memorial-P2K25-100.html". */
export function nomeArquivo(prefixo: string, obra: ObraMeta, ext: string): string {
  const base = (obra.codigo ?? obra.titulo ?? "obra").toString();
  const slug =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // remove diacríticos (combining marks) após NFD
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 48) || "obra";
  return `${prefixo}-${slug}.${ext}`;
}

// ── re-export p/ a UI checar persona sem reimportar de escopo.ts ─────────────────
export { personaPodeVerCusto, personaPodeVerPreco, personaPodeVerMargem, fmtMoeda };

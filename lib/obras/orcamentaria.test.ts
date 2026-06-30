/**
 * Testes PUROS da ORÇAMENTÁRIA v1 (a peça orçamentária = planilha + memorial). Travam:
 *  - o "mesmo fio": memorial e CSV nascem da MESMA árvore (montarArvore) e batem entre si;
 *  - memorial agrupa por ambiente → disciplina → item e NÃO vaza dinheiro;
 *  - CSV escapa vírgulas/aspas/quebras corretamente (RFC 4180);
 *  - a INVARIANTE de persona: arquiteto não recebe colunas de dinheiro; prestador não recebe custo/margem;
 *  - tolerância: sem custo (migração pendente) o artefato sai com quantidade + nota honesta.
 */

import { describe, it, expect } from "vitest";
import { calcularItem, montarArvore, type ItemEscopoInput } from "@/lib/obras/escopo";
import {
  gerarMemorialHtml,
  gerarOrcamentoCsv,
  colunasCsv,
  escCsv,
  escHtml,
  nomeArquivo,
  type ObraMeta,
} from "@/lib/obras/orcamentaria";
import type { NoAmbiente } from "@/lib/obras/escopo";

// ── Fixture: itens com custo (a obra "completa") ──────────────────────────────
const OBRA: ObraMeta = { codigo: "P2K25.100", titulo: "Reforma Rodrigo & Alline", cliente: "Rodrigo" };

const ITENS_COM_CUSTO: Array<ItemEscopoInput & { descricao?: string | null }> = [
  {
    id: "i1",
    parent_id: null,
    ambiente: "cozinha",
    disciplina_slug: "eletrica",
    nome: "Ponto de tomada",
    descricao: "Fornecimento de material e MO para instalação de ponto de tomada 220V.",
    codigo: "CZ.E1",
    quantidade: 10,
    unidade: "unid",
    pct_avanco: 0,
    custo_locacao_frete: 0,
    custo_material: 15,
    custo_mao_obra: 35,
  },
  {
    id: "i2",
    parent_id: null,
    ambiente: "cozinha",
    disciplina_slug: "pintura",
    nome: "Pintura teto",
    descricao: "Pintura de teto, duas demãos.",
    codigo: "CZ.P1",
    quantidade: 14,
    unidade: "m²",
    pct_avanco: 50,
    custo_locacao_frete: 0,
    custo_material: 8,
    custo_mao_obra: 12,
  },
  {
    id: "i3",
    parent_id: null,
    ambiente: "sala",
    disciplina_slug: "eletrica",
    nome: "Ponto de luz",
    descricao: "Instalação de ponto de iluminação.",
    codigo: "SL.E1",
    quantidade: 4,
    unidade: "unid",
    pct_avanco: 0,
    custo_locacao_frete: 0,
    custo_material: 10,
    custo_mao_obra: 20,
  },
];

// ── Fixture: SEM custo (migração E7 pendente) ─────────────────────────────────
const ITENS_SEM_CUSTO: Array<ItemEscopoInput & { descricao?: string | null }> = [
  {
    id: "j1",
    parent_id: null,
    ambiente: "cozinha",
    disciplina_slug: "eletrica",
    nome: "Ponto de tomada",
    descricao: "Instalação de tomada.",
    codigo: "CZ.E1",
    quantidade: 10,
    unidade: "unid",
    pct_avanco: 0,
    // sem custo_* → custo_total null
  },
];

/** Constrói a árvore a partir dos itens (o MESMO caminho que o /escopo usa). */
function arvoreDe(
  itens: Array<ItemEscopoInput & { descricao?: string | null }>,
  bdiObra = 1.06
): NoAmbiente[] {
  const calc = itens.map((it) => ({ ...calcularItem(it, bdiObra), descricao: it.descricao }));
  return montarArvore(calc as ReturnType<typeof calcularItem>[]).ambientes as NoAmbiente[];
}

// ══════════════════════════════════════════════════════════════════════════════
//  escCsv — escape RFC 4180
// ══════════════════════════════════════════════════════════════════════════════
describe("escCsv", () => {
  it("deixa texto simples cru", () => {
    expect(escCsv("Cozinha")).toBe("Cozinha");
    expect(escCsv(42)).toBe("42");
  });
  it("envolve em aspas quando há vírgula", () => {
    expect(escCsv("Pintura, duas demãos")).toBe('"Pintura, duas demãos"');
  });
  it("duplica aspas internas e envolve", () => {
    expect(escCsv('Tubo 3" PVC')).toBe('"Tubo 3"" PVC"');
  });
  it("envolve quando há quebra de linha ou ponto-e-vírgula", () => {
    expect(escCsv("linha1\nlinha2")).toBe('"linha1\nlinha2"');
    expect(escCsv("a;b")).toBe('"a;b"');
  });
  it("null/undefined viram string vazia", () => {
    expect(escCsv(null)).toBe("");
    expect(escCsv(undefined)).toBe("");
  });
});

describe("escHtml", () => {
  it("escapa caracteres perigosos", () => {
    expect(escHtml('<script>"a"&\'b\'')).toBe("&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  MEMORIAL — agrupa certo, sem dinheiro
// ══════════════════════════════════════════════════════════════════════════════
describe("gerarMemorialHtml", () => {
  const html = gerarMemorialHtml(arvoreDe(ITENS_COM_CUSTO), OBRA);

  it("inclui título e código da obra", () => {
    expect(html).toContain("Reforma Rodrigo &amp; Alline"); // título escapado
    expect(html).toContain("P2K25.100");
  });

  it("agrupa por ambiente e disciplina", () => {
    expect(html).toContain("Cozinha"); // rótulo de ambiente
    expect(html).toContain("Sala");
    // descrições (memorial = col B) presentes
    expect(html).toContain("instalação de ponto de tomada");
    expect(html).toContain("Pintura de teto");
  });

  it("mostra quantidade + unidade", () => {
    expect(html).toContain("10 unid");
    expect(html).toContain("14 m²");
  });

  it("NUNCA vaza dinheiro (custo/preço/margem) — é o documento p/ todos", () => {
    expect(html).not.toContain("R$");
    expect(html).not.toMatch(/margem/i);
    // 53 (preço unit do item 1 = 50*1.06) não pode aparecer como valor
    expect(html).not.toContain("53.00");
    expect(html).not.toContain("BDI");
  });

  it("usa nome quando não há descricao", () => {
    const semDesc = arvoreDe([{ ...ITENS_COM_CUSTO[0], descricao: null }]);
    const h = gerarMemorialHtml(semDesc, OBRA);
    expect(h).toContain("Ponto de tomada");
  });

  it("árvore vazia gera HTML válido com aviso, sem quebrar", () => {
    const h = gerarMemorialHtml([], OBRA);
    expect(h).toContain("Nenhum item de escopo");
    expect(h).toContain("<!doctype html>");
  });

  it("nota de migração pendente aparece quando solicitada", () => {
    const h = gerarMemorialHtml(arvoreDe(ITENS_SEM_CUSTO), OBRA, { migracaoPendente: true });
    expect(h).toMatch(/após aplicar a migração/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  CSV — colunas, persona, subtotais, tolerância
// ══════════════════════════════════════════════════════════════════════════════
describe("colunasCsv (persona)", () => {
  it("executor vê todas as colunas (custo + preço + margem)", () => {
    const cols = colunasCsv("executor");
    expect(cols).toContain("Custo Material");
    expect(cols).toContain("Preço Unit");
    expect(cols).toContain("Margem %");
    expect(cols).toContain("BDI");
  });
  it("hub vê todas as colunas (é o auditor)", () => {
    expect(colunasCsv("hub")).toContain("Margem %");
  });
  it("prestador vê preço mas NÃO custo nem margem", () => {
    const cols = colunasCsv("prestador");
    expect(cols).toContain("Preço Unit");
    expect(cols).toContain("Total");
    expect(cols).not.toContain("Custo Material");
    expect(cols).not.toContain("Custo MO");
    expect(cols).not.toContain("Margem %");
    expect(cols).not.toContain("BDI");
  });
  it("arquiteto NÃO vê nenhuma coluna de dinheiro (só descritiva)", () => {
    const cols = colunasCsv("arquiteto");
    expect(cols).toEqual(["Ambiente", "Disciplina", "Código", "Descrição", "Quant", "Unid"]);
  });
});

describe("gerarOrcamentoCsv", () => {
  it("executor: cabeçalho + linhas + subtotal por ambiente, com dinheiro", () => {
    const csv = gerarOrcamentoCsv(arvoreDe(ITENS_COM_CUSTO), "executor");
    const linhas = csv.split("\r\n");
    // cabeçalho
    expect(linhas[0]).toContain("Ambiente,Disciplina,Código,Descrição,Quant,Unid");
    // item 1: custo unit = 0+15+35 = 50; preço unit = 50*1.06 = 53; total = 53*10 = 530
    const linhaItem1 = linhas.find((l) => l.includes("CZ.E1"));
    expect(linhaItem1).toBeTruthy();
    expect(linhaItem1).toContain("50"); // custo unit
    expect(linhaItem1).toContain("53"); // preço unit
    // subtotal de ambiente presente
    expect(csv).toContain("SUBTOTAL · Cozinha");
    expect(csv).toContain("SUBTOTAL · Sala");
  });

  it("o 'mesmo fio': o total do CSV bate com o subtotal da MESMA árvore", () => {
    const arvore = arvoreDe(ITENS_COM_CUSTO);
    const csv = gerarOrcamentoCsv(arvore, "executor");
    const cozinha = arvore.find((a) => a.label === "Cozinha")!;
    // o subtotal de preço da cozinha calculado pela árvore deve constar na linha SUBTOTAL do CSV
    const linhaSub = csv.split("\r\n").find((l) => l.startsWith("SUBTOTAL · Cozinha"));
    expect(linhaSub).toContain(String(cozinha.subtotal.preco));
  });

  it("prestador: SEM colunas de custo/margem, COM preço", () => {
    const csv = gerarOrcamentoCsv(arvoreDe(ITENS_COM_CUSTO), "prestador");
    const header = csv.split("\r\n").find((l) => l.startsWith("Ambiente"))!;
    expect(header).toContain("Preço Unit");
    expect(header).not.toContain("Custo");
    expect(header).not.toContain("Margem");
  });

  it("arquiteto: CSV puramente descritivo (quantidade preservada, sem dinheiro)", () => {
    const csv = gerarOrcamentoCsv(arvoreDe(ITENS_COM_CUSTO), "arquiteto");
    const header = csv.split("\r\n").find((l) => l.startsWith("Ambiente"))!;
    expect(header).toBe("Ambiente,Disciplina,Código,Descrição,Quant,Unid");
    expect(csv).not.toContain("R$");
    expect(csv).not.toContain("Custo");
    // ainda traz a quantidade dos itens
    expect(csv).toContain("10");
    // nota honesta de perfil sem valores
    expect(csv).toMatch(/não exibe valores/i);
  });

  it("escapa descrição com vírgula corretamente na célula", () => {
    const itens = [
      {
        ...ITENS_COM_CUSTO[0],
        descricao: "Tomada, dupla, 220V",
      },
    ];
    const csv = gerarOrcamentoCsv(arvoreDe(itens), "executor");
    expect(csv).toContain('"Tomada, dupla, 220V"');
  });

  it("TOLERÂNCIA: sem custo, sai com quantidade e nota honesta, colunas de dinheiro vazias", () => {
    const csv = gerarOrcamentoCsv(arvoreDe(ITENS_SEM_CUSTO, 1.0), "executor", {
      migracaoPendente: true,
    });
    // nota no topo
    expect(csv).toMatch(/migração E7/i);
    // quantidade presente
    const linhaItem = csv.split("\r\n").find((l) => l.includes("CZ.E1"))!;
    expect(linhaItem).toContain("10"); // quant
    expect(linhaItem).toContain("unid");
    // o item sem custo: custo_total/preço_total null → célula Total vazia (termina sem número de R$)
    // a linha NÃO deve conter um total de preço inventado
    expect(linhaItem).not.toContain("R$");
  });
});

describe("nomeArquivo", () => {
  it("gera nome ascii a partir do código da obra", () => {
    expect(nomeArquivo("memorial", { codigo: "P2K25.100.03" }, "html")).toBe(
      "memorial-p2k25-100-03.html"
    );
  });
  it("remove acentos e espaços do título quando não há código", () => {
    expect(nomeArquivo("orcamento", { titulo: "Reforma São João" }, "csv")).toBe(
      "orcamento-reforma-sao-joao.csv"
    );
  });
  it("fallback p/ 'obra' quando não há nada útil", () => {
    expect(nomeArquivo("memorial", {}, "html")).toBe("memorial-obra.html");
  });
});

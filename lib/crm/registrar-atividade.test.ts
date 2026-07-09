import { describe, expect, it } from "vitest";
import { montarLinhaAtividade, registrarAtividade } from "./registrar-atividade";

const TENANT = "00000000-0000-4000-8000-000000000001";

describe("montarLinhaAtividade — timeline universal", () => {
  it("nota de fornecedor preenche entity_* e NÃO as colunas legadas de lead/negócio", () => {
    const l = montarLinhaAtividade({ entity_type: "fornecedor", entity_id: "f-1", descricao: "Homologado", tenant_id: TENANT }) as Record<string, unknown>;
    expect(l.entity_type).toBe("fornecedor");
    expect(l.entity_id).toBe("f-1");
    expect(l.lead_id).toBeUndefined();
    expect(l.negocio_id).toBeUndefined();
    expect(l.tipo).toBe("nota");
    expect(l.feito_por_tipo).toBe("humano");
  });
  it("lead/negocio/pessoa preenchem também a coluna legada (compat com fichas atuais)", () => {
    expect((montarLinhaAtividade({ entity_type: "lead", entity_id: "l-1", descricao: "x", tenant_id: TENANT }) as Record<string, unknown>).lead_id).toBe("l-1");
    expect((montarLinhaAtividade({ entity_type: "negocio", entity_id: "n-1", descricao: "x", tenant_id: TENANT }) as Record<string, unknown>).negocio_id).toBe("n-1");
    expect((montarLinhaAtividade({ entity_type: "pessoa", entity_id: "p-1", descricao: "x", tenant_id: TENANT }) as Record<string, unknown>).pessoa_id).toBe("p-1");
  });
  it("entity ou descrição vazios → erro", () => {
    expect(montarLinhaAtividade({ entity_type: "", entity_id: "x", descricao: "y" })).toEqual({ erro: "entity_type e entity_id obrigatórios" });
    expect(montarLinhaAtividade({ entity_type: "lead", entity_id: "x", descricao: "  " })).toEqual({ erro: "descrição obrigatória" });
  });
});

describe("registrarAtividade — insere best-effort", () => {
  it("insere e devolve o id", async () => {
    let inserted: unknown = null;
    const q: Record<string, unknown> = {};
    q.from = () => q;
    q.insert = (r: unknown) => { inserted = r; return q; };
    q.select = () => q;
    q.single = () => Promise.resolve({ data: { id: "a-1" }, error: null });
    const r = await registrarAtividade(q as never, { entity_type: "obra", entity_id: "o-1", descricao: "Visita técnica", tenant_id: TENANT });
    expect(r).toEqual({ ok: true, id: "a-1" });
    expect((inserted as Record<string, unknown>).entity_type).toBe("obra");
  });
  it("erro de insert → ok:false sem lançar", async () => {
    const q: Record<string, unknown> = {};
    q.from = () => q; q.insert = () => q; q.select = () => q;
    q.single = () => Promise.resolve({ data: null, error: { message: "boom" } });
    const r = await registrarAtividade(q as never, { entity_type: "obra", entity_id: "o-1", descricao: "x", tenant_id: TENANT });
    expect(r.ok).toBe(false);
  });
});

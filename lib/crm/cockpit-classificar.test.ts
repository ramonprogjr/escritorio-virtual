import { describe, it, expect } from "vitest";
import {
  normalizarStatusObra,
  avancoMedio,
  proximoMarco,
  ehAtrasada,
  ehProxima15,
  derivarSaude,
  ordenarPorUrgencia,
  passaFiltroSaude,
  rotuloPrazo,
  diasEntre,
  soData,
  type FaseCronograma,
  type ObraCard,
  type SaudeObra,
} from "./cockpit-classificar";

const HOJE = "2026-06-29";

function fase(p: Partial<FaseCronograma>): FaseCronograma {
  return {
    fase: p.fase ?? "Fase",
    percentual: p.percentual ?? 0,
    data_prevista: p.data_prevista ?? null,
    concluida: p.concluida ?? false,
  };
}

function card(p: Partial<ObraCard> & { saude: SaudeObra }): ObraCard {
  return {
    id: p.id ?? "x",
    titulo: p.titulo ?? "Obra",
    codigo: p.codigo ?? null,
    tipo_obra: p.tipo_obra ?? null,
    status: p.status ?? null,
    cidade: p.cidade ?? null,
    estado: p.estado ?? null,
    saude: p.saude,
    avanco: p.avanco ?? null,
    proximoMarco: p.proximoMarco ?? null,
    atrasados: p.atrasados ?? 0,
    ocorrenciasCriticas: p.ocorrenciasCriticas ?? 0,
    pedidosAbertos: p.pedidosAbertos ?? 0,
    temCronograma: p.temCronograma ?? true,
  };
}

describe("cockpit — normalização de status", () => {
  it("mapeia legado em_andamento → ativa e concluida → encerrada", () => {
    expect(normalizarStatusObra("em_andamento")).toBe("ativa");
    expect(normalizarStatusObra("concluida")).toBe("encerrada");
    expect(normalizarStatusObra("planejamento")).toBe("planejamento");
    expect(normalizarStatusObra("")).toBe("planejamento");
    expect(normalizarStatusObra(null)).toBe("planejamento");
  });
});

describe("cockpit — datas e prazos", () => {
  it("soData extrai YYYY-MM-DD de ISO com hora", () => {
    expect(soData("2026-06-29T10:00:00Z")).toBe("2026-06-29");
    expect(soData("2026-06-29")).toBe("2026-06-29");
    expect(soData(null)).toBeNull();
    expect(soData("lixo")).toBeNull();
  });

  it("diasEntre conta dias corretamente", () => {
    expect(diasEntre(HOJE, "2026-06-30")).toBe(1);
    expect(diasEntre(HOJE, "2026-06-28")).toBe(-1);
    expect(diasEntre(HOJE, HOJE)).toBe(0);
  });

  it("rotuloPrazo descreve atraso e futuro", () => {
    expect(rotuloPrazo(-2)).toBe("venceu há 2d");
    expect(rotuloPrazo(-1)).toBe("venceu ontem");
    expect(rotuloPrazo(0)).toBe("vence hoje");
    expect(rotuloPrazo(1)).toBe("vence amanhã");
    expect(rotuloPrazo(5)).toBe("vence em 5d");
  });
});

describe("cockpit — avanço médio das fases", () => {
  it("média de percentual, clampada 0..100", () => {
    expect(avancoMedio([fase({ percentual: 50 }), fase({ percentual: 100 })])).toBe(75);
    expect(avancoMedio([fase({ percentual: 150 }), fase({ percentual: 0 })])).toBe(50);
    expect(avancoMedio([fase({ percentual: null })])).toBe(0);
  });
  it("sem fases → null (sem cronograma, não 0%)", () => {
    expect(avancoMedio([])).toBeNull();
  });
});

describe("cockpit — atraso e próximos 15 dias", () => {
  it("fase vencida e não concluída é atrasada", () => {
    expect(ehAtrasada(fase({ data_prevista: "2026-06-20" }), HOJE)).toBe(true);
    expect(ehAtrasada(fase({ data_prevista: "2026-06-20", concluida: true }), HOJE)).toBe(false);
    expect(ehAtrasada(fase({ data_prevista: "2026-07-10" }), HOJE)).toBe(false);
    expect(ehAtrasada(fase({ data_prevista: null }), HOJE)).toBe(false);
  });
  it("próximos 15 dias inclui hoje..+15, exclui vencidos e >15", () => {
    expect(ehProxima15(fase({ data_prevista: HOJE }), HOJE)).toBe(true);
    expect(ehProxima15(fase({ data_prevista: "2026-07-14" }), HOJE)).toBe(true); // +15
    expect(ehProxima15(fase({ data_prevista: "2026-07-15" }), HOJE)).toBe(false); // +16
    expect(ehProxima15(fase({ data_prevista: "2026-06-28" }), HOJE)).toBe(false); // vencido
  });
});

describe("cockpit — próximo marco", () => {
  it("escolhe a MENOR data futura não concluída", () => {
    const m = proximoMarco(
      [
        fase({ fase: "A", data_prevista: "2026-07-10" }),
        fase({ fase: "B", data_prevista: "2026-07-02" }),
        fase({ fase: "C", data_prevista: "2026-07-05", concluida: true }),
      ],
      HOJE
    );
    expect(m?.fase).toBe("B");
    expect(m?.dias).toBe(diasEntre(HOJE, "2026-07-02"));
  });
  it("ignora datas vencidas (viram atrasados, não marco)", () => {
    const m = proximoMarco([fase({ data_prevista: "2026-06-01" })], HOJE);
    expect(m).toBeNull();
  });
});

describe("cockpit — derivação de saúde", () => {
  const base = {
    status: "em_andamento",
    atrasados: 0,
    ocorrenciasCriticas: 0,
    pedidosAbertos: 0,
    diasProximoMarco: null as number | null,
    temCronograma: true,
  };
  it("ocorrência crítica → crítica", () => {
    expect(derivarSaude({ ...base, ocorrenciasCriticas: 1 })).toBe("critica");
  });
  it("fase vencida → atrasada", () => {
    expect(derivarSaude({ ...base, atrasados: 2 })).toBe("atrasada");
  });
  it("marco em ≤2d (futuro próximo) → urgente, não atrasada; ≤7d → atenção", () => {
    // "atrasada" é reservado a item REALMENTE vencido (vive na fila Atrasados);
    // um marco que ainda vai vencer em ≤2d é "urgente" (fila Próximos 15d).
    expect(derivarSaude({ ...base, diasProximoMarco: 0 })).toBe("urgente");
    expect(derivarSaude({ ...base, diasProximoMarco: 1 })).toBe("urgente");
    expect(derivarSaude({ ...base, diasProximoMarco: 2 })).toBe("urgente");
    expect(derivarSaude({ ...base, diasProximoMarco: 5 })).toBe("atencao");
    expect(derivarSaude({ ...base, diasProximoMarco: 20 })).toBe("ok");
  });
  it("fase vencida (atrasados>0) continua → atrasada", () => {
    expect(derivarSaude({ ...base, atrasados: 1, diasProximoMarco: 1 })).toBe("atrasada");
  });
  it("pausada e encerrada respeitam o status macro", () => {
    expect(derivarSaude({ ...base, status: "pausada", atrasados: 9 })).toBe("pausada");
    expect(derivarSaude({ ...base, status: "concluida" })).toBe("encerrada");
    expect(derivarSaude({ ...base, status: "cancelada" })).toBe("encerrada");
  });
  it("sem cronograma → planejamento", () => {
    expect(derivarSaude({ ...base, status: "planejamento", temCronograma: false })).toBe("planejamento");
    expect(derivarSaude({ ...base, temCronograma: false })).toBe("planejamento");
  });
  it("ocorrência crítica vence o status pausada? NÃO — pausada é macro e sai da fila", () => {
    // Decisão de design: obra pausada não entra na fila de urgência mesmo com sinais.
    expect(derivarSaude({ ...base, status: "pausada", ocorrenciasCriticas: 3 })).toBe("pausada");
  });
});

describe("cockpit — ordenação por urgência", () => {
  it("crítica antes de atrasada antes de ok; empate por nº de atrasados", () => {
    const ordenada = ordenarPorUrgencia([
      card({ id: "ok", saude: "ok", titulo: "Z" }),
      card({ id: "crit", saude: "critica", titulo: "C" }),
      card({ id: "atr1", saude: "atrasada", titulo: "B", atrasados: 1 }),
      card({ id: "atr2", saude: "atrasada", titulo: "A", atrasados: 5 }),
      card({ id: "enc", saude: "encerrada", titulo: "E" }),
    ]);
    expect(ordenada.map((c) => c.id)).toEqual(["crit", "atr2", "atr1", "ok", "enc"]);
  });
  it("urgente fica entre atrasada e atenção", () => {
    const ordenada = ordenarPorUrgencia([
      card({ id: "atn", saude: "atencao", titulo: "A" }),
      card({ id: "urg", saude: "urgente", titulo: "U" }),
      card({ id: "atr", saude: "atrasada", titulo: "R" }),
    ]);
    expect(ordenada.map((c) => c.id)).toEqual(["atr", "urg", "atn"]);
  });
});

describe("cockpit — filtro de saúde", () => {
  it("'critica' só crítica; 'atencao' inclui crítica/atrasada/atenção; 'ativas' exclui planejamento/encerrada", () => {
    const crit = card({ saude: "critica" });
    const atr = card({ saude: "atrasada" });
    const atn = card({ saude: "atencao" });
    const ok = card({ saude: "ok" });
    const plan = card({ saude: "planejamento" });
    const enc = card({ saude: "encerrada" });

    expect(passaFiltroSaude(crit, "")).toBe(true);
    expect(passaFiltroSaude(ok, "critica")).toBe(false);
    expect(passaFiltroSaude(crit, "critica")).toBe(true);

    expect(passaFiltroSaude(atr, "atencao")).toBe(true);
    expect(passaFiltroSaude(atn, "atencao")).toBe(true);
    expect(passaFiltroSaude(ok, "atencao")).toBe(false);

    expect(passaFiltroSaude(ok, "ativas")).toBe(true);
    expect(passaFiltroSaude(plan, "ativas")).toBe(false);
    expect(passaFiltroSaude(enc, "ativas")).toBe(false);

    expect(passaFiltroSaude(plan, "planejamento")).toBe(true);
    expect(passaFiltroSaude(ok, "planejamento")).toBe(false);
  });
  it("'urgente' entra em 'atencao' e 'ativas'", () => {
    const urg = card({ saude: "urgente" });
    expect(passaFiltroSaude(urg, "atencao")).toBe(true);
    expect(passaFiltroSaude(urg, "ativas")).toBe(true);
    expect(passaFiltroSaude(urg, "planejamento")).toBe(false);
  });
});

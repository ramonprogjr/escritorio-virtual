import { describe, expect, it } from "vitest";
import {
  montarPayloadCriacaoAgente,
  type PayloadCriacaoAgenteInput,
} from "./montar-payload-criacao-agente";

/** Paridade: prova que a lib pura monta o payload IDÊNTICO ao inline do wizard nos 3 perfis. Qualquer
 *  drift na forma do payload (que o servidor consome) quebra este teste. */

const base: PayloadCriacaoAgenteInput = {
  nome: "Mari",
  mercados: ["IMB", "ARQ"],
  personalidade: "Cordial e objetiva",
  conhecimentoSecoes: { atendimento: "## Tarefas\n- Atender" },
  motorFerramentasHub: true,
  mistralProvisionar: false,
  usoFerramentasIa: { hub_lead_resumo: true },
  modeloPreferencia: "mistral",
  somentePlaybook: false,
  cargoSlug: "sdr-imobiliario",
  setorAgente: "imobiliario",
  hubCicloEstrategia: "padrao",
  hubCiclosVincularIds: [],
  modoOperacao: "interno",
  modoExecucao: "manual",
  agendaIntervalMin: 60,
};

describe("montarPayloadCriacaoAgente — paridade com o wizard", () => {
  it("campos base sempre presentes", () => {
    const p = montarPayloadCriacaoAgente(base);
    expect(p).toMatchObject({
      nome: "Mari",
      prefixo_mercado: "IMB,ARQ",
      personalidade: "Cordial e objetiva",
      system_prompt_base: "",
      conhecimento_secoes: { atendimento: "## Tarefas\n- Atender" },
      bio: null,
      horario_inicio: "08:00",
      horario_fim: "22:00",
      motor_ferramentas_habilitado: true,
      mistral_agent_sync_habilitado: false,
      uso_ferramentas_ia: { hub_lead_resumo: true },
      modelo_preferencia: "mistral",
      setor_ia: "imobiliario",
    });
  });

  it("perfil A — cargo + canal_whatsapp (atendimento): cargo_slug + ciclo_execucao=interacao", () => {
    const p = montarPayloadCriacaoAgente({ ...base, modoOperacao: "canal_whatsapp" }); // modoExecucao=manual (base)
    expect(p.cargo_slug).toBe("sdr-imobiliario");
    expect(p.playbook_only).toBeUndefined();
    expect(p.modo_operacao).toBe("canal_whatsapp");
    expect(p.ciclo_execucao).toBe("interacao"); // canal_whatsapp força interacao
    expect(p.ciclo_intervalo_minutos).toBeUndefined(); // modoExecucao=manual
  });

  it("FIEL AO ORIGINAL: ramo padrao seta intervalo p/ agenda mesmo com canal_whatsapp (guarda de wa só existe em somente_vincular)", () => {
    const p = montarPayloadCriacaoAgente({ ...base, modoOperacao: "canal_whatsapp", modoExecucao: "agenda", agendaIntervalMin: 15 });
    expect(p.ciclo_intervalo_minutos).toBe(15); // não é bug da lib — é o comportamento inline do wizard
  });

  it("perfil B — cargo + interno + agenda: intervalo aplicado", () => {
    const p = montarPayloadCriacaoAgente({ ...base, modoOperacao: "interno", modoExecucao: "agenda", agendaIntervalMin: 30 });
    expect(p.modo_operacao).toBe("interno");
    expect(p.ciclo_execucao).toBe("agenda");
    expect(p.ciclo_intervalo_minutos).toBe(30);
    expect(p.cargo_slug).toBe("sdr-imobiliario");
  });

  it("perfil C — só-playbook: playbook_only=true, sem cargo_slug, setor null", () => {
    const p = montarPayloadCriacaoAgente({ ...base, somentePlaybook: true, cargoSlug: null, setorAgente: null });
    expect(p.playbook_only).toBe(true);
    expect(p.cargo_slug).toBeUndefined();
    expect(p.setor_ia).toBeNull();
  });

  it("estratégia somente_vincular: omit_hub_ciclo_padrao + ids, intervalo só p/ agenda não-whatsapp", () => {
    const p = montarPayloadCriacaoAgente({
      ...base,
      hubCicloEstrategia: "somente_vincular",
      hubCiclosVincularIds: ["c1", "c2"],
      modoOperacao: "interno",
      modoExecucao: "agenda",
      agendaIntervalMin: 45,
    });
    expect(p.omit_hub_ciclo_padrao).toBe(true);
    expect(p.ciclos_vincular_ids).toEqual(["c1", "c2"]);
    expect(p.ciclo_intervalo_minutos).toBe(45);
  });

  it("padrao com ciclos vinculados: adiciona ids sem omit_hub_ciclo_padrao", () => {
    const p = montarPayloadCriacaoAgente({ ...base, hubCiclosVincularIds: ["x"] });
    expect(p.omit_hub_ciclo_padrao).toBeUndefined();
    expect(p.ciclos_vincular_ids).toEqual(["x"]);
  });
});

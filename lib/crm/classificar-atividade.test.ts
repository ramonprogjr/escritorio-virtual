import { describe, expect, it } from "vitest";
import { classificarAtividade, categoriaPermiteAutor, categoriaEhImutavel } from "./classificar-atividade";

/**
 * Paridade com a função SQL hub_atividade_categoria + barreira de regressão: passa o payload REAL de cada
 * write-site (tipo, feito_por_tipo, metadata) e afirma a categoria esperada. Se entrar um write novo com
 * combo inesperado, o teste que cobre esse combo quebra — nunca some/polui em silêncio.
 */

describe("classificarAtividade", () => {
  describe("comentário (nota humana — único editável pelo autor)", () => {
    it("nota + humano = comentario", () => {
      expect(classificarAtividade("nota", "humano", {})).toBe("comentario");
      expect(classificarAtividade("nota", "humano", null)).toBe("comentario");
    });
  });

  describe("log (ruído — oculto + imutável)", () => {
    it("origem de resumo interno do playbook = log", () => {
      expect(classificarAtividade("nota", "ia", { origem: "playbook_complete_summary" })).toBe("log");
    });
    it("origem persistir dados lead = log", () => {
      expect(classificarAtividade("ia_acao", "ia", { origem: "persistir_dados_lead_whatsapp" })).toBe("log");
    });
    it("guard de mídia / skip_ia = log", () => {
      expect(classificarAtividade("mensagem", "ia", { skip_ia: true })).toBe("log");
      expect(classificarAtividade("mensagem", "ia", { midia_nao_processada: true })).toBe("log");
    });
    it("mensagem que NÃO é a primeira (transcript) = log", () => {
      expect(classificarAtividade("mensagem", "ia", {})).toBe("log");
      expect(classificarAtividade("mensagem", "humano", { origem: "crm_atendimento" })).toBe("log");
      expect(classificarAtividade("mensagem", "ia", { primeira_mensagem: false })).toBe("log");
    });
  });

  describe("atividade_principal (marcos — só owner altera)", () => {
    it("status_change (humano e IA) = principal — o exemplo do dono", () => {
      expect(classificarAtividade("status_change", "humano", {})).toBe("atividade_principal");
      expect(classificarAtividade("status_change", "ia", {})).toBe("atividade_principal");
    });
    it("proposta = principal", () => {
      expect(classificarAtividade("proposta", "humano", {})).toBe("atividade_principal");
    });
    it("reuniao = principal (o 'agendou reunião' do dono; NÃO existe tipo 'agendamento')", () => {
      expect(classificarAtividade("reuniao", "humano", {})).toBe("atividade_principal");
    });
    it("primeira mensagem WhatsApp = principal (nascimento do lead)", () => {
      expect(classificarAtividade("mensagem", "ia", { primeira_mensagem: "true" })).toBe("atividade_principal");
      expect(classificarAtividade("mensagem", "ia", { primeira_mensagem: true })).toBe("atividade_principal");
    });
    it("ia_acao (handoff humano rotulado ia_acao + auto-avanço) = principal", () => {
      expect(classificarAtividade("ia_acao", "humano", {})).toBe("atividade_principal");
      expect(classificarAtividade("ia_acao", "ia", {})).toBe("atividade_principal");
    });
    it("nota deliberada da IA (hub_registar_nota_lead) = principal, não comentário", () => {
      expect(classificarAtividade("nota", "ia", {})).toBe("atividade_principal");
    });
  });

  describe("default fail-closed assimétrico", () => {
    it("humano com tipo desconhecido/interação nunca some (principal)", () => {
      expect(classificarAtividade("follow_up", "humano", {})).toBe("atividade_principal");
      expect(classificarAtividade("ligacao", "humano", {})).toBe("atividade_principal");
      expect(classificarAtividade("email", "humano", {})).toBe("atividade_principal");
      expect(classificarAtividade("tipo_novo_qualquer", "humano", {})).toBe("atividade_principal");
    });
    it("ia/desconhecido com tipo não-allowlist vira log (nunca polui)", () => {
      expect(classificarAtividade("follow_up", "ia", {})).toBe("log");
      expect(classificarAtividade("qualquer", "", {})).toBe("log");
      expect(classificarAtividade("memoria_salva", "ia", {})).toBe("log");
    });
  });

  describe("combos REAIS de produção (F0 — snapshot de 55 linhas)", () => {
    const reais: Array<[string, string, string]> = [
      ["status_change", "humano", "atividade_principal"],
      ["nota", "humano", "comentario"],
      ["proposta", "humano", "atividade_principal"],
      ["ia_acao", "humano", "atividade_principal"],
      ["ia_acao", "ia", "atividade_principal"],
      ["status_change", "ia", "atividade_principal"],
    ];
    for (const [tipo, fpt, esperado] of reais) {
      it(`${tipo}/${fpt} → ${esperado}`, () => {
        expect(classificarAtividade(tipo, fpt, {})).toBe(esperado);
      });
    }
  });

  describe("helpers de permissão", () => {
    it("só comentário permite autor", () => {
      expect(categoriaPermiteAutor("comentario")).toBe(true);
      expect(categoriaPermiteAutor("atividade_principal")).toBe(false);
      expect(categoriaPermiteAutor("log")).toBe(false);
    });
    it("só log é imutável", () => {
      expect(categoriaEhImutavel("log")).toBe(true);
      expect(categoriaEhImutavel("comentario")).toBe(false);
      expect(categoriaEhImutavel("atividade_principal")).toBe(false);
    });
  });
});

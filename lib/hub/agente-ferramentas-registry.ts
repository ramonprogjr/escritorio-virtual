/**
 * Catálogo declarado de ferramentas Hub ↔ function calling (Mistral chat completions / Agents).
 * Cada tool tem schema estável e execução servidor em `executarFerramentasHub`.
 */

export type HubFerramentaCategoria = "cliente" | "analise" | "registos";

export type HubAgenteFerramentaId =
  | "hub_lead_resumo"
  | "hub_lead_memorias"
  | "hub_metricas_escritorio"
  | "hub_relatorio_html_simples"
  | "hub_registar_nota_lead";

export type HubAgenteFerramentaCatalogo = {
  id: HubAgenteFerramentaId;
  categoria: HubFerramentaCategoria;
  /** Rótulo curto na UI */
  titulo: string;
  descricao: string;
  /** Sugestão de pré-ligar em atendimento WhatsApp (não força default no servidor) */
  recomendadoWhatsApp: boolean;
  mistralFunction: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const HUB_AGENTE_FERRAMENTAS_CATALOGO: readonly HubAgenteFerramentaCatalogo[] = [
  {
    id: "hub_lead_resumo",
    categoria: "cliente",
    titulo: "Resumo do cliente (lead)",
    descricao:
      "Consulta estágio, dados de contacto e responsáveis no CRM para responder com factos sobre esta conversa.",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_lead_resumo",
      description:
        "Obtém um resumo factual do lead actual nesta conversa no CRM. Use antes de afirmar estado do negócio.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_lead_memorias",
    categoria: "cliente",
    titulo: "Memórias sobre o cliente",
    descricao:
      "Lista notas automáticas ou memorias guardadas sobre este cliente (preferências, histórico relevante).",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_lead_memorias",
      description:
        "Recupera memorias conhecidas sobre o lead (preferências, objeções, histórico relevante). Chame quando precisar lembrar contexto.",
      parameters: {
        type: "object",
        properties: {
          limite: {
            type: "integer",
            description: "N máximo de memorias (1–10). Omita para 5.",
            minimum: 1,
            maximum: 10,
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_metricas_escritorio",
    categoria: "analise",
    titulo: "Métricas rápidas do escritório",
    descricao:
      "Devolve contagens agregadas (total de leads no tenant e volume recente de acções/atividade ligadas a este modelo). Só leitura.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_metricas_escritorio",
      description:
        "Obtém contagens agregadas do CRM para contextualizar respostas (escopo tenant + agente). Não substitui relatório financeiro completo.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_relatorio_html_simples",
    categoria: "analise",
    titulo: "Página HTML + link público",
    descricao:
      "Gera uma página HTML simples (título + texto em segurança), guarda no armazenamento e devolve um URL para abrir noutra janela.",
    recomendadoWhatsApp: false,
    mistralFunction: {
      name: "hub_relatorio_html_simples",
      description:
        "Gera relatório HTML minimalista com texto plano escapado e devolve URL público. Use quando o utilizador pedir página para partilhar ou rever fora do chat.",
      parameters: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Título curto da página (obrigatório).",
          },
          texto_plano: {
            type: "string",
            description: "Corpo em texto simples (sem HTML); será escapado no servidor.",
          },
        },
        required: ["titulo", "texto_plano"],
        additionalProperties: false,
      },
    },
  },
  {
    id: "hub_registar_nota_lead",
    categoria: "registos",
    titulo: "Registar nota na linha do tempo",
    descricao:
      "Cria uma entrada de nota na linha do tempo do cliente no CRM (sem apagar nem alterar registos existentes). Útil em atendimento.",
    recomendadoWhatsApp: true,
    mistralFunction: {
      name: "hub_registar_nota_lead",
      description:
        "Regista uma nota na timeline do lead actual (tipo nota, origem IA). Não apaga dados. Texto deve ser factual e breve.",
      parameters: {
        type: "object",
        properties: {
          texto: {
            type: "string",
            description: "Texto da nota (conteúdo visível ao equipa no CRM).",
          },
        },
        required: ["texto"],
        additionalProperties: false,
      },
    },
  },
] as const;

const IDS = new Set(HUB_AGENTE_FERRAMENTAS_CATALOGO.map((t) => t.id));

export function isHubAgenteFerramentaId(v: string): v is HubAgenteFerramentaId {
  return IDS.has(v as HubAgenteFerramentaId);
}

/** Mapa id → ativo; chaves desconhecidas são ignoradas. */
export function normalizarUsoFerramentasIa(raw: unknown): Partial<Record<HubAgenteFerramentaId, boolean>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<HubAgenteFerramentaId, boolean>> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!isHubAgenteFerramentaId(k)) continue;
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

export function ferramentasMistralParaAgente(
  uso: Partial<Record<HubAgenteFerramentaId, boolean>>
): Array<{ type: "function"; function: HubAgenteFerramentaCatalogo["mistralFunction"] }> {
  const out: Array<{ type: "function"; function: HubAgenteFerramentaCatalogo["mistralFunction"] }> = [];
  for (const item of HUB_AGENTE_FERRAMENTAS_CATALOGO) {
    if (uso[item.id] === true) {
      out.push({ type: "function", function: item.mistralFunction });
    }
  }
  return out;
}

export function mergeUsoFerramentasComPadrao(
  uso: Partial<Record<HubAgenteFerramentaId, boolean>>
): Record<HubAgenteFerramentaId, boolean> {
  const base: Record<HubAgenteFerramentaId, boolean> = {
    hub_lead_resumo: false,
    hub_lead_memorias: false,
    hub_metricas_escritorio: false,
    hub_relatorio_html_simples: false,
    hub_registar_nota_lead: false,
  };
  for (const id of Object.keys(base) as HubAgenteFerramentaId[]) {
    if (uso[id] === true) base[id] = true;
  }
  return base;
}

export const HUB_FERRAMENTA_SECAO_LABEL: Record<HubFerramentaCategoria, string> = {
  cliente: "Dados do cliente nesta conversa",
  analise: "Análise e partilha",
  registos: "Registos no CRM",
};

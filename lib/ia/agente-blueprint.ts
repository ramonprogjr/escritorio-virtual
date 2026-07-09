import { isHubAgenteFerramentaId, type HubAgenteFerramentaId } from "@/lib/hub/agente-ferramentas-registry";

/**
 * F6 (plano de agentes) — o DIAMANTE: "criar agente com IA". O dono descreve (voz/texto/PDF) e a IA
 * devolve um BLUEPRINT. Esta lib VALIDA o blueprint contra os catálogos REAIS: ferramenta/cargo que a IA
 * inventou é DESCARTADO com aviso (nunca persiste). Núcleo puro e testável — a rota fornece os cargos
 * válidos; a UI mostra os avisos. NÃO chama IA aqui (só valida a saída dela).
 *
 * Provider trocável (Mistral→Anthropic): o prompt/geração fica na rota; a validação é agnóstica.
 */

export type AgenteBlueprint = {
  modo_operacao: "canal_whatsapp" | "interno";
  cargo_slug: string | null;
  nome: string;
  tom: string;
  prompt: string;
  conhecimento: string[];
  ferramentas: HubAgenteFerramentaId[];
  perguntas: string[];
};

export type ValidarBlueprintResult = {
  blueprint: AgenteBlueprint;
  /** Avisos legíveis do que a IA sugeriu mas foi descartado (id inexistente, cargo desconhecido). */
  avisos: string[];
};

function asObj(v: unknown): Record<string, unknown> {
  if (typeof v === "string") {
    try {
      const s = v.trim();
      const ini = s.indexOf("{");
      const fim = s.lastIndexOf("}");
      return JSON.parse(ini >= 0 && fim > ini ? s.slice(ini, fim + 1) : s) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function strArray(v: unknown, maxItens: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x ?? "").trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItens);
}

/**
 * Valida e SANEIA o blueprint cru da IA. Nunca lança; sempre devolve um blueprint aplicável.
 * @param opts.cargosValidos slugs do catálogo real (/api/hub/cargos) — cargo fora disso é descartado.
 */
export function validarBlueprint(
  raw: unknown,
  opts: { cargosValidos: readonly string[] }
): ValidarBlueprintResult {
  const o = asObj(raw);
  const avisos: string[] = [];

  // modo: default INTERNO (copiloto); canal_whatsapp só se a IA marcou explicitamente.
  const modo = String(o.modo_operacao ?? "").trim().toLowerCase();
  const modo_operacao: AgenteBlueprint["modo_operacao"] = modo === "canal_whatsapp" ? "canal_whatsapp" : "interno";

  // cargo: só se existir no catálogo REAL; senão null (o servidor lida com só-playbook) + aviso.
  const cargoRaw = String(o.cargo_slug ?? "").trim();
  let cargo_slug: string | null = null;
  if (cargoRaw) {
    if (opts.cargosValidos.includes(cargoRaw)) {
      cargo_slug = cargoRaw;
    } else {
      avisos.push(`Sugeri o cargo "${cargoRaw}", mas ele não existe no catálogo — o agente nasce sem cargo (só playbook).`);
    }
  }

  // ferramentas: só ids reais do registry; alucinadas são descartadas com aviso.
  const ferramentas: HubAgenteFerramentaId[] = [];
  if (Array.isArray(o.ferramentas)) {
    const vistos = new Set<string>();
    for (const f of o.ferramentas) {
      const id = String(f ?? "").trim();
      if (!id || vistos.has(id)) continue;
      vistos.add(id);
      if (isHubAgenteFerramentaId(id)) ferramentas.push(id);
      else avisos.push(`Sugeri a ferramenta "${id}", mas ela não existe no sistema — foi ignorada.`);
    }
  }

  const nome = String(o.nome ?? "").trim().slice(0, 80) || "Novo agente";
  const tom = String(o.tom ?? o.tom_voz ?? "").trim().slice(0, 200);
  const prompt = String(o.prompt ?? o.system_prompt_base ?? "").trim().slice(0, 6000);
  const conhecimento = strArray(o.conhecimento, 12, 2000);
  const perguntas = strArray(o.perguntas ?? o.perguntas_essenciais, 12, 300);

  return {
    blueprint: { modo_operacao, cargo_slug, nome, tom, prompt, conhecimento, ferramentas, perguntas },
    avisos,
  };
}

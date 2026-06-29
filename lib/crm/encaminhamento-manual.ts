/**
 * Direcionamento MANUAL (válvula de escape do motor) — helpers de rede.
 *
 * Quando o motor de score NÃO rankeia ninguém OU nenhum fornecedor homologado
 * combina, o gestor ainda precisa mandar o lead a um destino por PERFIL. Estes
 * helpers concentram as duas chamadas para reuso entre `DirecionarLeadDrawer`
 * (ficha/lista) e `FilaDistribuicao` (tela de Distribuição) — registro correto,
 * sem digitação solta, autorizado-por vindo da SESSÃO (não de campo digitado).
 *
 * Backends reusados (já existentes):
 *  - GET  /api/crm/fornecedores   → lista de destinos (homologados)
 *  - POST /api/crm/encaminhamentos → grava o encaminhamento (exige CRM_ENCAMINHAMENTO_V2)
 */

import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { DestinoOpcao } from "@/components/crm/DirecionarLeadCard";
import type { DestinoManual } from "@/lib/crm/direcionamento-ui";

type FornecedorRow = {
  id: string;
  nome: string;
  mercado_principal?: string | null;
  mercados?: unknown;
  cidade?: string | null;
  estado?: string | null;
};

/**
 * Carrega destinos para o perfil escolhido. Hoje a única fonte com lista é o
 * cadastro de Fornecedores homologados — usada para TODOS os perfis (o perfil
 * vira o `segmento` do encaminhamento). Falha de rede → lista vazia (o card
 * mostra "nenhum destino" e não deixa confirmar às cegas).
 */
export async function carregarDestinosManual(_perfilSlug: string): Promise<DestinoOpcao[]> {
  try {
    const res = await fetch("/api/crm/fornecedores?status=homologado", {
      credentials: "include",
      headers: internalApiHeaders(),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: FornecedorRow[] };
    if (!res.ok || !Array.isArray(json.data)) return [];
    return json.data.map((f) => {
      const mercado =
        (typeof f.mercado_principal === "string" && f.mercado_principal) ||
        (Array.isArray(f.mercados) && typeof f.mercados[0] === "string"
          ? (f.mercados[0] as string)
          : null);
      return {
        id: String(f.id),
        nome: String(f.nome),
        mercado,
        cidade: f.cidade ?? null,
        estado: f.estado ?? null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Grava o direcionamento manual em /encaminhamentos. Autorizado-por NÃO é campo
 * digitado: o backend usa o `responsavel_envio` que mandamos como "gestor"
 * (a sessão CRM é a autoridade real do registro). validado_humano=true porque é
 * uma escolha explícita do gestor (não sugestão de IA).
 *
 * Retorna { ok, error } — o chamador decide o toast.
 */
export async function gravarDestinoManual(
  leadId: string,
  destino: DestinoManual
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/crm/encaminhamentos", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({
        lead_id: leadId,
        segmento: destino.perfil,
        responsavel_envio: "gestor",
        destinatario_empresa_id: destino.destinoId,
        sugerido_ia: false,
        validado_humano: true,
        status: "enviado",
        criterio_selecao: destino.destinoNome,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: typeof json.error === "string" ? json.error : "Não foi possível direcionar." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro de rede ao direcionar." };
  }
}

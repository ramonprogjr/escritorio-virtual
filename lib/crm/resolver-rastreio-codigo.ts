import type { SupabaseClient } from "@supabase/supabase-js";
import { HUB_PREFIXO_CODIGO, type HubPrefixoCodigo } from "@/lib/crm/codigos-rastreio";

const CODIGO_REGEX = /^(PES|EMP|LED|NEG|PAR|IMO)-\d{4}-\d{4}$/i;

export type RastreioNo = {
  tipo: string;
  id: string;
  codigo: string | null;
  titulo: string;
  href: string;
  meta?: Record<string, unknown>;
};

export type RastreioCadeia = {
  codigo: string;
  prefixo: HubPrefixoCodigo;
  principal: RastreioNo;
  vinculos: RastreioNo[];
  negocios: RastreioNo[];
};

export function normalizarCodigoRastreio(raw: string): string | null {
  const c = raw.trim().toUpperCase();
  if (!CODIGO_REGEX.test(c)) return null;
  return c;
}

function prefixoDeCodigo(codigo: string): HubPrefixoCodigo | null {
  const p = codigo.split("-")[0] as HubPrefixoCodigo;
  if (Object.values(HUB_PREFIXO_CODIGO).includes(p)) return p;
  return null;
}

export async function resolverRastreioCodigo(
  supabase: SupabaseClient,
  codigoRaw: string
): Promise<RastreioCadeia | null> {
  const codigo = normalizarCodigoRastreio(codigoRaw);
  if (!codigo) return null;

  const prefixo = prefixoDeCodigo(codigo);
  if (!prefixo) return null;

  const vinculos: RastreioNo[] = [];
  const negocios: RastreioNo[] = [];
  let principal: RastreioNo | null = null;

  if (prefixo === "PES") {
    const { data } = await supabase
      .from("hub_pessoas")
      .select("id, codigo, nome, telefone, email")
      .eq("codigo", codigo)
      .maybeSingle();
    if (!data) return null;
    principal = {
      tipo: "pessoa",
      id: String(data.id),
      codigo: data.codigo != null ? String(data.codigo) : null,
      titulo: String(data.nome),
      href: `/crm/pessoas/${data.id}`,
    };
    const { data: leads } = await supabase
      .from("hub_leads_crm")
      .select("id, codigo, nome, estagio")
      .eq("pessoa_id", data.id)
      .limit(10);
    (leads ?? []).forEach((l) =>
      vinculos.push({
        tipo: "lead",
        id: String(l.id),
        codigo: l.codigo != null ? String(l.codigo) : null,
        titulo: String(l.nome),
        href: `/crm/leads/${l.id}`,
        meta: { estagio: l.estagio },
      })
    );
    const { data: negs } = await supabase
      .from("hub_negocios")
      .select("id, codigo, titulo, status, motivo_perda")
      .eq("pessoa_id", data.id)
      .limit(10);
    (negs ?? []).forEach((n) =>
      negocios.push({
        tipo: "negocio",
        id: String(n.id),
        codigo: n.codigo != null ? String(n.codigo) : null,
        titulo: String(n.titulo),
        href: `/crm/negocios/${n.id}`,
        meta: { status: n.status, motivo_perda: n.motivo_perda },
      })
    );
  } else if (prefixo === "EMP") {
    const { data } = await supabase
      .from("hub_empresas")
      .select("id, codigo, razao_social, nome_fantasia")
      .eq("codigo", codigo)
      .maybeSingle();
    if (!data) return null;
    principal = {
      tipo: "empresa",
      id: String(data.id),
      codigo: data.codigo != null ? String(data.codigo) : null,
      titulo: String(data.razao_social),
      href: `/crm/empresas/${data.id}`,
    };
    const { data: negs } = await supabase
      .from("hub_negocios")
      .select("id, codigo, titulo, status")
      .eq("empresa_id", data.id)
      .limit(10);
    (negs ?? []).forEach((n) =>
      negocios.push({
        tipo: "negocio",
        id: String(n.id),
        codigo: n.codigo != null ? String(n.codigo) : null,
        titulo: String(n.titulo),
        href: `/crm/negocios/${n.id}`,
      })
    );
  } else if (prefixo === "LED") {
    const { data } = await supabase
      .from("hub_leads_crm")
      .select("id, codigo, nome, estagio, pessoa_id, negocio_id, metadata")
      .eq("codigo", codigo)
      .maybeSingle();
    if (!data) return null;
    principal = {
      tipo: "lead",
      id: String(data.id),
      codigo: data.codigo != null ? String(data.codigo) : null,
      titulo: String(data.nome),
      href: `/crm/leads/${data.id}`,
      meta: { estagio: data.estagio },
    };
    if (data.pessoa_id) {
      const { data: pes } = await supabase
        .from("hub_pessoas")
        .select("id, codigo, nome")
        .eq("id", data.pessoa_id)
        .maybeSingle();
      if (pes) {
        vinculos.push({
          tipo: "pessoa",
          id: String(pes.id),
          codigo: pes.codigo != null ? String(pes.codigo) : null,
          titulo: String(pes.nome),
          href: `/crm/pessoas/${pes.id}`,
        });
      }
    }
    if (data.negocio_id) {
      const { data: neg } = await supabase
        .from("hub_negocios")
        .select("id, codigo, titulo, status, motivo_perda")
        .eq("id", data.negocio_id)
        .maybeSingle();
      if (neg) {
        negocios.push({
          tipo: "negocio",
          id: String(neg.id),
          codigo: neg.codigo != null ? String(neg.codigo) : null,
          titulo: String(neg.titulo),
          href: `/crm/negocios/${neg.id}`,
          meta: { status: neg.status, motivo_perda: neg.motivo_perda },
        });
      }
    }
  } else if (prefixo === "NEG") {
    const { data } = await supabase
      .from("hub_negocios")
      .select("id, codigo, titulo, status, motivo_perda, lead_id, pessoa_id")
      .eq("codigo", codigo)
      .maybeSingle();
    if (!data) return null;
    principal = {
      tipo: "negocio",
      id: String(data.id),
      codigo: data.codigo != null ? String(data.codigo) : null,
      titulo: String(data.titulo),
      href: `/crm/negocios/${data.id}`,
      meta: { status: data.status, motivo_perda: data.motivo_perda },
    };
    const { data: nv } = await supabase
      .from("hub_negocio_vinculos")
      .select("entidade_tipo, entidade_id, codigo_rastreio, papel")
      .eq("negocio_id", data.id);
    for (const row of nv ?? []) {
      const tipo = String(row.entidade_tipo);
      const eid = String(row.entidade_id);
      const href =
        tipo === "lead"
          ? `/crm/leads/${eid}`
          : tipo === "pessoa"
            ? `/crm/pessoas/${eid}`
            : tipo === "empresa"
              ? `/crm/empresas/${eid}`
              : tipo === "parceiro"
                ? `/crm/parceiros/${eid}`
                : "#";
      vinculos.push({
        tipo,
        id: eid,
        codigo: row.codigo_rastreio != null ? String(row.codigo_rastreio) : null,
        titulo: `${tipo} (${row.papel ?? "—"})`,
        href,
        meta: { papel: row.papel },
      });
    }
  } else if (prefixo === "PAR") {
    const { data } = await supabase
      .from("hub_parceiros")
      .select("id, codigo, nome, telefone")
      .eq("codigo", codigo)
      .maybeSingle();
    if (!data) return null;
    principal = {
      tipo: "parceiro",
      id: String(data.id),
      codigo: data.codigo != null ? String(data.codigo) : null,
      titulo: String(data.nome),
      href: `/crm/parceiros/${data.id}`,
    };
  } else if (prefixo === "IMO") {
    const { data } = await supabase
      .from("hub_imoveis")
      .select("id, codigo, titulo")
      .eq("codigo", codigo)
      .maybeSingle();
    if (!data) return null;
    principal = {
      tipo: "imovel",
      id: String(data.id),
      codigo: data.codigo != null ? String(data.codigo) : null,
      titulo: String(data.titulo ?? "Imóvel"),
      href: `/crm/imoveis`,
    };
  }

  if (!principal) return null;
  return { codigo, prefixo, principal, vinculos, negocios };
}

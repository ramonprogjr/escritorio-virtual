/** RBAC CRM simplificado (PDF Pt.19) — extensível sem quebrar app_role existente. */

export type CrmPapelOperacional = "owner" | "admin" | "gestor" | "comercial" | "financeiro" | "leitura";

const PERMISSOES: Record<CrmPapelOperacional, string[]> = {
  owner: ["*"],
  admin: ["*"],
  gestor: [
    "crm:ler",
    "crm:editar",
    "crm:encaminhar",
    "crm:aprovar_encaminhamento",
    "crm:converter_negocio",
  ],
  comercial: ["crm:ler", "crm:editar", "crm:converter_negocio"],
  financeiro: ["crm:ler", "crm:financeiro"],
  leitura: ["crm:ler"],
};

export function crmPapelFromAppRole(role: string | null | undefined): CrmPapelOperacional {
  const r = (role ?? "").trim().toLowerCase();
  if (r === "owner") return "owner";
  if (r === "admin") return "admin";
  if (r === "gestor" || r === "manager") return "gestor";
  if (r === "financeiro" || r === "finance") return "financeiro";
  if (r === "comercial" || r === "sales") return "comercial";
  return "leitura";
}

export function crmPode(appRole: string | null | undefined, acao: string): boolean {
  const papel = crmPapelFromAppRole(appRole);
  const lista = PERMISSOES[papel];
  return lista.includes("*") || lista.includes(acao);
}

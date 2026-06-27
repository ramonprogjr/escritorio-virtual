"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserCog, UserPlus, UserX, UserCheck, X } from "lucide-react";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import { CrmPermissaoSelect } from "@/components/crm/CrmPermissaoSelect";
import { useCrmTenant } from "@/components/crm/CrmTenantContext";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { toast } from "@/components/crm/toast";
import {
  CRM_NIVEL_LABEL,
  crmPodeEditarPapelUtilizador,
  crmPodeAlterarStatusUtilizador,
  isCrmGestorRole,
  isCrmOwnerFixo,
  isCrmOwnerRole,
  type CrmNivel,
} from "@/lib/crm/crm-permissoes";
import { supabase } from "@/lib/supabase/client";
import type { TenantRow } from "@/app/api/crm/tenants/route";

type Usuario = {
  id: string;
  auth_id: string | null;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  empresa?: string | null;
};

function normalizeRoleKey(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "admin") return "gestor";
  if (r === "vendedor") return "comercial";
  return r;
}

function roleLabel(role: string): string {
  const key = normalizeRoleKey(role) as CrmNivel;
  return CRM_NIVEL_LABEL[key] ?? role;
}

function statusBadge(status: string) {
  const ativo = status.trim().toLowerCase() === "ativo";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        ativo ? "bg-[#23863633] text-[#3fb950]" : "bg-[#f8514922] text-[#ff7b72]"
      }`}
    >
      {status}
    </span>
  );
}

export default function UsuariosPage() {
  const { tenantNome: myTenantNome } = useCrmTenant();
  const [myRole, setMyRole] = useState("");
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmarDesativar, setConfirmarDesativar] = useState<Usuario | null>(null);
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "comercial" as CrmNivel,
    tenant_id: "",
  });

  const isOwner = isCrmOwnerRole(myRole);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const row = await supabase.from("users").select("role, tenant_id").eq("auth_id", user.id).maybeSingle();
      const role = row.data?.role != null ? String(row.data.role) : "";
      const tid = row.data?.tenant_id != null ? String(row.data.tenant_id) : "";
      setMyRole(role);
      setForm((f) => ({ ...f, tenant_id: tid }));
    });
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    void (async () => {
      const res = await fetch("/api/crm/tenants", { headers: await crmApiHeaders() });
      const json = (await res.json()) as { data?: TenantRow[]; currentTenantId?: string };
      if (res.ok && json.data) {
        setTenants(json.data);
        if (json.currentTenantId) {
          setForm((f) => ({ ...f, tenant_id: f.tenant_id || json.currentTenantId! }));
        }
      }
    })();
  }, [isOwner]);

  const podeGerir = isCrmGestorRole(myRole);

  const empresaFormNome = useMemo(() => {
    const t = tenants.find((x) => x.id === form.tenant_id);
    return t?.nome_exibicao ?? myTenantNome ?? "Obra10+";
  }, [form.tenant_id, tenants, myTenantNome]);

  const carregar = useCallback(async () => {
    if (!podeGerir) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/usuarios", { headers: await crmApiHeaders() });
      const json = (await res.json()) as { data?: Usuario[]; error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao carregar equipe");
        setUsuarios([]);
      } else {
        setUsuarios(json.data ?? []);
      }
    } catch {
      setErro("Erro de rede");
    } finally {
      setLoading(false);
    }
  }, [podeGerir]);

  useEffect(() => {
    if (myRole) void carregar();
  }, [myRole, carregar]);

  async function convidar() {
    if (!form.email.trim() || !form.role) return;
    setSalvando(true);
    setErro("");
    try {
      const payload: Record<string, string> = {
        email: form.email,
        name: form.name,
        role: form.role,
      };
      if (isOwner && form.tenant_id) payload.tenant_id = form.tenant_id;

      const res = await fetch("/api/crm/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha no convite");
        return;
      }
      setModal(false);
      setForm((f) => ({ email: "", name: "", role: "comercial", tenant_id: f.tenant_id }));
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function atualizarRole(id: string, role: string) {
    const res = await fetch(`/api/crm/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
      body: JSON.stringify({ role }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(json.error || "Falha ao atualizar permissão");
      return;
    }
    await carregar();
    toast.success("Permissão atualizada.");
  }

  async function executarStatus(u: Usuario, novo: "Ativo" | "Inativo") {
    const quem = u.name || u.email || "colaborador";
    const res = await fetch(`/api/crm/usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
      body: JSON.stringify({ status: novo }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(json.error || "Falha ao atualizar acesso");
      return;
    }
    await carregar();
    toast.success(novo === "Ativo" ? `Acesso de ${quem} reativado.` : `Acesso de ${quem} desativado.`);
  }

  function alternarStatus(u: Usuario) {
    // Reativar é seguro; desativar (cortar acesso) pede confirmação.
    if (u.status.trim().toLowerCase() === "ativo") {
      setConfirmarDesativar(u);
    } else {
      void executarStatus(u, "Ativo");
    }
  }

  if (!myRole && loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0a140f] text-sm text-[#8b949e]">
        Carregando…
      </div>
    );
  }

  if (!podeGerir) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-8 text-center">
          <UserCog className="mx-auto mb-4 h-8 w-8 text-[#c9a24a]" />
          <h1 className="text-lg font-bold text-[#e6edf3]">Usuários & Permissões</h1>
          <p className="mt-2 text-sm text-[#8b949e]">
            Apenas owner ou gestor podem gerenciar colaboradores da equipe.
          </p>
        </div>
      </div>
    );
  }

  const empresaNome = usuarios.find((u) => u.empresa)?.empresa ?? myTenantNome ?? "Obra10+";

  return (
    <div className="flex min-h-full flex-col bg-[#0a140f]">
      <CrmStickyPageHeader
        title="Usuários & Permissões"
        description="Colaboradores com login — não confundir com Cadastros de clientes (Vendas)."
        actions={
          <button
            type="button"
            onClick={() => setModal(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#c9a24a] px-3 text-xs font-bold text-[#003b26]"
          >
            <UserPlus className="h-4 w-4" />
            Convidar colaborador
          </button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {erro && (
          <p className="mb-4 rounded-lg border border-[#f8514966] bg-[#1a0a0a] px-3 py-2 text-sm text-[#ff7b72]">
            {erro}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[#8b949e]">Carregando equipe…</p>
        ) : usuarios.length === 0 ? (
          <p className="text-sm text-[#8b949e]">Nenhum colaborador. Convide o primeiro membro da equipe.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#1d3a2c]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#0f1d16] text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Empresa</th>
                  <th className="px-3 py-2">Permissão</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#16271e]">
                {usuarios.map((u) => {
                  const roleKey = normalizeRoleKey(String(u.role));
                  const ownerFixo = isCrmOwnerFixo(u.email, u.role);
                  const podeEditarRole =
                    !ownerFixo && crmPodeEditarPapelUtilizador(myRole, u.email, u.role);
                  const podeAlterarStatus = crmPodeAlterarStatusUtilizador(myRole, u.email, u.role);
                  return (
                    <tr key={u.id} className="bg-[#0a140f] text-[#e6edf3]">
                      <td className="px-3 py-2.5 font-medium">{u.name || "—"}</td>
                      <td className="px-3 py-2.5 text-[#8b949e]">{u.email}</td>
                      <td className="px-3 py-2.5 text-xs text-[#8b949e]">{u.empresa ?? empresaNome}</td>
                      <td className="px-3 py-2.5">
                        {podeEditarRole ? (
                          <CrmPermissaoSelect
                            actorRole={myRole}
                            value={roleKey}
                            onChange={(r) => void atualizarRole(u.id, r)}
                            showDescription={false}
                            className="rounded-lg border border-[#1d3a2c] bg-[#16271e] px-2 py-1 text-xs"
                          />
                        ) : (
                          <span
                            className="text-xs text-[#c9a24a]"
                            title={ownerFixo ? "Owner fixo da plataforma" : undefined}
                          >
                            {roleLabel(u.role)}
                            {ownerFixo ? " · fixo" : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">{statusBadge(u.status)}</td>
                      <td className="px-3 py-2.5">
                        {podeAlterarStatus ? (
                          <button
                            type="button"
                            onClick={() => void alternarStatus(u)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-2 py-1 text-[10px] font-semibold text-[#8b949e] hover:text-[#e6edf3]"
                          >
                            {u.status.trim().toLowerCase() === "ativo" ? (
                              <>
                                <UserX className="h-3.5 w-3.5" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5" />
                                Reativar
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#484f58]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center md:p-4">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Fechar" onClick={() => setModal(false)} />
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#1d3a2c] bg-[#0f1d16] p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#e6edf3]">Convidar colaborador</h2>
              <button type="button" onClick={() => setModal(false)} className="rounded-lg bg-[#16271e] p-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-[11px] text-[#6e7681]">
              Utilizador com login no CRM. Clientes comerciais cadastram-se em Vendas → Cadastros.
            </p>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="E-mail *"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full min-h-11 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 text-sm text-[#e6edf3]"
              />
              <input
                placeholder="Nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full min-h-11 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 text-sm text-[#e6edf3]"
              />
              {isOwner && tenants.length > 0 ? (
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">
                    Empresa *
                  </label>
                  <select
                    value={form.tenant_id}
                    onChange={(e) => setForm((f) => ({ ...f, tenant_id: e.target.value }))}
                    className="w-full min-h-11 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 text-sm text-[#e6edf3]"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome_exibicao}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">
                    Empresa
                  </label>
                  <p className="min-h-11 rounded-lg border border-[#1d3a2c] bg-[#16271e]/50 px-3 py-2.5 text-sm text-[#8b949e]">
                    {empresaFormNome}
                  </p>
                </div>
              )}
              <CrmPermissaoSelect
                actorRole={myRole}
                value={form.role}
                onChange={(role) => setForm((f) => ({ ...f, role }))}
              />
            </div>
            <button
              type="button"
              disabled={salvando || !form.email.trim() || !form.role}
              onClick={() => void convidar()}
              className="mt-4 w-full min-h-11 rounded-lg bg-[#c9a24a] text-sm font-bold text-[#003b26] disabled:opacity-50"
            >
              {salvando ? "Enviando convite…" : "Enviar convite por e-mail"}
            </button>
          </div>
        </div>
      )}

      <CrmConfirmDialog
        open={confirmarDesativar !== null}
        title="Desativar acesso?"
        confirmLabel="Desativar acesso"
        danger
        onCancel={() => setConfirmarDesativar(null)}
        onConfirm={() => {
          const u = confirmarDesativar;
          if (!u) return;
          setConfirmarDesativar(null);
          void executarStatus(u, "Inativo");
        }}
      >
        Isso <strong style={{ color: "#e6edf3" }}>desativa</strong> (não exclui) o acesso de{" "}
        <strong style={{ color: "#e6edf3" }}>
          {confirmarDesativar?.name || confirmarDesativar?.email}
        </strong>
        . A pessoa não conseguirá mais entrar no sistema até ser reativada.
      </CrmConfirmDialog>
    </div>
  );
}

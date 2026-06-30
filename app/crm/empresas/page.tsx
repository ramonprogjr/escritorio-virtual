"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Plus, X } from "lucide-react";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import { CrmPermissaoSelect } from "@/components/crm/CrmPermissaoSelect";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { isCrmOwnerRole } from "@/lib/crm/crm-permissoes";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/components/crm/toast";
import type { TenantRow } from "@/app/api/crm/tenants/route";
import type { CrmNivel } from "@/lib/crm/crm-permissoes";

export default function EmpresasPage() {
  const [myRole, setMyRole] = useState("");
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [acaoId, setAcaoId] = useState<string | null>(null);
  const [confirmarDesativar, setConfirmarDesativar] = useState<TenantRow | null>(null);
  const [form, setForm] = useState({
    nome_exibicao: "",
    admin_email: "",
    admin_name: "",
    admin_role: "gestor" as CrmNivel,
  });

  const isOwner = isCrmOwnerRole(myRole);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        // Sessão ausente/expirada: não deixa a tela em "Carregando…" eterno.
        setMyRole("");
        setLoading(false);
        return;
      }
      const row = await supabase.from("users").select("role").eq("auth_id", user.id).maybeSingle();
      setMyRole(row.data?.role != null ? String(row.data.role) : "");
    });
  }, []);

  const carregar = useCallback(async () => {
    if (!isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/tenants", { headers: await crmApiHeaders() });
      const json = (await res.json()) as { data?: TenantRow[]; error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao carregar escritórios");
        setTenants([]);
      } else {
        setTenants(json.data ?? []);
      }
    } catch {
      setErro("Erro de rede");
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (myRole) void carregar();
  }, [myRole, carregar]);

  async function criarEmpresa() {
    if (!form.nome_exibicao.trim()) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao criar escritório");
        toast.error(json.error || "Falha ao criar escritório");
        return;
      }
      setModal(false);
      setForm({ nome_exibicao: "", admin_email: "", admin_name: "", admin_role: "gestor" });
      toast.success("Escritório criado");
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  function alternarAtivo(t: TenantRow) {
    // Desativar é a ação destrutiva — pede confirmação no padrão do CRM (dark/dourado).
    // Reativar é seguro e direto.
    if (t.ativo !== false) {
      setConfirmarDesativar(t);
      return;
    }
    void aplicarAtivo(t, true);
  }

  async function aplicarAtivo(t: TenantRow, ativar: boolean) {
    setAcaoId(t.id);
    try {
      const res = await fetch(`/api/crm/tenants/${encodeURIComponent(t.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({ ativo: ativar }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || "Não foi possível atualizar o escritório");
        return;
      }
      toast.success(ativar ? "Escritório ativado" : "Escritório desativado");
      setTenants((prev) => prev.map((x) => (x.id === t.id ? { ...x, ativo: ativar } : x)));
      setConfirmarDesativar(null);
    } catch {
      toast.error("Erro de rede");
    } finally {
      setAcaoId(null);
    }
  }

  if (!myRole && loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0a140f] text-sm text-[#8b949e]">
        Carregando…
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-8 text-center">
          <Building2 className="mx-auto mb-4 h-8 w-8 text-[#c9a24a]" />
          <h1 className="text-lg font-bold text-[#e6edf3]">Escritórios</h1>
          <p className="mt-2 text-sm text-[#8b949e]">Apenas owners podem criar escritórios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#0a140f]">
      <CrmStickyPageHeader
        title="Escritórios"
        description="Escritórios Obra10+ — cada escritório com seus admins e colaboradores próprios."
        actions={
          <button
            type="button"
            onClick={() => setModal(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#c9a24a] px-3 text-xs font-bold text-[#003b26]"
          >
            <Plus className="h-4 w-4" />
            Novo escritório
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
          <p className="text-sm text-[#8b949e]">Carregando escritórios…</p>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-[#8b949e]">Nenhum escritório. Crie o primeiro.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#1d3a2c]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0f1d16] text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Slug</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#16271e]">
                {tenants.map((t) => (
                  <tr key={t.id} className="bg-[#0a140f] text-[#e6edf3]">
                    <td className="px-3 py-2.5 font-medium">{t.nome_exibicao}</td>
                    <td className="px-3 py-2.5 text-xs text-[#8b949e]">{t.slug}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {t.ativo === false ? (
                        <span className="text-[#ff7b72]">Inativa</span>
                      ) : (
                        <span className="text-[#3fb950]">Ativa</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={acaoId === t.id}
                        onClick={() => alternarAtivo(t)}
                        className="inline-flex min-h-8 items-center rounded-lg border px-2.5 text-xs font-bold transition-colors disabled:opacity-50"
                        style={
                          t.ativo === false
                            ? { borderColor: "#2ea04366", color: "#3fb950", background: "#0d1a13" }
                            : { borderColor: "#f8514966", color: "#ff7b72", background: "#1a0a0a" }
                        }
                      >
                        {acaoId === t.id ? "…" : t.ativo === false ? "Ativar" : "Desativar"}
                      </button>
                    </td>
                  </tr>
                ))}
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
              <h2 className="text-sm font-bold text-[#e6edf3]">Novo escritório</h2>
              <button type="button" onClick={() => setModal(false)} className="rounded-lg bg-[#16271e] p-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-[11px] text-[#6e7681]">
              Cria o escritório e, opcionalmente, convida o primeiro admin com permissão Gestor.
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">
                  Nome do escritório *
                </label>
                <input
                  value={form.nome_exibicao}
                  onChange={(e) => setForm((f) => ({ ...f, nome_exibicao: e.target.value }))}
                  className="w-full min-h-11 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 text-sm text-[#e6edf3]"
                  placeholder="Construtora Exemplo Ltda"
                />
              </div>
              <div className="border-t border-[#1d3a2c] pt-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">
                  Primeiro admin (opcional)
                </p>
                <input
                  type="email"
                  placeholder="E-mail do admin"
                  value={form.admin_email}
                  onChange={(e) => setForm((f) => ({ ...f, admin_email: e.target.value }))}
                  className="mb-2 w-full min-h-11 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 text-sm text-[#e6edf3]"
                />
                <input
                  placeholder="Nome do admin"
                  value={form.admin_name}
                  onChange={(e) => setForm((f) => ({ ...f, admin_name: e.target.value }))}
                  className="mb-2 w-full min-h-11 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 text-sm text-[#e6edf3]"
                />
                <CrmPermissaoSelect
                  actorRole={myRole}
                  value={form.admin_role}
                  onChange={(admin_role) => setForm((f) => ({ ...f, admin_role }))}
                  id="admin-permissao"
                  required={Boolean(form.admin_email.trim())}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={salvando || !form.nome_exibicao.trim()}
              onClick={() => void criarEmpresa()}
              className="mt-4 w-full min-h-11 rounded-lg bg-[#c9a24a] text-sm font-bold text-[#003b26] disabled:opacity-50"
            >
              {salvando ? "A criar…" : "Criar escritório"}
            </button>
          </div>
        </div>
      )}

      <CrmConfirmDialog
        open={confirmarDesativar !== null}
        title="Desativar escritório?"
        confirmLabel="Desativar"
        danger
        loading={confirmarDesativar != null && acaoId === confirmarDesativar.id}
        onCancel={() => {
          if (acaoId == null) setConfirmarDesativar(null);
        }}
        onConfirm={() => {
          if (confirmarDesativar) void aplicarAtivo(confirmarDesativar, false);
        }}
      >
        {confirmarDesativar ? (
          <>
            Marcar <strong style={{ color: "#e6edf3" }}>{confirmarDesativar.nome_exibicao}</strong>{" "}
            como inativo? Os colaboradores deste escritório perdem o acesso até ser reativado.
          </>
        ) : null}
      </CrmConfirmDialog>
    </div>
  );
}

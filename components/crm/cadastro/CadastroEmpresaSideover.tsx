"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Pencil, Trash2 } from "lucide-react";
import { AgenteSideoverEntityCard, AgenteSideoverInfoGrid } from "@/components/crm/AgenteSideoverCards";
import { CrmTelefoneCell } from "@/components/crm/CrmTelefoneCell";
import { CrmSideoverFold } from "@/components/crm/CrmSideoverFold";
import { SmartField } from "@/components/crm/SmartField";
import {
  CadastroPremiumSideover,
  CadastroSideoverPanel,
  CadastroTipoBadge,
} from "@/components/crm/cadastro/CadastroPremiumSideover";
import { crmApiHeadersWithActor } from "@/lib/internal-api-headers-client";
import { formatarCnpjMascara, normalizarDocumento } from "@/lib/crm/documento-brasil";
import { EMPRESA_SEGMENTOS, labelEmpresaSegmento } from "@/lib/crm/empresa-cadastro";
import { MERCADOS_PREFIXO_OPTIONS, labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";
import {
  buscarEnderecoPorCep,
  cepValidoParaBusca,
  formatarCepMascara,
} from "@/lib/crm/viacep";
import {
  CadastroFichaTabs,
  type CadastroFichaTabId,
} from "@/components/crm/cadastro/CadastroFichaTabs";
import { CadastroFichaRelacionados } from "@/components/crm/cadastro/CadastroFichaRelacionados";
import { CadastroVinculosPessoaEmpresa } from "@/components/crm/cadastro/CadastroVinculosPessoaEmpresa";

export type EmpresaLista = {
  id: string;
  codigo: string | null;
  razao_social: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  segmento: string | null;
  prefixo_mercado: string | null;
};

type EmpresaDetalhe = EmpresaLista & {
  nome_fantasia?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  ativo?: boolean | null;
  acesso_habilitado?: boolean | null;
  criado_em?: string | null;
};

type Actor = { id?: string; email?: string; name?: string };

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #1d3a2c",
  background: "#0f1d16",
  color: "#e6edf3",
  fontSize: 13,
  boxSizing: "border-box",
};

const LABEL: React.CSSProperties = {
  color: "#8b949e",
  fontSize: 11,
  fontWeight: 600,
  display: "block",
  marginBottom: 4,
};

function formatarData(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  empresaId: string | null;
  mode: "view" | "edit" | null;
  actor: Actor;
  onClose: () => void;
  onDeleted: () => void;
  onSaved: () => void;
  onBackToView: () => void;
  onStartEdit: () => void;
};

export function CadastroEmpresaSideover({
  empresaId,
  mode,
  actor,
  onClose,
  onDeleted,
  onSaved,
  onBackToView,
  onStartEdit,
}: Props) {
  const open = Boolean(empresaId && mode);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [erro, setErro] = useState("");
  const [empresa, setEmpresa] = useState<EmpresaDetalhe | null>(null);
  const [form, setForm] = useState<Partial<EmpresaDetalhe>>({});
  const [secIdentidade, setSecIdentidade] = useState(true);
  const [secContacto, setSecContacto] = useState(true);
  const [secEndereco, setSecEndereco] = useState(true);
  const [fichaTab, setFichaTab] = useState<CadastroFichaTabId>("resumo");
  const [negociosRel, setNegociosRel] = useState<
    Array<{ id: string; codigo?: string | null; titulo: string }>
  >([]);

  const carregar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/empresas/${encodeURIComponent(empresaId)}`, {
        credentials: "include",
        headers: await crmApiHeadersWithActor(actor),
      });
      const data = (await res.json().catch(() => ({}))) as { data?: EmpresaDetalhe; error?: string };
      if (!res.ok) {
        setErro(data.error || `Não foi possível carregar a empresa (${res.status}).`);
        return;
      }
      setEmpresa(data.data ?? null);
      setForm(data.data ?? {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede.";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }, [empresaId, actor.id, actor.email, actor.name]);

  useEffect(() => {
    if (!open) {
      setEmpresa(null);
      setForm({});
      setConfirmExcluir(false);
      setErro("");
      setFichaTab("resumo");
      setNegociosRel([]);
      return;
    }
    void carregar();
  }, [open, carregar]);

  useEffect(() => {
    if (!open || !empresaId || fichaTab !== "relacionados") return;
    void (async () => {
      const res = await fetch(`/api/crm/empresas/${encodeURIComponent(empresaId)}/vinculos`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { negocios?: Array<{ id: string; codigo?: string | null; titulo: string }> };
      };
      if (res.ok && json.data?.negocios) setNegociosRel(json.data.negocios);
    })();
  }, [open, empresaId, fichaTab]);

  async function salvar() {
    if (!empresaId) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/empresas/${encodeURIComponent(empresaId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(await crmApiHeadersWithActor(actor)),
        },
        body: JSON.stringify({
          razao_social: form.razao_social,
          nome_fantasia: form.nome_fantasia,
          cnpj: form.cnpj ? normalizarDocumento(String(form.cnpj)) : undefined,
          email: form.email,
          telefone: form.telefone,
          segmento: form.segmento,
          prefixo_mercado: form.prefixo_mercado,
          cep: form.cep,
          logradouro: form.logradouro,
          numero: form.numero,
          complemento: form.complemento,
          bairro: form.bairro,
          cidade: form.cidade,
          estado: form.estado,
          ativo: form.ativo,
          acesso_habilitado: form.acesso_habilitado,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error || "Falha ao guardar.");
        return;
      }
      onSaved();
      onBackToView();
      void carregar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!empresaId) return;
    setExcluindo(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/empresas/${encodeURIComponent(empresaId)}`, {
        method: "DELETE",
        credentials: "include",
        headers: await crmApiHeadersWithActor(actor),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error || "Não foi possível excluir.");
        return;
      }
      onDeleted();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede.";
      setErro(msg);
    } finally {
      setExcluindo(false);
      setConfirmExcluir(false);
    }
  }

  const cnpjFmt = empresa?.cnpj ? formatarCnpjMascara(empresa.cnpj) : "—";

  const footer =
    mode === "view" ? (
      <>
        <button
          type="button"
          onClick={onStartEdit}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #1d3a2c",
            background: "#16271e",
            color: "#e6edf3",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <Pencil size={16} /> Editar
        </button>
        {!confirmExcluir ? (
          <button
            type="button"
            onClick={() => setConfirmExcluir(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #f8514966",
              background: "transparent",
              color: "#f85149",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            <Trash2 size={16} /> Excluir
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmExcluir(false)}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #1d3a2c",
                background: "transparent",
                color: "#8b949e",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void excluir()}
              disabled={excluindo}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#da3633",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {excluindo ? "Excluindo…" : "Confirmar exclusão"}
            </button>
          </>
        )}
      </>
    ) : (
      <>
        <button
          type="button"
          onClick={onBackToView}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #1d3a2c",
            background: "transparent",
            color: "#8b949e",
            cursor: "pointer",
          }}
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#238636",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {salvando ? "Salvando…" : "Guardar alterações"}
        </button>
      </>
    );

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel={mode === "edit" ? "EDITAR EMPRESA" : "EMPRESA"}
      title={empresa?.razao_social || (loading ? "Carregando…" : "—")}
      subtitle={empresa?.codigo || undefined}
      Icon={Building2}
      accent="#2f9e8f"
      badge={
        <>
          {empresa?.prefixo_mercado ? (
            <CadastroTipoBadge label={labelMercadoPrefixo(empresa.prefixo_mercado)} />
          ) : null}
          {empresa?.ativo === false ? (
            <CadastroTipoBadge label="Inativa" tone="muted" />
          ) : (
            <CadastroTipoBadge label="Ativa" tone="green" />
          )}
        </>
      }
      footer={footer}
    >
      {loading && <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando dados da empresa…</p>}
      {empresaId && (
        <p style={{ margin: "0 0 8px", fontSize: 12 }}>
          <Link
            href={`/crm/empresas/${encodeURIComponent(empresaId)}`}
            style={{ color: "#2f9e8f", textDecoration: "none", fontWeight: 600 }}
          >
            Abrir ficha completa →
          </Link>
        </p>
      )}
      {erro && (
        <div
          style={{
            color: "#f87171",
            background: "#3a1518",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            padding: 10,
            fontSize: 13,
            marginBottom: 12,
          }}
          role="alert"
        >
          <p style={{ margin: 0 }}>{erro}</p>
          <button
            type="button"
            onClick={() => void carregar()}
            style={{
              marginTop: 8,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #7f1d1d",
              background: "transparent",
              color: "#fca5a5",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {mode === "view" && empresa && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <CadastroFichaTabs active={fichaTab} onChange={setFichaTab}>
            {fichaTab === "resumo" && (
              <>
          <AgenteSideoverEntityCard
            accent="#2f9e8f"
            Icon={Building2}
            avatarCaption={empresa.codigo || "Empresa"}
            footer={
              <AgenteSideoverInfoGrid
                rows={[
                  { label: "CNPJ", value: cnpjFmt },
                  {
                    label: "Telefone",
                    value: empresa.telefone ? (
                      <CrmTelefoneCell telefone={empresa.telefone} />
                    ) : (
                      "—"
                    ),
                  },
                  { label: "E-mail", value: empresa.email || "—" },
                ]}
              />
            }
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#e6edf3", lineHeight: 1.35 }}>
              {empresa.razao_social}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
              {empresa.nome_fantasia || "Sem nome fantasia"}
              {` · ${labelEmpresaSegmento(empresa.segmento)}`}
            </p>
          </AgenteSideoverEntityCard>

          <CadastroSideoverPanel>
            <CrmSideoverFold
              isFirst
              title="Identidade"
              open={secIdentidade}
              onToggle={() => setSecIdentidade((o) => !o)}
            >
              <AgenteSideoverInfoGrid
                rows={[
                  { label: "Código", value: empresa.codigo || "—" },
                  { label: "Razão social", value: empresa.razao_social },
                  { label: "Nome fantasia", value: empresa.nome_fantasia || "—" },
                  { label: "CNPJ", value: cnpjFmt },
                  { label: "Mercado", value: labelMercadoPrefixo(empresa.prefixo_mercado) },
                  { label: "Segmento", value: labelEmpresaSegmento(empresa.segmento) },
                  { label: "Criado em", value: formatarData(empresa.criado_em) },
                ]}
              />
            </CrmSideoverFold>

            <CrmSideoverFold title="Contato" open={secContacto} onToggle={() => setSecContacto((o) => !o)}>
              <AgenteSideoverInfoGrid
                rows={[
                  {
                    label: "Telefone",
                    value: empresa.telefone ? (
                      <CrmTelefoneCell telefone={empresa.telefone} />
                    ) : (
                      "—"
                    ),
                  },
                  { label: "E-mail", value: empresa.email || "—" },
                ]}
              />
            </CrmSideoverFold>

            <CrmSideoverFold title="Endereço" open={secEndereco} onToggle={() => setSecEndereco((o) => !o)}>
              <AgenteSideoverInfoGrid
                rows={[
                  { label: "CEP", value: empresa.cep || "—" },
                  { label: "Logradouro", value: empresa.logradouro || "—" },
                  { label: "Número", value: empresa.numero || "—" },
                  { label: "Complemento", value: empresa.complemento || "—" },
                  { label: "Bairro", value: empresa.bairro || "—" },
                  {
                    label: "Cidade / UF",
                    value: [empresa.cidade, empresa.estado].filter(Boolean).join(" / ") || "—",
                  },
                ]}
              />
            </CrmSideoverFold>
          </CadastroSideoverPanel>

          {confirmExcluir && (
            <p style={{ fontSize: 12, color: "#f85149", margin: 0 }}>
              A exclusão será registada em auditoria
              {actor.email ? ` (${actor.email})` : ""}.
            </p>
          )}
              </>
            )}
            {fichaTab === "vinculos" && empresaId ? (
              <CadastroVinculosPessoaEmpresa
                entityType="empresa"
                entityId={empresaId}
                actor={actor}
                variant="sideover"
              />
            ) : null}
            {fichaTab === "relacionados" ? (
              <CadastroFichaRelacionados negocios={negociosRel} variant="sideover" />
            ) : null}
            {fichaTab === "dados" && (
              <CadastroSideoverPanel>
                <AgenteSideoverInfoGrid
                  rows={[
                    { label: "Mercado", value: labelMercadoPrefixo(empresa.prefixo_mercado) },
                    { label: "Segmento", value: labelEmpresaSegmento(empresa.segmento) },
                    { label: "Criado em", value: formatarData(empresa.criado_em) },
                    {
                      label: "Endereço",
                      value:
                        [empresa.logradouro, empresa.numero, empresa.bairro, empresa.cidade, empresa.estado]
                          .filter(Boolean)
                          .join(", ") || "—",
                    },
                  ]}
                />
              </CadastroSideoverPanel>
            )}
          </CadastroFichaTabs>
        </div>
      )}

      {mode === "edit" && !loading && empresa && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={LABEL}>Razão social</label>
            <input
              style={INPUT}
              value={form.razao_social || ""}
              onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))}
            />
          </div>
          <div>
            <label style={LABEL}>Nome fantasia</label>
            <input
              style={INPUT}
              value={form.nome_fantasia || ""}
              onChange={(e) => setForm((f) => ({ ...f, nome_fantasia: e.target.value }))}
            />
          </div>
          <SmartField
            label="Mercado"
            modo="chips"
            opcoes={MERCADOS_PREFIXO_OPTIONS}
            value={form.prefixo_mercado || "IMB"}
            onChange={(v) => setForm((f) => ({ ...f, prefixo_mercado: v }))}
          />
          <SmartField
            label="Segmento"
            modo="chips"
            opcoes={EMPRESA_SEGMENTOS}
            value={form.segmento || "cliente"}
            onChange={(v) => setForm((f) => ({ ...f, segmento: v }))}
          />
          <div>
            <label style={LABEL}>Telefone</label>
            <input
              style={INPUT}
              value={form.telefone || ""}
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
            />
          </div>
          <div>
            <label style={LABEL}>E-mail</label>
            <input
              style={INPUT}
              type="email"
              value={form.email || ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <label style={{ ...LABEL, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.ativo !== false}
              onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
            />
            Empresa activa
          </label>
          <label style={{ ...LABEL, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={Boolean(form.acesso_habilitado)}
              onChange={(e) => setForm((f) => ({ ...f, acesso_habilitado: e.target.checked }))}
            />
            Acesso ao portal habilitado
          </label>
        </div>
      )}
    </CadastroPremiumSideover>
  );
}

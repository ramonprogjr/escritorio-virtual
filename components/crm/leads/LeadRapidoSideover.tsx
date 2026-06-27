"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronDown, ChevronUp, UserPlus } from "lucide-react";
import { CadastroPremiumSideover } from "@/components/crm/cadastro/CadastroPremiumSideover";
import { MercadoLeadPicker } from "@/components/crm/leads/MercadoLeadPicker";
import { SmartField } from "@/components/crm/SmartField";
import { LEAD_ORIGENS } from "@/lib/crm/lead-cadastro";
import {
  CAMPOS_POR_TIPO,
  prefixoMercadoFromTipoInteresse,
  TIPOS_INTERESSE_LEAD,
  type TipoInteresseLeadId,
} from "@/lib/crm/lead-campos-por-tipo";
import { internalApiHeaders } from "@/lib/internal-api-headers";

const ORIGEM_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  linkedin: "LinkedIn",
  site: "Site",
  indicacao: "Indicação",
  outro: "Outro",
};

// Opções de origem como chips (Click-and-Go) — mesmos valores do antigo <select>.
const ORIGEM_OPCOES = LEAD_ORIGENS.map((o) => ({ value: o, label: ORIGEM_LABEL[o] || o }));

const inputCls =
  "w-full min-h-10 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none placeholder:text-[#6e7681] focus:border-[#c9a24a]";

const labelCls = "mb-1 block text-xs font-semibold text-[#8b949e]";

const secaoCls = "text-[11px] font-extrabold uppercase tracking-wide text-[#aebccf]";

type LeadCriado = {
  id: string;
  codigo?: string | null;
  nome: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (lead: LeadCriado) => void;
};

const formInicial = {
  nome: "",
  telefone: "",
  email: "",
  origem: "whatsapp",
  valor_estimado: "",
  indicado_por: "",
  mercados: ["IMB"] as string[],
  tipo_interesse: "comprar_imovel" as TipoInteresseLeadId,
  extras: {} as Record<string, string>,
};

export function LeadRapidoSideover({ open, onClose, onSaved }: Props) {
  const [form, setForm] = useState(formInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [detalhes, setDetalhes] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(formInicial);
    setErro("");
    setSalvando(false);
    setDetalhes(false);
  }, [open]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMercado(sigla: string, ativo: boolean) {
    setForm((prev) => {
      const atual = prev.mercados ?? [];
      const next = ativo ? [...new Set([...atual, sigla])] : atual.filter((m) => m !== sigla);
      return { ...prev, mercados: next };
    });
  }

  async function salvar() {
    setErro("");
    const nome = form.nome.trim();
    if (nome.length < 2) {
      setErro("Informe o nome (mín. 2 caracteres).");
      return;
    }

    const telefone = form.telefone.replace(/\D/g, "");
    if (!telefone || telefone.length < 10) {
      setErro("Telefone é obrigatório (DDD + número).");
      return;
    }

    if (form.origem === "indicacao" && !form.indicado_por.trim()) {
      setErro("Informe quem indicou.");
      return;
    }

    setSalvando(true);
    try {
      const prefixo = prefixoMercadoFromTipoInteresse(form.tipo_interesse);
      const body: Record<string, unknown> = {
        nome,
        telefone: form.telefone.trim(),
        email: form.email.trim() || null,
        origem: form.origem,
        estagio: "novo",
        estagio_funil: "novo",
        tipo_interesse: form.tipo_interesse,
        valor_estimado: form.valor_estimado.trim() || 0,
        mercados: [prefixo, ...form.mercados.filter((m) => m !== prefixo)],
        cidade: form.extras.cidade?.trim() || null,
        bairro: form.extras.bairro?.trim() || null,
        metadata: { ...form.extras, tipo_interesse: form.tipo_interesse },
      };
      if (form.origem === "indicacao" && form.indicado_por.trim()) {
        body.indicado_por = form.indicado_por.trim();
      }

      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        data?: LeadCriado;
        error?: string;
        lead_id?: string;
      };

      if (!res.ok) {
        setErro(data.error || "Não foi possível criar o lead.");
        return;
      }

      const criado = data.data;
      if (criado?.id) {
        onSaved?.(criado);
        onClose();
      } else {
        setErro("Lead gravado, mas a resposta veio incompleta.");
      }
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel="Vendas"
      title="Novo lead"
      subtitle="Cadastro rápido no funil"
      Icon={UserPlus}
      accent="#3B82F6"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="min-h-10 rounded-lg border border-[#1d3a2c] px-4 py-2 text-sm font-semibold text-[#8b949e] hover:text-white disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="min-h-10 rounded-lg px-5 py-2 text-sm font-bold text-[#0a140f] disabled:opacity-50"
            style={{ background: salvando ? "#6e7681" : "#c9a24a" }}
          >
            {salvando ? "Salvando…" : "Criar lead"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-xs leading-relaxed text-[#8b949e]">
          Só <strong className="text-[#e6edf3]">nome e telefone</strong> já criam o lead. O resto é
          opcional — dá pra completar depois, no card.
        </p>

        {/* ESSENCIAL — o mínimo pra criar (2 campos) */}
        <section>
          <p className={`${secaoCls} mb-3 flex items-center gap-2`}>
            <Building2 size={14} aria-hidden />
            Contacto
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls} htmlFor="lead-rapido-nome">
                Nome *
              </label>
              <input
                id="lead-rapido-nome"
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                className={inputCls}
                placeholder="Nome do contacto"
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="lead-rapido-tel">
                Telefone *
              </label>
              <input
                id="lead-rapido-tel"
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                className={inputCls}
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
            </div>
          </div>
        </section>

        {/* Tudo que não é essencial fica escondido por padrão (3 toques) */}
        <button
          type="button"
          onClick={() => setDetalhes((v) => !v)}
          aria-expanded={detalhes}
          className="flex items-center gap-2 self-start rounded-lg border border-[#1d3a2c] px-3 py-2 text-xs font-semibold text-[#8b949e] transition-colors hover:border-[#c9a24a] hover:text-[#e6edf3]"
        >
          {detalhes ? (
            <>
              <ChevronUp size={14} aria-hidden /> Menos opções
            </>
          ) : (
            <>
              <ChevronDown size={14} aria-hidden /> Mais opções — tipo, mercado, origem, valor
            </>
          )}
        </button>

        {detalhes && (
          <div className="flex flex-col gap-5 border-t border-[#16271e] pt-5">
            <section>
              <SmartField
                label="Tipo de interesse"
                modo="chips"
                opcoes={TIPOS_INTERESSE_LEAD.map((t) => ({ value: t.id, label: t.label }))}
                value={form.tipo_interesse}
                onChange={(v) => {
                  const id = v as TipoInteresseLeadId;
                  set("tipo_interesse", id);
                  set("extras", {});
                  set("mercados", [prefixoMercadoFromTipoInteresse(id)]);
                }}
                disabled={salvando}
              />
            </section>

            {(CAMPOS_POR_TIPO[form.tipo_interesse] ?? []).length > 0 && (
              <section>
                <p className={`${secaoCls} mb-3`}>Dados do interesse</p>
                <div className="flex flex-col gap-3">
                  {(CAMPOS_POR_TIPO[form.tipo_interesse] ?? []).map((campo) =>
                    campo.type === "select" && campo.options ? (
                      <SmartField
                        key={campo.key}
                        label={campo.label}
                        required={campo.obrigatorio}
                        modo="chips"
                        opcoes={campo.options}
                        value={form.extras[campo.key] ?? ""}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, extras: { ...p.extras, [campo.key]: v } }))
                        }
                        disabled={salvando}
                      />
                    ) : (
                      <div key={campo.key}>
                        <label className={labelCls}>
                          {campo.label}
                          {campo.obrigatorio ? " *" : ""}
                        </label>
                        <input
                          className={inputCls}
                          value={form.extras[campo.key] ?? ""}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              extras: { ...p.extras, [campo.key]: e.target.value },
                            }))
                          }
                        />
                      </div>
                    )
                  )}
                </div>
              </section>
            )}

            <section>
              <p className={`${secaoCls} mb-3`}>Mercado do lead</p>
              <MercadoLeadPicker
                mercados={form.mercados}
                onToggle={toggleMercado}
                disabled={salvando}
              />
            </section>

            <section>
              <label className={labelCls} htmlFor="lead-rapido-email">
                E-mail
              </label>
              <input
                id="lead-rapido-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className={inputCls}
                placeholder="opcional"
              />
            </section>

            <section>
              <p className={`${secaoCls} mb-3`}>Comercial</p>
              <div className="flex flex-col gap-3">
                <SmartField
                  label="Origem"
                  modo="chips"
                  opcoes={ORIGEM_OPCOES}
                  value={form.origem}
                  onChange={(v) => set("origem", v)}
                  disabled={salvando}
                />
                <div>
                  <label className={labelCls} htmlFor="lead-rapido-valor">
                    Valor estimado (R$)
                  </label>
                  <input
                    id="lead-rapido-valor"
                    value={form.valor_estimado}
                    onChange={(e) => set("valor_estimado", e.target.value)}
                    className={inputCls}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </div>
                {form.origem === "indicacao" && (
                  <div>
                    <label className={labelCls} htmlFor="lead-rapido-indicacao">
                      Quem indicou? *
                    </label>
                    <input
                      id="lead-rapido-indicacao"
                      value={form.indicado_por}
                      onChange={(e) => set("indicado_por", e.target.value)}
                      className={inputCls}
                      placeholder="Nome de quem indicou"
                    />
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {erro && (
          <p className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#fca5a5]">
            {erro}
          </p>
        )}
      </div>
    </CadastroPremiumSideover>
  );
}

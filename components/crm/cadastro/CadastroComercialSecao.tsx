"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Factory,
  Hammer,
  HardHat,
  Layers,
  Package,
  Target,
  Wrench,
} from "lucide-react";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { SmartField } from "@/components/crm/SmartField";
import { MercadoLeadPicker } from "@/components/crm/leads/MercadoLeadPicker";
import { EMPRESA_SEGMENTOS } from "@/lib/crm/empresa-cadastro";
import { MERCADOS_PREFIXO_OPTIONS } from "@/lib/crm/negocio-cadastro";
import type { SuperCadastroInput } from "@/lib/crm/super-cadastro-form";

const OB = {
  borda: "#1d3a2c",
  texto: "#e6edf3",
  texto2: "#8b949e",
  dourado: "#c9a24a",
};

const ROW_BASE: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${OB.borda}`,
  background: "#0f1d16",
};

const MERCADO_ICON: Record<string, LucideIcon> = {
  IMB: Building2,
  ARQ: Layers,
  RFM: Hammer,
  MRC: Package,
  ENG: HardHat,
  SRV: Wrench,
  PRO: Factory,
  FOR: Package,
};

const INPUT: CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 10,
  border: `1px solid ${OB.borda}`,
  background: "#0f1d16",
  color: OB.texto,
  fontSize: 14,
  boxSizing: "border-box",
};

const ORIGEM_LEAD_OPCOES = [
  { value: "outro", label: "Outro / manual" },
  { value: "indicacao", label: "Indicação" },
  { value: "site", label: "Site" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
];

const SEGMENTO_OPCOES = EMPRESA_SEGMENTOS.filter(
  (s) => s.value !== "fornecedor" && s.value !== "parceiro"
);

const LABEL: CSSProperties = {
  color: OB.texto2,
  fontSize: 11,
  fontWeight: 600,
  display: "block",
  marginBottom: 6,
};

type Props = {
  tipo: "PF" | "PJ";
  nome: string;
  documento: string;
  comercial: SuperCadastroInput["comercial"];
  onComercialChange: (partial: Partial<SuperCadastroInput["comercial"]>) => void;
  onMercadoToggle: (sigla: string, ativo: boolean) => void;
};

function OpcaoToggleCard({
  icon: Icon,
  titulo,
  badge,
  descricao,
  ativo,
  onToggle,
  disabled,
  labelId,
}: {
  icon: LucideIcon;
  titulo: string;
  badge?: string;
  descricao: string;
  ativo: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  labelId: string;
}) {
  return (
    <div
      style={{
        ...ROW_BASE,
        borderColor: ativo ? "rgba(201, 162, 74, 0.45)" : OB.borda,
        background: ativo ? "rgba(201, 162, 74, 0.06)" : "#0f1d16",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: ativo ? "rgba(201, 162, 74, 0.18)" : "#16271e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: ativo ? OB.dourado : OB.texto2,
          marginTop: 2,
        }}
      >
        <Icon size={21} strokeWidth={2} aria-hidden />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span id={labelId} style={{ color: OB.texto, fontSize: 13, fontWeight: 700 }}>
            {titulo}
          </span>
          {badge ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.06,
                color: OB.dourado,
                border: "1px solid rgba(201, 162, 74, 0.35)",
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <span style={{ display: "block", color: OB.texto2, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>
          {descricao}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
          flexShrink: 0,
          paddingTop: 4,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: ativo ? "#3fb950" : "#6e7781" }}>
          {ativo ? "ATIVO" : "INATIVO"}
        </span>
        <CrmToggleSwitch
          checked={ativo}
          onCheckedChange={onToggle}
          disabled={disabled}
          labelledBy={labelId}
        />
      </div>
    </div>
  );
}

function SubtituloSecao({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 10px" }}>
      <Icon size={14} strokeWidth={2.25} style={{ color: OB.texto2 }} aria-hidden />
      <p
        style={{
          color: "#aebccf",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.04,
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        {children}
      </p>
    </div>
  );
}

export function CadastroComercialSecao({
  tipo,
  nome,
  documento,
  comercial,
  onComercialChange,
  onMercadoToggle,
}: Props) {
  const criarLead = comercial.criar_lead === true;
  const mercados = comercial.mercados ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ color: OB.texto2, fontSize: 11, fontWeight: 700, margin: 0, letterSpacing: 0.04 }}>
        DESTINO NO CRM
      </p>

      <OpcaoToggleCard
        icon={Target}
        labelId="destino-lead"
        titulo="Lead no funil comercial"
        badge="VENDAS"
        descricao="Cria o contato direto no funil de vendas, mesmo com poucos dados — ideal para campanhas. Mercado opcional (usa Imobiliário se nenhum for escolhido)."
        ativo={criarLead}
        onToggle={(v) => {
          onComercialChange({
            criar_lead: v,
            mercados: v && mercados.length === 0 ? ["IMB"] : mercados,
          });
        }}
      />
      {criarLead ? (
        <p
          style={{
            margin: "-8px 0 0",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #c9a24a33",
            background: "#c9a24a10",
            fontSize: 12,
            color: "#c9a24a",
            lineHeight: 1.45,
          }}
        >
          Ao guardar, será criado um código <strong>LED-{new Date().getFullYear()}-####</strong> no funil{" "}
          {mercados.length > 0 ? mercados.join(", ") : "IMB"}.
        </p>
      ) : null}

      <SubtituloSecao icon={Building2}>Mercado / área de interesse</SubtituloSecao>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: OB.texto2, lineHeight: 1.45 }}>
        Opcional — fica gravado no cadastro mesmo sem lead no funil.
      </p>
      <MercadoLeadPicker mercados={mercados} onToggle={onMercadoToggle} />

      {criarLead ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 4,
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <SmartField
              label="Origem do lead"
              modo="chips"
              opcoes={ORIGEM_LEAD_OPCOES}
              value={comercial.lead_origem || "outro"}
              onChange={(v) => {
                const lead_origem = v as SuperCadastroInput["comercial"]["lead_origem"];
                onComercialChange({
                  lead_origem,
                  indicado_por:
                    lead_origem === "indicacao" ? comercial.indicado_por ?? "" : null,
                });
              }}
            />
          </div>
          {comercial.lead_origem === "indicacao" && (
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={LABEL}>Quem indicou? *</label>
              <input
                style={INPUT}
                value={comercial.indicado_por || ""}
                onChange={(e) =>
                  onComercialChange({ indicado_por: e.target.value })
                }
                placeholder="Nome de quem indicou este contato"
                autoComplete="name"
              />
              <p style={{ margin: "6px 0 0", fontSize: 11, color: OB.texto2, lineHeight: 1.4 }}>
                Salvo no histórico de indicação do contato.
              </p>
            </div>
          )}
          {tipo === "PJ" && (
            <div style={{ gridColumn: "1 / -1" }}>
              <SmartField
                label="Segmento empresa"
                modo="chips"
                opcoes={SEGMENTO_OPCOES}
                value={comercial.segmento || "cliente"}
                onChange={(v) =>
                  onComercialChange({
                    segmento: v as SuperCadastroInput["comercial"]["segmento"],
                  })
                }
              />
            </div>
          )}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: OB.texto2, lineHeight: 1.45 }}>
          Sem lead no funil — cria apenas o cadastro (a área/mercado acima continua salva).
        </p>
      )}

      <div
        style={{
          padding: 12,
          borderRadius: 10,
          background: "#0f1d16",
          border: `1px solid ${OB.borda}`,
          fontSize: 12,
          color: OB.texto2,
        }}
      >
        <strong style={{ color: OB.texto }}>Resumo:</strong> {tipo} — {nome || "—"}
        {tipo === "PJ" && documento ? ` · ${documento}` : ""}
        {criarLead ? (
          <>
            {" · "}
            <strong style={{ color: OB.dourado }}>Lead</strong>
            {mercados.length ? ` (${mercados.join(", ")})` : " — escolha um mercado"}
            {comercial.lead_origem === "indicacao" && comercial.indicado_por?.trim()
              ? ` · indicação: ${comercial.indicado_por.trim()}`
              : ""}
          </>
        ) : (
          <>
            {" · só cadastro"}
            {mercados.length ? ` · áreas: ${mercados.join(", ")}` : ""}
          </>
        )}
      </div>
    </div>
  );
}

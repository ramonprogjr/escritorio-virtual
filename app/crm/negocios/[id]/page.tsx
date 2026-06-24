"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { CrmRastreioCadeia } from "@/components/crm/CrmRastreioCadeia";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";
import { tipoAlvoPorMercado } from "@/lib/crm/derivar-negocio";
import { MOTIVOS_PERDA, MOTIVOS_PERDA_LABEL } from "@/lib/crm/pipelines";
import type { RastreioCadeia } from "@/lib/crm/resolver-rastreio-codigo";

type NegocioDetalhe = {
  id: string;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  prefixo_mercado: string;
  status: string;
  etapa: string;
  valor_estimado: number | null;
  valor_fechado: number | null;
  motivo_perda: string | null;
  proxima_acao: string | null;
  lead_id: string | null;
  pessoa_id: string | null;
  criado_em: string | null;
};

type TimelineItem = {
  id: string;
  tipo: string;
  descricao: string;
  criado_em: string;
};

type PessoaMini = { id: string; nome: string; codigo?: string | null };

function formatCurrency(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function NegocioDetalhePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [negocio, setNegocio] = useState<NegocioDetalhe | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [leadNome, setLeadNome] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ titulo: "", descricao: "", valor_estimado: "" });
  const [salvando, setSalvando] = useState(false);
  const [rastreio, setRastreio] = useState<RastreioCadeia | null>(null);
  const [motivoPendente, setMotivoPendente] = useState<string | null>(null);
  const [motivoSelecionado, setMotivoSelecionado] = useState("");
  const [derivando, setDerivando] = useState(false);
  const [derivadoMsg, setDerivadoMsg] = useState<string | null>(null);
  const [proximaAcao, setProximaAcao] = useState("");
  const [acaoStatus, setAcaoStatus] = useState<"" | "salvando" | "salvo">("");
  const [novaNota, setNovaNota] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [pessoaVinc, setPessoaVinc] = useState<PessoaMini | null>(null);
  const [pickerAberto, setPickerAberto] = useState(false);
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [resultadosPessoa, setResultadosPessoa] = useState<PessoaMini[]>([]);

  const carregar = useCallback(async () => {
    setErro("");
    setCarregando(true);
    try {
      const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json()) as {
        data?: NegocioDetalhe;
        timeline?: TimelineItem[];
        lead?: { nome: string } | null;
        pessoa?: PessoaMini | null;
        error?: string;
      };
      if (!res.ok) {
        setErro(json.error || "Não foi possível carregar.");
        return;
      }
      const n = json.data ?? null;
      setNegocio(n);
      if (n) {
        setForm({
          titulo: n.titulo,
          descricao: n.descricao ?? "",
          valor_estimado: n.valor_estimado != null ? String(n.valor_estimado) : "",
        });
        setProximaAcao(n.proxima_acao ?? "");
        setAcaoStatus("");
      }
      setTimeline(json.timeline ?? []);
      setLeadNome(json.lead?.nome ?? null);
      setPessoaVinc(json.pessoa ?? null);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!negocio?.codigo) return;
    void (async () => {
      const res = await fetch(`/api/crm/rastreio?codigo=${encodeURIComponent(negocio.codigo!)}`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { data?: RastreioCadeia };
      if (res.ok && json.data) setRastreio(json.data);
    })();
  }, [negocio?.codigo]);

  async function salvarEdicao() {
    setSalvando(true);
    const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({
        titulo: form.titulo.trim(),
        descricao: form.descricao || null,
        valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
      }),
    });
    setSalvando(false);
    if (res.ok) {
      setEditando(false);
      void carregar();
    }
  }

  async function arquivar() {
    if (!confirm("Arquivar este negócio (status cancelado)?")) return;
    await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ status: "cancelado" }),
    });
    void carregar();
  }

  /** Auto-save da próxima ação (ao sair do campo). */
  async function salvarProximaAcao() {
    if ((negocio?.proxima_acao ?? "") === proximaAcao.trim()) return;
    setAcaoStatus("salvando");
    try {
      const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ proxima_acao: proximaAcao.trim() || null }),
      });
      setAcaoStatus(res.ok ? "salvo" : "");
      if (res.ok) setNegocio((n) => (n ? { ...n, proxima_acao: proximaAcao.trim() || null } : n));
    } catch {
      setAcaoStatus("");
    }
  }

  async function registrarNota() {
    const txt = novaNota.trim();
    if (!txt) return;
    setSalvandoNota(true);
    try {
      const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}/nota`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ descricao: txt }),
      });
      if (res.ok) {
        setNovaNota("");
        void carregar();
      }
    } finally {
      setSalvandoNota(false);
    }
  }

  async function buscarPessoas(q: string) {
    setBuscaPessoa(q);
    if (q.trim().length < 2) {
      setResultadosPessoa([]);
      return;
    }
    try {
      const res = await fetch(`/api/crm/pessoas?busca=${encodeURIComponent(q.trim())}&limit=8`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: PessoaMini[] };
      setResultadosPessoa(Array.isArray(json.data) ? json.data : []);
    } catch {
      setResultadosPessoa([]);
    }
  }

  async function definirPessoa(pessoa: PessoaMini | null) {
    const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ pessoa_id: pessoa?.id ?? null }),
    });
    if (res.ok) {
      setPessoaVinc(pessoa);
      setPickerAberto(false);
      setBuscaPessoa("");
      setResultadosPessoa([]);
    }
  }

  async function mudarEtapa(novaEtapa: string) {
    const perdido = novaEtapa === "perdido" || novaEtapa === "fechado_perdido";
    if (perdido && !negocio?.motivo_perda) {
      setMotivoPendente(novaEtapa);
      return;
    }
    const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({
        etapa: novaEtapa,
        status: perdido ? "perdido" : undefined,
      }),
    });
    if (res.ok) void carregar();
  }

  async function confirmarMotivoPerda() {
    if (!motivoPendente || !motivoSelecionado.trim()) return;
    const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({
        etapa: motivoPendente,
        status: "perdido",
        motivo_perda: motivoSelecionado.trim(),
      }),
    });
    if (res.ok) {
      setMotivoPendente(null);
      setMotivoSelecionado("");
      void carregar();
    }
  }

  async function gerarDerivado(tipoAlvo?: "obra" | "projeto") {
    setDerivando(true);
    setDerivadoMsg(null);
    try {
      const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}/converter-obra`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(tipoAlvo ? { tipo_alvo: tipoAlvo } : {}),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { codigo?: string };
        tipo?: string;
        ja_existia?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setDerivadoMsg(json.error || "Não foi possível gerar.");
        return;
      }
      const label = json.tipo === "projeto" ? "Projeto" : "Obra";
      setDerivadoMsg(
        `${label} ${json.data?.codigo ?? ""} ${json.ja_existia ? "já existia" : "criada"}.`.trim()
      );
      void carregar();
    } catch {
      setDerivadoMsg("Erro de rede.");
    } finally {
      setDerivando(false);
    }
  }

  if (carregando) {
    return <p style={{ padding: 24, color: "#8b949e" }}>Carregando...</p>;
  }

  if (!negocio) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#ef4444" }}>{erro || "Negócio não encontrado."}</p>
        <button type="button" onClick={() => router.push("/crm/negocios")} style={{ marginTop: 12 }}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, color: "#e6edf3" }}>
      <button
        type="button"
        onClick={() => router.push("/crm/negocios")}
        style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", marginBottom: 16 }}
      >
        ← Negócios
      </button>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, flex: 1 }}>{negocio.titulo}</h1>
        <button type="button" onClick={() => setEditando((e) => !e)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #30363d", background: "#21262d", color: "#c9a24a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {editando ? "Cancelar" : "Editar"}
        </button>
        <button type="button" onClick={() => void arquivar()} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #f8514944", background: "transparent", color: "#f85149", fontSize: 12, cursor: "pointer" }}>
          Arquivar
        </button>
      </div>
      <p style={{ margin: 0, color: "#8b949e", fontFamily: "monospace" }}>{negocio.codigo}</p>
      {negocio.motivo_perda ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f87171" }}>
          Motivo perda: {MOTIVOS_PERDA_LABEL[negocio.motivo_perda] ?? negocio.motivo_perda}
        </p>
      ) : null}

      {motivoPendente ? (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 10,
            border: "1px solid #30363d",
            background: "#161b22",
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>Motivo da perda (obrigatório)</p>
          <select
            value={motivoSelecionado}
            onChange={(e) => setMotivoSelecionado(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #30363d",
              background: "#0d1117",
              color: "#e6edf3",
              marginBottom: 8,
            }}
          >
            <option value="">Selecione…</option>
            {MOTIVOS_PERDA.map((m) => (
              <option key={m} value={m}>
                {MOTIVOS_PERDA_LABEL[m]}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setMotivoPendente(null)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #30363d", background: "transparent", color: "#8b949e", cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="button" onClick={() => void confirmarMotivoPerda()} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, cursor: "pointer" }}>
              Confirmar perda
            </button>
          </div>
        </div>
      ) : null}

      {rastreio ? (
        <div style={{ marginTop: 20 }}>
          <CrmRastreioCadeia cadeia={rastreio} />
        </div>
      ) : null}

      {editando && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 12, border: "1px solid #30363d", background: "#161b22" }}>
          <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Título" style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }} />
          <textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descrição" style={{ width: "100%", marginBottom: 8, minHeight: 80, padding: 10, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }} />
          <input value={form.valor_estimado} onChange={(e) => setForm((f) => ({ ...f, valor_estimado: e.target.value }))} placeholder="Valor estimado" type="number" style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }} />
          <button type="button" disabled={salvando} onClick={() => void salvarEdicao()} style={{ padding: "10px 16px", borderRadius: 8, background: "#c9a24a", color: "#003b26", border: "none", fontWeight: 700, cursor: "pointer" }}>
            {salvando ? "Salvando…" : "Guardar"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 12, fontSize: 12 }}>
        <Link href={`/crm/projetos?negocio_id=${negocio.id}`} style={{ color: "#c9a24a", fontWeight: 700 }}>Projetos</Link>
        <Link href="/crm/obras" style={{ color: "#8b949e" }}>Obras</Link>
      </div>

      {(negocio.status === "fechado_ganho" || negocio.etapa === "ganho") &&
        (() => {
          const alvo = tipoAlvoPorMercado(negocio.prefixo_mercado);
          const outro = alvo === "projeto" ? "obra" : "projeto";
          const labelAlvo = alvo === "projeto" ? "projeto" : "obra";
          return (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 10,
                border: "1px solid #c9a24a44",
                background: "#003b2622",
              }}
            >
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#c9a24a" }}>
                Negócio ganho — gerar entrega
              </p>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#8b949e" }}>
                Cria a {labelAlvo} ligada a este negócio (padrão do mercado{" "}
                {labelMercadoPrefixo(negocio.prefixo_mercado)}).
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  disabled={derivando}
                  onClick={() => void gerarDerivado()}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: "#c9a24a",
                    color: "#003b26",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: derivando ? "default" : "pointer",
                    opacity: derivando ? 0.6 : 1,
                  }}
                >
                  {derivando ? "Gerando…" : `Gerar ${labelAlvo}`}
                </button>
                <button
                  type="button"
                  disabled={derivando}
                  onClick={() => void gerarDerivado(outro)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #30363d",
                    background: "transparent",
                    color: "#8b949e",
                    fontSize: 12,
                    cursor: derivando ? "default" : "pointer",
                  }}
                >
                  ou gerar {outro}
                </button>
                {derivadoMsg ? (
                  <span style={{ fontSize: 12, color: "#34d399" }}>{derivadoMsg}</span>
                ) : null}
              </div>
            </div>
          );
        })()}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
        <div>
          <p style={{ fontSize: 11, color: "#8b949e" }}>MERCADO</p>
          <p>{labelMercadoPrefixo(negocio.prefixo_mercado)}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: "#8b949e" }}>VALOR ESTIMADO</p>
          <p style={{ color: "#c9a24a", fontWeight: 700 }}>{formatCurrency(negocio.valor_estimado)}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: "#8b949e" }}>ETAPA</p>
          <p style={{ textTransform: "capitalize" }}>{negocio.etapa}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: "#8b949e" }}>STATUS</p>
          <p>{negocio.status}</p>
        </div>
      </div>

      {leadNome && negocio.lead_id && (
        <p style={{ marginTop: 16 }}>
          Lead:{" "}
          <Link href={`/crm/leads/${negocio.lead_id}`} style={{ color: "#60a5fa" }}>
            {leadNome}
          </Link>
        </p>
      )}

      {/* Pessoa vinculada (editável) */}
      <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "1px solid #30363d", background: "#161b22" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#8b949e", flex: 1 }}>PESSOA / DECISOR</p>
          <button type="button" onClick={() => setPickerAberto((o) => !o)}
            style={{ background: "none", border: "none", color: "#c9a24a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {pessoaVinc ? "Trocar" : "Vincular"}
          </button>
          {pessoaVinc ? (
            <button type="button" onClick={() => void definirPessoa(null)}
              style={{ background: "none", border: "none", color: "#8b949e", fontSize: 12, cursor: "pointer" }}>
              Desvincular
            </button>
          ) : null}
        </div>
        {pessoaVinc ? (
          <Link href={`/crm/pessoas/${pessoaVinc.id}`} style={{ color: "#e6edf3", fontWeight: 600, fontSize: 14 }}>
            {pessoaVinc.nome}
            {pessoaVinc.codigo ? <span style={{ color: "#8b949e", fontFamily: "monospace", fontSize: 12 }}> · {pessoaVinc.codigo}</span> : null}
          </Link>
        ) : (
          <p style={{ margin: 0, color: "#8b949e", fontSize: 13 }}>Nenhuma pessoa vinculada.</p>
        )}
        {pickerAberto ? (
          <div style={{ marginTop: 10 }}>
            <input
              value={buscaPessoa}
              onChange={(e) => void buscarPessoas(e.target.value)}
              placeholder="Buscar por nome, telefone ou código…"
              autoFocus
              style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 13 }}
            />
            {resultadosPessoa.length > 0 ? (
              <div style={{ marginTop: 6, border: "1px solid #30363d", borderRadius: 8, overflow: "hidden" }}>
                {resultadosPessoa.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => void definirPessoa(p)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderTop: i ? "1px solid #21262d" : "none", background: "transparent", color: "#e6edf3", fontSize: 13, cursor: "pointer" }}>
                    {p.nome}
                    {p.codigo ? <span style={{ color: "#8b949e", fontFamily: "monospace", fontSize: 11 }}> · {p.codigo}</span> : null}
                  </button>
                ))}
              </div>
            ) : buscaPessoa.trim().length >= 2 ? (
              <p style={{ margin: "6px 0 0", color: "#8b949e", fontSize: 12 }}>Nenhuma pessoa encontrada.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["novo", "qualificando", "qualificado", "proposta", "negociando", "fechamento", "ganho", "perdido"].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => mudarEtapa(e)}
            disabled={negocio.etapa === e}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #30363d",
              background: negocio.etapa === e ? "#003b26" : "#161b22",
              color: negocio.etapa === e ? "#c9a24a" : "#e6edf3",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {e}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ fontSize: 11, color: "#8b949e", margin: 0 }}>PRÓXIMA AÇÃO</p>
          {acaoStatus === "salvando" ? <span style={{ fontSize: 11, color: "#8b949e" }}>salvando…</span> : null}
          {acaoStatus === "salvo" ? <span style={{ fontSize: 11, color: "#34d399" }}>salvo ✓</span> : null}
        </div>
        <textarea
          value={proximaAcao}
          onChange={(e) => { setProximaAcao(e.target.value); setAcaoStatus(""); }}
          onBlur={() => void salvarProximaAcao()}
          placeholder="O que fazer a seguir? (salva automaticamente ao sair do campo)"
          style={{ width: "100%", marginTop: 6, minHeight: 56, padding: 10, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 13 }}
        />
      </div>

      <h2 style={{ marginTop: 32, fontSize: 16 }}>Timeline</h2>
      <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
        <input
          value={novaNota}
          onChange={(e) => setNovaNota(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void registrarNota(); }}
          placeholder="Registrar uma nota…"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 13 }}
        />
        <button type="button" disabled={salvandoNota || !novaNota.trim()} onClick={() => void registrarNota()}
          style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 12, cursor: salvandoNota || !novaNota.trim() ? "default" : "pointer", opacity: salvandoNota || !novaNota.trim() ? 0.6 : 1 }}>
          {salvandoNota ? "…" : "Adicionar"}
        </button>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {timeline.length === 0 ? (
          <li style={{ color: "#8b949e", fontSize: 13 }}>Sem atividades.</li>
        ) : (
          timeline.map((a) => (
            <li
              key={a.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #21262d",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#8b949e", marginRight: 8 }}>
                {new Date(a.criado_em).toLocaleString("pt-BR")}
              </span>
              {a.descricao}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

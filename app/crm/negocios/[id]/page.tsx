"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { CadastroFichaRelacionados } from "@/components/crm/cadastro/CadastroFichaRelacionados";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { FinanceiroNovoLancamentoModal } from "@/components/crm/FinanceiroNovoLancamentoModal";
import { toast } from "@/components/crm/toast";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";
import { resolverEntrega } from "@/lib/crm/derivar-negocio";
import { MOTIVOS_PERDA, MOTIVOS_PERDA_LABEL } from "@/lib/crm/pipelines";

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
  proxima_acao_em: string | null;
  lead_id: string | null;
  pessoa_id: string | null;
  criado_em: string | null;
};

type FaixaAcao = "atrasada" | "hoje" | "futura" | "sem_data";

/** Início do dia local em ms — base para classificar vencimento. */
function inicioDoDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function classificarAcao(dataIso: string | null): FaixaAcao {
  if (!dataIso) return "sem_data";
  const t = new Date(dataIso).getTime();
  if (Number.isNaN(t)) return "sem_data";
  const hoje0 = inicioDoDia(new Date());
  const amanha0 = hoje0 + 86_400_000;
  if (t < hoje0) return "atrasada";
  if (t < amanha0) return "hoje";
  return "futura";
}

/** Cor da faixa: atrasada=vermelho, hoje=dourado, futura=verde-água, sem data=neutro. */
const COR_ACAO: Record<FaixaAcao, string> = {
  atrasada: "#f85149",
  hoje: "#c9a24a",
  futura: "#2f9e8f",
  sem_data: "#8b949e",
};

/** Texto humano do "quando". */
function quandoAcao(dataIso: string | null): string {
  if (!dataIso) return "sem data";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "sem data";
  const hoje0 = inicioDoDia(new Date());
  const alvo0 = inicioDoDia(data);
  const dias = Math.round((alvo0 - hoje0) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  if (dias < 0) return `há ${Math.abs(dias)} dias`;
  if (dias < 7) return `em ${dias} dias`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** ISO (yyyy-mm-dd) de hoje + N dias, para os atalhos de agenda. */
function isoDiaRelativo(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Converte o valor do <input type="date"> (yyyy-mm-dd) em timestamptz (meio-dia local). */
function dateInputParaIso(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(`${valor}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Extrai yyyy-mm-dd de um timestamptz, para preencher o <input type="date">. */
function isoParaDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type TimelineItem = {
  id: string;
  tipo: string;
  descricao: string;
  criado_em: string;
};

type PessoaMini = { id: string; nome: string; codigo?: string | null };

// `papel` só vem preenchido em pessoas/empresas (relacionados do negócio); demais grupos ignoram.
type NamedRef = { id: string; nome: string; papel?: string | null };
type Relacionados = {
  pessoas: NamedRef[];
  empresas: NamedRef[];
  parceiros?: NamedRef[];
  leads: NamedRef[];
  obras: NamedRef[];
  projetos: NamedRef[];
  linhagem: { pai: NamedRef | null; raiz: NamedRef | null; filhos: NamedRef[] };
};

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
  const [relacionados, setRelacionados] = useState<Relacionados | null>(null);
  const [motivoPendente, setMotivoPendente] = useState<string | null>(null);
  const [motivoSelecionado, setMotivoSelecionado] = useState("");
  const [derivando, setDerivando] = useState(false);
  const [derivadoMsg, setDerivadoMsg] = useState<string | null>(null);
  const [proximaAcao, setProximaAcao] = useState("");
  const [proximaAcaoEm, setProximaAcaoEm] = useState("");
  const [acaoStatus, setAcaoStatus] = useState<"" | "salvando" | "salvo">("");
  const [editandoAcao, setEditandoAcao] = useState(false);
  const [novaNota, setNovaNota] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [pessoaVinc, setPessoaVinc] = useState<PessoaMini | null>(null);
  const [pickerAberto, setPickerAberto] = useState(false);
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [resultadosPessoa, setResultadosPessoa] = useState<PessoaMini[]>([]);
  const [modalReceber, setModalReceber] = useState(false);
  // "Já gerado": evita o usuário criar dois recebíveis para o mesmo negócio (duplicidade
  // no caminho do dinheiro). O backend já é a fonte da verdade (anti-duplicação + índice
  // único parcial), este estado só dá o feedback visual de que a conta já foi lançada.
  const [recebivelGerado, setRecebivelGerado] = useState(false);
  const [confirmandoArquivar, setConfirmandoArquivar] = useState(false);
  const [arquivando, setArquivando] = useState(false);

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
        setProximaAcaoEm(isoParaDateInput(n.proxima_acao_em ?? null));
        setAcaoStatus("");
        setEditandoAcao(false);
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

  // Rastreio AUTOMÁTICO name-only: relacionados do negócio (pessoas/empresas/leads/obras/
  // projetos) + linhagem (origem/derivados). Substitui o CrmRastreioCadeia (que mostrava código).
  useEffect(() => {
    if (!id) return;
    void (async () => {
      const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}/relacionados`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: Relacionados };
      if (res.ok && json.data) setRelacionados(json.data);
    })();
  }, [id]);

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
      toast.success("Negócio salvo");
      void carregar();
    } else {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(json.error || "Não foi possível salvar o negócio");
    }
  }

  async function arquivar() {
    setArquivando(true);
    try {
      const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ status: "cancelado" }),
      });
      if (res.ok) {
        setConfirmandoArquivar(false);
        toast.success("Negócio arquivado");
        void carregar();
      } else {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error || "Não foi possível arquivar o negócio");
      }
    } catch {
      toast.error("Erro de rede ao arquivar o negócio");
    } finally {
      setArquivando(false);
    }
  }

  /** Grava próxima ação (texto + data). Reaproveitada por salvar, reagendar e concluir. */
  async function patchProximaAcao(payload: { proxima_acao: string | null; proxima_acao_em: string | null }) {
    setAcaoStatus("salvando");
    try {
      const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setAcaoStatus("salvo");
        setNegocio((n) =>
          n ? { ...n, proxima_acao: payload.proxima_acao, proxima_acao_em: payload.proxima_acao_em } : n
        );
        return true;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setAcaoStatus("");
      toast.error(json.error || "Não foi possível salvar a próxima ação");
      return false;
    } catch {
      setAcaoStatus("");
      toast.error("Erro de rede ao salvar a próxima ação");
      return false;
    }
  }

  /** Salvar a próxima ação definida no formulário (texto + data). */
  async function salvarAcao() {
    const texto = proximaAcao.trim();
    if (!texto) {
      toast.error("Escreva o que fazer a seguir.");
      return;
    }
    const ok = await patchProximaAcao({
      proxima_acao: texto,
      proxima_acao_em: dateInputParaIso(proximaAcaoEm),
    });
    if (ok) {
      setEditandoAcao(false);
      toast.success("Próxima ação definida");
    }
  }

  /** Reagendar em 1 toque: mantém o texto e troca só a data. */
  async function reagendarAcao(novaDataIso: string | null) {
    const ok = await patchProximaAcao({
      proxima_acao: (negocio?.proxima_acao ?? proximaAcao).trim() || null,
      proxima_acao_em: novaDataIso,
    });
    if (ok) {
      setProximaAcaoEm(isoParaDateInput(novaDataIso));
      toast.success(novaDataIso ? "Reagendada" : "Data removida");
    }
  }

  /** Concluir: dá baixa na ação (limpa texto e data). */
  async function concluirAcao() {
    const ok = await patchProximaAcao({ proxima_acao: null, proxima_acao_em: null });
    if (ok) {
      setProximaAcao("");
      setProximaAcaoEm("");
      setEditandoAcao(false);
      toast.success("Ação concluída");
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
        toast.success("Nota registrada");
        void carregar();
      } else {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error || "Não foi possível registrar a nota");
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
      toast.success(pessoa ? "Contato vinculado" : "Contato removido");
    } else {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(json.error || "Não foi possível vincular o contato");
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
        // status canônico de perda = "fechado_perdido" (NEGOCIO_STATUS / negocio-rules);
        // "perdido" era gravado cru e sumia dos contadores que filtram fechado_perdido.
        etapa: novaEtapa,
        status: perdido ? "fechado_perdido" : undefined,
      }),
    });
    if (res.ok) {
      void carregar();
    } else {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(json.error || "Não foi possível mover a etapa");
    }
  }

  async function confirmarMotivoPerda() {
    if (!motivoPendente || !motivoSelecionado.trim()) return;
    const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({
        etapa: motivoPendente,
        status: "fechado_perdido",
        motivo_perda: motivoSelecionado.trim(),
      }),
    });
    if (res.ok) {
      setMotivoPendente(null);
      setMotivoSelecionado("");
      void carregar();
    } else {
      toast.error("Não foi possível registrar a perda.");
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
      setDerivadoMsg(`${label} ${json.ja_existia ? "já existia" : "criada"}.`.trim());
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
        <button type="button" onClick={() => setEditando((e) => !e)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #1d3a2c", background: "#16271e", color: "#c9a24a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {editando ? "Cancelar" : "Editar"}
        </button>
        <button type="button" onClick={() => setConfirmandoArquivar(true)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #f8514944", background: "transparent", color: "#f85149", fontSize: 12, cursor: "pointer" }}>
          Arquivar
        </button>
      </div>
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
            border: "1px solid #1d3a2c",
            background: "#0f1d16",
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
              border: "1px solid #1d3a2c",
              background: "#0a140f",
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
            <button type="button" onClick={() => setMotivoPendente(null)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #1d3a2c", background: "transparent", color: "#8b949e", cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="button" onClick={() => void confirmarMotivoPerda()} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, cursor: "pointer" }}>
              Confirmar perda
            </button>
          </div>
        </div>
      ) : null}

      {relacionados ? (
        <div
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 10,
            border: "1px solid #1d3a2c",
            background: "#0f1d16",
          }}
        >
          <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: "#8b949e" }}>
            RELACIONADOS
          </p>
          <CadastroFichaRelacionados
            pessoas={relacionados.pessoas}
            empresas={relacionados.empresas}
            parceiros={relacionados.parceiros ?? []}
            leads={relacionados.leads}
            obras={relacionados.obras}
            projetos={relacionados.projetos}
            variant="page"
          />
          {relacionados.linhagem.pai ||
          relacionados.linhagem.raiz ||
          relacionados.linhagem.filhos.length > 0 ? (
            <div style={{ marginTop: 24 }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#8b949e" }}>
                ORIGEM / DERIVADOS
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {relacionados.linhagem.raiz ? (
                  <li style={{ padding: "8px 0", borderBottom: "1px solid #1d3a2c" }}>
                    <span style={{ marginRight: 8, fontSize: 11, color: "#8b949e", textTransform: "uppercase" }}>
                      Raiz
                    </span>
                    <Link
                      href={`/crm/negocios/${relacionados.linhagem.raiz.id}`}
                      style={{ color: "#c9a24a", textDecoration: "none", fontWeight: 600 }}
                    >
                      {relacionados.linhagem.raiz.nome}
                    </Link>
                  </li>
                ) : null}
                {relacionados.linhagem.pai ? (
                  <li style={{ padding: "8px 0", borderBottom: "1px solid #1d3a2c" }}>
                    <span style={{ marginRight: 8, fontSize: 11, color: "#8b949e", textTransform: "uppercase" }}>
                      Origem
                    </span>
                    <Link
                      href={`/crm/negocios/${relacionados.linhagem.pai.id}`}
                      style={{ color: "#c9a24a", textDecoration: "none", fontWeight: 600 }}
                    >
                      {relacionados.linhagem.pai.nome}
                    </Link>
                  </li>
                ) : null}
                {relacionados.linhagem.filhos.map((f) => (
                  <li key={f.id} style={{ padding: "8px 0", borderBottom: "1px solid #1d3a2c" }}>
                    <span style={{ marginRight: 8, fontSize: 11, color: "#8b949e", textTransform: "uppercase" }}>
                      Derivado
                    </span>
                    <Link
                      href={`/crm/negocios/${f.id}`}
                      style={{ color: "#c9a24a", textDecoration: "none", fontWeight: 600 }}
                    >
                      {f.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {editando && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 12, border: "1px solid #1d3a2c", background: "#0f1d16" }}>
          <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Título" style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid #1d3a2c", background: "#0a140f", color: "#e6edf3" }} />
          <textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descrição" style={{ width: "100%", marginBottom: 8, minHeight: 80, padding: 10, borderRadius: 8, border: "1px solid #1d3a2c", background: "#0a140f", color: "#e6edf3" }} />
          <input value={form.valor_estimado} onChange={(e) => setForm((f) => ({ ...f, valor_estimado: e.target.value }))} placeholder="Valor estimado" type="number" style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid #1d3a2c", background: "#0a140f", color: "#e6edf3" }} />
          <button type="button" disabled={salvando} onClick={() => void salvarEdicao()} style={{ padding: "10px 16px", borderRadius: 8, background: "#c9a24a", color: "#003b26", border: "none", fontWeight: 700, cursor: "pointer" }}>
            {salvando ? "Salvando…" : "Guardar"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 12, fontSize: 12 }}>
        <Link href={`/crm/arquitetura?negocio_id=${negocio.id}`} style={{ color: "#c9a24a", fontWeight: 700 }}>Arquitetura</Link>
        <Link href={`/crm/obras?negocio_id=${negocio.id}`} style={{ color: "#8b949e" }}>Obras</Link>
      </div>

      {(negocio.status === "fechado_ganho" || negocio.etapa === "ganho") &&
        (() => {
          const entrega = resolverEntrega(negocio.prefixo_mercado);
          const labelAlvo = entrega.label.toLowerCase();
          const outro = entrega.tipo === "obra" ? "projeto" : "obra";
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
                    border: "1px solid #1d3a2c",
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

              {/* Cadeia venda → financeiro: gera o recebível já pré-preenchido. */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1d3a2c" }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#8b949e" }}>
                  Lançar o valor deste negócio no financeiro (você confirma/ajusta antes de salvar).
                </p>
                <button
                  type="button"
                  disabled={recebivelGerado}
                  onClick={() => setModalReceber(true)}
                  style={{
                    minHeight: 40,
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: `1px solid ${recebivelGerado ? "#1d3a2c" : "#c9a24a"}`,
                    background: "transparent",
                    color: recebivelGerado ? "#34d399" : "#c9a24a",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: recebivelGerado ? "default" : "pointer",
                    opacity: recebivelGerado ? 0.85 : 1,
                  }}
                >
                  {recebivelGerado ? "✓ Conta a receber gerada" : "+ Gerar conta a receber"}
                </button>
              </div>
            </div>
          );
        })()}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginTop: 24 }}>
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
          <Link href={`/crm/leads/${negocio.lead_id}`} style={{ color: "#c9a24a" }}>
            {leadNome}
          </Link>
        </p>
      )}

      {/* Pessoa vinculada (editável) */}
      <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "1px solid #1d3a2c", background: "#0f1d16" }}>
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
          </Link>
        ) : (
          <p style={{ margin: 0, color: "#8b949e", fontSize: 13 }}>Nenhuma pessoa vinculada.</p>
        )}
        {pickerAberto ? (
          <div style={{ marginTop: 10 }}>
            <input
              value={buscaPessoa}
              onChange={(e) => void buscarPessoas(e.target.value)}
              placeholder="Buscar por nome ou telefone…"
              autoFocus
              style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #1d3a2c", background: "#0a140f", color: "#e6edf3", fontSize: 13 }}
            />
            {resultadosPessoa.length > 0 ? (
              <div style={{ marginTop: 6, border: "1px solid #1d3a2c", borderRadius: 8, overflow: "hidden" }}>
                {resultadosPessoa.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => void definirPessoa(p)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderTop: i ? "1px solid #16271e" : "none", background: "transparent", color: "#e6edf3", fontSize: 13, cursor: "pointer" }}>
                    {p.nome}
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
              border: "1px solid #1d3a2c",
              background: negocio.etapa === e ? "#003b26" : "#0f1d16",
              color: negocio.etapa === e ? "#c9a24a" : "#e6edf3",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {e}
          </button>
        ))}
      </div>

      {(() => {
        const acaoSalva = (negocio.proxima_acao ?? "").trim();
        const faixa = classificarAcao(negocio.proxima_acao_em ?? null);
        const cor = COR_ACAO[faixa];
        const temAcao = acaoSalva.length > 0;
        const mostrarForm = editandoAcao || !temAcao;

        return (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontSize: 11, color: "#8b949e", margin: 0 }}>PRÓXIMA AÇÃO</p>
              {acaoStatus === "salvando" ? <span style={{ fontSize: 11, color: "#8b949e" }}>salvando…</span> : null}
              {acaoStatus === "salvo" ? <span style={{ fontSize: 11, color: "#34d399" }}>salvo ✓</span> : null}
            </div>

            {/* ── Estado COM ação definida: Click-and-Go (Concluir / Reagendar / Editar) ── */}
            {temAcao && !mostrarForm ? (
              <div
                style={{
                  marginTop: 8,
                  borderRadius: 12,
                  border: "1px solid #1d3a2c",
                  borderLeft: `3px solid ${cor}`,
                  background: "#0f1d16",
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <p style={{ margin: 0, flex: 1, fontSize: 14, lineHeight: 1.4, color: "#e6edf3" }}>{acaoSalva}</p>
                  <span
                    style={{
                      flexShrink: 0,
                      borderRadius: 999,
                      padding: "3px 9px",
                      fontSize: 11,
                      fontWeight: 700,
                      background: `${cor}22`,
                      color: cor,
                    }}
                  >
                    {faixa === "atrasada" ? "⚠ " : ""}
                    {quandoAcao(negocio.proxima_acao_em ?? null)}
                  </span>
                </div>

                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    disabled={acaoStatus === "salvando"}
                    onClick={() => void concluirAcao()}
                    style={{
                      minHeight: 38,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #2f9e8f66",
                      background: "#2f9e8f1f",
                      color: "#2f9e8f",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: acaoStatus === "salvando" ? "default" : "pointer",
                    }}
                  >
                    ✓ Concluir
                  </button>
                  <button
                    type="button"
                    disabled={acaoStatus === "salvando"}
                    onClick={() => void reagendarAcao(dateInputParaIso(isoDiaRelativo(1)))}
                    style={{
                      minHeight: 38,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #1d3a2c",
                      background: "#16271e",
                      color: "#e6edf3",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: acaoStatus === "salvando" ? "default" : "pointer",
                    }}
                  >
                    Adiar p/ amanhã
                  </button>
                  <button
                    type="button"
                    disabled={acaoStatus === "salvando"}
                    onClick={() => void reagendarAcao(dateInputParaIso(isoDiaRelativo(7)))}
                    style={{
                      minHeight: 38,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #1d3a2c",
                      background: "#16271e",
                      color: "#e6edf3",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: acaoStatus === "salvando" ? "default" : "pointer",
                    }}
                  >
                    +7 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProximaAcao(acaoSalva);
                      setProximaAcaoEm(isoParaDateInput(negocio.proxima_acao_em ?? null));
                      setEditandoAcao(true);
                      setAcaoStatus("");
                    }}
                    style={{
                      minHeight: 38,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #1d3a2c",
                      background: "transparent",
                      color: "#c9a24a",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Editar / reagendar
                  </button>
                </div>
              </div>
            ) : (
              /* ── Estado SEM ação (ou editando): definir o quê + quando ── */
              <div
                style={{
                  marginTop: 8,
                  borderRadius: 12,
                  border: "1px solid #1d3a2c",
                  background: "#0f1d16",
                  padding: 14,
                }}
              >
                <textarea
                  value={proximaAcao}
                  onChange={(e) => { setProximaAcao(e.target.value); setAcaoStatus(""); }}
                  placeholder="O que fazer a seguir? Ex.: ligar para confirmar a proposta"
                  style={{ width: "100%", minHeight: 56, padding: 10, borderRadius: 8, border: "1px solid #1d3a2c", background: "#0a140f", color: "#e6edf3", fontSize: 13 }}
                />

                <p style={{ margin: "12px 0 6px", fontSize: 11, color: "#8b949e" }}>QUANDO</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[
                    { label: "Hoje", dias: 0 },
                    { label: "Amanhã", dias: 1 },
                    { label: "+3 dias", dias: 3 },
                    { label: "+7 dias", dias: 7 },
                  ].map((opt) => {
                    const iso = isoDiaRelativo(opt.dias);
                    const ativo = proximaAcaoEm === iso;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => { setProximaAcaoEm(iso); setAcaoStatus(""); }}
                        style={{
                          minHeight: 36,
                          padding: "7px 12px",
                          borderRadius: 8,
                          border: `1px solid ${ativo ? "#c9a24a" : "#1d3a2c"}`,
                          background: ativo ? "#c9a24a22" : "#16271e",
                          color: ativo ? "#c9a24a" : "#e6edf3",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                  <input
                    type="date"
                    value={proximaAcaoEm}
                    onChange={(e) => { setProximaAcaoEm(e.target.value); setAcaoStatus(""); }}
                    style={{
                      minHeight: 36,
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #1d3a2c",
                      background: "#0a140f",
                      color: "#e6edf3",
                      fontSize: 12,
                    }}
                  />
                  {proximaAcaoEm ? (
                    <button
                      type="button"
                      onClick={() => { setProximaAcaoEm(""); setAcaoStatus(""); }}
                      style={{ minHeight: 36, padding: "7px 10px", borderRadius: 8, border: "none", background: "transparent", color: "#8b949e", fontSize: 12, cursor: "pointer" }}
                    >
                      sem data
                    </button>
                  ) : null}
                </div>

                <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    disabled={acaoStatus === "salvando" || !proximaAcao.trim()}
                    onClick={() => void salvarAcao()}
                    style={{
                      minHeight: 40,
                      padding: "10px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: "#c9a24a",
                      color: "#003b26",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: acaoStatus === "salvando" || !proximaAcao.trim() ? "default" : "pointer",
                      opacity: acaoStatus === "salvando" || !proximaAcao.trim() ? 0.6 : 1,
                    }}
                  >
                    {acaoStatus === "salvando" ? "Salvando…" : temAcao ? "Atualizar ação" : "Definir ação"}
                  </button>
                  {editandoAcao ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoAcao(false);
                        setProximaAcao(negocio.proxima_acao ?? "");
                        setProximaAcaoEm(isoParaDateInput(negocio.proxima_acao_em ?? null));
                        setAcaoStatus("");
                      }}
                      style={{ minHeight: 40, padding: "10px 16px", borderRadius: 8, border: "1px solid #1d3a2c", background: "transparent", color: "#8b949e", fontSize: 13, cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <h2 style={{ marginTop: 32, fontSize: 16 }}>Timeline</h2>
      <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
        <input
          value={novaNota}
          onChange={(e) => setNovaNota(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void registrarNota(); }}
          placeholder="Registrar uma nota…"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #1d3a2c", background: "#0a140f", color: "#e6edf3", fontSize: 13 }}
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
                borderBottom: "1px solid #16271e",
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

      <FinanceiroNovoLancamentoModal
        open={modalReceber}
        onClose={() => setModalReceber(false)}
        onCriado={() => {
          setRecebivelGerado(true);
          toast.success("Conta a receber gerada");
        }}
        tipoInicial="receber"
        prefill={{
          descricao: negocio.titulo || "",
          valor: negocio.valor_fechado ?? negocio.valor_estimado ?? undefined,
          clienteNome: pessoaVinc?.nome ?? leadNome ?? undefined,
          negocioId: negocio.id,
        }}
      />

      <CrmConfirmDialog
        open={confirmandoArquivar}
        title="Arquivar este negócio?"
        confirmLabel="Arquivar"
        danger
        loading={arquivando}
        onCancel={() => setConfirmandoArquivar(false)}
        onConfirm={() => void arquivar()}
      >
        O negócio passa para o status <strong style={{ color: "#e6edf3" }}>cancelado</strong> e sai do
        pipeline ativo. Você pode reabri-lo depois mudando a etapa.
      </CrmConfirmDialog>
    </div>
  );
}

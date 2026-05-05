"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const TIPOS_AGENTE = [
  { id: "atendimento", label: "Atendimento", icon: "💬", desc: "Atende leads, qualifica e vende" },
  { id: "trafego",     label: "Tráfego",     icon: "📊", desc: "Monitora campanhas e métricas" },
  { id: "conteudo",    label: "Conteúdo",    icon: "✏️",  desc: "Produz textos, posts e criativos" },
  { id: "gestao",      label: "Gestão",      icon: "🎯", desc: "Supervisiona e coordena equipes" },
  { id: "especialista",label: "Especialista",icon: "🔬", desc: "Pesquisa, estratégia e análise" },
];

const NIVEIS = [
  { n: 1, label: "N1 — CEO",        desc: "Visão estratégica, decide o rumo",       modelo: "claude-opus-4-7",           cor: "bg-red-800"    },
  { n: 2, label: "N2 — Diretor",    desc: "Dirige uma área inteira",                modelo: "claude-sonnet-4-6",         cor: "bg-orange-800" },
  { n: 3, label: "N3 — Gerente",    desc: "Coordena um time e métricas",            modelo: "claude-sonnet-4-6",         cor: "bg-yellow-800" },
  { n: 4, label: "N4 — Executor",   desc: "Executa as tarefas do dia a dia",        modelo: "claude-haiku-4-5-20251001", cor: "bg-blue-800"   },
  { n: 5, label: "N5 — Especialista",desc: "Especialidade técnica sob demanda",     modelo: "claude-haiku-4-5-20251001", cor: "bg-gray-700"   },
];

const HUMORES = [
  { id: 1, label: "Analítico",   desc: "Baseado em dados, lógico, preciso",   emoji: "📊" },
  { id: 2, label: "Criativo",    desc: "Inovador, propõe alternativas",        emoji: "💡" },
  { id: 3, label: "Pragmático",  desc: "Focado em resultado, direto",          emoji: "⚡" },
  { id: 4, label: "Empático",    desc: "Acolhedor, paciente, humano",          emoji: "❤️" },
  { id: 5, label: "Competitivo", desc: "Orientado a ganhar, urgente",          emoji: "🏆" },
];

const PERSONALIDADES = [
  { id: 1, label: "Formal",      desc: "Linguagem técnica e profissional",    emoji: "👔" },
  { id: 2, label: "Casual",      desc: "Próximo, acessível, simples",         emoji: "😊" },
  { id: 3, label: "Assertivo",   desc: "Direto, objetivo, vai ao ponto",      emoji: "🎯" },
  { id: 4, label: "Entusiasta",  desc: "Energético, positivo, celebra",       emoji: "🚀" },
  { id: 5, label: "Estratégico", desc: "Visão de longo prazo",                emoji: "♟️" },
];

const MODELOS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku",  desc: "Rápido e econômico — ideal para executores", custo: "R$0,001/msg" },
  { id: "claude-sonnet-4-6",         label: "Sonnet", desc: "Equilibrado — ideal para gerentes",          custo: "R$0,01/msg"  },
  { id: "claude-opus-4-7",           label: "Opus",   desc: "Mais poderoso — ideal para diretores/CEO",   custo: "R$0,08/msg"  },
];

const MERCADOS = [
  { id: "IMB", label: "🏠 Imobiliário" },
  { id: "ARQ", label: "🏛 Arquitetura" },
  { id: "RFM", label: "🔨 Reforma"     },
  { id: "SRV", label: "🤝 Fornecedor/Serviço" },
  { id: "PRO", label: "📦 Produto"     },
  { id: "GRL", label: "📌 Geral"       },
];

const SUPERVISORES_PADRAO = [
  { slug: "gerente_atendimento", label: "Gerente de Atendimento" },
  { slug: "ariane",              label: "Ariane — Diretora"      },
  { slug: "ceo",                 label: "CEO IA"                 },
  { slug: "wendel",              label: "Wendel (Humano)"        },
];

const SECOES_CONHECIMENTO = [
  { id: "empresa",    label: "🏢 Sobre o negócio",        placeholder: "Quem somos, o que fazemos, nossos diferenciais, valores e proposta de valor..." },
  { id: "servicos",   label: "🛠 Serviços e produtos",    placeholder: "Detalhes de cada serviço ou produto, faixas de preço, entregáveis, prazos médios..." },
  { id: "atendimento",label: "💬 Como atender",           placeholder: "Fluxo de atendimento, perguntas que deve fazer, como conduzir o lead, tom de voz..." },
  { id: "proibicoes", label: "🚫 O que nunca fazer",      placeholder: "O que nunca prometer, termos proibidos, quando sempre escalar para humano..." },
  { id: "objeccoes",  label: "🛡 Como lidar com objeções",placeholder: "Objeções mais comuns e como responder. Ex: 'tá caro' — 'vou pensar'..." },
  { id: "exemplos",   label: "✅ Exemplos reais",         placeholder: "Exemplos de boas respostas, cases de sucesso, situações reais..." },
];

interface Conhecimento { secao: string; titulo: string; conteudo: string; }

interface FormData {
  tipo: string; nome: string; cargo: string; area: string;
  nivel: number; modelo_padrao: string; humor: number; personalidade: number;
  mercados: string[]; supervisor_slug: string;
  horario_inicio: string; horario_fim: string; dias_semana: number[];
  pode_falar_preco: boolean; pode_prometer_prazo: boolean;
  pode_enviar_proposta: boolean; pode_agendar: boolean; pode_pedir_email: boolean;
  escala_quando: string; sempre_dizer: string; nunca_dizer: string;
  conhecimentos: Conhecimento[];
}

const FORM_INICIAL: FormData = {
  tipo: "", nome: "", cargo: "", area: "",
  nivel: 4, modelo_padrao: "claude-haiku-4-5-20251001", humor: 4, personalidade: 2,
  mercados: ["GRL"], supervisor_slug: "gerente_atendimento",
  horario_inicio: "08:00", horario_fim: "22:00", dias_semana: [0,1,2,3,4,5,6],
  pode_falar_preco: false, pode_prometer_prazo: false,
  pode_enviar_proposta: false, pode_agendar: true, pode_pedir_email: false,
  escala_quando: "lead_acima_50k",
  sempre_dizer: "",
  nunca_dizer: "não sei, impossível, não posso, não faço ideia",
  conhecimentos: [],
};

function gerarSlug(nome: string): string {
  return nome.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function gerarPreviewPrompt(form: FormData): string {
  const humor = HUMORES.find(h => h.id === form.humor);
  const personalidade = PERSONALIDADES.find(p => p.id === form.personalidade);
  const secoes: string[] = [];

  if (form.nome) {
    secoes.push(`═══ IDENTIDADE ═══
Você é ${form.nome}${form.cargo ? `, ${form.cargo}` : ""}${form.area ? ` da área de ${form.area}` : ""}.
Comportamento: Humor ${humor?.label || ""} + Personalidade ${personalidade?.label || ""}.`);
  }

  for (const c of form.conhecimentos.filter(c => c.conteudo.trim())) {
    const s = SECOES_CONHECIMENTO.find(s => s.id === c.secao);
    secoes.push(`═══ ${s?.label.toUpperCase() || c.secao} ═══\n[${c.titulo || "Sem título"}]\n${c.conteudo}`);
  }

  const regras: string[] = [];
  if (!form.pode_falar_preco)     regras.push("Nunca prometa preço antes de avaliação humana");
  if (!form.pode_prometer_prazo)  regras.push("Nunca garanta prazo sem avaliação humana");
  if (!form.pode_enviar_proposta) regras.push("Nunca envie proposta sem aprovação");
  if (!form.pode_pedir_email)     regras.push("Não solicite email no fluxo inicial");
  if (form.nunca_dizer)           regras.push(`Nunca dizer: ${form.nunca_dizer}`);
  if (regras.length > 0) secoes.push(`═══ REGRAS ═══\n${regras.map(r => `• ${r}`).join("\n")}`);

  secoes.push(`═══ REGRAS UNIVERSAIS ═══
- Máximo 3 linhas por mensagem no WhatsApp
- Responda primeiro a pergunta do cliente
- Nunca mencione que é IA a menos que perguntado
- Nunca encerre sem indicar o próximo passo`);

  return secoes.join("\n\n") || "Preencha os campos para ver o preview...";
}

function CardSelecao({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`p-4 rounded-xl border-2 text-left transition-all ${ativo ? "border-[#c9a24a] bg-[#003b26] text-white" : "border-[#e0ddd6] bg-white text-[#1a1a1a] hover:border-[#003b26]"}`}>
      {children}
    </button>
  );
}

function Toggle({ ativo, onChange, label, desc }: { ativo: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#e0ddd6]">
      <div>
        <p className="text-[#1a1a1a] text-sm font-medium">{label}</p>
        {desc && <p className="text-[#888] text-xs mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => onChange(!ativo)} className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${ativo ? "bg-[#003b26]" : "bg-[#ccc]"}`}>
        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-transform ${ativo ? "translate-x-6" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

export default function NovoAgentePage() {
  const router = useRouter();
  const [passo, setPasso] = useState(1);
  const [form, setForm] = useState<FormData>(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [secaoConhecimento, setSecaoConhecimento] = useState("empresa");

  const totalPassos = 5;
  const progresso = (passo / totalPassos) * 100;

  function update(campo: keyof FormData, valor: unknown) {
    setForm(prev => ({ ...prev, [campo]: valor }));
  }

  function toggleMercado(id: string) {
    setForm(prev => ({
      ...prev,
      mercados: prev.mercados.includes(id) ? prev.mercados.filter(m => m !== id) : [...prev.mercados, id],
    }));
  }

  function getConhecimento(secao: string): Conhecimento {
    return form.conhecimentos.find(c => c.secao === secao) || { secao, titulo: secao, conteudo: "" };
  }

  function updateConhecimento(secao: string, campo: "titulo" | "conteudo", valor: string) {
    setForm(prev => {
      const existente = prev.conhecimentos.find(c => c.secao === secao);
      if (existente) {
        return { ...prev, conhecimentos: prev.conhecimentos.map(c => c.secao === secao ? { ...c, [campo]: valor } : c) };
      }
      return { ...prev, conhecimentos: [...prev.conhecimentos, { secao, titulo: secao, conteudo: "", [campo]: valor }] };
    });
  }

  async function salvar() {
    if (!form.nome || !form.tipo) { setErro("Preencha pelo menos o nome e o tipo do agente"); return; }
    setSalvando(true);
    setErro("");

    const payload = {
      agente_slug: gerarSlug(form.nome),
      nome: form.nome,
      cargo: form.cargo || form.tipo,
      area: form.area || form.tipo,
      nivel: form.nivel,
      modelo_padrao: form.modelo_padrao,
      humor: form.humor,
      personalidade_id: form.personalidade,
      prefixo_mercado: form.mercados.join(","),
      supervisor_slug: form.supervisor_slug,
      horario_inicio: form.horario_inicio,
      horario_fim: form.horario_fim,
      dias_semana: form.dias_semana,
      system_prompt_base: `Você é ${form.nome}${form.cargo ? `, ${form.cargo}` : ""}. ${form.area ? `Área: ${form.area}.` : ""}`,
      pode_fazer: [form.pode_agendar && "agendar_reuniao", "qualificar_lead", "responder_duvidas", "registrar_crm"].filter(Boolean) as string[],
      nao_pode_fazer: [
        !form.pode_falar_preco && "prometer_preco",
        !form.pode_prometer_prazo && "prometer_prazo",
        !form.pode_enviar_proposta && "enviar_proposta_sem_aprovacao",
        !form.pode_pedir_email && "pedir_email_fluxo_inicial",
      ].filter(Boolean) as string[],
      sempre_dizer: form.sempre_dizer.split(",").map(s => s.trim()).filter(Boolean),
      nunca_dizer: form.nunca_dizer.split(",").map(s => s.trim()).filter(Boolean),
      conhecimentos: form.conhecimentos.filter(c => c.conteudo.trim()),
    };

    const res = await fetch("/api/agentes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      router.push(`/crm/agentes`);
    } else {
      const data = await res.json() as { erro?: string };
      setErro(data.erro || "Erro ao criar agente");
      setSalvando(false);
    }
  }

  const previewPrompt = gerarPreviewPrompt(form);
  const tokensEstimados = Math.ceil(previewPrompt.length / 4);

  return (
    <div className="min-h-screen bg-[#f7f4ec]">
      {/* HEADER */}
      <div className="bg-[#003b26] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-[#c9a24a] hover:text-white text-sm transition-colors">← Voltar</button>
          <div>
            <h1 className="text-white font-bold text-lg">Criar Novo Agente</h1>
            <p className="text-[#c9a24a] text-xs">Passo {passo} de {totalPassos}</p>
          </div>
        </div>
        {form.nome && (
          <div className="text-right">
            <p className="text-white text-sm font-bold">{form.nome}</p>
            <p className="text-[#c9a24a] text-xs">{gerarSlug(form.nome)}</p>
          </div>
        )}
      </div>

      {/* BARRA DE PROGRESSO */}
      <div className="h-1 bg-[#e0ddd6]">
        <div className="h-full bg-[#c9a24a] transition-all duration-500" style={{ width: `${progresso}%` }} />
      </div>

      <div className="flex max-w-6xl mx-auto gap-6 p-6">
        {/* FORMULÁRIO */}
        <div className="flex-1 space-y-6">

          {/* PASSO 1 — TIPO */}
          {passo === 1 && (
            <div>
              <h2 className="text-[#003b26] font-bold text-xl mb-2">Qual é o tipo deste agente?</h2>
              <p className="text-[#555] text-sm mb-4">Escolha a função principal. Os campos vão se adaptar automaticamente.</p>
              <div className="grid grid-cols-2 gap-3">
                {TIPOS_AGENTE.map(tipo => (
                  <CardSelecao key={tipo.id} ativo={form.tipo === tipo.id} onClick={() => update("tipo", tipo.id)}>
                    <div className="text-2xl mb-2">{tipo.icon}</div>
                    <div className="font-bold text-sm">{tipo.label}</div>
                    <div className="text-xs mt-1 opacity-70">{tipo.desc}</div>
                  </CardSelecao>
                ))}
              </div>
            </div>
          )}

          {/* PASSO 2 — IDENTIDADE */}
          {passo === 2 && (
            <div className="space-y-4">
              <h2 className="text-[#003b26] font-bold text-xl mb-2">Identidade do agente</h2>
              <p className="text-[#555] text-sm mb-4">Defina quem é este agente.</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#003b26] text-xs font-bold block mb-1">Nome do agente *</label>
                  <input value={form.nome} onChange={e => update("nome", e.target.value)} placeholder="Ex: Mari, SDR IA, Analista..."
                    className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#003b26]" />
                </div>
                <div>
                  <label className="text-[#003b26] text-xs font-bold block mb-1">Cargo</label>
                  <input value={form.cargo} onChange={e => update("cargo", e.target.value)} placeholder="Ex: Atendente de Vendas..."
                    className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#003b26]" />
                </div>
              </div>

              <div>
                <label className="text-[#003b26] text-xs font-bold block mb-2">Nível hierárquico</label>
                <div className="space-y-2">
                  {NIVEIS.map(nivel => (
                    <button key={nivel.n} onClick={() => { update("nivel", nivel.n); update("modelo_padrao", nivel.modelo); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${form.nivel === nivel.n ? "border-[#c9a24a] bg-[#003b26] text-white" : "border-[#e0ddd6] bg-white hover:border-[#003b26]"}`}>
                      <span className={`text-xs px-2 py-1 rounded font-bold ${nivel.cor} text-white`}>N{nivel.n}</span>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{nivel.label}</p>
                        <p className="text-xs opacity-70">{nivel.desc}</p>
                      </div>
                      <span className="text-xs opacity-50">{nivel.modelo.split("-")[1]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#003b26] text-xs font-bold block mb-2">Humor</label>
                  <div className="space-y-1.5">
                    {HUMORES.map(h => (
                      <CardSelecao key={h.id} ativo={form.humor === h.id} onClick={() => update("humor", h.id)}>
                        <div className="flex items-center gap-2">
                          <span>{h.emoji}</span>
                          <div><p className="font-bold text-xs">{h.label}</p><p className="text-xs opacity-70">{h.desc}</p></div>
                        </div>
                      </CardSelecao>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[#003b26] text-xs font-bold block mb-2">Personalidade</label>
                  <div className="space-y-1.5">
                    {PERSONALIDADES.map(p => (
                      <CardSelecao key={p.id} ativo={form.personalidade === p.id} onClick={() => update("personalidade", p.id)}>
                        <div className="flex items-center gap-2">
                          <span>{p.emoji}</span>
                          <div><p className="font-bold text-xs">{p.label}</p><p className="text-xs opacity-70">{p.desc}</p></div>
                        </div>
                      </CardSelecao>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[#003b26] text-xs font-bold block mb-2">Mercados que atende</label>
                <div className="flex flex-wrap gap-2">
                  {MERCADOS.map(m => (
                    <button key={m.id} onClick={() => toggleMercado(m.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border-2 transition-all ${form.mercados.includes(m.id) ? "border-[#003b26] bg-[#003b26] text-white" : "border-[#e0ddd6] bg-white text-[#555] hover:border-[#003b26]"}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#003b26] text-xs font-bold block mb-1">Reporta para</label>
                  <select value={form.supervisor_slug} onChange={e => update("supervisor_slug", e.target.value)}
                    className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm outline-none">
                    {SUPERVISORES_PADRAO.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#003b26] text-xs font-bold block mb-1">Modelo de IA</label>
                  <select value={form.modelo_padrao} onChange={e => update("modelo_padrao", e.target.value)}
                    className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm outline-none">
                    {MODELOS.map(m => <option key={m.id} value={m.id}>{m.label} — {m.custo}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#003b26] text-xs font-bold block mb-1">Horário início</label>
                  <input type="time" value={form.horario_inicio} onChange={e => update("horario_inicio", e.target.value)}
                    className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-[#003b26] text-xs font-bold block mb-1">Horário fim</label>
                  <input type="time" value={form.horario_fim} onChange={e => update("horario_fim", e.target.value)}
                    className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3 — CONHECIMENTO */}
          {passo === 3 && (
            <div className="space-y-4">
              <h2 className="text-[#003b26] font-bold text-xl mb-2">O que este agente sabe?</h2>
              <p className="text-[#555] text-sm mb-4">Este é o cérebro do agente. A IA só usa o que você escrever aqui.</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {SECOES_CONHECIMENTO.map(s => {
                  const temConteudo = form.conhecimentos.find(c => c.secao === s.id)?.conteudo.trim();
                  return (
                    <button key={s.id} onClick={() => setSecaoConhecimento(s.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border-2 transition-all flex items-center gap-1 ${secaoConhecimento === s.id ? "border-[#003b26] bg-[#003b26] text-white" : "border-[#e0ddd6] bg-white text-[#555] hover:border-[#003b26]"}`}>
                      {s.label}
                      {temConteudo && <span className="w-1.5 h-1.5 rounded-full bg-[#c9a24a]" />}
                    </button>
                  );
                })}
              </div>

              {SECOES_CONHECIMENTO.filter(s => s.id === secaoConhecimento).map(secao => {
                const conhecimento = getConhecimento(secao.id);
                return (
                  <div key={secao.id} className="bg-white rounded-xl border border-[#e0ddd6] p-4">
                    <label className="text-[#003b26] text-xs font-bold block mb-2">{secao.label}</label>
                    <textarea value={conhecimento.conteudo} onChange={e => updateConhecimento(secao.id, "conteudo", e.target.value)}
                      placeholder={secao.placeholder} rows={8}
                      className="w-full bg-[#f7f4ec] rounded-lg p-3 text-sm text-[#1a1a1a] outline-none resize-none border border-[#e0ddd6] focus:border-[#003b26] placeholder-[#aaa]" />
                    <div className="flex justify-between mt-2">
                      <p className="text-[#aaa] text-xs">~{Math.ceil(conhecimento.conteudo.length / 4)} tokens</p>
                      <p className="text-[#aaa] text-xs">{conhecimento.conteudo.length} caracteres</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PASSO 4 — REGRAS */}
          {passo === 4 && (
            <div className="space-y-4">
              <h2 className="text-[#003b26] font-bold text-xl mb-2">Regras de comportamento</h2>
              <p className="text-[#555] text-sm mb-4">O que este agente pode e não pode fazer.</p>

              <div className="space-y-2">
                <Toggle ativo={form.pode_falar_preco}    onChange={v => update("pode_falar_preco", v)}    label="Pode falar sobre preço?"  desc="Se ativo, pode mencionar faixas de valor" />
                <Toggle ativo={form.pode_prometer_prazo} onChange={v => update("pode_prometer_prazo", v)} label="Pode prometer prazo?"      desc="Se ativo, pode mencionar prazos estimados" />
                <Toggle ativo={form.pode_enviar_proposta}onChange={v => update("pode_enviar_proposta", v)}label="Pode enviar proposta?"     desc="Se ativo, pode criar e enviar propostas" />
                <Toggle ativo={form.pode_agendar}        onChange={v => update("pode_agendar", v)}        label="Pode agendar reunião?"    desc="Se ativo, pode marcar datas e horários" />
                <Toggle ativo={form.pode_pedir_email}    onChange={v => update("pode_pedir_email", v)}    label="Pode pedir email?"        desc="Se ativo, solicita email no atendimento" />
              </div>

              <div>
                <label className="text-[#003b26] text-xs font-bold block mb-1">Escala para humano quando:</label>
                <select value={form.escala_quando} onChange={e => update("escala_quando", e.target.value)}
                  className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm outline-none">
                  <option value="sempre">Sempre (nunca resolve sozinho)</option>
                  <option value="lead_acima_50k">Lead acima de R$50k</option>
                  <option value="lead_acima_100k">Lead acima de R$100k</option>
                  <option value="lead_acima_200k">Lead acima de R$200k</option>
                  <option value="reclamacao">Qualquer reclamação</option>
                  <option value="nunca">Nunca (resolve tudo sozinho)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#003b26] text-xs font-bold block mb-1">Sempre usar estas frases:</label>
                  <input value={form.sempre_dizer} onChange={e => update("sempre_dizer", e.target.value)} placeholder="Ex: Obra 10+, É um prazer..."
                    className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#003b26]" />
                  <p className="text-[#aaa] text-xs mt-1">Separe por vírgula</p>
                </div>
                <div>
                  <label className="text-[#003b26] text-xs font-bold block mb-1">Nunca dizer:</label>
                  <input value={form.nunca_dizer} onChange={e => update("nunca_dizer", e.target.value)} placeholder="não sei, impossível..."
                    className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#003b26]" />
                  <p className="text-[#aaa] text-xs mt-1">Separe por vírgula</p>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 5 — REVISÃO */}
          {passo === 5 && (
            <div className="space-y-4">
              <h2 className="text-[#003b26] font-bold text-xl mb-2">Revisar e ativar</h2>
              <p className="text-[#555] text-sm mb-4">Confira tudo antes de ativar.</p>

              <div className="bg-white rounded-xl border border-[#e0ddd6] p-4 space-y-3">
                {[
                  { label: "Nome",                  value: form.nome || "—" },
                  { label: "Tipo",                  value: TIPOS_AGENTE.find(t => t.id === form.tipo)?.label || "—" },
                  { label: "Nível",                 value: NIVEIS.find(n => n.n === form.nivel)?.label || "—" },
                  { label: "Humor",                 value: HUMORES.find(h => h.id === form.humor)?.label || "—" },
                  { label: "Personalidade",         value: PERSONALIDADES.find(p => p.id === form.personalidade)?.label || "—" },
                  { label: "Modelo",                value: MODELOS.find(m => m.id === form.modelo_padrao)?.label || "—" },
                  { label: "Mercados",              value: form.mercados.join(", ") || "—" },
                  { label: "Horário",               value: `${form.horario_inicio} às ${form.horario_fim}` },
                  { label: "Seções de conhecimento",value: `${form.conhecimentos.filter(c => c.conteudo.trim()).length} preenchidas` },
                  { label: "Tokens estimados",      value: `~${tokensEstimados} tokens` },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center border-b border-[#f0ede6] pb-2">
                    <span className="text-[#888] text-xs">{item.label}</span>
                    <span className="text-[#1a1a1a] text-xs font-bold">{item.value}</span>
                  </div>
                ))}
              </div>

              {erro && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{erro}</div>}

              <button onClick={salvar} disabled={salvando}
                className="w-full bg-[#003b26] hover:bg-[#002a1c] disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg transition-colors">
                {salvando ? "Criando agente..." : "✓ Criar e Ativar Agente"}
              </button>
            </div>
          )}

          {/* NAVEGAÇÃO */}
          <div className="flex gap-3 pt-4">
            {passo > 1 && (
              <button onClick={() => setPasso(p => p - 1)}
                className="flex-1 bg-white border-2 border-[#003b26] text-[#003b26] font-bold py-3 rounded-xl transition-colors hover:bg-[#003b26] hover:text-white">
                ← Anterior
              </button>
            )}
            {passo < totalPassos && (
              <button onClick={() => setPasso(p => p + 1)} disabled={passo === 1 && !form.tipo}
                className="flex-1 bg-[#003b26] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors hover:bg-[#002a1c]">
                Próximo →
              </button>
            )}
          </div>
        </div>

        {/* PREVIEW DO PROMPT */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-[#003b26] rounded-xl overflow-hidden sticky top-6">
            <div className="px-4 py-3 border-b border-[#ffffff20]">
              <p className="text-[#c9a24a] text-xs font-bold uppercase tracking-wide">Preview do Prompt</p>
              <p className="text-white text-xs opacity-60 mt-0.5">Como a IA vai receber as instruções</p>
              <p className="text-[#c9a24a] text-xs mt-1">~{tokensEstimados} tokens estimados</p>
            </div>
            <div className="p-4 max-h-[600px] overflow-y-auto">
              <pre className="text-green-300 text-xs font-mono whitespace-pre-wrap leading-relaxed">{previewPrompt}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export type ModeloIA = 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6' | 'claude-opus-4-6'

export interface ResultadoProcessamento {
  resposta: string
  modelo: ModeloIA
  tempoResposta: number
  tokensUsados: { entrada: number; saida: number }
  custo: { usd: number; brl: number }
  scriptUsado?: string
}

// ============================================================
// CAMADA 1 — IDENTIDADE E CONFIGURAÇÃO DO AGENTE
// ============================================================

export async function buscarAgente(slugOuId: string) {
  const { data } = await supabase
    .from('hub_agente_identidade')
    .select('*')
    .or(`agente_slug.eq.${slugOuId},id.eq.${slugOuId}`)
    .eq('ativo', true)
    .single()
  return data
}

export async function agenteEstaNoHorario(config: any): Promise<boolean> {
  if (!config) return true
  const agora = new Date()
  const diaSemana = agora.getDay()
  const horaAtual = agora.getHours() * 60 + agora.getMinutes()
  const diasOp: number[] = config.dias_operacao || [1, 2, 3, 4, 5]
  if (!diasOp.includes(diaSemana)) return false
  const inicio = parseInt(config.horario_inicio?.split(':')[0] || '8') * 60
  const fim = parseInt(config.horario_fim?.split(':')[0] || '18') * 60
  return horaAtual >= inicio && horaAtual <= fim
}

export async function selecionarMelhorAgente(fase: string, _leadId: string): Promise<string> {
  const mapaFases: Record<string, string> = {
    entrada: 'atendente',
    qualificacao: 'sdr',
    proposta: 'closer',
    negociacao: 'closer',
    'pos-venda': 'atendente',
  }
  return mapaFases[fase] || 'atendente'
}

// ============================================================
// CAMADA 2 — SCRIPTS E REGRAS DE NEGÓCIO
// ============================================================

export async function buscarScriptPorGatilho(agenteId: string, gatilho: string) {
  const { data } = await supabase
    .from('hub_scripts')
    .select('*')
    .eq('agente_id', agenteId)
    .eq('gatilho', gatilho)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
}

export async function buscarRegrasAplicaveis(contexto: Record<string, any>, agenteId: string) {
  const { data } = await supabase
    .from('hub_regras_negocio')
    .select('*')
    .eq('agente_id', agenteId)
    .eq('ativo', true)
    .order('prioridade', { ascending: false })

  if (!data) return []

  return data.filter((regra: any) => {
    const valor = contexto[regra.condicao_campo]
    switch (regra.condicao_operador) {
      case 'eq':       return String(valor) === String(regra.condicao_valor)
      case 'gt':       return Number(valor) > Number(regra.condicao_valor)
      case 'lt':       return Number(valor) < Number(regra.condicao_valor)
      case 'contains': return String(valor).includes(regra.condicao_valor)
      default:         return false
    }
  })
}

export function aplicarRegras(regras: any[]): string {
  if (!regras.length) return ''
  return regras.map((r: any) => `REGRA ATIVA: ${r.acao_valor}`).join('\n')
}

// ============================================================
// CAMADA 3 — MEMÓRIA DO LEAD
// ============================================================

export async function buscarMemoriasLead(leadId: string, _limite = 10) {
  const { data } = await supabase
    .from('hub_memorias_lead')
    .select('*')
    .eq('lead_id', leadId)
    .maybeSingle()
  return data
}

export async function salvarMemoria(leadId: string, updates: Record<string, any>) {
  const { data: existing } = await supabase
    .from('hub_memorias_lead')
    .select('id, dados_coletados')
    .eq('lead_id', leadId)
    .maybeSingle()

  if (existing) {
    const dadosMesclados = { ...(existing.dados_coletados || {}), ...(updates.dados_coletados || {}) }
    await supabase
      .from('hub_memorias_lead')
      .update({ ...updates, dados_coletados: dadosMesclados, atualizado_em: new Date().toISOString() })
      .eq('lead_id', leadId)
  } else {
    await supabase.from('hub_memorias_lead').insert({ lead_id: leadId, nivel_engajamento: 5, ...updates })
  }
}

export function extrairMemoriasDeResposta(mensagem: string, _resposta: string): Record<string, any> {
  const dados: Record<string, any> = {}
  const matchOrcamento = mensagem.match(/R\$\s*[\d.,]+/i)
  if (matchOrcamento) dados.orcamento_mencionado = matchOrcamento[0]
  if (/urgent|urgente|rápido|hoje|amanhã/i.test(mensagem)) dados.urgencia_detectada = true
  if (/reforma|construção|obra|projeto/i.test(mensagem)) dados.interesse_detectado = 'obra'
  return dados
}

// ============================================================
// CAMADA 4 — SYSTEM PROMPT (6 sub-camadas)
// ============================================================

function dentroDoHorario(config: any): boolean {
  if (!config) return true
  const agora = new Date()
  const hora = agora.getHours() * 60 + agora.getMinutes()
  const inicio = parseInt(config.horario_inicio?.split(':')[0] || '8') * 60
  const fim = parseInt(config.horario_fim?.split(':')[0] || '18') * 60
  return hora >= inicio && hora <= fim
}

export function montarSystemPrompt(
  identidade: any,
  configuracao: any,
  script: any,
  memorias: any,
  regrasInstrucoes: string
): string {
  const noHorario = dentroDoHorario(configuracao)

  return `${identidade.system_prompt_base}

═══════════════════════════════════════
CAMADA 2 — MEMÓRIA DO LEAD
═══════════════════════════════════════
${memorias ? `Dados coletados: ${JSON.stringify(memorias.dados_coletados || {})}
Preferências: ${JSON.stringify(memorias.preferencias_detectadas || {})}
Engajamento: ${memorias.nivel_engajamento}/10
Humor: ${memorias.humor_predominante || 'não detectado'}
Resumo: ${memorias.resumo_ia || 'primeira interação'}` : 'Primeira interação com este lead.'}

═══════════════════════════════════════
CAMADA 3 — SCRIPT ATIVO
═══════════════════════════════════════
${script ? `Script: ${script.conteudo}` : 'Responder naturalmente sem script específico.'}

═══════════════════════════════════════
CAMADA 4 — REGRAS DE NEGÓCIO
═══════════════════════════════════════
${regrasInstrucoes || 'Nenhuma regra específica ativa.'}

═══════════════════════════════════════
CAMADA 5 — OPERACIONAL
═══════════════════════════════════════
Horário atual: ${new Date().toLocaleTimeString('pt-BR')}
Dentro do horário: ${noHorario ? 'SIM' : 'NÃO'}
SLA primeira resposta: ${configuracao?.sla_primeira_resposta_min || 5} min
Escalar para: ${configuracao?.escalar_para || 'supervisor'}
Nunca dizer: ${(identidade.nunca_dizer || []).join(', ') || 'nenhuma restrição'}
Sempre incluir: ${(identidade.sempre_dizer || []).join(', ') || 'nenhum'}
${!noHorario ? `\nFORA DO HORÁRIO: ${configuracao?.mensagem_fora_horario}` : ''}

═══════════════════════════════════════
CAMADA 6 — INSTRUÇÕES FINAIS
═══════════════════════════════════════
- Responda APENAS como ${identidade.nome}
- Tom: ${identidade.tom_voz}
- Máximo 3 parágrafos curtos
- Use o nome do cliente quando apropriado
- Nunca invente informações
- Idioma: português brasileiro`.trim()
}

// ============================================================
// CAMADA 5 — SELEÇÃO DE MODELO
// ============================================================

export function selecionarModelo(configuracao: any, contexto: Record<string, any>): ModeloIA {
  if ((contexto.valor_estimado || 0) > 200000) return 'claude-sonnet-4-6'
  if (contexto.status_visual === 'critico') return 'claude-sonnet-4-6'
  if (contexto.status_visual === 'quente')  return 'claude-sonnet-4-6'
  if ((contexto.score || 50) < 30)          return 'claude-haiku-4-5-20251001'
  return configuracao?.modelo_padrao === 'sonnet' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'
}

// ============================================================
// CAMADA 6 — CUSTO
// ============================================================

export function calcularCusto(
  modelo: string,
  tokensEntrada: number,
  tokensSaida: number
): { usd: number; brl: number } {
  const taxas: Record<string, { input: number; output: number }> = {
    'claude-haiku-4-5-20251001': { input: 0.00000025, output: 0.00000125 },
    'claude-sonnet-4-6':         { input: 0.000003,   output: 0.000015   },
    'claude-opus-4-6':           { input: 0.000015,   output: 0.000075   },
  }
  const taxa = taxas[modelo] || taxas['claude-haiku-4-5-20251001']
  const usd = tokensEntrada * taxa.input + tokensSaida * taxa.output
  return { usd, brl: usd * 5.75 }
}

// ============================================================
// CAMADA 7 — LOGGING
// ============================================================

export async function registrarLog(dados: {
  leadId: string
  conversaId: string
  agenteSlug: string
  systemPrompt: string
  mensagemUsuario: string
  respostaIa: string
  modeloUsado: string
  tokensInput: number
  tokensOutput: number
  custoEstimadoBrl: number
  tempoRespostaMs: number
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('hub_prompt_logs')
    .insert({
      lead_id:            dados.leadId,
      conversa_id:        dados.conversaId,
      agente_slug:        dados.agenteSlug,
      system_prompt:      dados.systemPrompt,
      mensagem_usuario:   dados.mensagemUsuario,
      resposta_ia:        dados.respostaIa,
      modelo_usado:       dados.modeloUsado,
      tokens_input:       dados.tokensInput,
      tokens_output:      dados.tokensOutput,
      custo_estimado_brl: dados.custoEstimadoBrl,
      tempo_resposta_ms:  dados.tempoRespostaMs,
    })
    .select('id')
    .single()

  return error ? null : (data?.id ?? null)
}

// ============================================================
// CAMADA 8 — FILA DE MENSAGENS
// ============================================================

export async function enfileirarMensagem(dados: {
  leadId: string
  conversaId: string
  whatsappMessageId?: string
  remetenteNumero: string
  conteudo: string
  agenteResponsavel?: string
}) {
  await supabase.from('hub_fila_mensagens').insert({
    lead_id:              dados.leadId,
    conversa_id:          dados.conversaId,
    whatsapp_message_id:  dados.whatsappMessageId,
    remetente_numero:     dados.remetenteNumero,
    conteudo:             dados.conteudo,
    status:               'pendente',
    agente_responsavel:   dados.agenteResponsavel || 'atendente',
    tentativas:           0,
  })
}

export async function processarFilaPendente(limite = 10) {
  const { data } = await supabase
    .from('hub_fila_mensagens')
    .select('*')
    .eq('status', 'pendente')
    .lt('tentativas', 3)
    .order('criado_em', { ascending: true })
    .limit(limite)
  return data || []
}

// ============================================================
// CAMADA 9 — ML E MÉTRICAS
// ============================================================

export async function atualizarScoreScript(scriptId: string, converteu: boolean) {
  const { data } = await supabase
    .from('hub_scripts')
    .select('vezes_usado, conversoes')
    .eq('id', scriptId)
    .single()

  if (!data) return
  await supabase.from('hub_scripts').update({
    vezes_usado: (data.vezes_usado || 0) + 1,
    conversoes:  converteu ? (data.conversoes || 0) + 1 : data.conversoes,
  }).eq('id', scriptId)
}

export async function registrarPadraoML(tipo: string, padrao: string, agenteId: string) {
  const { data: existing } = await supabase
    .from('hub_ml_padroes')
    .select('id, frequencia')
    .eq('tipo', tipo)
    .eq('padrao', padrao)
    .eq('agente_id', agenteId)
    .maybeSingle()

  if (existing) {
    await supabase.from('hub_ml_padroes').update({
      frequencia: (existing.frequencia || 0) + 1,
      ultima_vez: new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await supabase.from('hub_ml_padroes').insert({ tipo, padrao, agente_id: agenteId, frequencia: 1 })
  }
}

export async function buscarMelhorHorario(agenteId: string) {
  const { data } = await supabase
    .from('hub_ml_padroes')
    .select('*')
    .eq('agente_id', agenteId)
    .eq('tipo', 'horario_conversao')
    .order('efetividade', { ascending: false })
    .limit(5)
  return data || []
}

// ============================================================
// FUNÇÃO PRINCIPAL — processarMensagem
// ============================================================

export async function processarMensagem(
  contexto: {
    leadId: string
    conversaId: string
    mensagemUsuario: string
    lead?: any
  },
  slugAgente = 'atendente'
): Promise<ResultadoProcessamento> {
  const inicio = Date.now()

  // 1. Carregar lead
  let lead = contexto.lead
  if (!lead) {
    const { data } = await supabase
      .from('hub_leads')
      .select('*, hub_pessoas(*)')
      .eq('id', contexto.leadId)
      .single()
    lead = data
  }
  if (!lead) throw new Error('Lead não encontrado')

  // 2. Selecionar agente pela fase
  const slugFinal = slugAgente !== 'atendente'
    ? slugAgente
    : await selecionarMelhorAgente(lead.fase || 'entrada', contexto.leadId)

  // 3. Carregar identidade
  const identidade = await buscarAgente(slugFinal)
  if (!identidade) throw new Error(`Agente '${slugFinal}' não encontrado`)

  // 4. Carregar configuração
  const { data: configuracao } = await supabase
    .from('hub_agente_configuracao')
    .select('*')
    .eq('agente_slug', slugFinal)
    .maybeSingle()

  // 5. Script pelo gatilho (fase do lead)
  const script = await buscarScriptPorGatilho(identidade.id, lead.fase || 'entrada')

  // 6. Regras de negócio
  const contextoRegras = {
    score:         lead.score,
    valor_estimado: lead.valor_estimado,
    status_visual: lead.status_visual,
    fase:          lead.fase,
  }
  const regras = await buscarRegrasAplicaveis(contextoRegras, identidade.id)
  const regrasInstrucoes = aplicarRegras(regras)

  // 7. Memórias do lead
  const memorias = await buscarMemoriasLead(contexto.leadId)

  // 8. Histórico da conversa
  const { data: historico } = await supabase
    .from('hub_mensagens')
    .select('remetente, conteudo, enviada_em')
    .eq('conversa_id', contexto.conversaId)
    .order('enviada_em', { ascending: false })
    .limit(10)

  // 9. System prompt
  const systemPrompt = montarSystemPrompt(identidade, configuracao, script, memorias, regrasInstrucoes)

  // 10. Modelo
  const modelo = selecionarModelo(configuracao, contextoRegras)

  // 11. Histórico formatado
  const mensagensHistorico = (historico || []).reverse().map((msg: any) => ({
    role: (msg.remetente === 'lead' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: msg.conteudo || '',
  }))

  // 12. Chamar Claude API
  const response = await anthropic.messages.create({
    model: modelo,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      ...mensagensHistorico,
      { role: 'user', content: contexto.mensagemUsuario },
    ],
  })

  const resposta = response.content[0].type === 'text' ? response.content[0].text : ''
  const tempoResposta = Date.now() - inicio
  const custo = calcularCusto(modelo, response.usage.input_tokens, response.usage.output_tokens)

  // 13. Registrar log
  await registrarLog({
    leadId:            contexto.leadId,
    conversaId:        contexto.conversaId,
    agenteSlug:        slugFinal,
    systemPrompt,
    mensagemUsuario:   contexto.mensagemUsuario,
    respostaIa:        resposta,
    modeloUsado:       modelo,
    tokensInput:       response.usage.input_tokens,
    tokensOutput:      response.usage.output_tokens,
    custoEstimadoBrl:  custo.brl,
    tempoRespostaMs:   tempoResposta,
  })

  // 14. Salvar resposta da IA
  await supabase.from('hub_mensagens').insert({
    conversa_id:   contexto.conversaId,
    lead_id:       contexto.leadId,
    pessoa_id:     lead.pessoa_id,
    remetente:     'ia',
    tipo_conteudo: 'texto',
    conteudo:      resposta,
  })

  // 15. Atualizar memória
  const novosDados = extrairMemoriasDeResposta(contexto.mensagemUsuario, resposta)
  if (Object.keys(novosDados).length > 0) {
    await salvarMemoria(contexto.leadId, {
      dados_coletados: novosDados,
      ultima_interacao: new Date().toISOString(),
    })
  }

  // 16. Padrão ML
  await registrarPadraoML('resposta_efetiva', lead.fase || 'entrada', identidade.id)

  return {
    resposta,
    modelo,
    tempoResposta,
    tokensUsados: { entrada: response.usage.input_tokens, saida: response.usage.output_tokens },
    custo,
    scriptUsado: script?.id,
  }
}

// ============================================================
// UTILITÁRIOS
// ============================================================

export async function listarAgentes() {
  const { data } = await supabase
    .from('hub_agente_identidade')
    .select('agente_slug, nome, descricao, ativo')
    .order('nome')
  return data || []
}

export async function listarScripts(agenteId: string) {
  const { data } = await supabase
    .from('hub_scripts')
    .select('*')
    .eq('agente_id', agenteId)
    .order('ordem')
  return data || []
}

export async function metricas(agenteId?: string) {
  let query = supabase
    .from('hub_prompt_logs')
    .select('agente_slug, modelo_usado, tokens_input, tokens_output, custo_estimado_brl, tempo_resposta_ms')

  if (agenteId) query = (query as any).eq('agente_slug', agenteId)

  const { data } = await query
  if (!data || data.length === 0) return { total: 0, custo_total_brl: 0, tempo_medio_ms: 0, por_modelo: {} }

  return {
    total:           data.length,
    custo_total_brl: data.reduce((acc: number, r: any) => acc + (r.custo_estimado_brl || 0), 0),
    tempo_medio_ms:  Math.round(data.reduce((acc: number, r: any) => acc + (r.tempo_resposta_ms || 0), 0) / data.length),
    por_modelo:      data.reduce((acc: Record<string, number>, r: any) => {
      acc[r.modelo_usado] = (acc[r.modelo_usado] || 0) + 1
      return acc
    }, {}),
  }
}

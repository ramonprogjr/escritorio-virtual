export const meta = {
  name: 'auditoria-validacao',
  description: 'Auditoria ADVERSARIAL DE VALIDAÇÃO: lentes céticas leem o código REAL, dão veredito (acertou/parcial/errou/faltou) com evidência + melhorias com nível de certeza. Antes de reformular.',
  whenToUse: 'Antes de reformulação grande, ou para validar o que foi construído. args: { contexto: string, frentes: [{ agentType, lente }] }.',
  phases: [
    { title: 'Auditoria', detail: 'lentes céticas validam o construído + melhorias com certeza' },
    { title: 'Síntese CEO', detail: 'plano validado priorizado por impacto×esforço' },
  ],
}

// args = { contexto: string, frentes?: [{ agentType, lente }] }
// Se frentes não vier, usa um conjunto padrão de lentes de auditoria.
const CONTEXTO = (args && typeof args.contexto === 'string' && args.contexto.trim())
  ? args.contexto
  : `Projeto Obra10+ (CRM IA-first, Next.js 16 + Supabase) em c:\\Users\\wende\\Documents\\escritorio-virtual-ramon. Marca DARK verde+dourado. Princípios: Click-and-Go + Talk-and-Go, mobile importa, funcional-não-fachada, sugere→confirma, IA-first, "nada de tabela como tela de trabalho". AUDITORIA ADVERSARIAL DE VALIDAÇÃO do que já foi construído — leia o código REAL, não os specs. (Nenhum contexto específico passado em args.contexto — peça ao usuário se precisar do alvo exato.)`

const FRENTES = (args && Array.isArray(args.frentes) && args.frentes.length)
  ? args.frentes
  : [
      { agentType: 'ui-ux-designer', lente: 'UI/UX e facilidade de uso da área em foco — leia as telas/componentes reais; "intimida/confunde/atrapalha" procede? Melhor desenho? Mobile-first.' },
      { agentType: 'design-master', lente: 'Design + produto/fluxo — coerência visual, hierarquia, tabela-vs-cards (tela de trabalho vs relatório), o JOB do usuário, valor×esforço.' },
      { agentType: 'ai-engineer', lente: 'IA-first + funcionalidade — a IA está sub/mal usada? travas de segurança corretas? roteamento de modelo? o que falta pra ser IA-first de verdade?' },
      { agentType: 'product-owner', lente: 'Coerência de produto — o conjunto faz sentido junto? o que sobra/falta/confunde? redundância? prioriza por valor×esforço; as decisões anteriores miraram o alvo?' },
      { agentType: 'architect-review', lente: 'CRÍTICO DE COMPLETUDE / adversarial — o que TODAS as construções/mesas anteriores MISSARAM ou erraram? re-examine no código as decisões load-bearing e de segurança/integridade; ache buracos, dívidas, riscos e melhorias que ninguém viu.' },
    ]

const LENTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    lente: { type: 'string' },
    entendimento: { type: 'string', description: 'o que esta frente É e como funciona HOJE no código (entender antes de opinar)' },
    impacto_no_sistema: { type: 'string', description: 'impacto/utilidade desta frente no sistema como um todo (IA-first, jornada do dono)' },
    validacoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          decisao_anterior: { type: 'string' },
          veredito: { type: 'string', enum: ['acertou', 'parcial', 'errou', 'faltou'] },
          evidencia: { type: 'string', description: 'arquivo/código real, não suposição' },
        },
        required: ['decisao_anterior', 'veredito', 'evidencia'],
      },
    },
    melhorias: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          melhoria: { type: 'string' },
          dimensao: { type: 'string', enum: ['ui_ux', 'design', 'facilidade', 'recursos', 'funcionalidade', 'ia_first'] },
          porque: { type: 'string' },
          impacto: { type: 'string', enum: ['alto', 'medio', 'baixo'] },
          esforco: { type: 'string', enum: ['baixo', 'medio', 'alto'] },
          certeza: { type: 'string', enum: ['alta', 'media', 'baixa'] },
        },
        required: ['melhoria', 'dimensao', 'porque', 'impacto', 'esforco', 'certeza'],
      },
    },
    riscos_ou_erros_encontrados: { type: 'array', items: { type: 'string' } },
  },
  required: ['lente', 'entendimento', 'impacto_no_sistema', 'validacoes', 'melhorias', 'riscos_ou_erros_encontrados'],
}

phase('Auditoria')
const contribs = (await parallel(
  FRENTES.map((f) => () =>
    agent(
      `${CONTEXTO}\n\nVocê é a lente: ${f.lente}\n\nMÉTODO (entender antes de fazer): PASSO 1 — abra e LEIA o código REAL da sua frente, entenda como funciona HOJE. PASSO 2 — avalie o IMPACTO no sistema COMO UM TODO. PASSO 3 — VEREDITO cético nas decisões anteriores com evidência do código. PASSO 4 — MELHORIAS concretas com dimensão, impacto×esforço e CERTEZA (só 'alta' com convicção real). PASSO 5 — riscos/erros que ninguém viu. Seja específico, profundo e honesto; o dono quer CERTEZA, não educação. NÃO valide por cortesia.`,
      { label: `audita:${f.agentType}`, phase: 'Auditoria', schema: LENTE_SCHEMA, agentType: f.agentType, effort: 'high' },
    ),
  ),
)).filter(Boolean)
log(`Auditoria: ${contribs.length} lentes`)

const PLANO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    parecer_ceo: { type: 'string' },
    validacao_por_frente: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { frente: { type: 'string' }, veredito: { type: 'string' }, impacto_sistema: { type: 'string' }, acao: { type: 'string' } },
        required: ['frente', 'veredito', 'impacto_sistema', 'acao'],
      },
    },
    melhorias_priorizadas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          melhoria: { type: 'string' },
          dimensao: { type: 'string' },
          impacto: { type: 'string' },
          esforco: { type: 'string' },
          certeza: { type: 'string' },
          arquivos_alvo: { type: 'string' },
          precisa_dono: { type: 'boolean' },
        },
        required: ['melhoria', 'dimensao', 'impacto', 'esforco', 'certeza', 'arquivos_alvo', 'precisa_dono'],
      },
    },
    erros_a_corrigir: { type: 'array', items: { type: 'string' } },
  },
  required: ['parecer_ceo', 'validacao_por_frente', 'melhorias_priorizadas', 'erros_a_corrigir'],
}

phase('Síntese CEO')
const plano = await agent(
  `${CONTEXTO}\n\nVocê é o CEO de produto (prudente, diligente, honesto). As lentes auditaram o código e acharam melhorias com certeza (abaixo). Consolide: (1) parecer — acertaram o alvo? o que muda?; (2) validação por frente (veredito + impacto + ação); (3) MELHORIAS PRIORIZADAS por IMPACTO×ESFORÇO, SÓ certeza alta/média, com arquivos-alvo e flag precisa_dono; (4) erros a corrigir já. Destaque o autônomo (sem dono/migração/credencial). Honestidade total: se algo foi superestimado/errado, diga.\n\nAUDITORIAS:\n${JSON.stringify(contribs)}`,
  { label: 'ceo:sintese', phase: 'Síntese CEO', schema: PLANO_SCHEMA, agentType: 'executive-director', effort: 'high' },
)

return { plano, lentes: contribs.length }

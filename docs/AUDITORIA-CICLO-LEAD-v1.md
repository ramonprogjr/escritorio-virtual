# Auditoria + mesa Fable — ciclo do lead (CRM → ficha do lead → Negócios)

> Origem: revisão ao vivo do dono na ficha real "Fabio Vendramini" (estágio *Qualificando*).
> Método: workflow de 4 fases (mapear código → auditar cada queixa com evidência arquivo:linha →
> mesa Fable de 5 personas → síntese). Todos os achados ancorados no código real.
> Data: 06/jul/2026. Ver também [[processo-aprovacao-tela-e2e-mesa-ceo]] e a memória do ciclo do lead.

## Diagnóstico de fundo (a raiz)

Não é um bug isolado — é **um eixo confundido**. A ficha trata **QUALIFICAÇÃO** como *posição* no funil,
quando qualificação é **PRONTIDÃO** (um sinal derivado de score + memórias da IA + interesse + valor).
Disso nascem quase todas as queixas:

1. **Dois vocabulários de estágio vivos e não reconciliados:**
   - *Ciclo de vida* (a barra do topo, o que o dono vê): `FUNIL_LEAD_ETAPAS` — Novo · Em atendimento ·
     Aguardando resposta · **Qualificando** · Encaminhado · Convertido · Perdido · Spam. **Não tem "Qualificado".**
   - *Funil de vendas* (kanban): `COLUNAS_VENDAS` em `lib/crm/estagio-map.ts:44` — novo · qualificando ·
     **qualificado** · proposta · negociando · fechamento · ganho · perdido.
   - `estagio-map.ts` existe só para remendar a costura entre os dois.
2. **Posição anunciada em dois indicadores que se contradizem:** o badge do header usava o slug cru de
   *coluna de vendas*; a barra usava o *funil*. "qualificado" acendia o badge e **nenhum** chip.
3. **Ação espalhada em 3 superfícies com nomes diferentes** para a mesma coisa (barra que move fase,
   botão Direcionar no header, e um rodapé que só aparece na aba Dados repetindo Central/Negócio/Perdido).
4. O par verde-✓ "Negócio" + vermelho-✗ "Perdido" **imita ganhou/perdeu de venda sobre um LEAD**.
5. A ficha existe **duplicada** (página `[id]` no desktop + slide-over embutido na lista no mobile).
6. A ficha de **Negócio** já resolve bem quase tudo (edição inline, Próxima Ação Click-and-Go,
   timeline+nota, linhagem, ganho como etapa+status) — é o **molde-ouro a herdar**, não a reinventar.

## O bug crítico (P0) — CORRIGIDO nesta rodada

**Sintoma:** "Direcionar" diz que o lead precisa estar *qualificado*, mas ele está em *Qualificando* e
não há essa opção → loop infinito.

**Causa-raiz:** o gate comparava `lead.estagio === "qualificado"` (`lib/crm/sugerir-encaminhamento-auto.ts:47`),
mas o **write-path da ficha normaliza tudo** por `legacyToFunil`, e `"qualificado"` **colapsa em
`"qualificando"`** (`pipelines.ts` LEGADO_ESTAGIO_PARA_FUNIL). Ou seja: era **impossível persistir
"qualificado" pela tela** — o gate ficava inalcançável. (O único caminho que passava era o playbook do
WhatsApp, que grava o valor cru.) O botão "Qualificar e direcionar" gravava "qualificado" → colapsava em
"qualificando" → o gate rejeitava de novo → loop.

**Correção (aplicada):** o gate passa a falar o vocabulário do funil visível —
`legacyToFunil(lead.estagio) !== "qualificando"`. Assim **ambos** os caminhos passam (a ficha, que grava
"qualificando", e o playbook, que grava "qualificado"). O dono passa a direcionar **direto de Qualificando**,
que é exatamente o que pediu. Arquivo: `lib/crm/sugerir-encaminhamento-auto.ts`.
Junto: a **barra e o badge** agora falam o vocabulário do funil (chip acende, badge mostra o rótulo
amigável, não o slug cru) e o `onQualificar` grava "qualificando" honestamente. Arquivo:
`app/crm/leads/[id]/page.tsx`.

## Redesenho por área (o plano)

| Área | Hoje | Alvo |
|------|------|------|
| **Estágios + Direcionar** | barra = indicador E mutação; 2 vocabulários; gate impossível | **2 eixos**: barra = POSIÇÃO (funil, informativa); chip separado = PRONTIDÃO (sinal IA). "qualificado" aposentado como etapa visível. *(gate P0 já feito)* |
| **Atividades** | logs de status + notas humanas no mesmo feed, sem corte por papel | "Conversa & Notas" (todos) × "Histórico do sistema" (**só admin** via `isCrmGestorRole`); ícone próprio p/ ação de IA |
| **Memória IA** | aba fixa mostrando "(0)" | aba **condicional** (só com conteúdo) ou seção "O que a IA sabe" dentro de Conversa |
| **Dados** | 100% vidro (0 inputs), muitos "—" | **edição inline** (o PATCH já aceita os campos), derivados num bloco recolhível, vazios viram "adicionar +" |
| **Propostas** | stub de 2 campos sobre tabela rica (7 estados) | card estruturado (escopo/prazo/validade/serviço) + ciclo de vida (enviar/aceitar/recusar) |
| **Rodapé/ações** | footer duplicado só na aba Dados; par ganho/perdido | **uma** barra persistente: Direcionar · Converter em negócio (sem ✓ verde) · Marcar perdido (separado) |
| **Fronteira lead→negócio** | won/lost vazando pro lead; elo frágil (lead_id=null) | ganho/perdido **só no Negócio**; linhagem redundante + origem viaja com o deal |
| **Auto-avanço IA** | só no playbook do WhatsApp, teto "qualificando" | avaliador puro `avaliarQualificacao`; na ficha a IA **sugere** ("pronto p/ direcionar"), humano confirma |
| **Telas vizinhas** | ficha duplicada desktop/mobile; conversão 1-clique sem gate; label cru "Novo_negocio" | ficha única reutilizável; regra de fronteira coerente; labels/kanban de Negócios corrigidos; modo "Caixa" |

### Plano priorizado

- **P0 (FEITO):** gate do Direcionar normalizado + realce/badge no vocabulário do funil + onQualificar honesto.
- **P1 (uso — o que mais dói no dia a dia):**
  - Logs vs comentários (corte por papel na aba Atividades) — precisa passar o `CrmNivel` p/ a ficha.
  - Aba Dados editável inline (reusa o PATCH allowlist já pronto — sem rota nova).
  - Rodapé: eliminar duplicação + quebrar o par ganho/perdido.
  - Auto-avanço IA na ficha (sugestão + confirmação) — **depende do limiar do dono**.
- **P2 (estrutura/polish):**
  - Memória IA condicional.
  - Propostas reestruturada (card + ciclo de vida).
  - Desduplicar as 2 fichas (refactor estrutural — por último).
  - Negócios: labels/kanban/modo Caixa + linhagem redundante lead↔negócio.

## Decisões que são do dono (travam P1/P2)

1. **Limiar de qualificação:** que sinais + cortes o `avaliarQualificacao` usa? (ex.: interesse preenchido
   + valor > X + score ≥ Y). É regra de negócio, não técnica.
2. **Auto-avanço na ficha:** a IA só **sugere** (banner, humano confirma) ou pode **auto-mover** e avisar?
   *Recomendação do CEO: só sugerir* (fricção proporcional — direcionar toca outra pessoa).
3. **Regra da fronteira:** "Converter em negócio" pode de qualquer estágio (1 clique) enquanto "Direcionar"
   exige prontidão? Ou ambos exigem critério? Hoje são inconsistentes (lista converte sem gate).
4. **Papéis de admin:** quem vê a "Trilha do sistema" (logs)? Confirmar `isCrmGestorRole` p/ o time real.
5. **Propostas — profundidade agora:** já com ciclo de vida completo, ou só a captura estruturada primeiro?
6. **Vocabulário:** confirmar que "qualificado" é **aposentado** como etapa visível (vira só sinal de
   prontidão) e que as 8 etapas do funil são o único vocabulário que o dono vê.

## O que NÃO mexer (a mesa foi unânime)
- `hub_atividades` como timeline única de gravação (a correção é de leitura/filtro, não de schema).
- O motor de memórias IA (`hub_memorias_lead`) — o problema é hierarquia de UI, não o dado.
- A ficha de **Negócio** como padrão-ouro a herdar.
- Distribuição automática ligada por padrão (`CRM_DISTRIBUICAO_AUTO=true`).
- O vocabulário das 8 etapas do funil que o dono já reconhece (reconciliação é interna).

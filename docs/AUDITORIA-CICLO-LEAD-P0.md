# 🚨 AUDITORIA DO CICLO DO LEAD — bugs que PERDEM lead real (12/jul)

> Auditoria Fable-max (6 lentes adversariais) do ciclo captação→cadastro→CRM→atendimento IA→agentes/copiloto→negócio,
> lida no CÓDIGO REAL + conferida no BANCO DE PRODUÇÃO de hoje. Motivada por: **o dono tem leads reais chegando** e
> precisa do ciclo sólido. **Veredito: ainda NÃO — o fio principal funciona, mas o ciclo completo perde/suja lead em
> cenário COMUM, e 2 furos estão mordendo AGORA.** Conserto: ~2 dias de código + 1 janela de banco.

## Provado no banco de produção HOJE (não é achismo)
- **5 negócios abertos PRESOS** numa etapa `'novo_negocio'` que não existe em nenhum pipeline → invisíveis no kanban agora.
- Telefones de lead em **4 formatos** (10/11/12/13 dígitos) + **1 duplicado real** já na base.
- 0 encaminhamentos no limbo `'sugerido_ia'` (armadilha armada, ainda não mordeu — mas é o fluxo do copiloto que o dono usa).

## P0 — CONSERTAR PRIMEIRO (perde/suja lead em cenário corriqueiro)
1. **P0-1 · "parceria" silencia a Mari.** Qualquer mensagem com `parceria/parceiro/treinamento/módulo/homologar` (match por
   SUBSTRING) desvia ANTES de criar lead/enfileirar → sem resposta, sem registro no CRM, e o telefone vira "parceiro em
   captação". "Vocês têm parceria com banco pra financiamento?" no meio da negociação = silêncio total. **Mordendo agora.**
   *lib/ia/agentes-config.ts:144-161 + app/api/whatsapp/webhook/route.ts:648-712*
2. **P0-2 · Qualificação corrompida a CADA turno, em TODO lead.** O reforço pós-turno sobrescreve `interesse_principal` com a
   mensagem crua ("pode me ligar às 18h" vira o interesse) e o nome com o pushName; "R$ 500 mil" é gravado como R$ 500;
   correção do cliente ("na verdade 500 mil") perde para o valor antigo. O auto-direcionamento decide com esse lixo.
   **Mordendo agora.** *sincronizar-contato-whatsapp.ts:112-123,172-220 + persistir-lead-whatsapp.ts:8-15,125*
3. **P0-3 · Rajada de WhatsApp perde conteúdo.** "Oi" + "tenho terreno, orçamento 300 mil" + "pode me ligar?" → só a última
   sobrevive; as anteriores somem (nunca entram no CRM/memória). *supersede-jobs-antigos.ts:15-27 + webhook route.ts:363*
4. **P0-4 · Direcionar por voz morre em limbo invisível.** A tool força status `'sugerido_ia'` que nenhuma tela lista; o lead
   já vira "encaminhado" na criação da proposta (some do funil parecendo tratado); a aprovação falharia (sem parceiro_id).
   Nada chega ao parceiro. *encaminhamentos/pendentes:23-28 + encaminhamento-criar:73-76 + executar-ferramenta-ia:695-723*
5. **P0-5 · Negócio convertido some do kanban** (5 negócios reais presos agora). Grava etapa literal `'novo_negocio'`.
   *converter-negocio/route.ts:139 + negocios/page.tsx:511*
6. **P0-6 · Telefone em 4 formatos duplica lead entre canais.** Lead manual/site não casa com o WhatsApp (conversa num lead,
   proposta noutro; IA atropela seu atendimento quando você responde do celular). Sem UNIQUE; com 2 duplicados degenera em
   1 lead novo POR mensagem. *webhook:210-214,305-314 + lead-hub-publico:60-64 + leads/route.ts:191-196 + isolamento-conversa-lead:17-19*

## P1 — sérios (fecham o ciclo)
- **P1-7** Lead qualificado pela ficha nunca entra na fila de Distribuição (fila procura 'qualificado', tela grava 'qualificando').
- **P1-8** "Fornecedor avisado" = mentira: caminho manual não envia nada; automático engole falha da UAZAPI e marca 'enviado'.
- **P1-9** Lead de ARQUITETURA direcionado como IMÓVEIS (Mari nunca grava o mercado; motor assume 'IMB').
- **P1-10** Arrastar lead p/ "✓ Ganhos" marca convertido SEM criar o negócio (vencedor órfão).
- **P1-11** Agente com `modo_operacao` NULL recebe as ferramentas mas TODAS as escritas são rejeitadas (fix de 1 linha).
- **P1-12** Playbook promete "vou encaminhar" e nada nasce (fecho não grava interesse/valor numérico → gate falha sempre).

## P2 — banco (janela ~30 min) + lote de médios
- **P2-14 JANELA:** UNIQUE parcial em telefone (após canonicalizar/merge); UNIQUE 1-negócio-vivo-por-lead; UNIQUE
  1-encaminhamento-pendente-por-lead; UPDATE dos 5 negócios presos; merge do duplicado; backfill tenant/mercado.
  **⚠️ NÃO aplicar a seed `20260628120000` (funil PDF) como está — esconderia 7 dos 12 leads do board (regressão L2/L3).**
- **P2-15:** lote de médios (recusar sem idempotência, score sem gate de mercado, TTL zerando 'preferencias', dedupe em
  memória antes do processamento, rate-limit CGNAT, card com fallback localhost, homônimo no copiloto, etc.).

## O que ESTÁ sólido (pode confiar)
Pausa/handoff da Mari (fail-closed, 3 fontes + trava temporal) · dedup de mensagem (retry não duplica) · criação de pessoa
sem corrida · copiloto (HMAC fail-closed, allowlist em código, confirmação humana, tenant da sessão) · card-resumo nunca
derruba envio · gate financeiro. **Os 3 fixes de 09/jul: SEM regressão.**

## Plano de ataque
- **Dia 1 (código, P0-1..P0-5):** o que silencia a Mari, corrompe dado agora e esconde negócio. Cirúrgico, SEM migração.
- **Dia 2 (código, P0-6..P1-12):** telefone entre canais, fila, notificação honesta, mercado, kanban de ganho, modo_operacao.
- **Janela do dono (banco ~30 min, P2-14):** índices únicos + consertar os 5 presos + merge + backfill.
- **Depois:** lote de médios (P2-15).

**Recomendação franca:** não colocar tráfego pago nem confiar no ciclo de olhos fechados antes de fechar P0-1..P0-6. Dois
deles estão ativos AGORA. 2 dias focados + 1 janela e aí eu digo "sólido" com a consciência limpa.

> Não testado: envio real UAZAPI, envs do Render novo (`NEXT_PUBLIC_APP_URL`), carga. Tudo acima é código real + banco de hoje.

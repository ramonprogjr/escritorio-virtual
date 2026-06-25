# Pendências — Plataforma Obra10+

> Registro único do que ficou **em aberto**, para não se perder nada. Atualizar sempre que algo for concluído ou surgir. Complementa o roadmap em [PLANO-EXECUTIVO-BLOCOS.md](PLANO-EXECUTIVO-BLOCOS.md).
>
> **Legenda dono:** 🧑 Wendel (decisão/config) · 🤖 dev/IA (executável) · 🔒 trava (precisa Wendel presente).
> **Status:** 2026-06-24.

---

## 🔧 Configuração (Supabase / dashboard — 🧑 Wendel)
Sem isso, o "Esqueci minha senha" **não envia e-mail** de verdade:
- [ ] **Auth → URL Configuration → Redirect URLs:** incluir `http://localhost:3001/redefinir-senha` (+ URL de produção). **Sem curinga** (`*`).
- [ ] **Auth → SMTP:** configurar SMTP próprio (o padrão do Supabase quase não envia).
- [ ] **Auth → Rate limits / expiração** do link de recuperação (curto).
- [ ] **Auth → Password policy:** mínimo ≥8 + *leaked password protection* (alinhar ao client).
- [ ] **Trocar a senha** `A12345679` (foi enviada no chat → exposta) por uma forte.

## 👁 Validação (🤖)
- [x] **Validação visual via browser (24/jun):** login OK (senha A12345679), menu §8 renderiza, **QuickAdd FAB** visível, deep-link `?novo=1` abre o criador, **chips do lead confirmados** (Tipo de interesse + campo dinâmico viraram chips; Cidade segue texto). Login mostra "Esqueci minha senha".
- [ ] **Spot-check restante (opcional):** negócio/empresa/imóvel usam o MESMO `SmartField` (alta confiança), mas validar em **mobile** e o fluxo **/redefinir-senha** (depende de SMTP configurado) quando der.

## 🧭 Análise-mestra encomendada (24/jun, revisar amanhã) — CEO/mesa redonda
O Wendel pediu (papel de **CEO/conselheiro honesto + mesa redonda por especialista**):
- **Auditar TODAS as telas** (botões/funções ruins, desnecessários, mal usados) com lente **IA-first/conversacional + Click-and-Go + usabilidade**, uma mesa redonda por tela.
- **Mapear cada métrica → FUNCIONALIDADE necessária** (ex.: follow-up → configurar tipos/prazos; reunião → função de agendar; registros → log/escrever nos cards de pessoa/empresa/negócio) — **sem deixar impossível de usar pelo excesso**.
- **Repassar todos os docs, entender tudo, atualizar cronograma/execução** e dizer **onde estamos** sem perder foco/constância.
- Entregáveis (gerados na análise): `docs/AUDITORIA-TELAS-UIUX.md`, `docs/METRICAS-FUNCIONALIDADES.md`, cronograma atualizado, e um parecer **CEO** (onde estamos + foco + o que NÃO fazer agora). *(análise em workflow rodando; consolidar nos docs ao concluir.)*

## 🎨 Plano UI/UX (auditoria + diretor, 24/jun) — 4 ondas seguras-autônomas
Auditoria de UX (mesa redonda) gerou Top 8; diretor sequenciou em 4 ondas (aditivo, gates tsc+vitest+_chk23, sem push/RLS):
- [x] **Onda A** — #1 cabeçalho contextual no `CadastroSideoverPanel` (some "Visão do cadastro" do config; **verificado no browser**) + #7 PT-BR + ocultar slug técnico. ✅
- [x] **Onda B (visual)** ✅ — #2 tabela-lista de Leads tokenizada (`--obra-*`, score dourado); #5 quick-actions com ícones Lucide; **dica de Ctrl+K na sidebar** ✅ (botão "Buscar… Ctrl K" abre a paleta).
- [x] **Onda C (sinais acionáveis)** ✅ — #4 selo de **SLA textual** no card de lead (rótulo+cor, via `sla-frescor`); #3 **dashboard reordenado por urgência** (Ação agora→Alertas→Leads parados no topo; % no rodapé) + "+ Parceiro" tokenizado. (Card de negócio sem SLA em minutos — semântica de dias = B5.)
- [x] **Onda D (interação)** ✅ — #8 respostas rápidas (templates) no Inbox + label IA dinâmico; **#6 FEITO:** `window.confirm()` das exclusões do cadastro viraram `CrmConfirmDialog` (requester+executor); `alert()` do leads virou strip dark efêmero. Sem mais `alert/confirm` nativos no CRM.
- **Travas fora do Top 8:** cards de distribuição/SLA-fornecedor/ranking no dashboard (motor+RLS), converter conversa→negócio, respostas por IA, disclosure de menu por plano.

## 🎨 UX / produto (decisão futura — 🧑 + 🤖)
- [ ] **`valor_estimado` do lead como faixa:** hoje é numérico (faixa exigiria guardar faixa vs número). Decidir.
- [ ] **SmartField modo "faixa"** com visual *ordinal* (segmented control) — hoje renderiza igual a chips.
- [ ] **ConfidenceBadge.onCorrigir** não ligado — depende da IA pré-preencher (Bloco 8).
- [ ] **Voz (Talk-and-Go)** — "no fim" do roadmap (decidir on-device vs serviço, custo/privacidade).
- [ ] **Mapear `error.message` do Supabase** para mensagens PT amigáveis no login (UX).
- [x] **Verificar paleta da LISTA de Negócios** ✅ — confirmado o drift e **tokenizado** (`app/crm/negocios/page.tsx`), igual à de Leads.
- [ ] **🆕 Migrar criação de Cadastro (wizard PF/PJ) para SmartField** — hoje a criação ainda é formulário tradicional; é o item *grande* do Click-and-Go nos cadastros (auditoria UX). Esforço **G** → fatiar. (🤖 seguro; campos de valor dependem da decisão faixas vs exato)

## 🔐 Segurança (consideração — 🤖 quando o fluxo existir)
- [ ] **/redefinir-senha** aceita sessão ativa comum (usuário logado troca senha sem reautenticar — padrão Supabase). Ao criar "trocar senha **dentro do app**", exigir a **senha atual** antes.

## 🔒 Segurança multi-tenant — ALTA prioridade (🔒 Wendel)
- [x] **RLS `hub_pipeline_estagios` tenant-aware — APLICADO (24/jun, autorização explícita).** Migração Supabase `rls_pipeline_estagios_tenant_aware` (escopo via pipeline-pai). Verificado: policies tenant-aware; Kanban segue OK (service role bypassa). Arquivo `docs/sql/20260624-rls-pipeline-estagios-tenant-APPLIED.sql`. → UI de config de etapas (B3) liberada.
- [ ] **Backfill `pipeline_id`** em leads/negócios antigos (migração aditiva) — agrupar com o trabalho de RLS de pipelines.

## 🗺 Cronograma (próximos blocos)
- [x] **Bloco 3 — CRM do fornecedor (fatia segura do diretor) — COMPLETO + verificado (24/jun).** Cartão acionável (próxima-ação no negócio + frescor testado); **config de pipeline** (`PipelineConfigSideover`) já existia, ligada à API e montada em leads/negócios — **verificada no browser pós-RLS** (lista pipelines/estágios, criar/ativar/adicionar via service-role). RLS de estágios endurecido. **Faltam (futuro, não nesta fatia):** reordenar etapa por drag, guard não-destrutivo (não desativar etapa-sistema/com negócios), inbox unificado + respostas sugeridas (depende de IA, B8).
- [x] **Polimento menor (FEITO — Onda A/#1):** cabeçalho contextual no `CadastroSideoverPanel`; o config de pipeline já não mostra "Visão do cadastro".
- [~] **Bloco 4 — Visibilidade & Governança Hub** — mesa redonda (architect-review) feita. **Diagnóstico:** sistema é **single-tenant real** (`current_user_tenant_id()` hardcoded p/ 1 tenant) → "fornecedor vê só o seu vs Hub vê tudo" é **B5+** (multi-tenant real). **Fatia segura feita (autorizada):** migração `rls_crm_core_close_holes` — fecha buracos de RLS (tabelas com RLS sem policy: `hub_empresas`/`hub_pessoas_empresas`/`hub_proximas_acoes`/`hub_leads` + `hub_negocios` INSERT/UPDATE). **APPLY PENDENTE** — Supabase MCP caiu por socket (rede); SQL pronto+rollback em `docs/sql/20260624-rls-crm-core-close-holes-AUTORIZADA-pendente-apply.sql` (reaplicar quando MCP voltar OU rodar no SQL Editor). **Deferido (maior blast radius):** alterar `is_hub_admin()` (usado em ~30 policies de schema paralelo). **Dashboard do Hub** (cards de direcionamento/SLA/ranking) depende de dados de distribuição = **B5**.
- [ ] **B5 distribuição · B5.5 monetização · B6 obra · B7 membros · B8 IA** — futuros (ver plano).

## ✅ Concluído recente (24/jun — referência)
Bloco 1 (menu §8), Bloco 1.5 (auditoria + Escritórios), Bloco 2/U2 (QuickAdd + SmartField/ConfidenceBadge + chips em lead/negócio/empresa/imóvel + sideover edição + `disabled` uniforme), "Esqueci minha senha" + `/redefinir-senha` + hardening, **fix login intermitente** (retry no `crm-session` — 401 transitório), **RLS pipelines aplicado**, validação visual (lead + config + dashboard), e **Plano UI/UX Ondas A–C + D#8** (cabeçalho contextual, tabela tokenizada, Lucide, selo SLA, dashboard por urgência, respostas rápidas). Suíte **182/182**.

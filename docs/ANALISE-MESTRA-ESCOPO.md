# 🧭 Análise-Mestra — Escopo Total Obra10+ (documento vivo)

> **O que é.** A visão **fria, profunda e única** de tudo que falta para o sistema ficar pronto — *nada para trás, nada faltando, nada a mais, nada fora do lugar*. Consolida **todos os documentos** + **todas as decisões** que tratamos + o **estado real do código/banco** (auditado por mesa redonda de 4 especialistas em 25/jun/2026).
>
> **Regra deste doc:** é **vivo** — atualizar a cada entrega/decisão. Quando um item fechar, marcar aqui. Detalhe fino fica nos docs-fonte (links abaixo); aqui é o mapa que amarra tudo.

**Fontes consolidadas:** [INDICE.md](INDICE.md) · [PLANO-EXECUTIVO-BLOCOS.md](PLANO-EXECUTIVO-BLOCOS.md) · [PENDENCIAS.md](PENDENCIAS.md) · [CENTRAL-PERFORMANCE-METRICAS.md](CENTRAL-PERFORMANCE-METRICAS.md) · [INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md](INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md) · [UIUX-AUDITORIA-E-PLANO.md](UIUX-AUDITORIA-E-PLANO.md) · memórias (`ceo-mandato-produto`, `crm-prioridade-codigo-unico`, `registros-log-kpi-por-entidade`, `monetizacao-licenciamento-rede`, `feedback-barometro-progresso`).

---

## 0. Princípios consolidados (as decisões que valem para TUDO)

1. **Plataforma:** um **Hub** distribui leads → **empresas fornecedoras homologadas (tenants)** que **vendem (CRM)** e **executam (obra)** tudo aqui. Multi-tenant, IA-first, API-first.
2. **Código único:** pessoa/empresa existe **uma vez** (dedup por telefone/CPF/CNPJ); lead linka pessoa; é a chave de não-duplicação, histórico, comissão e roteamento.
3. **Telas para o JOB, não tabelas** (regra de ouro #7): cards acionáveis, triagem por urgência, conversa/IA-first, Click-and-Go (≤ poucos cliques). **Tabela vive só em Relatórios.**
4. **Relatórios/Analytics → BI generativo:** a IA gera relatório/tela/dados **sob demanda** (Bloco 8). Tela estática tem dias contados → só higiene mínima agora.
5. **Registro = Evento:** cada nota/avanço em lead/empresa/negócio vira **evento estruturado** (`hub_eventos`, F4) que alimenta os KPIs. Um trabalho, dois resultados.
6. **Monetização em 2 trilhas separadas:** (a) **SaaS** (assinatura mensal + por usuário + módulo/plano + créditos) e (b) **comissionamento transacional** (rateio/split por código único). Manual-first.
7. **Atendimento:** só canais **Meta** no início; leads por **formulário + WhatsApp**, atendidos pela **IA**, entram no CRM.
8. **Método:** aditivo, preserva a lógica que já funciona, **gates** (tsc+vitest+_chk23), mesa redonda de UX a cada tela, **sem push/secrets**, migrações reversíveis. Aprovação humana só p/ exclusão/irreversível/credencial/produção.

---

## 1. Estado por dimensão (auditoria fria — 25/jun)

### 🟢 A. Núcleo comercial / Produto-UX
**~11 telas no padrão "job" (coerentes):** Leads (Caixa de Oportunidades ✨), Negócios (Kanban + combobox), Atendimento (inbox IA/humano), Aprovações, Ciclos, Agentes, Dashboard, Financeiro pagar/receber, Parceiro-ficha, Onboarding.
**7 telas que ainda traem o discurso "tabela é relatório" (risco BAIXO — modelos já existem no repo):**
- ⛔ **Cadastros** (`app/crm/cadastro/page.tsx`) — *prioridade #1*; tabela+wizard → **busca + Ficha 360** (reusar `CadastroFichaTabs`, `parceiros/[id]`).
- ⛔ **Tarefas** (`app/crm/tarefas/page.tsx`) — listão read-only → "Minhas ações de hoje" (faixas Atrasadas/Hoje/Semana + Concluir).
- ⛔ **Pedidos, Obras (lista+detalhe), Projetos, Imóveis** — Operações; cards de status/urgência. (`obras/*` usa estilo inline fora do design system — corrigir junto.)
**Lacunas sistêmicas de UX:** skeletons de loading, empty-states **com ação**, a11y irregular nos cards, **scroll horizontal em mobile nas tabelas**, ruído residual (R$ 0,00/—/dados de teste).
**Nada a mais (UX):** Relatórios/Tráfego (vira BI generativo — só higiene); Analytics já é dashboard OK; Config/Usuários/Empresas/Contatos/Canais = admin (formulário é o formato certo). Barra **conversacional plena com voz** = adiada ao Bloco 8.

### 🟡 B. Gestão / KPIs / Registros (a profundidade que faltava)
- ❌ **`hub_eventos` (keystone F4) NÃO existe** — sem ele, KPIs de tempo/SLA/ranking/funil são **falsos ou impossíveis**.
- ⚠️ **Área de registro/log por entidade PARCIAL** — só o lead tem `proxima_acao` (texto solto). Falta: nota livre, log de interação estruturado (`hub_registros_interacao`), próxima-ação com **tipo+data+status**, timeline visível, e o **mesmo padrão em empresa/negócio/pessoa**.
- ❌ **Funções que faltam inteiras:** *agendar reunião* (calendário), *registrar interação* (ligação/visita/proposta), *follow-up automático por regra*, **motor de SLA real** (hoje só frescor visual).
- **Já existe:** funil/conversão por etapa, taxa de qualificação, `/alertas/parados`, `hub_proximas_acoes` (base), `hub_memorias_lead`.

### 🔵 C. Arquitetura / Dados / Multi-tenant
- 🔴 **Duas funções de tenant concorrentes** e a usada (`current_user_tenant_id()`) **não está versionada** em migração (drift: reconstruir o banco pelo repo quebra a RLS). `users.tenant_id` **já existe** (pronto p/ tornar a função dinâmica).
- 🔴 **`hub_imoveis` vaza entre tenants** (rota sem filtro) + geração de código por `count+1` (race) em imóveis/obras.
- 🔴 **Dedup do intake de FORMULÁRIO ausente** (`app/api/leads/route.ts`) → lead duplicado sem pessoa/código. Helper `garantirPessoaParaLead` a extrair de `salvar-super-cadastro`. Falta **FK `lead.pessoa_id → hub_pessoas`**.
- ❌ **Distribuição não é persistida** (`hub_lead_distribuicao`, score §6.1, Mestre×Vinculado, SLA do fornecedor) — só grava `agente_responsavel`.
- ❌ **Schema de Obra** (frentes/itens/medições/aditivos/cronograma/compras/evidências) — Bloco 6, não iniciar especulativo.
- ⚠️ **`OR tenant_id IS NULL`** em toda policy = furo permanente disfarçado de compat → exige **backfill de tenant_id** e remoção do ramo NULL no multi-tenant real.

### 🔴 D. Segurança / Multi-tenant / Monetização — **ACHADOS CRÍTICOS (novos)**
> O banco está **mais frágil** que o plano assumia: **143 advisories**, **56 tabelas RLS sem policy**, **26 policies `USING(true)`**, e um **schema paralelo `crm_*`** morto no código mas com RLS aberta (superfície de vazamento de comissão).

- 🔴 **CRÍTICO 1 — Escalada de privilégio na API (o pior, e é HOJE):** ~**32 rotas** usam `crmDb()` (service_role, bypassa RLS) **sem guard de papel**, e o proxy libera qualquer sessão logada. Efeito real **single-tenant**: um **atendente** pode `DELETE` empresas/pessoas, `bulk-delete`, `PATCH` em `negocios/[id]` (mexer em valor/comissão) e aprovar cotação. Exploração financeira + perda de dados **sem precisar de multi-tenant**.
- 🔴 **CRÍTICO 2 — `tenant_id` aceito de header/body sem validar** contra o caller → no dia que ligar multi-tenant, gestor do tenant A grava/lê no tenant B sabendo o UUID.
- 🔴 **CRÍTICO 3 — RLS frágil para o browser:** o front usa **anon key direto** (33 pares tabela/op + 8 canais realtime). Com `USING(true)`/sem-policy, é vazamento direto quando a anon alcança.
- 🔴 **CRÍTICO 4 — Integridade do split sem fundação:** sem `hub_comissao_eventos`(imutável)/`rateio`(auditável)/ledger de crédito; `comissao_calculada` é campo editável via PATCH sem guard. Cobrar comissão assim = disputa sem prova.
- ❌ **Entitlements/SaaS** (`hub_planos`/assinatura/módulos/créditos) **não existem** — nem tabela, nem guard de módulo.
- **Migração `rls_crm_core_close_holes` segue PENDENTE de apply.**

---

## 2. 🚦 Sequência correta (ordem de dependência — não inverter)

```
FAIXA A — APRESENTÁVEL (deadline amanhã à noite) · risco baixo, visível
  A1 Limpar leads de teste + ~6 mocks realistas (com backup)
  A2 Cadastros → Ficha 360 (busca + cards)         ← prioridade #1 de UX
  A3 Tarefas → "ações de hoje" + Pedidos/Obras/Projetos cards
  A4 Higiene mínima de Relatórios (sem redesenho)

FAIXA B — GO-LIVE BLOCKERS (antes de usuários reais / multi-tenant) · invisível mas grave
  B1 Guard de papel em TODA rota mutativa/sensível (Crítico 1)   ← baixo risco, mata o pior vetor
  B2 Validar tenant_id server-side (deriva de ctx; só owner muda) (Crítico 2)
  B3 Aplicar rls_crm_core_close_holes + trocar USING(true) por tenant-aware (Crítico 3)
  B4 Trancar/avaliar schema crm_* paralelo (sem dropar sem OK)

FAIXA C — FUNDAÇÃO DE GESTÃO (destrava KPIs e IA) · alavanca dupla
  C1 hub_eventos (append-only) + helper emitirEvento() — começar mínimo
  C2 hub_registros_interacao + painel "Registros" (lead/empresa/negócio/pessoa)
  C3 Próxima-ação estruturada (tipo+data+status) + dedup do formulário (código único)

FAIXA D — PLATAFORMA (a maratona pós-prazo)
  D1 B3.9 Multi-tenant real (current_user_tenant_id dinâmica + is_hub_owner + 2º tenant)
  D2 B4 Visibilidade Hub (policies fornecedor vs Hub-bypass) + Dashboard do Hub
  D3 B5 Distribuição (hub_lead_distribuicao + score §6.1 + SLA + redistribuição)
  D4 B5.5 Monetização (entitlements SaaS + evento de comissão imutável/auditado + split)
  D5 B6 Gestão de Obra · D6 B7 Membros · D7 B8 IA-first + BI generativo
```

**Caminho crítico da plataforma:** `B1→B2→B3 → D1 → D2 → D3/D4`. **Tudo "Hub vê tudo / fornecedor vê o seu" está bloqueado até D1**, que por sua vez exige a segurança da Faixa B feita primeiro (ligar isolamento sobre base que vaza = pior).

---

## 3. ⚠️ Lacunas IRREVERSÍVEIS (capturar agora ou perder para sempre)

Se NÃO registrarmos desde já (em `hub_eventos`/registros), fica **impossível** reconstruir depois:
- **Quem** fez cada ação (`user_id` no evento) — senão o histórico inteiro fica anônimo.
- **Timestamp de cada transição** (criado→qualificado→negócio→ganho/perdido) — senão TMA/SLA/velocidade morrem (hoje só "atualizado_em", que muda a cada edição).
- **Canal e tipo de interação** (ligação 30min vs SMS vs reunião) — senão TMA por canal vira ruído.
- **Distribuição** (quem recebeu, quando, aceitou/recusou+motivo) — senão B5 e ranking de fornecedor são adivinhação.
- **Auditoria do split** (quem mudou o %, quando, de quanto p/ quanto) — senão a comissão é indefensável.

---

## 4. 🚫 Nada a mais (fora de escopo agora — não construir)

- **Relatórios/Tráfego redesenho** (vira BI generativo) · **VoIP/telefonia** · **forecast/pipeline ponderado** · **churn/carteira avançada**.
- **Billing automático/gateway** (manual-first — só modelar o evento imutável) · **comissão automática** antes de B5.
- **`hub_eventos` com as 14 famílias completas** — começar com o mínimo (lead criado/distribuído/contato/estágio/ganho).
- **Schema de Obra especulativo** (Compras em aberto, spec §15.1) · **Membros** (contrato em aberto §15.2) · **ativar IA/Anthropic** (B8, manual-first).
- **N tenants reais antes de fechar API+tenant_id** · **ABAC/permissão granular** (os 5 níveis bastam — falta aplicar) · **API pública/marketplace** (Fase 3).
- **Dropar schema `crm_*`** sem OK do dono (exclusão = trava) — apenas trancar RLS.

---

## 5. 📊 Progresso recalibrado (medindo profundidade FUNCIONAL, não só telas)

| Frente | % honesto |
|---|---|
| Núcleo comercial **apresentável** (telas) | 🟢 ~70% |
| Núcleo comercial **funcional** (com registros/KPIs/automação) | 🟡 ~48% |
| Segurança / go-live (API guards, RLS, tenant) | 🔴 ~25% |
| Fundação de gestão (eventos/registros/KPIs) | 🔴 ~8% |
| Multi-tenant real (B3.9) | 🔴 ~10% |
| Distribuição (B5) · Monetização (B5.5) | 🔴 ~10–15% |
| Obra (B6) · Membros (B7) · IA/BI generativo (B8) | 🔴 ~10–30% |
| **VISÃO COMPLETA (B0–B8) — média ponderada** | **🔵 ~30%** |

**Leitura de CEO:** o que se **apresenta** está bom (~70%); o que dá **gestão e vai a mercado com segurança** está no começo. A descoberta mais importante da auditoria: **há dívida de segurança explorável HOJE** (Faixa B) que precisa entrar no plano antes de qualquer usuário real.

---

## 6. Ação imediata (respeitando o prazo)
1. **Hoje (apresentação):** Faixa A — mocks + Cadastros Ficha 360 + Tarefas/Operações em cards.
2. **Logo após o prazo (antes de qualquer cliente real):** Faixa B — fechar a API (guards de papel) + tenant_id + RLS. É barato e mata o pior risco.
3. **Em paralelo/sequência:** Faixa C — eventos+registros (a gestão que o dono quer), já capturando os dados irreversíveis.

> Atualizar este documento a cada entrega. Ele é o índice de verdade do "quanto falta".

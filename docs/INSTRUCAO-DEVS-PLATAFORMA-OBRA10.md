# Instrução para Desenvolvedores — Plataforma Obra10+

> **O que é este documento.** Especificação **operacional** do sistema como um todo — pronta para virar backlog de desenvolvimento. Consolida as definições do cliente (Wendel) com o estado real do código. Não é protótipo visual; entrega o "o quê", o "porquê" e o suficiente do "como" para o dev executar **sem preencher lacunas por conta própria**.
>
> **Status:** **v2 operacional** — 2026-06-24. Evolui a v1 (visão) com: menu oficial em árvore, Imóvel como entidade central, modelo de propriedade do lead (Hub × fornecedor), motor de distribuição com tabela de score, cadastros com campos mínimos por entidade, e ordem de desenvolvimento endurecida. A **visão central da v1 permanece** (estava correta).
>
> **Regra de leitura:** **[JÁ EXISTE]** = há base no código, estender. **[A CONSTRUIR]** = novo. **[FUTURO]** = deixar arquitetura pronta, **não ativar agora**.

---

## 1. Princípio central (a frase que orienta tudo)

> **Plataforma multi-tenant, IA-first e conversacional.** O **Hub** recebe, qualifica e **distribui leads** para **fornecedores homologados**; cada fornecedor possui **CRM e gestão próprios dentro da plataforma**. O Hub mantém **governança, visibilidade, qualidade, indicadores, redistribuição e acompanhamento de toda a jornada — do lead à entrega final.**

Três implicações que mudam o desenho:
1. **Não é "só um CRM".** É **Hub + Motor de Distribuição + CRM do Fornecedor + Gestão Operacional** num só sistema.
2. **Todo membro/fornecedor loga aqui** para vender (CRM) e executar (obra). Multi-tenant por empresa.
3. **A IA opera o sistema** — mas **ligar IA = fase futura**; primeiro tudo roda **manual**, com UI/UX boa. A IA nasce **prevista**, nunca como desculpa para um manual ruim.

---

## 2. Glossário

| Termo | Significado |
|------|-------------|
| **Hub** | Núcleo Obra10+: recebe todos os leads e governa a rede. |
| **Membro** | Empresa/profissional na jornada **homologação → onboarding → comunidade → academy** (sistema **Membros**, separado). |
| **Fornecedor** | Membro **elegível** que migrou para a plataforma; apto a **receber leads** e operar (CRM + obra). |
| **Lead do Hub** | Lead captado pelo Hub. Hub é dono e governa. Distribuído como **Vinculado**. |
| **Lead próprio do fornecedor** | Lead que o fornecedor cadastrou/importou/captou sozinho. Pertence ao fornecedor; Hub **não vê por padrão**. |
| **Lead Vinculado** | Lead do Hub **compartilhado** com o fornecedor (não duplicado); histórico sincronizado. |
| **Imóvel** | **Entidade central** da cadeia imobiliária/reforma: liga lead→cliente→venda→projeto→obra→serviços→pós-venda. |
| **Negócio** | Oportunidade comercial (Pipedrive). Quando **ganho**, vira projeto/obra/serviço. |
| **Frente** | Unidade mensurável da obra (ex.: alvenaria). Frente → itens (prev×exec×saldo). |
| **Aditivo** | Mudança de escopo aprovada; recalcula prazo, quantitativos e financeiro. |
| **Tenant** | Empresa isolada no multi-tenant. Toda linha carrega `tenant_id`. |
| **SLA** | Prazo do fornecedor para agir no lead; estourou → alerta + redistribuição. |

---

## 3. Ciclo de vida completo (a espinha do sistema)

```
[Membros: homologação → onboarding → comunidade → academy]
        │  (membro fica ELEGÍVEL)
        ▼
[MIGRAÇÃO] dados do membro entram na plataforma como FORNECEDOR ativo
        │
        ▼
[HUB] recebe lead (Meta/Google/WhatsApp/site/indicação/manual/API)
        │  IA qualifica, classifica a demanda e vincula a um IMÓVEL (se houver)
        ▼
[MOTOR DE DISTRIBUIÇÃO] score de aderência → escolhe fornecedor
        │  (automático ≥85 / manual 70–84 / não <70) + SLA
        ▼
[CRM DO FORNECEDOR] recebe Lead Vinculado → atende → negócio → GANHO
        │
        ▼
[GESTÃO DE OBRA] negócio ganho → "Gerar obra/projeto" → Wizard → obra/projeto/serviço
        │  escopo, cronograma, avanço & medição, compras  (sempre ligados ao IMÓVEL)
        ▼
[ENTREGA + PÓS-VENDA]  ── HUB acompanha tudo (governança, indicadores, qualidade) ──┘
```

---

## 4. Entidades centrais e o lugar do IMÓVEL

O **Imóvel é entidade de 1ª classe** e ponto de costura da jornada. Modelo relacional (tudo `tenant_id` + RLS):

```
                 ┌─────────────┐
        ┌────────│   IMÓVEL    │────────┐
        │        └─────────────┘        │
        │           │      │            │
     PESSOA      NEGÓCIO  OBRA       SERVIÇO
    (cliente)       │      │          │
        │        ATIVIDADES│       MEDIÇÃO
     EMPRESA          MEDIÇÃO/COMPRA/ADITIVO
```

- **Regra:** `imovel_id` é **nullable** — nem todo lead/negócio tem imóvel (serviço/produto puro). Mas onde existir, é o eixo: a ficha do imóvel mostra **todo o histórico** (leads, vendas, projetos, obras, marcenaria, marmoraria, serviços, pós-venda).
- **Por quê:** sem o imóvel central, o sistema vira "CRM com obras penduradas". Com ele, vira **plataforma de jornada imobiliária + reforma + serviços**.
- **[A CONSTRUIR]** `hub_imoveis` + vínculos `imovel_id` em lead/negócio/obra/serviço + ficha-360 do imóvel.

---

## 5. Visibilidade do Lead — Hub vê TUDO · Fornecedor vê só o seu — **crítico**

**Regra confirmada pelo Wendel (controle TOTAL do Hub):**
- **Hub vê TODOS os leads** da rede inteira — qualquer fornecedor, qualquer origem, qualquer estado. Governança e controle totais.
- **Fornecedor vê SOMENTE os leads dele** — os que o Hub **direcionou** a ele (mais os que ele mesmo cadastrar). **Nunca** vê a carteira do Hub nem lead de outro fornecedor.

| Tipo de lead | Hub enxerga? | Fornecedor enxerga? |
|--------------|:------------:|:-------------------:|
| Captado pelo Hub, ainda não distribuído | **Sim** | Não |
| Direcionado a ESTE fornecedor (Vinculado) | **Sim** | **Sim** (só o seu) |
| Direcionado a OUTRO fornecedor | **Sim** | Não |
| Cadastrado pelo próprio fornecedor | **Sim** (controle total) | Sim |

- **Nunca duplicar o dado:** lead do Hub é compartilhado com **vínculo** (Mestre↔Vinculado), histórico sincronizado, redistribuível.
- **[A CONSTRUIR]** RLS: o papel **fornecedor** é filtrado por `fornecedor_id = seu tenant`; o papel **Hub/governança bypassa** o filtro e vê tudo. Campos `proprietario`/`origem` no lead. O **Dashboard do Hub** (ver UI/UX) materializa esse controle total.

---

## 6. Motor de Distribuição de Leads — especificação própria `[A CONSTRUIR — base parcial]`

O maior diferencial do produto. **[JÁ EXISTE]** base: `resolverDestinoLead` + `hub_lead_routing_regras` + fallback heurístico.

### 6.1 Tabela de score (default — pesos **configuráveis por mercado/tenant**)

| Critério | Pontos |
|---------|:-----:|
| Especialidade compatível | 25 |
| Região atendida | 20 |
| Disponibilidade atual | 15 |
| Avaliação histórica | 15 |
| Tempo médio de resposta | 10 |
| Taxa de conversão | 10 |
| Nível na comunidade | 5 |
| **Total** | **100** |

> Critérios secundários que ajustam o score (modificadores, fase 2): capacidade operacional, volume de leads já recebido (balanceamento), projetos em andamento, ticket médio, reclamações, plano contratado, afinidade com o perfil do cliente.

### 6.2 Regras de decisão

| Condição | Ação |
|----------|------|
| Score **≥ 85** | **Distribuição automática** |
| Score **70–84** | **Aprovação manual do Hub** (semiautomático) |
| Score **< 70** | **Não recomenda** (fica na fila / escolha manual) |
| **SLA vencido** | alerta ao Hub e ao fornecedor |
| **SLA vencido 2×** | **redistribuição** automática |
| **Reincidência** de SLA | fornecedor **perde score** |
| Fornecedor **suspenso/inelegível** | **não recebe lead** |

- **3 modos coexistem:** Automático · Semiautomático · Manual (controlar no início, automatizar com dados).
- **[A CONSTRUIR]** `hub_fornecedor_score` (critérios + pesos por mercado), `hub_lead_distribuicao` (Mestre×Vinculado + estado + SLA + timestamps), motor de cálculo, fila de redistribuição.

---

## 7. Cadastros — campos mínimos por entidade `[guia para não criar cadastro pobre]`

Formato por entidade: **Objetivo · Campos principais · Relacionamentos · Acesso · Ações · IA sugere**. Tudo `tenant_id` + código próprio + RLS.

### Lead
- **Objetivo:** registrar interesse antes de virar negócio. **Campos:** nome, telefone, e-mail, origem, canal, demanda/mercado, cidade/UF, `imovel_id?`, `proprietario` (hub/fornecedor), score de prioridade, status, responsável. **Relações:** Pessoa, Imóvel, Negócio, Canal de entrada, Fornecedor (vinculado). **Acesso:** atendente↑; Hub conforme propriedade (§5). **Ações:** qualificar, distribuir, converter em negócio, redistribuir. **IA:** classificar demanda, sugerir fornecedor, dedup, próxima ação.
### Pessoa
- **Objetivo:** indivíduo (cliente/decisor/contato). **Campos:** nome, documento, telefone(s), e-mail(s), cargo, origem, endereço. **Relações:** Empresa, Negócio, Imóvel, Atividades. **Acesso:** comercial↑. **Ações:** vincular empresa/negócio/imóvel, histórico. **IA:** dedup, enriquecer, sugerir vínculo.
### Empresa
- **Objetivo:** pessoa jurídica (cliente ou parceira). **Campos:** razão/fantasia, CNPJ, segmento, porte, contatos, endereço. **Relações:** Pessoas, Negócios, Imóveis. **Acesso:** comercial↑. **Ações:** vincular pessoas/negócios. **IA:** dedup, classificar segmento.
### Imóvel `[A CONSTRUIR]`
- **Objetivo:** **eixo da jornada** (§4). **Campos:** tipo (residencial/comercial/predial/terreno), endereço/geo, área, padrão, status (em projeto/obra/concluído), proprietário/cliente. **Relações:** Pessoa, Empresa, Negócio, Obra, Serviços, Documentos. **Acesso:** comercial↑/obra. **Ações:** ficha-360, abrir negócio/obra, anexar docs. **IA:** estimar quantidades por área, sugerir frentes pelas fotos.
### Negócio
- **Objetivo:** oportunidade comercial (Pipedrive). **Campos:** título, mercado, valor, etapa/pipeline, `pessoa_id?`, `empresa_id?`, `imovel_id?`, próxima-ação, motivo de perda. **Relações:** Pessoa, Empresa, Imóvel, Atividades, Obra (quando ganho). **Acesso:** comercial↑. **Ações:** mover etapa, registrar nota, ganhar→**Gerar obra/projeto**. **IA:** próxima ação, risco, resumo. **[JÁ EXISTE].**
### Fornecedor
- **Objetivo:** empresa homologada que recebe leads e executa. **Campos:** identidade, especialidades, regiões atendidas, capacidade, plano, nível na comunidade, status de homologação, avaliação, SLA config. **Relações:** Membros (origem), Leads recebidos, Obras, Score. **Acesso:** Hub (gestão); o próprio fornecedor (leitura do seu perfil). **Ações:** homologar/suspender, ajustar score, ver performance. **IA:** ranquear, prever capacidade. **[JÁ EXISTE base `hub_fornecedores`].**
### Mão de Obra (Banco de profissionais)
- **Objetivo:** profissionais/equipes para alocar em obras. **Campos:** nome, função, especialidade, disponibilidade, região, avaliação, documentos/SST. **Relações:** Fornecedor, Obra, Tarefas. **Acesso:** gestor de obra↑. **Ações:** alocar, avaliar. **IA:** sugerir alocação por skill/disponibilidade. **[JÁ EXISTE base `hub_especialistas`].**
### Projeto / Obra / Serviço
- **Objetivo:** execução do negócio ganho. **Campos:** tipo (construção/reforma/serviço), origem (com/sem projeto), `imovel_id`, cliente, contrato (valor/prazo/forma de medição/BDI/retenção), papéis (Eng. responsável…), status. **Relações:** Negócio, Imóvel, Frentes/Itens, Cronograma, Medições, Compras, Aditivos, Documentos. **Acesso:** equipe da obra (papéis). **Ações:** wizard, cockpit, medir, comprar. **IA:** extrair de projeto, estimar, prever atraso. **[A CONSTRUIR — base: botão Bloco G].**
### Atividade
- **Objetivo:** evento na timeline (nota/tarefa/ligação/etapa). **Campos:** tipo, descrição, feito_por, data, `negocio_id?`/`lead_id?`/`obra_id?`. **Relações:** Lead, Negócio, Obra. **Acesso:** conforme entidade-pai. **Ações:** criar nota/tarefa, concluir. **IA:** registrar automático, lembrar follow-up. **[JÁ EXISTE `hub_atividades`].**
### Documento
- **Objetivo:** arquivos (projeto, contrato, ART, foto). **Campos:** nome, tipo, disciplina/revisão, vínculo, autor, data. **Relações:** Imóvel, Obra, Negócio, Medição. **Acesso:** conforme entidade. **Ações:** upload, versionar, classificar. **IA:** ler PDF/DWG, extrair dados, classificar disciplina/revisão.
### Medição
- **Objetivo:** transformar avanço físico em faturamento. **Campos:** período, base (projeto/escopo), itens (contratado/executado/a medir/preço), bruto, retenção, deduções, líquido, status/gate, evidências. **Relações:** Obra, Frentes/Itens, Contas a receber. **Acesso:** Eng (técnico), cliente/fiscal, financeiro. **Ações:** montar boletim, submeter, aprovar por gate, faturar. **IA:** pré-montar pela evidência, "fiscal de evidências". **[A CONSTRUIR].**
### Compra `[A CONSTRUIR — Wendel ainda detalha]`
- **Objetivo:** suprir o saldo de itens da obra. **Campos:** `CO.<código>`, item, quantidade, fornecedor de material, preço, lead time, status. **Relações:** Obra, Item/Frente, Cronograma. **Acesso:** Compras↑. **Ações:** requisitar (1 clique do saldo), cotar, aprovar. **IA:** sinalizar lead time longo, alertar excesso vs. quantitativo.
### Aditivo
- **Objetivo:** mudança de escopo aprovada. **Campos:** tipo (acréscimo/supressão/substituição), itens afetados, justificativa, impacto prazo/valor, status. **Relações:** Obra, Frentes/Itens, Cronograma, Medição. **Acesso:** Eng/gestor + aprovação cliente. **Ações:** propor, aprovar, recalcular tudo. **IA:** classificar, redigir justificativa, identificar da foto/projeto. **[A CONSTRUIR].**
### Aprovação
- **Objetivo:** gate genérico (dinheiro/prazo/escopo). **Campos:** tipo, item, solicitante, aprovador, status, motivo. **Relações:** qualquer entidade sensível. **Acesso:** conforme alçada. **Ações:** aprovar/rejeitar com motivo. **IA:** preparar pacote de aprovação; nunca aprovar sozinha. **[JÁ EXISTE base `/crm/aprovacoes`].**

---

## 8. Menu lateral OFICIAL (árvore pronta para implementar) `[Fase 1 — próxima tarefa]`

Tags: ✅ existe · 🔨 a construir · 🔮 futuro. Respeitar o **design system Obra10+** (dark verde+dourado tokenizado; **não** azul/Shadcn).

```
Central IA              🔮
  Assistente · Pendências · Aprovações ✅ · Relatórios IA · Insights

Comercial / CRM
  Leads ✅ · Negócios ✅ · Pessoas ✅ · Empresas ✅ · Imóveis 🔨 ·
  Atendimentos ✅ · Atividades ✅ · Produtos e Serviços 🔨 · Pipelines ✅

Operações
  Projetos 🔨 · Obras 🔨 · Serviços 🔨 · Tarefas 🔨 · Documentos 🔨 ·
  Evidências 🔨 · Medições 🔨 · Compras 🔨 · Aditivos 🔨

Fornecedores            (motor da rede)
  Empresas Homologadas ✅ · Banco de Mão de Obra ✅ · Distribuição de Leads ✅ ·
  Performance 🔨 · Ranking 🔨 · SLA 🔨 · Homologação 🔨

Financeiro
  Receitas 🔨 · Despesas 🔨 · Contas a Receber 🔨 · Contas a Pagar 🔨 ·
  Fluxo de Caixa 🔨 · Contratos 🔨 · Comissões 🔨 · Retenções 🔨

IA e Agentes            🔮
  Agentes ✅ · Fluxos · Base de Conhecimento · Integrações · Monitoramento · Logs

Comunidade              (ponte Membros — leitura/externa)
  Homologação · Onboarding · Academy · Certificações · Conquistas · Ranking

Marketing
  Campanhas 🔨 · Fontes de Leads 🔨 · Canais de Entrada ✅ · Landing Pages 🔮 · Analytics 🔨

Administração
  Empresas / Tenants ✅ · Usuários ✅ · Permissões ✅ · Planos 🔨 ·
  Configurações ✅ · Auditoria 🔨
```

**Nota de implementação:** o menu deve **filtrar por papel** (RBAC, §9) e por **plano do tenant** (item oculto se o plano não inclui). Grupos vazios para o papel não aparecem.

---

## 9. Papéis e permissões (RBAC) `[JÁ EXISTE — estender]`
5 níveis em `lib/crm/crm-permissoes.ts`: **owner · gestor · comercial · financeiro · atendente** (rank linear + funções ortogonais — Financeiro é função própria). Owners fixos por allowlist; guards por rota (`crmPodeVerRota`, `ROTA_MIN_NIVEL`). **Estender:** papéis do lado **obra** (Eng. responsável, Gestor de obra, Compras, SST, Campo) e separação **Hub (governança) × Fornecedor (operação)**.

---

## 10. Multi-tenant & Segurança `[JÁ EXISTE — manter rigor]`
- Toda tabela com `tenant_id`; RLS `using (tenant_id = public.current_user_tenant_id() or tenant_id is null)`; helper SECURITY DEFINER.
- **Travas:** nunca expor PII a `anon`; sem tokens/segredos no banco/Git; migrações **aditivas/reversíveis**.
- **Lead Mestre×Vinculado + propriedade (§5)** exigem políticas finas (fornecedor vê só o seu; Hub vê conforme plano).

---

## 11. Regras transversais (todo o sistema)
1. **IA preenche, humano confirma** — campo derivado mostra **origem + confiança**; nada grava sem confirmação.
2. **Aprovação humana obrigatória** em: valor de contrato, prazo, distribuição financeira, critério de aceite, baseline, **aditivo**, e cada **gate** de medição.
3. **Rastreabilidade:** valor derivado guarda origem (arquivo + página/linha).
4. **Sem evidência → item bloqueado** ("dívida de evidência" condicional, destacada até regularizar).
5. **Nunca medir/executar além do contratado** sem aditivo aprovado.
6. **Mobile = campo** (evidência/avanço por voz/foto); **desktop = montar/aprovar** boletim, replanejar, editar escopo.
7. **Salvamento contínuo** (rascunho por passo).

---

## 12. Modelo de dados (alto nível)
**[JÁ EXISTE]** `hub_pessoas`, `hub_empresas`, `hub_negocios`, `hub_atividades` (`negocio_id`+`lead_id` nullable), `hub_canais_entrada`, `hub_lead_routing_regras`, `hub_especialistas`, `hub_fornecedores`, `hub_codigo_contador`, `hub_conversas`, `hub_whatsapp_config`.

**[A CONSTRUIR]:** `hub_imoveis`; `hub_fornecedor_score`; `hub_lead_distribuicao` (Mestre×Vinculado + SLA); `hub_obras`, `hub_obra_frentes`, `hub_obra_itens` (prev/exec/saldo); `hub_medicoes` + itens; `hub_aditivos`; `hub_cronograma` (atividades/dependências/baseline); `hub_compras` (`CO.<código>`); `hub_documentos`/`hub_evidencias`; campos `proprietario`/`origem`/`visivel_hub` no lead. Tudo `tenant_id` + RLS.

---

## 13. Ordem de desenvolvimento (dura — nesta sequência)
**Norte:** sistema **manual excelente** antes de IA. A IA nasce prevista, nunca vira desculpa para manual ruim.

1. **Menu lateral e navegação** (§8) — a fundação que organiza ou bagunça tudo.
2. **CRM manual rodando muito bem** — cadastros completos (incl. **Imóvel**), fichas Pipedrive correlacionadas, pipelines customizáveis.
3. **CRM do fornecedor** — recebimento de Lead Vinculado, propriedade do lead (§5), funis por tipo.
4. **Distribuição de leads** — motor de score (§6), modos, SLA, redistribuição, Governança/Fornecedores.
5. **Gestão de projeto/obra/serviço** — Wizard + Escopo + Cronograma + Medição + **Compras**.
6. **Integração com Membros** — elegibilidade + migração de fornecedor.
7. **IA operacional pesada** `[FUTURO]` — conversacional + relatórios generativos (Bloco H/Anthropic; depende de chave + GO de custo).

Integrações **API-first**: arquitetura prevista desde o passo 2; ligações reais conforme necessidade.

---

## 14. Estado atual do código (grounding)
- **Stack:** Next.js 16 (App Router) + Supabase (projeto "SISTEMA OBRA10+", ref `cdjlqsznerdhwqyunodl`). Branch `wendel/dev` (base `feature/escritorio-visual`). **Tudo local — nada pushado/deployado.**
- **Provado nesta sessão:** especialistas/fornecedores editáveis; negócio flexível (Pipedrive); roteamento de leads; canais de entrada (CRUD); colunas customizáveis; ficha do negócio (próxima-ação auto-save, nota na timeline, vínculo pessoa); **fix login** (autofill via DOM); **fix drift** `hub_atividades` (`negocio_id` + `lead_id` nullable).
- **Schema aplicado** (aditivo/reversível): `docs/sql/*-APPLIED.sql`.
- **Design system:** dark verde+dourado tokenizado (`globals.css`, `--obra-*`/`--brand-*`). Manter.

---

## 15. Decisões em aberto (resolver com o Wendel)
1. **Módulo Compras** — falta detalhamento (campos, fluxo de cotação/aprovação).
2. **Contrato da migração Membros → fornecedor** (API vs. view; campos; gatilho de elegibilidade).
3. **Política de visibilidade do lead próprio do fornecedor por plano** (§5) — defaults e exceções.
4. **Pesos do score por mercado** (§6.1) — confirmar defaults por arquitetura/engenharia/marcenaria/imobiliário.
5. **Catálogo de Produto físico** — hoje "mercado"; produto físico é futuro.

---

## 16. Travas operacionais (qualquer dev/IA neste repo)
- Mexer **somente** no projeto `-ramon`. **Sem push** sem ordem. **Sem secrets** no Git/banco.
- Migrações **aditivas e reversíveis**; rotas autor/admin-only; validar `tsc` + testes + `_chk23`.
- **Aprovação humana** para: exclusão de dados, mudança irreversível, custo, credenciais, produção.

---

### Próxima sessão começa por…
**Passo 1 — menu lateral** (§8), respeitando o design system, filtrando por papel + plano. Contexto durável na memória: `plataforma-arquitetura-visao`, `distribuicao-leads-motor`, `modulo-engenharia-obra`, `sessao-entregas-jun2026`, `crm-cliente-final-foco`.

# Instrução para Desenvolvedores — Plataforma Obra10+

> **O que é este documento.** A especificação funcional do sistema **como um todo**, para a equipe de produto/desenvolvimento entender o que deve ser construído e em que ordem. Consolida as definições do cliente (Wendel) com o estado real do código. Não é protótipo visual; é o "o quê" e o "porquê", com o "como" no nível de arquitetura.
>
> **Status:** v1 — 2026-06-24. Plataforma em construção (`escritorio-virtual-ramon`, branch `wendel/dev`). Há base significativa já no código (ver §11).
>
> **Regra de ouro de leitura:** onde estiver **[JÁ EXISTE]**, há base no código — estender, não reescrever. Onde estiver **[A CONSTRUIR]**, é novo. Onde estiver **[FUTURO]**, deixar a arquitetura pronta mas **não ativar agora**.

---

## 1. Princípio central (a frase que orienta tudo)

> **Plataforma multi-tenant, IA-first e conversacional.** O **Hub** recebe, qualifica e **distribui leads** para **fornecedores homologados**; cada fornecedor possui **CRM e gestão próprios dentro da plataforma**. O Hub mantém **governança, visibilidade, controle de qualidade, indicadores, redistribuição e acompanhamento de toda a jornada do cliente — do lead à entrega final.**

Três implicações que mudam o desenho:
1. **Não é "só um CRM".** É **Hub + Motor de Distribuição + CRM do Fornecedor + Gestão Operacional** num só sistema.
2. **Todo membro/fornecedor loga aqui** para vender (CRM) e executar (obra). Multi-tenant por empresa.
3. **A IA opera o sistema** (distribui, redistribui, cobra SLA, gera proposta/relatório, move etapa) — não é um chat decorativo. Mas **ativar IA = fase futura**; primeiro tudo roda **manual**, com UI/UX boa.

---

## 2. Glossário

| Termo | Significado |
|------|-------------|
| **Hub** | O núcleo Obra10+: recebe todos os leads e governa a rede. Dono do dado. |
| **Membro** | Empresa/profissional que entra pela jornada de **homologação → onboarding → comunidade → academy** (sistema **Membros**, separado). |
| **Fornecedor** | Membro **elegível** que migrou para a plataforma e está apto a **receber leads** e operar (CRM + obra). |
| **Lead Mestre** | O lead como propriedade do Hub. |
| **Lead Vinculado** | A cópia *vinculada* (não duplicada) que o fornecedor trabalha no CRM dele. Histórico sincronizado. |
| **Negócio** | Oportunidade comercial (estilo Pipedrive). Quando **ganho**, vira projeto/obra/serviço. |
| **Frente** | Unidade mensurável de uma obra (ex.: alvenaria, elétrica). Frente → itens (prev×exec×saldo). |
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
        │  IA qualifica e classifica a demanda
        ▼
[MOTOR DE DISTRIBUIÇÃO] calcula score de aderência → escolhe fornecedor
        │  (modo automático / semiautomático / manual) + SLA
        ▼
[CRM DO FORNECEDOR] recebe Lead Vinculado → atende → negócio → GANHO
        │
        ▼
[GESTÃO DE OBRA] negócio ganho → "Gerar obra/projeto" → Wizard → obra/projeto/serviço
        │  escopo, cronograma, avanço & medição, compras
        ▼
[ENTREGA]  ── e o HUB acompanha tudo (governança, indicadores, qualidade) ──┘
```

Cada caixa é um domínio abaixo (§4).

---

## 4. Domínios / Módulos

### A. Comunidade, Academy e Elegibilidade do Membro `[FUTURO — integração]`
- **Onde mora:** sistema **Membros** (homologação/onboarding/comunidade/academy) é **separado e intocável** hoje.
- **O que a plataforma precisa:** um **gate de elegibilidade + migração**. Quando o membro fica elegível (homologado / concluiu critérios de academy), seus dados migram para cá como **fornecedor ativo** apto a receber leads.
- **Requisitos para os devs:**
  - Definir o **contrato de integração** (API ou view compartilhada) Membros → plataforma: identidade da empresa, especialidades, região de atuação, plano, nível na comunidade, status de homologação, avaliação.
  - **Migração idempotente** (reprocessável; sem duplicar fornecedor).
  - O **nível na comunidade / status de homologação** alimentam o **score de distribuição** (§E).
- **Não fazer agora:** reimplementar homologação/onboarding aqui. Só consumir o resultado.

### B. Captação & Canais de Entrada `[PARCIAL]`
- **Função:** registrar de onde vêm os leads e normalizar a `origem`.
- **[JÁ EXISTE]** `hub_canais_entrada` + CRUD + UI `/crm/canais-entrada` (tipo: whatsapp/meta_ads/google_ads/site/indicacao/manual; `origem_slug` alimenta as regras de roteamento). **Não guarda tokens/segredos.**
- **[A CONSTRUIR]** ligação real dos canais: webhook Meta/Google Ads (lead forms), captura de site, e amarração com o pipeline WhatsApp existente.

### C. CRM — Cadastros (estilo Pipedrive) `[PARCIAL]`
Entidades cruzadas e navegáveis em 1 clique: **Pessoa ↔ Empresa ↔ Negócio ↔ Produto**.
- **[JÁ EXISTE]** `hub_pessoas`, `hub_empresas`, `hub_negocios`; códigos atômicos tipo-CPF (`crm_proximo_codigo` + `hub_codigo_contador`, ex.: `PS2026001`, `NGIMB2026001` que embute o mercado); negócio **flexível** (`pessoa_id` e `lead_id` nullable — cria direto, estilo Pipedrive); ficha do negócio com **próxima-ação (auto-save)**, **notas na timeline** e **vínculo pessoa↔negócio (picker)**; listas com **colunas customizáveis**.
- **Mercados** (não catálogo físico ainda): IMB (imobiliário), ARQ (arquitetura), ENG (engenharia), SRV (serviços) + cadeia **projeto→obra→execução** (reforma/marcenaria/marmoraria). **Produto físico = futuro.**
- **[A CONSTRUIR]** fichas de detalhe correlacionadas completas (Pessoa↔Empresa↔Negócio↔Produto navegáveis), campos ricos vindos do Membros, dedup/sugestão de vínculo (IA depois).

### D. CRM — Atendimento / Inbox `[PARCIAL]`
- **Função:** inbox omnichannel (WhatsApp primeiro), qualifica e atende o lead.
- **[JÁ EXISTE]** pipeline WhatsApp → fila → worker → IA; `hub_conversas`, `hub_whatsapp_config`; papel **atendente** no RBAC.
- **[A CONSTRUIR]** unificar inbox com o Lead Vinculado do fornecedor; histórico de conversa visível no lead distribuído.

### E. Motor de Distribuição de Leads `[A CONSTRUIR — base parcial]`
O coração da rede. Detalhe em [memória `distribuicao-leads-motor`].
- **Score de aderência** por: tipo de serviço, cidade/região, especialidade, disponibilidade, capacidade, avaliação, conversão, tempo de resposta, volume recebido, projetos em andamento, ticket médio, qualidade, reclamações, homologação, nível na comunidade, plano, afinidade com o cliente.
- **3 modos:** Automático · Semiautomático (aprovação do Hub) · Manual — coexistem (controlar no início, automatizar com dados).
- **Lead Mestre × Vinculado:** compartilha com **vínculo**, **nunca duplica**; histórico sincronizado; permissões (fornecedor vê o necessário, Hub vê tudo); Hub redistribui.
- **SLA:** prazos (ex.: 1º contato 15min / status 24h / proposta 48h); estouro → IA alerta, lead volta à fila, fornecedor perde score, redistribui.
- **[JÁ EXISTE]** roteamento configurável `resolverDestinoLead` (`hub_lead_routing_regras` + fallback heurístico `resolverAgenteResponsavelLead`).
- **[A CONSTRUIR]** o score multi-critério real, os modos auto/semi, o SLA com redistribuição, o modelo Mestre×Vinculado.

### F. CRM do Fornecedor (pipelines configuráveis) `[PARCIAL]`
- **Função:** cada empresa tem **funil próprio**, configurável por tipo (arquitetura, engenharia, marcenaria têm etapas diferentes).
- **[JÁ EXISTE]** Kanban/pipelines, RBAC 5 níveis (owner/gestor/comercial/financeiro/atendente).
- **[A CONSTRUIR]** pipelines/kanban/listas **editáveis e customizáveis pelo tenant**; recebimento do Lead Vinculado com SLA e score de prioridade.

### G. Gestão de Projeto / Obra / Serviço / Produto `[A CONSTRUIR — base: botão Bloco G]`
Lado "executar". Detalhe em [memória `modulo-engenharia-obra`]. **[JÁ EXISTE]** o botão **"Gerar obra/projeto" no negócio ganho (Bloco G)** — é a porta de entrada deste módulo.

**Dois forks comandam tudo:**
- **Construção × Reforma** — Reforma injeta *Demolição* + campo **"existente (as-found)"**.
- **Com projeto × Sem projeto** — define a **fonte da verdade**: com projeto mede **contra o projeto** (IA lê PDF/DWG/XLSX/IFC-BIM); sem projeto mede **contra o escopo acordado** (IA estima de descrição/área/fotos). Projeto que chega depois → **reconciliação → aditivos**.

**Telas:**
1. **Wizard de obra (5 passos):** Tipo → Origem → Dados+Contrato (cliente do CRM, valor, prazo, forma de medição, BDI, retenção, **papéis** — mín. Eng. responsável; código curto alimenta Compras `CO.<código>`) → confirmar **frentes→itens** (selo Projeto/Estimativa/Aditivo, critério de aceite, evidência) → cronograma+quantitativos+financeiro → **"Criar obra"** gera EAP+cronograma+Curva S+Cockpit.
2. **Escopo & Quantidades (EAP):** frentes→itens **prev×exec×saldo**; aditivos recalculam tudo; saldo → **requisição de compra 1 clique**.
3. **Cronograma & Curva S:** Gantt + caminho crítico + **previsão de atraso pelo ritmo real**; baseline travada + revisões rastreáveis; vínculo **cronograma↔compra↔avanço**.
4. **Avanço & Medição:** avanço físico → **faturamento**; **regra dura: medido nunca passa do contratado sem aditivo aprovado**; retenção controlada; gates **Rascunho→técnico(Eng)→cliente/fiscal→financeiro**; Curva físico-financeiro (previsto×realizado×medido×faturado); medição aprovada → **conta a receber**.

- **Serviço/Produto:** mesmo motor, escopo mais simples (serviço pontual; produto físico = futuro).
- **[PENDENTE — Wendel ainda vai detalhar]** módulo **Compras** (`CO.<código>`, requisição por saldo, lead time longo) — citado, não especificado.

### H. IA-first & Agentes `[FUTURO — deixar pronto]`
- **A IA deve operar:** consultar dados, criar tarefas, mover etapas, gerar propostas, sugerir fornecedores, apontar risco, cobrar atualização, gerar relatórios, criar agentes, acionar integrações. Comandos conversacionais (ex.: "redistribua leads sem resposta há 24h", "qual parceiro converte mais em obras > R$100k").
- **Relatórios/Analytics = GENERATIVOS sob demanda** (gerados em tempo real pela IA), não dashboards estáticos.
- **[JÁ EXISTE]** camada de agentes (provider Mistral-first; Anthropic integrado mas **dormente**, chave vazia).
- **Regra:** **arquitetura provider-agnóstica pronta agora**; **ativar Anthropic/Bloco H é futuro** (depende de chave + GO de custo). **Não ligar IA antes do manual estar bom.**

### I. Integrações (API-first) `[FUTURO — prever desde já]`
Arquitetura **API-first**; mesmo que a integração venha depois, prever: WhatsApp, e-mail, Google Calendar/Drive, **Pipedrive, RD Station**, **Meta Ads, Google Ads**, **Zapier/n8n/Make**, ERP financeiro, assinatura digital, gateways de pagamento.

### J. Governança do Hub `[A CONSTRUIR]`
Visão "por cima": todos os leads/negócios/obras de todos os fornecedores; indicadores (conversão, SLA, ranking, qualidade); redistribuição; performance por fornecedor. **Menu "Fornecedores" é o motor desta camada** (Empresas Homologadas, Banco de Mão de Obra, Distribuição de Leads, Performance, Ranking, SLA, Homologação).

---

## 5. Papéis e permissões (RBAC) `[JÁ EXISTE]`
5 níveis em `lib/crm/crm-permissoes.ts`: **owner · gestor · comercial · financeiro · atendente** (rank linear + funções ortogonais, ex.: Financeiro é função própria). Owners fixos por allowlist. Guards por rota (`crmPodeVerRota`, `ROTA_MIN_NIVEL`). **Estender** para: papéis do lado **obra** (Eng. responsável, Gestor de obra, Compras, SST, Campo) e separação **Hub (governança) × Fornecedor (operação)**.

---

## 6. Multi-tenant & Segurança `[JÁ EXISTE — manter rigor]`
- Toda tabela carrega `tenant_id`; RLS padrão `using (tenant_id = public.current_user_tenant_id() or tenant_id is null)`; helper SECURITY DEFINER.
- **Travas:** nunca expor PII a `anon`; sem tokens/segredos no banco/Git; migrações **aditivas/reversíveis**; aprovação humana para dados sensíveis.
- O modelo **Lead Mestre × Vinculado** exige política de permissão fina (fornecedor vê só o seu; Hub vê tudo).

---

## 7. Regras transversais (valem para todo o sistema)
1. **A IA preenche, o humano confirma.** Todo campo derivado por IA mostra **origem + confiança** (alta/média/baixa) e corrige em 1 toque. Nada derivado grava sem confirmação.
2. **Aprovação humana obrigatória** em: valor de contrato, prazo, distribuição financeira, critério de aceite, mudança de baseline, **aditivo**, e cada **gate** de medição.
3. **Rastreabilidade:** cada valor derivado guarda de onde veio (arquivo + página/linha) para auditoria.
4. **Sem evidência → item bloqueado** (com "dívida de evidência" condicional para não travar o campo, mas destacado até regularizar).
5. **Nunca medir/executar além do contratado** sem aditivo aprovado.
6. **Mobile = campo** (anexa evidência, marca avanço, por voz/foto); **desktop = montar/aprovar** boletim, replanejar, editar escopo estrutural.
7. **Salvamento contínuo** (rascunho por passo; sair e voltar não perde nada).

---

## 8. Menu lateral alvo `[A CONSTRUIR — próxima tarefa]`
Reorganizar para refletir a plataforma (base: análise "P1" já feita + `lib/crm-nav-groups.ts`):

```
Central IA            (visão + comandos conversacionais — futuro)
Comercial / CRM       (Leads, Negócios, Pessoas, Empresas, Pipelines, Atendimento/Inbox)
Operações / Obras     (Projetos, Obras, Serviços, Escopo, Cronograma, Medição, Compras)
Fornecedores          (Empresas Homologadas, Banco de Mão de Obra, Distribuição de Leads,
                       Performance, Ranking, SLA, Homologação)   ← motor da rede
Financeiro            (Contas a receber, retenção, faturamento)
IA e Agentes          (agentes, ciclos, ferramentas — futuro)
Comunidade            (ponte Membros)
Marketing             (canais de entrada, tráfego)
Administração         (usuários, empresas, integrações, configurações)
```
Respeitar o **design system Obra10+** (dark verde+dourado tokenizado; **não** o azul/Shadcn genérico).

---

## 9. Modelo de dados (alto nível)
**[JÁ EXISTE]** `hub_pessoas`, `hub_empresas`, `hub_negocios`, `hub_atividades` (timeline; tem `negocio_id`+`lead_id` nullable), `hub_canais_entrada`, `hub_lead_routing_regras`, `hub_especialistas`, `hub_fornecedores`, `hub_codigo_contador`, `hub_conversas`, `hub_whatsapp_config`.

**[A CONSTRUIR]** (nomes sugeridos): `hub_fornecedor_score` / critérios; `hub_lead_distribuicao` (Mestre×Vinculado + SLA + estado); `hub_obras`, `hub_obra_frentes`, `hub_obra_itens` (prev/exec/saldo), `hub_medicoes` + itens, `hub_aditivos`, `hub_cronograma` (atividades/dependências/baseline), `hub_compras` (`CO.<código>`), `hub_evidencias`. Tudo `tenant_id` + RLS.

---

## 10. Faseamento e prioridades
**Norte do cliente:** entregar o sistema **rodando MANUALMENTE**, fácil e intuitivo, **UI/UX antes da IA**. Arquitetura pronta para IA-first, mas IA **ligada depois**.

| Fase | Entrega | IA? |
|------|---------|-----|
| **0 — feito** | CRM manual: cadastros, negócio flexível, roteamento, canais, ficha do negócio | não |
| **1 — agora** | **Menu lateral** reorganizado + navegação coerente da plataforma | não |
| **2** | Cadastros Pipedrive completos (fichas correlacionadas) + CRM do fornecedor com pipelines customizáveis | não |
| **3** | Motor de distribuição (score + modos + SLA + Mestre×Vinculado) + Governança/Fornecedores | não |
| **4** | Gestão de Obra (Wizard + 4 telas) + Compras | não |
| **5** | Ponte Membros → elegibilidade/migração de fornecedor | não |
| **6 — [FUTURO]** | **IA-first** (operacional + conversacional + relatórios generativos) — Bloco H/Anthropic | **sim** |

(Integrações API-first: arquitetura prevista desde a Fase 2; ligações reais conforme necessidade.)

---

## 11. Estado atual do código (grounding)
- **Stack:** Next.js 16 (App Router) + Supabase (projeto "SISTEMA OBRA10+", ref `cdjlqsznerdhwqyunodl`). Branch ativa `wendel/dev` (base `feature/escritorio-visual`).
- **Já implementado e provado nesta sessão (local, sem deploy):** especialistas/fornecedores editáveis; negócio flexível (Pipedrive); roteamento de leads configurável; canais de entrada (CRUD); colunas customizáveis; ficha do negócio (próxima-ação auto-save, nota na timeline, vínculo pessoa); **fix do login** (lia autofill do DOM); **fix de drift** em `hub_atividades` (faltava `negocio_id`; `lead_id` agora nullable).
- **Mudanças de schema aplicadas** (aditivas/reversíveis): documentadas em `docs/sql/*-APPLIED.sql`.
- **Design system:** dark verde+dourado tokenizado (`globals.css`, tokens `--obra-*`/`--brand-*`). Manter.

---

## 12. Decisões em aberto (resolver com o Wendel)
1. **Módulo Compras** — ainda não detalhado pelo cliente (bloco futuro).
2. **Contrato exato da migração Membros → fornecedor** (API vs. view; quais campos; gatilho de elegibilidade).
3. **Granularidade de permissão Mestre×Vinculado** (o que o fornecedor vê do lead).
4. **Onde o "produto físico" entra** (catálogo) — hoje "mercado", produto físico é futuro.

---

## 13. Travas operacionais (para qualquer dev/IA neste repo)
- Mexer **somente** no projeto `-ramon`. **Sem push** sem ordem. **Sem secrets** no Git/banco.
- Migrações **aditivas e reversíveis**; rotas autor/admin-only; validar com `tsc` + testes + `_chk23`.
- **Aprovação humana** para: exclusão de dados, mudança irreversível, custo financeiro, credenciais, produção.

---

### Próxima sessão começa por…
**Fase 1 — arrumar o menu lateral** (§8), respeitando o design system, e **expandir esta instrução** por módulo conforme o Wendel detalhar (Compras, integração Membros). Contexto durável na memória: `plataforma-arquitetura-visao`, `distribuicao-leads-motor`, `modulo-engenharia-obra`, `sessao-entregas-jun2026`, `crm-cliente-final-foco`.

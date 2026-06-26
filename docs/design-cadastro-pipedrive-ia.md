# Design — Cadastro relacional estilo Pipedrive + campos Membros + IA-first

**Data:** 2026-06-24 · **Escopo:** CRM cliente-final (`-ramon`) · **Status:** plano (aguardando GO; nada codado)

## Princípio
Pessoa ↔ Empresa ↔ Negócio **cruzados e navegáveis em 1 clique** (modelo Pipedrive),
com **campos ricos do sistema Membros**, **rastreio por código tipo-CPF** (já implementado:
PS2026001 / NGIMB2026001), e **IA-first + conversacional** tecida em cada ponto. Negócio é o centro.

## Foco de mercado (o "produto" agora)
O produto inicial **são os mercados de atuação**, não um catálogo de produtos físicos:
**Imobiliário (IMB) · Arquitetura (ARQ) · Engenharia (ENG) · Serviços (SRV)** + a cadeia
**projeto → obra → execução** (reforma/obra RFM, **marcenaria** MRC, marmoraria e demais serviços).
~80% da entrada inicial é **projeto e obra** (e a execução decorrente). **Produto/catálogo físico
(PRO) e fornecedores (FOR) = futuro.** Os 8 pipelines por mercado já existem; o foco operacional
são IMB/ARQ/ENG/SRV + RFM/MRC.

## Analytics & Relatórios GENERATIVOS (sob demanda, via Anthropic/Claude)
As telas de **Relatórios e Analytics não são dashboards estáticos** — são **geradas sob demanda,
em tempo real, pela Anthropic (Claude)**: o usuário pergunta (conversacional) ou abre "Analytics",
o sistema reúne os dados relevantes (negócios/leads/funil por mercado), envia ao Claude com o
contexto, e Claude devolve **análise + narrativa + specs de gráfico + tabela**, customizado e
personalizado, renderizado na hora. O dashboard fixo atual vira só "vista rápida"; o profundo é gerado.
*(Depende do Bloco H — chave Anthropic + GO de custo. Arquitetura desenhada provider-agnóstica:
camada de "analytics agent" pronta agora; Claude pluga quando a chave existir.)*

## Mapa Pipedrive → -ramon (o que já existe)
| Pipedrive | -ramon hoje | Lacuna |
|---|---|---|
| Person / Organization / Deal | `hub_pessoas` / `hub_empresas` / `hub_negocios` (liga pessoa_id, empresa_id, lead_id) | vínculo do negócio é **rígido** (pessoa_id NOT NULL) |
| Lead Inbox → Deal | `hub_leads_crm` + converter-negocio | ok |
| Products no Deal (line items) | `hub_servicos` / catálogo parcial | falta **itens do negócio** (qtd×preço) |
| Activities / Timeline | `hub_atividades` (lead/negocio/pessoa) | falta **timeline unificada** na ficha |
| Pipeline Kanban | pipelines por mercado (negócio já auto-resolve) | ok |
| Detail view correlacionada | telas existem isoladas | falta o **cruzamento navegável** |

---

## Fase 1 — Modelo relacional (fundação, migrações aditivas)
1. **Vínculo flexível do negócio:** relaxar `hub_negocios.pessoa_id` para nullable → negócio liga
   **pessoa E/OU empresa** (como Pipedrive). Manter a regra "ganho exige pessoa" só na transição
   para ganho (não na criação). *Risco:* checar dependências da NOT NULL (validação de ganho).
2. **Pessoa ↔ Empresa:** consolidar `hub_pessoas.empresa_id` como empresa primária + permitir
   uma pessoa aparecer nos contatos de uma empresa.
3. **Itens/escopo do negócio (serviços e etapas de obra — não catálogo de produto):** tabela
   `hub_negocio_itens` (negocio_id, descricao, servico_id?, quantidade, preco_unit, total, tenant_id)
   p/ compor o valor do negócio por **serviço/etapa** (projeto, execução, marcenaria, marmoraria…).
   Produto físico/catálogo (PRO) fica para depois.
4. Tudo tenant-scoped + RLS (mesmo padrão do Bloco E) + códigos (SV serviço; PD produto = futuro).

## Fase 2 — Fichas de detalhe correlacionadas (a "mágica" do Pipedrive)
- **Ficha do Negócio:** centro + painéis laterais → **Pessoa** (card clicável), **Empresa**,
  **Produtos/itens**, **Timeline** (atividades + mudanças de etapa), **próxima ação**. Botões
  rápidos: ligar pessoa/empresa, adicionar produto, registrar atividade, marcar ganho/perda.
- **Ficha da Pessoa:** dados + Empresa + **lista de Negócios** + Atividades + timeline.
- **Ficha da Empresa:** dados + **Contatos (pessoas)** + Negócios + Atividades.
- Navegação 1-clique entre fichas (por código/id). Reusar o `⌘K` para pular entre entidades.

## Fase 3 — Campos ricos (Membros) + catálogo de serviços
- Pessoa/Empresa ganham os campos úteis do Membros (mercados, área, origem, documento, endereço,
  redes) — só o que faz sentido para cliente-final (homologação fica no CRM de Membros).
- Catálogo de **serviços** (`hub_servicos`) por mercado (projeto, execução, marcenaria, marmoraria…)
  com preço/unidade, p/ alimentar os itens do negócio. Produto físico = futuro.

## Fase 4 — IA-first + CONVERSACIONAL (espinha do produto; heurística → Claude)
- **No cadastro:** dedup automática (telefone/CPF/CNPJ), **sugestão de vínculo** (essa pessoa é
  desta empresa?), enriquecimento, normalização. *(heurística pura primeiro — sem custo.)*
- **No negócio:** IA sugere **escopo/serviços**, **próxima ação**, **resumo da timeline**, score.
- **Camada conversacional:** o usuário conversa ("como está o funil de arquitetura?", "resume esse
  negócio") e a IA responde com dados reais + ações. ⌘K evolui para busca + comandos por linguagem.
- **Analytics/Relatórios generativos** (ver seção acima): Claude gera a análise/tela sob demanda.
- Provider: hoje Mistral; **Anthropic/Claude dormente (Bloco H — precisa chave + GO de custo)**.
  Toda a camada IA é desenhada **provider-agnóstica**: pronta agora (heurística/Mistral), e o
  **Claude pluga** quando a chave existir — é o que destrava o analytics generativo e o conversacional.

## Abordagem escolhida (GO 2026-06-24) + sequência otimizada
**Decisão:** construir a **arquitetura IA-first provider-agnóstica agora** (heurística/Mistral),
e o **Claude pluga no Bloco H** (chave + custo) sem refatorar.

**Otimização-chave — uma camada de IA única:** interface `assistirIA({ intent, contexto, dados })`
provider-agnóstica que serve os 4 usos com a mesma plumbing — (a) sugestão no cadastro
(dedup/vínculo), (b) próxima-ação/resumo do negócio, (c) **analytics generativo**, (d) conversa.
Hoje resolve por heurística; troca o "motor" para Claude no Bloco H. Evita 4 implementações.

**Reuso (já pronto):** códigos tipo-CPF, pipeline-por-mercado, `hub_atividades`, `⌘K` (estender).

**Ordem de execução:**
1. **F1.1 — vínculo flexível** do negócio (pessoa **e/ou** empresa; relaxar `pessoa_id NOT NULL`). Rápido, destrava criação.
2. **F2 — ficha do Negócio correlacionada** (pessoa + empresa + timeline + próxima-ação navegáveis). Maior impacto.
3. **IA hooks (heurística)** desde a F1: dedup por telefone/CPF/CNPJ, sugestão de vínculo.
4. **F1.3 — itens/escopo** (serviços) quando a ficha pedir.
5. **Camada conversacional + analytics generativo:** stubs provider-agnósticos agora; **ativam no Bloco H** (Claude).

Cada passo: migração aditiva + prova logada + commit local (sem deploy).

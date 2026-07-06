# Pendências — Backlog Triado (inventário acurado)

> **O que é.** Inventário único, acurado e triado de TODAS as pendências acumuladas (maratonas anteriores + atuais), lido das fontes reais (docs canônicos, memos, grep do código). Base para "acabar com as pendências com segurança, consistência, pragmatismo e CERTEZA".
>
> **Como ler.** Cada item tem: **categoria · fonte/evidência · esforço (P/M/G) · ação recomendada**.
> **Categorias:** 🟢 AUTÔNOMO (eu fecho sem o dono) · 🔴 DEPENDE DO DONO (migração prod / secret / decisão de negócio / validação) · ⚠️ SEGURANÇA (sempre destacado).
> **Esforço:** P = ≤meio dia · M = 1–2 dias · G = fatiar.
>
> **Gerado:** 2026-06-29. Fontes: `docs/PENDENCIAS.md`, `docs/DIVIDAS-TECNICAS.md`, `docs/PLANO-EXECUTIVO-BLOCOS.md`, memos de memória, grep do código.
> **Trava de método:** aditivo · gates (tsc+vitest+_chk23) · sem push sem ordem · migrações aditivas/reversíveis com o dono.

---

## ✅ JÁ RESOLVIDO em maratonas recentes (não retrabalhar)

Itens que apareciam como pendência em memos antigos mas o código/SQL atual já fechou — verificado nesta varredura:

| Item | Evidência atual |
|---|---|
| Blindagem do `x-tenant-id` forjável (furo do header) | `lib/tenant-default.ts:70` `tenantIdFromRequest` só honra header com `x-api-key`=INTERNAL; senão cai no default. Furo fechado. |
| Especialistas: coluna CPF + dedup por CPF | `docs/sql/PENDENTES-aplicar-no-fim.sql` [1] = APLICADO; `app/api/crm/especialistas/route.ts:51-62` deduplica CPF por tenant (409). |
| RLS CRM core (deny-all + hub_negocios INSERT/UPDATE) | `docs/sql/20260624-rls-crm-core-close-holes...sql` = APLICADA 25/jun (3 policies verificadas). |
| RLS `hub_pipeline_estagios` tenant-aware | `docs/sql/20260624-rls-pipeline-estagios-tenant-APPLIED.sql`. |
| Renomeação nav Operações/Arquitetura/Engenharia (nível de rótulo) | `lib/crm-nav-groups.ts:99-110` (grupo "Operações"; "Arquitetura"→/crm/projetos; "Engenharia"→/crm/obras). **Falta só** a hierarquia de sub-itens (ver AUT-9). |
| Escritório virtual `/office` legado | `app/office/page.tsx` redireciona p/ `/crm` (desativado, opção A). |
| Fase 3a — 4 itens de higiene/honestidade da medição | `docs/DIVIDAS-TECNICAS.md` §"Fase 3a" diz "JÁ corrigidos"; restam só (a)-(e) abaixo. |
| Higiene de leads de teste (144→6 mocks) | `PENDENTES-aplicar-no-fim.sql` [2] APLICADO, com backup restaurável. |

---

## ⚠️ SEGURANÇA (destacar SEMPRE — triar com cuidado)

| # | Título | Categoria | Fonte/evidência | Esf. | Ação recomendada |
|---|---|---|---|---|---|
| SEC-1 | **`lib/ia/aprovacoes.ts` + `/api/hub/aprovacoes` sem `.eq('tenant_id')`** — vazamento cross-tenant LIVE; o escrow leva dinheiro pro gate | ⚠️🔴 | `docs/DIVIDAS-TECNICAS.md` §multi-tenant ("Sendo corrigido no E6/F0") | M | **Verificar se o E6/F0 já fechou.** Se não, aplicar a regra `tenant-null-leak-pattern` (`.eq` puro + guarda `!==`→404). É dinheiro → prioridade máxima. |
| SEC-2 | **`tenantScopeOrFilter` inclui o tenant legado** (lê tenant atual + NULL + DEFAULT) | ⚠️ | `lib/tenant-default.ts:55` (`tenant_id.eq.DEFAULT...`); `docs/DIVIDAS-TECNICAS.md` | M | Inócuo em single-tenant/seed global. **Resolver antes** de taxonomia/catálogo terem registros `origem='tenant'` real. Backfill NULL→default e remover `is.null` do scope. |
| SEC-3 | **Padrão sistêmico `tenant_id IS NULL` legado** (service-role bypassa RLS) | ⚠️ | memo `tenant-null-leak-pattern`; recorrente em E0/A0 | — | **Regra permanente, não tarefa única:** toda rota/tool/migração nova que toca `hub_*` usa `.eq('tenant_id')` puro + guarda `!==`→404 + backfill + RLS na tabela nova. Auditar em todo build. |
| SEC-4 | **RLS `anon` ausente** nas tabelas novas de E5 (`hub_pedido_itens`, `hub_estoque_mov`) e do módulo obra | ⚠️ | `docs/DIVIDAS-TECNICAS.md` §multi-tenant | P | Padronizar `ENABLE RLS` + policy quando o módulo for endurecido (service-role + `.eq` já protege hoje). Defesa em profundidade. |
| SEC-5 | **`/redefinir-senha` não pede senha atual** ao trocar com sessão ativa | ⚠️🔴 | `app/redefinir-senha/page.tsx:71` (`updateUser({password})` sem check); `docs/PENDENCIAS.md` §Segurança | P | Quando criar "trocar senha **dentro do app**", exigir reautenticação (senha atual). Hoje o fluxo é só recovery-link (aceitável). É gatilho ao construir a feature in-app. |
| SEC-6 | **Multi-tenant real não existe** (`current_user_tenant_id()` hardcoded p/ 1 tenant; sem `fornecedor_id`; `is_hub_admin()` aponta p/ roles que ninguém tem) | ⚠️🔴 | `docs/PLANO-EXECUTIVO-BLOCOS.md` Bloco 3.9; memo `multitenant-golive-plano` | G | **DEPENDE DO DONO** (decisão modelo parceiro A/B + janela de migração irreversível). Já escolhido (A) tenant próprio; Fase 1 ~55% feita. Ver DONO-1. |
| SEC-7 | **Tools de escrita da IA não gravam auditoria** em `hub_acoes_ia`/`hub_memorias_agente` | ⚠️ | `docs/DIVIDAS-TECNICAS.md` §E3 | M | Lacuna sistêmica (E0/E2/E3). O loop de aprendizado da Central de Aprovações depende disso. Resolver junto da Central de Aprovações. |
| SEC-8 | **Snapshot de custo falha em silêncio** (`console.warn`) — custo não-materializado some do radar | ⚠️🟢 | `app/api/aprovacoes/[id]/route.ts:113`; `lib/ia/aprovacoes.ts`; `docs/DIVIDAS-TECNICAS.md` §Fase 3a (c) | P | Registrar a falha do `rpc_snapshot_custo_frente` em `hub_decision_logs` (ou tabela de reconciliação) p/ conciliar depois. Não é vazamento, mas é integridade financeira → tratei como segurança. |

---

## 🟢 AUTÔNOMO — ordenado por (segurança > valor > esforço baixo)

| # | Título | Fonte/evidência | Esf. | Ação recomendada |
|---|---|---|---|---|
| AUT-1 | **Snapshot de custo falha em silêncio → logar p/ reconciliação** | `app/api/aprovacoes/[id]/route.ts:113`; DIVIDAS §Fase 3a (c) | P | (= SEC-8) Gravar falha do RPC em `hub_decision_logs`. Integridade financeira, esforço baixo → fazer primeiro. |
| AUT-2 | **Gap do cadastro automático (código único): intake de formulário insere lead SEM criar/vincular pessoa e SEM deduplicar por telefone** → lead duplicado sem código PES | `docs/PENDENCIAS.md` §"ACHADO IMPORTANTE Passo 4"; `lib/crm/lead-cadastro.ts` (sem person-linking — confirmado: helper não existe) | M | Extrair `garantirPessoaParaLead(telefone/doc, nome)` (reusa a lógica do super-cadastro) e plugar em `/api/leads`, `/api/crm/leads`, ingestor Meta. Backend sensível → **com vitest + mesa de merge-safety**. Alto valor (fere a codificação única). |
| AUT-3 | **Histórico de medição append-only sem UI** (o GET já existe, nenhuma tela consome) | DIVIDAS §Fase 3a (b); `GET /api/crm/obras/[id]/medicoes` | M | Seção "Medições do item" read-only (data, autor, qtd, pct, foto, observação) — a prova visível do "nada-se-perde". |
| AUT-4 | **`GET /medicoes` com `.limit(500)` sem paginação** → trunca silencioso em obras longas | DIVIDAS §Fase 3a (d) | P | Paginação por cursor (`criado_em`/`id`). Fazer junto de AUT-3 (mesma tela). |
| AUT-5 | **Default de etapa / valores crus / drift de cor residuais** — varrer telas de detalhe (shell) ainda não tokenizadas | memo `design-overhaul-deferido` (cor concluída em listas; **detalhe + telas fora do CRM não escaneadas**); DIVIDAS §Fase 3a (e) `CadastroPremiumSideover` herda azul Shadcn | M | Tokenizar `--obra-*` no shell das telas de detalhe (agentes/[slug], parceiros/[id], leads/[id], Aprovações) + `CadastroPremiumSideover`/`DrawerMedir`. Telas fora do CRM (`app/parceiro`, onboarding) ainda azuis. Fatiar por tela. |
| AUT-6 | **Foto da medição é `type=url` — falta upload nativo de câmera** | DIVIDAS §Fase 3a (a); `DrawerMedir` | M | `<input type="file" accept="image/*" capture="environment">` + upload p/ Supabase Storage (bucket de medições) → grava `foto_url`. **Decidir o bucket com o dono** (criar bucket = config) → tem aresta 🔴, mas a UI é autônoma. |
| AUT-7 | **`idx_taxonomia_tenant` redundante** com o prefixo do UNIQUE (custo de escrita à toa) | DIVIDAS §EAP | P | `DROP INDEX` na próxima migração de taxonomia (aditiva/reversível). |
| AUT-8 | **Wizard EAP não expõe ambiente-first no passo 3** (só na aba Itens) | DIVIDAS §EAP | P | Melhoria de UX no wizard de obra. |
| AUT-9 | **Sub-itens de navegação Arquitetura>Projetos / Engenharia>Construção+Reforma** (hoje é só rótulo) | memo `navegacao-renomear-...`; `lib/crm-nav-groups.ts:104` (comentário "sub-itens futuros entram quando as telas existirem") | M | Aninhar sub-itens quando as telas separadas (Construção/Reforma) existirem — **acoplado ao Bloco 6**. Hoje correto não ter (evita menu morto). Registrar como gate do B6, não fazer solto. |
| AUT-10 | **Vínculo N:N pessoa↔empresa real** (hoje `hub_pessoas.empresa_id` é 1:1) + UI bidirecional nos 3 cadastros | memo `vinculos-nn-pessoa-empresa-negocio`; `hub_negocio_vinculos` já existe | G | Modelo N:N (tabela nova OU generalizar `hub_negocio_vinculos`) — **decidir o modelo com o dono** (tem aresta 🔴). UI Click-and-Go (picker) nas 3 fichas. Fatiar. |
| AUT-11 | **Pickers de participantes do Negócio = `<select>` com 100+ itens** → combobox com busca | `docs/PENDENCIAS.md` §Negócios ("PRECISA-DESIGN") | M | Combobox com busca nos pickers de participantes + simplificar "Checklist operacional". UX puro. |
| AUT-12 | **Saída/Devolução de estoque compartilham handler** (abre sempre 'saida') | DIVIDAS §Compras | P | Prop trivial p/ distinguir saída × devolução. |
| AUT-13 | **`ConfidenceBadge.onCorrigir` não ligado** + SmartField não integrado nos forms críticos | `docs/PENDENCIAS.md` §UX; `docs/PLANO-EXECUTIVO-BLOCOS.md` B2 ("⏸ gated") | M | **Gated** pela decisão faixas×exato e voz (🔴 dono). Até lá, Click-and-Go (chips) carrega. Não é puro autônomo — depende de DONO-3. |
| AUT-14 | **Mapear `error.message` do Supabase → mensagens PT amigáveis no login** | `docs/PENDENCIAS.md` §UX | P | Dicionário de erros → PT-BR no login. UX baixo esforço. |
| AUT-15 | **Limpeza do catálogo de cargos** (`hub_cargos_catalogo`): cargo `mari_...` com nome de agente; redundâncias SDR/Atendente; cargos não usados | memo `pendencias-etapa-copiloto-agentes`; dono: "por hora está bom, fazer com sinal" | P | É UPDATE no DB (reversível: `ativo=false`). **Esperar sinal do dono** → tem aresta 🔴 (decisão de quais desativar). Renomear o `mari_` é seguro-agora. |
| AUT-16 | **Rotas legadas `/comando` e `/agentes` sobre mock data** (`components/office/*`, `lib/data/*-mock.ts`, `ALERTS_MOCK`, `MOCK_TASKS`) | grep: `app/comando/page.tsx`, `app/agentes/page.tsx` importam `components/office/*`; `/office` já redireciona | P | Decidir: remover (o `/office` já foi desativado p/ `/crm`) ou manter. **Não estão no menu**; risco = código morto confundindo. Recomendo remover as rotas + mocks órfãos após confirmar zero uso. Verificar `app/agentes` vs `/crm/agentes` (nomes colidem). |

---

## 🔴 DEPENDE DO DONO (migração prod / secret / decisão de negócio / validação)

| # | Título | Fonte/evidência | Tipo | Ação |
|---|---|---|---|---|
| DONO-1 | **Multi-tenant real (Bloco 3.9 + janela de migração irreversível)** | PLANO B3.9; memo `multitenant-golive-plano` | Migração prod + decisão | Modelo (A) tenant próprio já escolhido; Fase 1 ~55% (blindagem feita, ~14 rotas restam). Janela irreversível (`tenant_id` em hub_alertas/ciclos, UNIQUE por-tenant, DROP dos globais, backfill) **só com o dono presente**. Resume com `git push` + completar Fase 1. |
| DONO-2 | **Secrets no Render: `MISTRAL_API_KEY` + `COPILOTO_HMAC_SECRET`** | memos `pendencias-etapa-copiloto-agentes`, `copiloto-voz-global` | Secret | Mistral já ligada 28/jun (validar — ver DONO-8). COPILOTO_HMAC_SECRET: sem ela o copiloto retorna 503 (fail-closed). Confirmar presença. |
| DONO-3 | **Decisão UX: `valor_estimado` faixa × valor exato** (+ SmartField modo "faixa" ordinal) | `docs/PENDENCIAS.md` §UX; PLANO B2 | Decisão produto | Destrava AUT-13 (integrar SmartField nos forms). |
| DONO-4 | **Voz (Talk-and-Go): on-device × serviço** (custo/privacidade) | `docs/PENDENCIAS.md` §UX; PLANO §decisões | Decisão produto | "No fim" do roadmap. SmartField já mostra selo "em breve". |
| DONO-5 | **Config Supabase Auth: Redirect URLs + SMTP próprio + rate limits + password policy** | `docs/PENDENCIAS.md` §Configuração | Config BaaS | Sem SMTP, "Esqueci minha senha" não envia e-mail de verdade. Trocar a senha `A12345679` (foi exposta no chat). |
| DONO-6 | **Credenciais Meta (Lead Ads/DM)** p/ o intake automático | `docs/PENDENCIAS.md` §Passo 4 | Secret | Trava do dono; lead hoje entra por formulário + WhatsApp. |
| DONO-7 | **Elo Comunidade(Membros)→CRM** (push/pull/link) — PARADO até o dono explicar | memo `comunidade-elo-crm-pendente` | Decisão produto | Plano pronto (webhook HMAC). NÃO agir até ele explicar. |
| DONO-8 | **Validar IA ao vivo em PROD** (3 testes: gerar fluxo, atendimento WhatsApp, copiloto de voz) | memo `testes-ia-pendentes-validar-com-dono` | Validação | O dono pediu p/ lembrar; fazer JUNTO. Corrigir na hora se der erro. |
| DONO-9 | **Decisões de negócio (comissão/spread/KPIs)** | DIVIDAS §"Decisões de NEGÓCIO"; PLANO B5.5 | Decisão | Comodato · frete Lalamove (repasse×spread) · KPIs iniciais · spread por modelo de contrato · qtd_padrão taxonomia · política entregue×aprovado no "Gerar Obra" · mapa tipologia→tipo_obra. |
| DONO-10 | **Enriquecer taxonomia/presets EAP** (cobre 5/15 disciplinas; presets comercial/PDV esqueléticos) | DIVIDAS §EAP | Conteúdo + dono | Semear as outras 10 disciplinas antes do Orçamento IA depender delas. |
| DONO-11 | **Validação visual mobile** das telas de cadastro (desktop OK) + `/redefinir-senha` (depende de SMTP) | `docs/PENDENCIAS.md` §Validação; PLANO B2 | Validação | Spot-check mobile dos 4 criadores (mesmo SmartField, alta confiança). |
| DONO-12 | **`hub_obras.projeto_id` + UNIQUE** (FK reversa) — mata a race do elo criar-obra→PATCH | DIVIDAS §Elo/A2 | Migração | Requer migração (sai do escopo zero-migração de A2). Aditiva/reversível, mas é schema → com o dono. |
| DONO-13 | **Fase 6 copiloto: seed `hub_agente_identidade` + coluna `setor_ia`** | memo `copiloto-voz-global` | Migração | Sistema funciona 100% sem ela (otimização). `setor_ia` já aplicada no caso dos agentes; o seed `copiloto-global` foi DEFERIDO (seria schema morto — não refazer sem necessidade). |
| DONO-14 | **Backfill `pipeline_id`** em leads/negócios antigos | `docs/PENDENCIAS.md` §Segurança multi-tenant | Migração | Agrupar com o trabalho de RLS de pipelines. |
| DONO-15 | **Follow-up customizável** (cadência, nº de tentativas, gatilhos) | memo `pendencias-etapa-copiloto-agentes` (#6) | Feature + decisão | É feature, não troca de texto. Propor desenho quando o dono quiser. |

---

## Resumo executivo

- **🟢 AUTÔNOMO:** 16 itens (alguns com pequena aresta de decisão — marcados).
- **🔴 DEPENDE DO DONO:** 15 itens.
- **⚠️ SEGURANÇA:** 8 itens (3 deles também AUTÔNOMOS ou DONO; SEC-1 é o mais grave).
- **✅ Já resolvido (não retrabalhar):** 8 itens verificados nesta varredura (memos estavam stale).

**Sequência recomendada (autônomo):** AUT-1 (integridade financeira, P) → AUT-2 (código único, M, alto valor) → AUT-3+AUT-4 (histórico de medição + paginação, M) → AUT-6 (foto nativa, M) → AUT-5 (shell de detalhe / cor, M) → AUT-11/AUT-14/AUT-7/AUT-8/AUT-12 (UX e higiene, P).

**Antes de qualquer build:** confirmar SEC-1 (aprovações cross-tenant) — é o único vazamento LIVE com dinheiro envolvido.
</content>
</invoke>

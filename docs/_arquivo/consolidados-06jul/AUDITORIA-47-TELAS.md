# Auditoria 47 telas — Obra10+ (26/jun/2026, workflow multi-agente)

Tenho os números. Aqui está o relatório consolidado.

---

# AUDITORIA DE 47 TELAS — CRM OBRA10+
### Relatório do Revisor-Chefe / CEO de Produto

## 1. VEREDITO GERAL

**Nota média: 6.8 / 10** (47 telas auditadas)

| Classificação funcional | Qtd | % |
|---|---|---|
| **real** (funciona de verdade ponta a ponta) | 36 | 77% |
| **parcial** (funciona, mas com gap pontual de fachada/UX) | 8 | 17% |
| **stub** (placeholder / tabela fantasma / "em breve") | 3 | 6% |

**Distribuição de notas:** 11 telas ≥8 · 18 telas entre 7–7.9 · 13 telas entre 5–6.9 · **5 telas abaixo de 5** (zona vermelha).

**Honestidade direta: o sistema está MAJORITARIAMENTE SÓLIDO, não é fachada.** 77% das telas são reais — carregam dados reais, persistem em endpoints reais, recarregam. A espinha dorsal comercial (atendimento 9.0, dashboard 8.5, cadastro 8.5, ferramentas 8.5, analytics 8.5, financeiro 8.2) está apresentável e usável por cliente real. A fachada está **concentrada e identificável**: 3 telas stub (tarefas, agentes-reais, conteúdo) + 5 defeitos pontuais críticos. Não é um produto Potemkin; é um produto bom com bolsões de dívida bem delimitados.

**O que segura a nota em 6.8 e não em 8:** (a) o módulo de **obra/execução está cru** (obras 5.5, obra/[id] 3.5, projetos 5.5, pedidos 5.5) — é a metade "executar" da visão Hub→vender→executar, e ela ainda não está pronta; (b) **lacunas de segurança multi-tenant** em 2 rotas (nota de negócio, especialistas/[id]); (c) o produto se vende como **IA-first/Click-and-Go** mas várias telas centrais são formulários manuais sem nenhuma camada de IA.

**Apresentabilidade para demo comercial: SIM, com roteiro.** Demonstrável hoje pelo eixo comercial (atendimento → leads → negócios → cadastro → distribuição → financeiro → analytics). NÃO demonstrar: tarefas, agentes-reais, conteúdo, e a ficha de obra/[id].

---

## 2. MAPA POR TELA

| Rota | Func. | Nota | Achado-chave |
|---|---|---|---|
| /crm | real | 8.5 | Sólido; falta ponto conversacional IA ("o que faço agora?") |
| /crm/leads | parcial | 8.0 | Botão "Ligar" do slide-over é handler vazio (fachada) |
| /crm/leads/[id] | real | 7.5 | "Perdido" em 1 clique sem confirmação nem motivo |
| /crm/negocios | real | 8.0 | Mover etapa só por drag-drop; mobile não move |
| /crm/negocios/[id] | real | 7.0 | Rota de nota SEM guard de auth (cross-tenant) |
| /crm/cadastro | real | 8.5 | Forte; superfície ainda é tabela (mitigada por sideover) |
| /crm/pessoas (→cadastro) | real | 8.0 | Redirect mostra texto cru; superfície é tabela |
| /crm/pessoas/[id] | parcial | 6.5 | Aba "Registros" clicável e VAZIA (tab morta) |
| /crm/empresas | real | 6.5 | Loading infinito se sessão expira; tabela read-only sem ações |
| /crm/empresas/[id] | parcial | 6.5 | Resumo leitura passiva; salvar falha em silêncio |
| /crm/especialistas | real | 6.5 | Rota [id] sem guard nem tenant (IDOR) |
| /crm/distribuicao | real | 7.5 | Configurar regra = digitar slug/ID cru (anti Click-and-Go) |
| /crm/parceiros | real | 7.0 | Cores hardcoded; entidade "parceiro" tensiona com a visão |
| /crm/parceiros/[id] | real | 7.0 | "Concluir módulo" sem confirmação/desfazer |
| /crm/parceiros/novo | real | 7.5 | Tela de transição sem spinner — parece quebrada 1s |
| /crm/fornecedores | real | 6.5 | Área de atuação é texto livre (devia ser chips); sem busca |
| /crm/atendimento | real | **9.0** | Melhor tela; falta envio otimista da mensagem |
| /crm/canais | real | 6.5 | Cores fora do design system |
| /crm/canais-entrada | real | 6.5 | Idem; consolidável com /canais |
| **/crm/tarefas** | **stub** | **2.5** | Aponta p/ tabela `hub_tarefas_comerciais` inexistente; sempre vazia |
| /crm/aprovacoes | parcial | 7.5 | Funciona; revisar fluxo de escrita |
| /crm/obras | real | 5.5 | Módulo execução cru |
| /crm/obras/[id] | parcial | **3.5** | Ficha de obra muito incompleta |
| /crm/projetos | real | 5.5 | Cru, embrionário |
| /crm/imoveis | real | 6.5 | Básico funcional |
| /crm/pedidos | real | 5.5 | Cru |
| /crm/financeiro | real | 8.2 | Sólido |
| /crm/financeiro/receber | real | 7.5 | OK |
| /crm/financeiro/pagar | real | 7.5 | OK |
| /crm/analytics | real | 8.5 | Forte |
| /crm/relatorios | real | 7.0 | Lar natural das tabelas |
| /crm/agentes | real | 7.5 | Tela real de agentes IA |
| /crm/agentes/novo | real | 7.5 | OK |
| /crm/agentes/[slug] | real | 7.0 | OK |
| **/crm/agentes-reais** | **stub** | **1.5** | 33 linhas, 100% "em breve", manda o usuário embora |
| /crm/ciclos | real | 8.0 | Sólido |
| /crm/ferramentas | real | 8.5 | Forte |
| /crm/integracoes | parcial | 7.0 | Parcial por natureza |
| /crm/kpis | real | 8.0 | Sólido |
| /crm/configuracoes | real | 6.5 | Funcional |
| /crm/contatos | parcial | 6.5 | Parcial |
| /crm/usuarios | real | 7.5 | OK |
| /crm/trafego | parcial | **4.5** | Em grande parte placeholder |
| **/crm/conteudo** | **stub** | **2.5** | Stub |
| /crm/onboarding-tenant | real | 7.0 | Funcional |
| /crm/lead/[id] (legada→redirect) | real | 7.5 | Redireciona p/ ficha real |
| /crm/progresso-sistema | real | 7.5 | Tracker interno honesto |

---

## 3. CRÍTICOS CONFIRMADOS (só os que a verificação adversarial sustentou)

Priorizados por risco. Os 5 itens abaixo **passaram** na contraprova; itens que a verificação refutou (ex.: "classificação geral como stub" de pessoas/[id], e o enquadramento exagerado "qualquer um sem chave acessa" da rota de nota) foram descartados.

### C1 — SEGURANÇA: Rota de nota de negócio sem guard de auth nem escopo de tenant `/crm/negocios/[id]` → POST `/nota`
**O que quebra:** `app/api/crm/negocios/[id]/nota/route.ts` (POST) só chama `crmConfigError()` + lê `tenantIdFromRequest(headers)`. Não chama `requireCrmComercial`/`requireCrmSessao` (diferente de GET/PATCH/converter-obra, que chamam) e **não valida que o negócio pertence ao tenant**. Como `INTERNAL_API_KEY` é exposta como `NEXT_PUBLIC_`, quem tiver essa chave pública (ou sessão) pode forjar `x-tenant-id` e inserir notas em `hub_atividades` de qualquer negócio de qualquer tenant.
**Ressalva da verificação (justa):** a borda existe (`proxy.ts` compilado como middleware exige cookie OU `x-api-key`), então NÃO é "qualquer anônimo". É escalada cross-tenant via chave pública — ainda assim grave.
**Fix:** adicionar no topo do POST `const g = await requireCrmComercial(request); if ('error' in g) return g.error;`, usar `g.ctx.tenantId` (não o header) e checar `negocio.tenant_id === g.ctx.tenantId` antes do insert — mesmo padrão da PATCH.

### C2 — SEGURANÇA: Especialistas [id] sem guard e sem tenant (IDOR) `/crm/especialistas`
**O que quebra:** `app/api/crm/especialistas/[id]/route.ts` — GET e PATCH só chamam `crmConfigError()`, sem `requireCrm*` e sem filtro por `tenant_id`. Qualquer usuário logado pode **ler e editar** (inclusive `verificado:true`) qualquer especialista de qualquer tenant pelo id. A rota de lista já é blindada; a de item não.
**Fix:** aplicar `requireCrmComercial` + filtro `.eq('tenant_id', g.ctx.tenantId)` no GET e PATCH; rejeitar se o registro não pertence ao tenant.

> **C1+C2 são o P0 absoluto.** São os únicos achados que vazam dados entre clientes numa plataforma multi-tenant — viola o pilar do produto (distribuir leads entre empresas isoladas).

### C3 — FACHADA: Botão "Ligar" inerte `/crm/leads`
**O que quebra:** nas quick actions do slide-over (linha ~1055): `{ label:"Ligar", Icon:Phone, action:()=>{} }` — handler vazio ligado ao `onClick`. Renderiza idêntico às outras 5 ações (que funcionam), é clicável, e **não faz nada**. Viola "funcional, não fachada".
**Fix:** ligar a `window.open('tel:'+telefone)` ou WhatsApp `wa.me` (padrão já usado nos cards); idealmente registrar atividade `ligacao` em `hub_atividades`. Se discagem não existe, **remover o botão** até estar pronto.

### C4 — FACHADA: Aba "Registros" clicável e vazia `/crm/pessoas/[id]`
**O que quebra:** `CadastroFichaTabs.tsx` declara a aba `registros`, renderiza `<button role=tab>`, mas `page.tsx` só tem branches para `resumo/dados/vinculos/relacionados`. Clicar em Registros mostra `<div role=tabpanel>` **vazio**. A verificação confirmou que não existe componente `CadastroFichaRegistros` e que a aba está morta em todo o cadastro (não só aqui). A memória que dizia "Registros renderizado com note-logging" está **desatualizada/revertida**.
**Fix:** implementar painel real (timeline de notas/interações) OU remover `registros` do array e do `TAB_LABELS` até existir conteúdo. Não deixar tab sem destino.

### C5 — UX/SEGURANÇA OPERACIONAL: "Perdido" em 1 clique, sem confirmação nem motivo `/crm/leads/[id]`
**O que quebra:** botão Perdido (linha ~974) chama `moverEstagio("perdido")` → PATCH imediato. Ação comercial destrutiva, single-click, **sem confirmação e sem capturar motivo** — mesmo existindo `MOTIVOS_PERDA`/`MOTIVOS_PERDA_LABEL` prontos em `lib/crm/pipelines.ts`. Em erro só `alert()` cru, sem undo.
**Ressalva da verificação:** mover *estágio* por chip é reversível e exigir confirm por chip iria contra o Click-and-Go — o defeito real é só (a) Perdido sem motivo/confirm e (b) erro via `alert` sem toast/undo. **Não rebaixa a tela de "real"** — é gap de UX, não fachada.
**Fix:** Perdido abre mini-seletor de motivo (reusar `MOTIVOS_PERDA`) + confirmação leve; trocar `alert` por toast com "Desfazer" (o backend já recebe `_estagio_anterior`).

**Bônus de robustez (verificado, severidade menor):** `/crm/empresas` entra em **"Carregando…" eterno** se a sessão expira (effect faz `if(!user) return` sem setar `loading=false`/`myRole`). Fix de 2 linhas: `if(!user){ setLoading(false); setMyRole(''); return; }`.

---

## 4. REVISÃO DE ESCOPO / PREMISSAS (onde diverge da visão do dono)

A visão é **Hub distribui → membro VENDE (CRM) e EXECUTA (obra)**, tudo **IA-first conversacional** e **Click-and-Go**, com **tabela = relatório, nunca tela de trabalho**. Divergências reais:

1. **A metade "EXECUTAR" da visão ainda não existe de verdade.** obras (5.5), obra/[id] (**3.5**), projetos (5.5), pedidos (5.5) são as 4 menores notas reais. O eixo comercial está pronto; o eixo de obra/engenharia é embrião. Isso é o maior gap *de produto* (não bug) entre o que se promete e o que se entrega.

2. **IA-first é mais slogan que prática nas telas centrais.** `/crm/negocios/[id]` é 100% manual (digita próxima ação, digita nota, escolhe etapa) — zero sugestão de próximo passo, resumo ou redação assistida, apesar de o produto anunciar agentes/Mistral. O dashboard tem "Ação agora" (embrião certo) mas estático, sem ponto conversacional ("o que devo fazer agora?"). `/crm/pessoas/[id]` é quase só leitura — não dá para criar negócio/lead, registrar conversa ou WhatsApp a partir do contato. **Recomendo escolher 2–3 telas-âncora (negócio, lead, atendimento) e injetar IA de verdade**, em vez de espalhar fino.

3. **Tabela-como-tela persiste nas superfícies de entrada.** `/crm/cadastro` (e `/crm/pessoas` que redireciona) tem `CadastroListaTable` como primeiro contato; `/crm/empresas` é `<table>` read-only **sem nenhuma ação por linha** (não edita, não ativa/inativa apesar do campo `ativo` existir, não abre detalhe). Atenuante: cadastro tem sideover acionável e wizard IA-first. Mas a regra do dono ("tabela vive em /crm/relatorios") não está cumprida na porta de entrada. `/crm/empresas` é o caso mais puro de "criar+olhar, não operar".

4. **Click-and-Go furado na configuração de distribuição.** `/crm/distribuicao` (linha ~372) pede para **digitar slug/ID cru** do parceiro/agente num input de texto livre — o oposto de "escolher e confirmar". Deveria ser seletor/autocomplete de entidades reais.

5. **Entidade "parceiro" tensiona com a memória.** A memória aposentou "parceiro" como entidade (fornecedor=classificação, homologado=status), mas o botão primário do dashboard é "+ Parceiro" e há rotas `/crm/parceiros/*`. Decisão de nomenclatura a reconciliar.

---

## 5. TOP MELHORIAS DE DESIGN / UX (transversais)

1. **Design system ignorado em massa.** Dezenas de telas usam cores hardcoded (GitHub-dark `#0d1117`/`#30363d`/`#161b22`, azul, laranja, cinzas Tailwind) em vez dos tokens `--obra-*`/`--brand-*` (dark verde #003b26 + dourado #c9a24a). Atinge leads, negócios, distribuição, especialistas, fornecedores, pessoas/[id], empresas/[id], parceiros, atendimento. **É a inconsistência visual nº1** — um sweep de tokenização eleva a percepção de qualidade do produto inteiro de uma vez.
2. **Falhas de escrita silenciosas.** `salvarEdicao` em pessoas/[id] e empresas/[id], ações de escrita em negocios/[id], carregamento em distribuição — todos engolem erro sem feedback. Padronizar toast de erro/sucesso.
3. **Confirmações/undo ausentes em ações de impacto.** Perdido (lead), "Concluir módulo" (parceiros/[id]), exclusões com `window.confirm` nativo. Padrão Click-and-Go: popover de confirmação leve + toast com "Desfazer".
4. **Sem estados de loading inicial** em leads e em transições (parceiros/novo "pisca" como tela quebrada). Adicionar skeleton/spinner com identidade.
5. **Inputs sem máscara** (telefone/CPF em especialistas) e **texto livre onde deveria ser chips** (área de atuação em fornecedores — contradiz o formato Membros).
6. **Otimismo de UI no atendimento** (9.0, a melhor tela): mensagem enviada espera o roundtrip — adicionar render otimista fecharia o último gap da joia da coroa.

---

## 6. PLANO DE INTERVENÇÃO PRIORIZADO (em ondas)

### 🔴 P0 — Fachada / quebrado / segurança (fazer JÁ — antes de qualquer demo)
| # | Item | Esforço |
|---|---|---|
| C1 | Guard + tenant na rota POST `/negocios/[id]/nota` | **P** (XS, copiar padrão da PATCH) |
| C2 | Guard + tenant em `/especialistas/[id]` GET/PATCH | **P** (XS) |
| C3 | Ligar ou remover botão "Ligar" em /crm/leads | **P** (XS) |
| C4 | Implementar OU remover aba "Registros" (pessoas/[id]) | **P–M** (XS se remover; M se implementar timeline) |
| — | Fix loading infinito em /crm/empresas (sessão expirada) | **P** (XS, 2 linhas) |
| — | Decisão honesta sobre stubs: tarefas / agentes-reais / conteúdo / trafego — esconder do menu OU rotular "Em breve" de forma inequívoca (agentes-reais já tem badge; tarefas/conteúdo precisam) | **P** (config nav) |

*P0 é majoritariamente esforço extra-pequeno (copiar padrões já existentes no próprio código). Alto retorno, baixo risco.*

### 🟡 P1 — Escopo / UX de risco (próxima sprint)
| # | Item | Esforço |
|---|---|---|
| C5 | "Perdido" com seletor de motivo (reusar `MOTIVOS_PERDA`) + confirm + toast/undo | **M** |
| — | Toast padrão de erro/sucesso em todas as escritas silenciosas | **M** |
| — | `/crm/distribuicao`: trocar input de slug por seletor/autocomplete de entidades | **M** |
| — | `/crm/empresas`: ações por linha (editar, ativar/inativar, abrir detalhe) | **M** |
| — | Mover etapa de negócio também no mobile (não só drag-drop) | **M** |
| — | **Decidir e construir** a primeira injeção real de IA em 1 tela-âncora (sugestão de próxima ação no negócio/lead) | **G** |

### 🟢 P2 — Polish / consistência (contínuo)
| # | Item | Esforço |
|---|---|---|
| — | **Sweep de tokenização** `--obra-*`/`--brand-*` em todas as telas com hex hardcoded | **G** (mas mecânico; maior ganho visual) |
| — | Spinner/identidade em transições (parceiros/novo) e loading inicial (leads) | **M** |
| — | Máscaras de telefone/CPF; chips de área em fornecedores | **M** |
| — | Render otimista da mensagem no atendimento | **P** |
| — | Reconciliar nomenclatura "parceiro" vs. visão (fornecedor/homologado) | **M** (decisão de produto) |
| — | Limpar painéis de diagnóstico de dev expostos ao usuário (aba Memórias do lead) | **P** |
| — | Maturar módulo de obra/execução (obras/[id] 3.5 → usável) — roadmap próprio | **XG** |

---

**Resumo executivo de uma linha:** produto comercialmente apresentável e majoritariamente real (77% das telas), com fachada concentrada em 3 stubs e 5 defeitos pontuais — **2 deles falhas de segurança multi-tenant que são o único bloqueador inegociável**; o resto é dívida de UX e a metade "executar obra" da visão ainda imatura. Comece pelo P0 (quase tudo XS, copiando padrões já presentes no código) e o sistema passa de "bom com riscos" para "demo-ready sem ressalvas".

Arquivos load-bearing para os P0:
- `c:\Users\wende\Documents\escritorio-virtual-ramon\app\api\crm\negocios\[id]\nota\route.ts` (C1)
- `c:\Users\wende\Documents\escritorio-virtual-ramon\app\api\crm\especialistas\[id]\route.ts` (C2)
- `c:\Users\wende\Documents\escritorio-virtual-ramon\app\crm\leads\page.tsx` (~linha 1055, C3)
- `c:\Users\wende\Documents\escritorio-virtual-ramon\components\crm\cadastro\CadastroFichaTabs.tsx` + `app\crm\pessoas\[id]\page.tsx` (C4)
- `c:\Users\wende\Documents\escritorio-virtual-ramon\app\crm\leads\[id]\page.tsx` (~linha 974, C5) e `lib\crm\pipelines.ts` (`MOTIVOS_PERDA`)
- `c:\Users\wende\Documents\escritorio-virtual-ramon\app\crm\empresas\page.tsx` (loading infinito, ~linha 29)

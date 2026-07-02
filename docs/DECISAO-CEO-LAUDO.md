# 🧭 Decisão de CEO — laudo de produto (33 telas)

> Gerado 01/jul (noite) por mesa-redonda (verificação técnica contra o código/DB real + triagem de produto) sobre `LAUDO-DETALHADO-POR-TELA.md`. Honesto, sem inflar.

---

# 🧭 Decisão de CEO — laudo de produto (33 telas)

> Documento de decisão. Leitura de 5 min. Sem enfeite: o que o Claude já conserta sozinho, o que trava na sua janela, e o que o laudo errou.

---

## 1. Veredito

O laudo é **bom no que importa e exagerado onde dói menos**. Ele acertou em cheio a espinha funcional: a criação de negócio/lead/imóvel quebra de verdade, e a causa-raiz das telas "mentindo" (Dashboard, Kanban de leads, funil) é uma só — **duas máquinas de estado concorrentes**. Isso é ouro e é barato de resolver.

Mas **inflou a severidade de segurança**: os 3 achados P0 de RBAC ("owner vê preço/markup", "desativa tenant a 1 clique", "vê service_role") foram **refutados** na verificação — "owner" é uma allowlist fixa de 3 e-mails da *plataforma* (você, Ramon, Ariane), não um cliente/gestor de escritório. O código já barra. Somando, **5 dos 17 achados caíram** na verificação (3 de RBAC + lead 409 + board de Arquitetura, todos já corrigidos no código atual). Tradução: confie no laudo para bug funcional; desconfie do rótulo "P0 de segurança" — ele soou alarme onde a porta já estava trancada.

---

## 2. ✅ INCORPORAR JÁ (autônomo — o Claude conserta sozinho)

Priorizado por alavancagem × esforço. Tudo abaixo é código, aditivo, sem tocar em prod-schema.

| # | O quê | Por que agora | Esforço |
|---|-------|---------------|---------|
| 1 | **Mapear ciclo-de-vida → coluna do Kanban (causa-raiz L3)** | Uma correção conserta **3 telas de uma vez**: Kanban de leads volta a mostrar os 6 leads sumidos, funil do Dashboard para de dar 0 com 5 negócios, e vira a base da fonte-única. Máxima alavancagem do lote. | Alto |
| 2 | **Kanban de Leads renderiza os cards (L2)** | Cai junto com o #1 (mesmo defeito). Hoje só 2 de 8 leads aparecem. | (incluso no #1) |
| 3 | **Imóvel: trocar default `captacao` → `disponivel` (IM1)** | Módulo natimorto: **toda** criação viola o CHECK constraint. Uma linha. | Baixo |
| 4 | **Error boundary: nunca expor SQL cru (AP2/IM2/EN3)** | 4 telas vazam nome real de tabela/coluna = superfície de reconhecimento + quebra de confiança. Toast com ID + log interno. Transversal e barato. | Baixo |
| 5 | **KPI "Modelos IA ativos" e rótulos de IA derivam do health-check (D2)** | Hoje mostra "2 ativos" com IA desligada = **mente pro prospect na demo**. Não é ligar IA — é parar de fingir. Fallback "desconectada". | Baixo |
| 6 | **Guardas tolerantes em Aprovações/Contatos (stopgap de AP1/CN1)** | Enquanto a migração não entra na sua janela, aplicar o padrão `isMissingPgColumn` que Imóveis/Negócios já usam → a rota **para de dar 500 e de vazar SQL** em vez de morrer. Restauração plena = item 3.2. | Baixo |
| 7 | **Posse de obra tolera `tenant_id` legado NULL (EN1)** | A hipótese uuid×código do laudo foi refutada, mas a posse estrita ainda dá 404 em obra legada. Blindar. | Baixo |
| 8 | **Derivar STATUS de ETAPA no negócio (N2, P1)** | Negócio "Ganho" exibindo status "Aberto" é dado errado e visível. | Baixo |
| 9 | **G0 de UX: tooltip do copiloto só em hover/1ª visita; FAB "+" recua do "Enviar" (P1)** | Atrito em 100% das telas por custo trivial; atendente erra o clique mais usado. Click-and-Go. | Baixo |
| 10 | **Fricção em ação destrutiva/externa: idempotência+cooldown no auditor, dry-run/confirm, soft-delete (P1)** | Auditor cobrou o mesmo parceiro **6×** = imagem de sistema descontrolado, queima parceiro real. "Nada se perde". | Médio |
| 11 | **Tarefas agrega próxima-ação de negócio, não só de lead (P1)** | Follow-up de receita some do agregador. Semente do gestor de tarefas universal. | Baixo |
| 12 | **i18n pt-PT → pt-BR (P2)** e **cosmético de confiança (P3)** — "seleccionado/registo/contacto", contador do sino, "1 projetos", skeleton+timeout no Analytics | Passada mecânica; público é BR. Fazer **antes de qualquer demo**. | Baixo |

**Protect-list (não regredir nos refactors):** Caixa de leads, wizard de negócio (busca unificada + IA opcional), +Convidar link permanente, aderência-como-moeda, Assumir/Devolver IA, +Novo projeto em 3 toques, Visão financeira reativa. São os benchmarks que já encarnam a visão — ao corrigir as máquinas de estado, **não quebre estes**.

---

## 3. 🔴 DEPENDE DO DONO (janela de migração / IA / custo)

| Item | Decisão que só você toma | Regra |
|------|--------------------------|-------|
| **N1 — negócio não salva (500 mudo)** | Existe uma **FK legada podre** (`hub_negocios_lead_id_fkey` → tabela antiga `hub_leads`) que barra todo negócio com lead. O conserto é **dropar a FK morta** = alteração de schema em prod. | Migração em prod = **sua janela** (regra travada). Aplicar JUNTO, verificado via MCP. |
| **AP1/CN1 — Aprovações e Contatos** | Restauração plena exige **adicionar `tenant_id`** (a migração multi-tenant nunca rodou nessas 2 tabelas). Stopgap autônomo no item 2.6; a coluna de verdade é migração. | Mesma janela. Priorizar **RLS tenant-scope** dessas tabelas antes do 2º tenant. |
| **EN2 — Compras & Estoque da obra (E5)** | Tabelas E5 não existem nesta base. Não é bug: é migração não aplicada. | Mesma janela. |
| **Ligar a IA de verdade (MISTRAL_API_KEY) + validar ao vivo** | Auto-qualificação, copiloto de voz, escopo por voz, WhatsApp. Hoje tudo é heurística/mock. Exige **chave + custo + validação em PROD com você**. Sem isso o teto de nota de IA fica em ~2-3. | Decisão de infra/custo/negócio. |
| **Ciclos "0 ativos" (tema 23)** | Não é bug de rota; os ciclos dependem da IA acima. O rótulo "nunca · 7 exec." é cosmético (cai no item 2.12). | Downstream de ligar a IA. |

**Recomendação de janela:** ao aplicar N1 + AP1 + CN1 + E5, adicionar um **smoke-test no deploy** (`SELECT 1` por tabela crítica) para nunca mais subir uma rota morta.

---

## 4. ✂️ CORTAR / NÃO AGORA

| O quê | Por que não vale |
|-------|-------------------|
| **Requisitos "enterprise 100–5.000 usuários"** (virtualização p/ 100k leads, tenant-switcher, favoritos/recentes, SLA por equipe, fila por time) | Over-engineering pré-escala com **1 tenant real**. Drena a janela e atrasa os P0. |
| **Aprofundar domínios que o MODELO vai reestruturar** (Imóveis rico com fotos/m², Pedidos com itens/cotação, Arquitetura funil→carteira, unificar Pedidos×Solicitações) | O rebuild **tenant-first** já está travado na memória. Investir agora = **retrabalho garantido**. Aplicar só o stopgap barato (constraint do imóvel, bind do board) e **represar** o resto até você destravar a sequência. |
| **Encher telas-casca de integração desligada** (Campanhas/Windsor, execução das Ferramentas IA) | Casca honesta com link para Integrações já é o certo. Só corrigir o barato (cor invertida onde R$0 fica vermelho; SLA dos alertas parados há 37-43 dias). |
| **Checagem de exaustividade das máquinas de estado em CI** | Boa ideia, mas **P2** — não bloqueia. Entra depois do item 2.1. |

**Exceção que NÃO se corta:** **2FA + auditoria por usuário** sobe para **P2 assim que existir o 2º tenant real**. Isso é dado/privilégio, não vaidade enterprise.

---

## 5. ⚠️ REFUTADO / DESATUALIZADO (o laudo soou alarme onde já estava resolvido)

| Achado do laudo | Realidade na verificação |
|-----------------|--------------------------|
| **RBAC P0: "owner vê/edita preço, markup, custo, margem" (PR1)** | **Refutado.** `requireCrmOwner` server-side + página gated por `isOwner`. "Owner" = allowlist fixa de 3 e-mails da **plataforma**, não atribuível pela UI. |
| **"Desativa tenant a 1 clique, sem confirmação" (EM1)** | **Refutado.** Rota owner-only + `CrmConfirmDialog` "Desativar escritório?" + PATCH. Não é 1-clique. |
| **"Painel de service_role/segredos visível ao owner" (CF1)** | **Refutado.** Bloco só renderiza sob `isOwner`; fetch é pulado se `!isOwner`. Não vaza para papel não-plataforma. |
| **"Lead 409 falha em silêncio, sem toast" (L1)** | **Refutado.** O drawer atual já chama `setErro` e renderiza a caixa vermelha. Resta só a melhoria "Abrir/Mesclar" (P2). |
| **"Board de Arquitetura ligado ao funil de vendas" (AR1)** | **Refutado.** Já usa funil dedicado de projeto (briefing→...→entregue). Desacoplado. |
| **"Abas Cronograma/Financeiro dão 'Obra não encontrada'" (EN1)** | **Hipótese uuid×código refutada.** As 4 obras têm `tenant_id` batendo com a sessão. Sobra só a fragilidade de obra legada NULL → já coberta no item 2.7. |

**Leitura executiva:** o único ajuste real de RBAC seria *se* o produto migrar para multi-tenant atribuindo "owner" a admin de tenant — hoje o código impede. Ou seja: **não é dívida de hoje, é um cuidado para o rebuild tenant-first.**

---

## 6. Cronograma

Coerente com o modelo **tenant-primeiro** (Hub e camada Rede vêm depois; núcleo comercial primeiro).

**Onda 1 — quick-wins autônomos (o Claude começa já, sem você):**
Itens 2.1→2.12. Ordem: causa-raiz das máquinas de estado (#1/#2) → constraint do imóvel (#3) → error boundary + guardas tolerantes (#4/#6) → honestidade da IA (#5) → posse de obra (#7) → derivação de status (#8) → G0 de UX (#9) → fricção destrutiva (#10) → tarefas (#11) → i18n + cosmético (#12). Desbloqueia a espinha negócio→projeto→obra e para o vazamento de SQL. **Não exige sua presença.**

**Onda 2 — sistêmico (downstream da Onda 1):**
Fonte única de métricas (`/api/crm/metricas` alimentando Dashboard/Leads/Relatórios) — só depois que as máquinas de estado estiverem unificadas, senão retrabalho.

**Onda 3 — sua janela (aplicar JUNTO, verificado via MCP):**
N1 (drop da FK morta) + tenant_id em Aprovações/Contatos + E5 de Compras + RLS tenant-scope + smoke-test no deploy. **Único bloco que precisa de você e de janela de prod.**

**Onda 4 — sua decisão de negócio/custo:**
Ligar Mistral + validar IA ao vivo em PROD com você (auto-qualificação, voz, WhatsApp). Destrava o teto de nota da IA.

**Represado até você destravar a sequência de construção:**
Aprofundamento de domínios (Imóveis/Pedidos/Arquitetura-carteira) + 2FA/auditoria (dispara no 2º tenant). Não mexer antes da mesa-redonda e do estudo da planilha/Asana.

---

**Resumo de uma linha:** o Claude pode começar **agora** e resolver a maioria dos bugs reais sozinho (Onda 1); você só precisa aparecer para a **janela de migração** (Onda 3) e para a **decisão de ligar a IA** (Onda 4). Ignore o alarme de RBAC — era falso.
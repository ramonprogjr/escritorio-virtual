# 🚦 MASTERPLAN & CRONOGRAMA — Obra10+ (MVP → V1 publicado nas lojas)

> **O cronograma-mestre do qual não saímos mais dos trilhos.** Semana a semana, todos os produtos, cada pendência com a ficha "o que o dev faz para saná-la". Baseado em TUDO: caderno de engenharia (36 WIs) + plano de negócio + os 5 docs vivos + a varredura de 162 pendências (32 órfãs). Dois marcos: **MVP** (operar sem planilha) e **V1** (todos os negócios, seguro, publicado App Store + Play Store). Datas em SEMANAS (dependem de capacidade + janelas do dono), meta: MVP em ~1 trimestre.

> **Documento vivo — 07/jul/2026.** Fonte técnica: [CADERNO-ENGENHARIA](CADERNO-ENGENHARIA-AUDITORIA.md) · [04-ROADMAP](04-ROADMAP-E-PLANO.md) · [PENDENCIAS-VARREDURA](PENDENCIAS-VARREDURA-07JUL.md) · [PLANO-DE-NEGOCIO](PLANO-DE-NEGOCIO.md). A numeração de fases autoritativa é a do 04/CADERNO (Fases 0–8). Honesto: nada marcado verde que esteja âmbar.


---

## Índice

- 1. Definições — MVP × V1 (escopo e critérios de saída binários)
- 2. Cronograma do MVP — semana a semana (≈12 semanas)
- 3. Cronograma da V1 — semana a semana (pós-MVP até publicar)
- 4. Workstream Mobile & App Stores (detalhado)
- 5. Gates do dono, dependências críticas & riscos
- 6. Painel de acompanhamento & a regra "não sair dos trilhos"
- 7. Matriz de Cobertura de Produto (todo produto × estado × fase de pronto)
- 8. Fichas das 32 pendências ÓRFÃS — o que o dev faz para sanar cada uma

---


## 1. Definições — MVP × V1 (escopo e critérios de saída binários)

> **Propósito desta seção.** Fixar, sem ambiguidade, o que entra em cada marco, o que é deliberadamente adiado, e o **teste binário** que declara cada marco "concluído". Tudo aqui está ancorado no **04-ROADMAP / CADERNO-ENGENHARIA (§14–15, autoritativo)** — não no 00-PAINEL, cujo esquema de fases diverge (dívida **DECISÃO-35**, "reconciliar os 2 documentos-mestre", a sanar na Semana 1). As WIs citadas (RAS-01…LGPD-01) e as janelas do dono são as reais do backlog. **Nenhuma data de calendário é fixada** — a numeração é por Semana/Sprint, ancorada na meta do Plano de Negócio: **MVP = Fases 0–3 em ~1 trimestre (12 semanas / Sprints S1–S7)**.

---

### 1.1 Os dois marcos em uma frase

| Marco | Frase-âncora | Fases | Sprints | Tenancy | Receita | Lojas |
|---|---|---|---|---|---|---|
| **MVP** | "A operação do **próprio dono** roda ponta-a-ponta **sem planilha**, com dinheiro real (escrow + comissão) em produção, single-tenant." | 0 → 3 | S1–S7 (~12 sem) | **Single-tenant** (tenant-zero = operação do dono) | **R$0 recorrente** (motor de comissão/escrow real, mas MRR ainda desligado) | **Não** (web/PWA) |
| **V1** | "**Todos os negócios/verticais** funcionando, rede **endurecida** (multitenant + RBAC), **billing ligado** (MRR + Tijolos), **Portal do Cliente** no ar, **publicado na App Store e na Play Store**." | 4 → 8 (+ endurecimento) | S8 em diante | **Multi-tenant** (2º tenant é o gate F5→F6) | **MRR + Tijolo** cobrados | **Sim** (Play + App Store) |

**Regra de ouro da separação:** o MVP prova que o **produto opera e movimenta dinheiro** para *um* usuário (o dono); o V1 prova que o **negócio escala e cobra** de *muitos*. Publicação em loja e multitenant são V1 **por definição** — nunca antecipar hora de dev de rede/escala antes do gate F5 (invariante do Plano: "sem hora de dev na F8 antes da F6").

---

### 1.2 MVP — definição canônica (Fases 0–3, single-tenant, sem planilha)

#### 1.2.1 Escopo INCLUÍDO — o que TEM que estar de pé no MVP

Cada linha mapeia às WIs reais. Fichas técnicas detalhadas: **as 36 WIs → CADERNO (referência por §)**; as órfãs que entram no MVP recebem ficha própria nas Partes de execução deste cronograma.

| Fase | Bloco de capacidade | WIs incluídas | Ficha | Por que é MVP (não adiável) |
|---|---|---|---|---|
| **F0** | Estancar o irreversível | RAS-01, RAS-02, RAS-03, MET-01, IA-02, FIN-03, EST-03 | CAD §2/§9/§10/§8/§6 | Sem raiz de linhagem escrita pelo app **agora**, todo negócio criado nasce órfão — dano **irreversível** que cresce a cada dia. Markup<1 = IA de graça (sangria de custo). |
| **F0 (órfãs promovidas)** | Rotação de segredos · delete=arquiva · R7 fail-closed · mobile-cadastros | Órfãs #4, #25, #23, #10 | ficha própria | Chave do dev demitido válida até 2036 = risco de posse do sistema. Delete que apaga viola invariante #4 em prod. Mobile que não cria PF/empresa = dono não opera no celular. |
| **F1** | Ligar a IA | IA-01 (+ órfãs #3 rate-limit, #7 IA-hardening, #8 HMAC) | CAD §10 | Qualificação de lead pela IA é a promessa central do fluxo core; sem ela o dono ainda tria lead na mão. |
| **F2** | Aplicar o represado (**JANELA GRANDE única**) | FND-01, OBR-01, OBR-02, **FIN-02**, FIN-01, TEN-03(parcial) | CAD §1/§7/§8/§3 | Motor de escrow+comissão já está **construído e testado por MCP, mas represado**. Só vira MVP quando aplicado com o fix de custódia-fantasma (FIN-02) **antes** de E6. |
| **F3** | Operar sem planilha (critério-mãe) | LEAD-01, LEAD-02, EST-01, EST-02, RAS-04, RAS-05, EVT-01, FND-02 | CAD §5/§6/§2/§11/§1 | O teste de saída do MVP é operacional: um cliente real percorre captação→IA→CRM→obra→medição→escrow→comissão **inteiramente no sistema**. |
| **F3 (órfãs promovidas)** | Registros/atividades+próxima-ação · financeiro operacional · `hub_produtos`+catálogo · Tela do Arquiteto · SEC-7 auditoria-IA · design/honestidade de telas | Órfãs #13, #14, #17, #20, #1, #11, #12 | ficha própria | São **gaps P0 do próprio rastreador do código** (próxima-ação obrigatória) e bloqueantes de uso real (Compras abre vazia sem catálogo; barras de progresso falsas). |

**Verticais no MVP:** apenas o que o **dono opera hoje** — **ENGENHARIA/OBRA** (EAP, medição, escrow, RDO básico) como espinha, **LEAD/CRM** e **ARQUITETURA** (carteira de projetos, ficha `po-proj-ficha`) porque o dono é eng. civil + corretor. **IMÓVEL (IMB)** entra parcialmente via EST-02 (fechamento IMB correto, "não vira obra") — o fluxo de captação de imóvel completo é V1.

#### 1.2.2 Escopo EXCLUÍDO do MVP (adiado para V1 — explícito e justificado)

| Excluído do MVP | Onde entra | Por quê fora do MVP |
|---|---|---|
| **Multi-tenant / 2º tenant** (TEN-01…04, RBAC-01…05) | V1 / F5–F6 | MVP é single-tenant por definição. Endurecimento de rede só faz sentido antes de admitir o 2º tenant. |
| **Billing / MRR / SaaS** (MET-02…05) | V1 / F4 | MVP prova operação; cobrança é o marco seguinte ("F4: 1º R$ de MRR"). |
| **Publicação App Store / Play Store** (workstream MOBILE-LOJAS) | V1 | Greenfield de packaging; caminho-crítico iOS (conta Apple + Mac + Guideline 4.2). Fora do trimestre. |
| **Portal do Cliente completo** (POR-01) | V1 / F7 | Leitura pode ser antecipada pós-F3, mas aprovação depende de F2 aplicada; entrega plena é V1. |
| **Marketplace/iFood da construção, Lalamove, CUB proprietário, predição de falta** | V1 / F8 | Rede/escala; "sem hora de dev antes da F6". |
| **Serviços/ofícios completos** (MRC/MMR/VDR/serralheria/pintura), Portal do Fornecedor pleno | V1 / F3-F7 | Cadastro/medição básica pode encostar no MVP via RAS-04; motor-por-ofício e portal do fornecedor são V1. |
| **Tráfego pago real** (Meta Lead Ads/Direct, Google, Windsor, CAC por bairro) | V1 | EVT-01 entrega a **fundação de analytics** (consumir `hub_eventos` + UTM) no MVP; ligar as credenciais Meta/ads é janela do dono e escopo de marketing V1. |
| **IAP / Sign in with Apple / push APNs** | V1 | Só relevante com app em loja. |
| **Copiloto de Voz Global, Agent Builder Fase 4, editor de fluxo visual** | V1 / F7-F8 | IA no MVP é "sugere e mostra" (IA-01); autonomia é depois. |

#### 1.2.3 Janelas do dono que o MVP EXIGE (bloqueiam a saída)

🚩 = ação do **VOCÊ-dono**, sem a qual o marco não fecha.

| Janela do dono | Destrava | Tipo | Fase |
|---|---|---|---|
| 🚩 **Rotação de segredos** (SERVICE_ROLE + PAT `sbp_` + chaves Render + senha exposta no chat) + push de backup em GitHub próprio | Posse segura do sistema | Credencial | **F0** |
| 🚩 **Chave Mistral + billing da Mistral** | IA-01 / toda a F1 | Credencial | **F1** |
| 🚩 **Janela de migração GRANDE (Fase 2)** — FND-01 + OBR-01 + FIN-02 + FIN-01 aplicadas **juntas, na ordem exata** E0→E0b→E2→E3→E5→E7→E7b→A0→A1, e **E6 só depois de FIN-02** | Escrow + comissão reais | Janela Supabase | **F2** |
| 🚩 **Migração da linhagem (RAS-01)** — o irreversível | Raiz escrita pelo app | Janela Supabase | **F0/F2** |
| 🚩 **Desfazer DEMO de escrow (R$15k reais numa camada NÃO aplicada)** | Fecha risco crítico vivo (constatação C2) | Janela/decisão | **F2** |
| 🚩 **JANELA-03** `engenheiro_responsavel_id` (amarra `escrow:chave_tecnica` à pessoa, não ao papel) | Dupla-chave real | Janela Supabase | **F2** |
| 🚩 **Parceiro BaaS/KYC + abrir contas-escrow por obra** + **seed de dinheiro real** (medições Consulado) + **recuperar docs de obra do Asana** | Obra real com dinheiro | Config/decisão | **F2/F3** |
| 🚩 **Rebalancear owners** (Ramon owner→admin, Ariane owner→comercial, promover obradezmais→owner, remover `e2e-arq@obra10.app`) + `CRM_OWNER_EMAILS` hardcoded (RBAC-04) | Posse/permissão sã | Decisão | **F0/F3** |
| 🚩 **Config Render/cron** (`CRON_SECRET`, `MOTOR_FONTE=fornecedores`, `COPILOTO_HMAC_SECRET`, mover cron de KPIs pro Render) | SLA/cron do motor de leads | Config | **F0/F3** |
| 🚩 **Catálogo ~20 itens de materiais** (BLOQUEANTE — Compras abre vazia) + decisão `hub_produtos` modelar-agora vs deferir | Tela Produtos/Compras usável | Decisão | **F3** |
| 🚩 **Decisões de produto travantes** (valor lead faixa/exato · escrow 2-chaves papéis · IMB/FOR/PRO entrega correta #7/#8) | EST-02, FIN-01 | Decisão | **F2/F3** |

#### 1.2.4 Critério de SAÍDA do MVP — checklist BINÁRIO (todos verdes = MVP fechado)

- [ ] **F0:** nenhum negócio novo nasce sem `negocio_raiz_id` (query em prod retorna **0 órfãos** entre criados pós-deploy); markup<1 **rejeitado** na UI **e** no banco (CHECK); `/api/ml/*` responde sem Anthropic (fallback IA-02); ganho sem `valor_fechado` mostra banner (FIN-03); adicionar tipo fora do CHECK **falha o CI**, não a produção (EST-03).
- [ ] **F0-segurança:** segredos rotacionados (chave do dev demitido **revogada**); backup do repo em GitHub próprio; `delete` **arquiva** nos 5 endpoints (invariante #4); papel desconhecido → **fail-closed** (R7); mobile **cria** PF/empresa.
- [ ] **F1:** um lead entra pelo **WhatsApp → é qualificado pela IA → humano confirma em 1 toque**, ponta-a-ponta, em produção, uma vez ao vivo com o dono.
- [ ] **F2:** existe **1 obra real** com **EAP + medição append-only (`rpc_registrar_medicao`) + escrow dupla-chave** (2 humanos **distintos**: `chave_hub` ≠ `chave_tecnica`, ambas pessoas físicas); **1 comissão real** percorre PREVISTA→APURADA→EXIGÍVEL→APROVADA→PAGA; **DEMO de R$15k desfeita** (C2 fechada); **`supabase db reset` reconstrói o schema limpo** e `db diff` sai **vazio** (FND-01).
- [ ] **F3 (critério-mãe):** o **próximo cliente real roda ponta-a-ponta SEM tocar em planilha** — captação → IA qualifica → CRM/funil por mercado (EST-01, vocabulário consolidado LEAD-02) → obra/projeto → medição → escrow → comissão → financeiro operacional, com **próxima-ação obrigatória** registrada (gap P0 do rastreador), catálogo de materiais preenchido, e telas **honestas** (sem barra 42% falsa, sem 85%-confiança inventado).

**Um teste único que resume o MVP:** *o dono fecha um negócio real de ponta a ponta no sistema e não abre o Excel uma única vez; o dinheiro (escrow + comissão) aparece movimentado na camada aplicada.*

---

### 1.3 V1 — definição canônica (todos os negócios + seguro + billing + Portal + lojas)

#### 1.3.1 Escopo INCLUÍDO — o que TEM que estar de pé no V1

| Bloco | WIs / workstreams | Fase | Critério-resumo |
|---|---|---|---|
| **Receita ligada** | MET-02 (consumo IA atômico), MET-03 (carteira + top-up PIX, 3 cadeados de idempotência), MET-04 (régua 7/3/1 + `IA_HARD_CAP`), MET-05 (planos SaaS/MRR, entitlements por módulo) | **F4** | 1º R$ de MRR **e** 1º Tijolo cobrado. |
| **Rede endurecida (gate absoluto)** | TEN-01 (backfill `tenant_id NULL`→sentinela + NOT NULL, 36 tabelas), TEN-02 (`.eq` puro), TEN-03 (fechar RLS abertas), TEN-04 (hierarquia tenant), RBAC-01…05, LGPD-01 (anonimização), órfãs #2 (logs/observabilidade "Onda D"), #21 (Onda C self-service) | **F5** | Teste de intrusão interno passa; **nenhum tenant lê outro**; 12/12 checklist. |
| **Piloto de rede** | LEAD-03 (paginação/pré-filtro motor) | **F6** | 2º tenant rodando **isolado**. |
| **Portal do Cliente + Altitude 1** | POR-01 (5 medos), órfã #19 (Portal do Fornecedor), Onda A completa (Tela do Arquiteto), bloco "Dinheiro do Hub" (RLS Faixa B real) | **F7** | Hub lê a rede; cliente acompanha obra sem ligar; portal do fornecedor com cotações/pedidos. |
| **Todos os verticais** | IMÓVEL (funil imobiliário + captação de imóvel + corretagem `captado_por`), ARQUITETURA (hub_projetos, funil, aprovação por fase), ENGENHARIA (curva-S, RDO voz/foto), SERVIÇOS+MRC/MMR/VDR (motor-por-ofício), PRODUTOS/MATERIAIS (estoque, cotação), MDO em campo (RAS-05 pleno, tablet/totem) | **F3→F7** | Cada vertical fecha no seu tipo correto (EST-02), sem "virar obra". |
| **MARKETING que gera lead** | Tráfego pago (Meta Lead Ads/Direct, Google), campanhas, landing/forms, captura UTM, captação pública, analytics de canal, CAC por bairro (EVT-01 pleno + credenciais Meta/Windsor) | **F3→V1** | Lead pago entra, atribui UTM/canal, CAC calculado por mercado. |
| **PUBLICAÇÃO NAS LOJAS** (workstream MOBILE-LOJAS, greenfield) | Preparo PWA/infra (domínio próprio HTTPS, reescrever+registrar SW, ícones/splash reais, `/privacidade` LGPD + delete-account, usuário demo) → **Android TWA** (Bubblewrap/PWABuilder → AAB → `assetlinks.json`) → **iOS Capacitor** (WKWebView + push APNs/câmera/geo p/ sobreviver ao Guideline 4.2) | **V1** | App **aprovado e publicado** na Play **e** na App Store. |

#### 1.3.2 Escopo EXCLUÍDO do V1 (é V2+)

| Excluído do V1 | Por quê |
|---|---|
| **Marketplace/iFood da construção pleno** (organizar 160k lojas, spread por elo, CUB proprietário, predição de falta, selo/homologação em escala) | F8/escala; V1 entrega o *rail*, não o marketplace pleno. |
| **Campo E8-E10** (ponto de obra GPS, compras totem+iFood com spread, voz→materiais, diário 100% automático, SST) | Backlog F6+. |
| **Lalamove / logística de entrega**, alerta preditivo de falta | F8. |
| **2FA + Enterprise + API pública** | Pós-rede madura. |
| **Copiloto de Voz Global + Agent Builder por IA + editor de fluxo visual** | F7-8; V1 tem IA "sugere e mostra" + playbooks, não autonomia plena. |
| **Elo Comunidade(Membros)→CRM automático + feed tempo real** | Órfã #29, futura; sem `membro_id`/webhook hoje. |
| **Internacionalização** | F8. |
| **IAP dentro do app iOS** (billing pago no app) | **Decisão do dono:** manter billing **na web** (B2B) para evitar comissão 15–30% e rejeição 3.1.1. |

#### 1.3.3 Janelas do dono que o V1 EXIGE

| Janela do dono | Destrava | Tipo |
|---|---|---|
| 🚩 **Decisão de preços SaaS (planos) + markup de Tijolos** | MET-05 | Decisão |
| 🚩 **Política de hold do clawback (dias)** | F5 | Decisão |
| 🚩 **Modelo multi-tenant A/B** (tenant próprio vs view) + fornecedor×parceiro×empresa | TEN-04, F5/F6 | Decisão |
| 🚩 **Janela Altitude 1 (RLS Faixa B real)** | F7 (Hub lê a rede + Dinheiro do Hub) | Janela Supabase |
| 🚩 **Credenciais Meta (Lead Ads/Direct) + Windsor** | Tráfego pago | Credencial |
| 🚩 **Textos jurídicos** (termos de uso + política de privacidade LGPD, base legal, retenção, DPO) | Bloqueante nas 2 lojas + `/privacidade` | Decisão/legal |
| 🚩 **Conta Apple Developer (US$99/ano, verificação 1–2 sem — abrir CEDO)** | Toda a trilha iOS | Credencial/custo |
| 🚩 **Google Play Console (US$25 única; possível teste fechado 12 testers/14 dias)** | Trilha Android | Credencial/custo |
| 🚩 **Mac/Xcode ou CI Mac (EAS/Codemagic/MacinCloud)** — equipe é Windows | Build iOS | Custo/decisão |
| 🚩 **Domínio próprio HTTPS** (sair de `*.onrender.com`) | TWA `assetlinks.json` + credibilidade na revisão Apple | Config |

#### 1.3.4 Critério de SAÍDA do V1 — checklist BINÁRIO

- [ ] **F4:** primeiro **R$ de MRR** cobrado (assinatura em `hub_tenant_assinatura`) **e** primeiro **Tijolo** debitado no ledger (`hub_ia_creditos_mov`), com `IA_HARD_CAP` ligado após a régua 7/3/1.
- [ ] **F5 (gate do 2º tenant):** **12/12** do checklist de rede + **teste de intrusão interno passa**; `tenant_id` NOT NULL em 36/36 tabelas; **0** policies com `OR tenant_id IS NULL`; 0 rotas service-role sem guard de papel (RBAC-05); nenhum `NEXT_PUBLIC_*` sensível no bundle do browser.
- [ ] **F6:** **2º tenant real rodando isolado** — não lê **nenhum** dado do tenant-zero (verificado por consulta cruzada que retorna vazio).
- [ ] **Verticais:** cada tipo (IMB/PRJ/OBR/SRV/MRC/MMR/VDR/PRO) **fecha no seu tipo correto** (EST-02) e o resolver de rastreio cobre os 14 prefixos (RAS-04).
- [ ] **Portal:** cliente acessa o **Portal do Cliente** e vê status/medição/aprovação (5 medos endereçados); fornecedor acessa o **Portal do Fornecedor** com cotação/pedido.
- [ ] **Marketing:** um lead de **tráfego pago** entra com UTM atribuída e aparece o **CAC por mercado** no analytics (EVT-01 + credenciais Meta).
- [ ] **LOJAS (o gate final do V1):** app **aprovado e publicado na Play Store** (AAB assinado, Data Safety, `assetlinks.json` validando a TWA) **E na App Store** (Capacitor com push/câmera/geo passando no **Guideline 4.2**, App Privacy labels, conta demo, cookie de sessão persistindo no WKWebView). Ambos **baixáveis por um usuário final**.

**Um teste único que resume o V1:** *um segundo cliente (2º tenant), captado por um anúncio pago, baixa o app da loja, opera seu próprio negócio (qualquer vertical), paga a assinatura, e não enxerga um único dado de outro tenant.*

---

### 1.4 Tabela mestra MVP × V1 (capability por capability)

Legenda: ✅ incluído · ⬜ excluído (adiado) · 🟡 parcial/fundação (honesto: não é o recurso pleno).

| Capacidade | MVP (F0–F3) | V1 (F4–F8) | WIs / workstream | Janela do dono |
|---|---|---|---|---|
| Linhagem/raiz escrita pelo app | ✅ | ✅ | RAS-01/02/03 | 🚩 migração linhagem |
| Markup≥1, ml sem hardcode, ganho c/ valor | ✅ | ✅ | MET-01, IA-02, FIN-03, EST-03 | — |
| Rotação de segredos + backup próprio | ✅ | ✅ | órfã #4 | 🚩 credenciais |
| delete=arquiva · R7 fail-closed · mobile-cadastros | ✅ | ✅ | órfãs #25/#23/#10 | — |
| IA "sugere e mostra" (Mistral) | ✅ | ✅ | IA-01 | 🚩 chave Mistral |
| Rate-limit / IA-hardening / HMAC | 🟡 fundação | ✅ | órfãs #3/#7/#8 | config Render |
| Schema reconstruível (`db reset`) | ✅ | ✅ | FND-01 | 🚩 janela grande |
| Escrow dupla-chave real | ✅ | ✅ | OBR-01, FIN-02 | 🚩 janela + JANELA-03 + BaaS |
| Motor de comissões PREVISTA→PAGA | ✅ | ✅ | FIN-01, TEN-03(parcial) | 🚩 janela |
| Medição append-only | ✅ | ✅ | OBR-02 | 🚩 seed real |
| Funis por mercado + vocabulário | ✅ | ✅ | EST-01, LEAD-02 | decisão #7/#8 |
| Entrega correta IMB/FOR/PRO | ✅ | ✅ | EST-02 | 🚩 decisão dono |
| SLA de lead com relógio + redistribuição | ✅ | ✅ | LEAD-01 | config cron |
| MDO fonte única + alocação | 🟡 básico | ✅ pleno (campo/totem) | RAS-05, órfã #31 | recuperar Asana |
| Analytics `hub_eventos` + UTM + CAC | 🟡 fundação | ✅ (Meta/ads reais) | EVT-01 | 🚩 Meta/Windsor |
| Registros/atividade + próxima-ação obrigatória | ✅ | ✅ | órfã #13 | — |
| Financeiro operacional (a pagar/receber) | ✅ | ✅ | órfã #14 | — |
| `hub_produtos` + catálogo materiais | ✅ | ✅ | órfã #17 | 🚩 catálogo ~20 itens |
| Auditoria de IA (`hub_acoes_ia`) | ✅ | ✅ | órfã #1 (SEC-7) | — |
| Design overhaul + honestidade de telas | ✅ | ✅ | órfãs #11/#12 | — |
| **Billing / MRR / Tijolos** | ⬜ | ✅ | MET-02…05 | 🚩 preços SaaS |
| **Multi-tenant + NOT NULL + `.eq` puro** | ⬜ | ✅ | TEN-01…04 | 🚩 modelo A/B |
| **RBAC pleno (guards, chave à pessoa)** | 🟡 owners saneados | ✅ | RBAC-01…05 | 🚩 rebalancear owners |
| **Logs/observabilidade (Onda D)** | 🟡 mínimo | ✅ | órfã #2 | — |
| **LGPD anonimização + textos jurídicos** | 🟡 delete-arquiva | ✅ | LGPD-01, órfã #28 | 🚩 jurídico |
| **2º tenant (piloto rede)** | ⬜ | ✅ | LEAD-03 | 🚩 gate F5 |
| **Portal do Cliente** | ⬜ (leitura antecipável) | ✅ | POR-01 | 🚩 Altitude 1 |
| **Portal do Fornecedor** | ⬜ | ✅ | órfã #19 | — |
| **Tela do Arquiteto (Onda A)** | 🟡 ficha projeto | ✅ pleno | órfã #20 | — |
| **Config self-service (Onda C)** | ⬜ | ✅ | órfã #21 | — |
| **Marketplace/iFood, Lalamove, CUB, predição** | ⬜ | ⬜ (V2/F8) | órfãs #31/#32 | — |
| **App na Play Store** | ⬜ | ✅ | MOBILE-LOJAS Android | 🚩 Play Console + domínio |
| **App na App Store** | ⬜ | ✅ | MOBILE-LOJAS iOS | 🚩 Apple Dev + Mac/Xcode |

---

### 1.5 Mapa fase → semana → sprint (âncora — sem datas de calendário)

Ancorado nos **sprints canônicos (CAD §15 / 04)**: S1=F0 · S2=F1 · **S3–4=F2 (uma janela)** · S5–7=F3 · S8–10=F4 · S11+=F5 · depois F6/F7/F8. As Partes seguintes deste cronograma detalham semana a semana; aqui fica só a régua de referência.

| Sprint | Semanas | Fase | Marco atingido ao fim |
|---|---|---|---|
| S1 | 1–2 | F0 | Irreversível estancado + segredos rotacionados |
| S2 | 3–4 | F1 | IA ligada (WhatsApp→qualifica→1 toque) |
| **S3–S4** | **5–8** | **F2** | **Janela grande aplicada: escrow + comissão reais + schema reconstruível** |
| S5–S7 | 9–12 | F3 | **★ MVP — cliente real ponta-a-ponta sem planilha** |
| S8–S10 | 13–18 | F4 | Receita ligada (1º MRR + 1º Tijolo) |
| S11–S13 | 19–24 | F5 | Rede endurecida (12/12 + intrusão passa) |
| S14+ | 25+ | F6/F7 | 2º tenant + Portal + Altitude 1 |
| paralelo a F4→F7 | ~Sem. 13–22 do V1 | MOBILE-LOJAS | **★ V1 — publicado Play + App Store** |

> **Nota de paralelismo (honesta):** o workstream **MOBILE-LOJAS é greenfield e roda em paralelo**, não em série depois de tudo. O caminho-crítico é iOS (**conta Apple 1–2 sem de verificação + Mac/Xcode + risco de 1–2 rejeições no Guideline 4.2**), por isso a **conta Apple deve ser aberta pelo dono já no início do V1** (idealmente ainda durante o MVP, pois é só cadastro). Play ~4–6 sem; App Store ~7–9 sem a partir do início do workstream.

---

### 1.6 Honestidade — o que está verde e o que está âmbar

Regra do Plano: **não pintar de verde o que é âmbar.**

- 🟡 **Unit economics** (LTV ~R$38,7k, take 2,8%, tickets) são **ILUSTRATIVOS** — o próprio Plano marca. Não são critério de saída de nenhum marco; servem só de baliza.
- 🟡 **"~40% da visão / ~70% de MVP single-tenant"** e **R$0 de receita recorrente** são o ponto de partida real. Altitude 2 construída; Altitude 1 desenhada.
- 🔴 **Risco crítico vivo no MVP:** o **DEMO de escrow moveu R$15k reais numa camada NÃO aplicada** (constatação C2). Desfazer isso é **pré-condição** de fechar a F2 — está no checklist 1.2.4, não é opcional.
- 🟡 **Divergências de fonte a reconciliar (dívida DECISÃO-35):** (a) o 00-PAINEL usa esquema de fases **antigo e desalinhado** — este cronograma ancora no **04**; (b) o Plano diz "37 fichas", a tabela lista **36 WIs**; (c) o Plano cita "MVP em 1 trimestre" — adotado como **12 semanas / S1–S7**, mas **dependente de capacidade real da equipe** (dono + Ramon + devs) e das **janelas do dono**, que podem alongar F2/F3.
- 🟡 **IA "sugere e mostra"** no MVP: a IA **nunca aprova dinheiro** (invariante #1). Autonomia (Agent Builder pleno, voz global) é V1/F7-8.
- 🟡 **`proxy.ts` está morto** (Next espera `middleware.ts`): não bloqueia lojas, mas o gate de auth roda só nas route handlers — ponto de QA obrigatório no webview do V1.
- ⚠️ **Dois blockers de qualidade de loja hoje invisíveis:** `public/sw.js` é um **kill-switch sem `fetch` e nem registrado**, e os **ícones são placeholder "O+" gerado** — ambos reprovam qualidade de loja e **têm** que ser sanados no preparo do V1.

**Invariantes que valem em TODA WI dos dois marcos (critério de rejeição de PR):** dinheiro só com 2 humanos distintos; duas moedas nunca somam na UI; append-only onde há dinheiro/prova; delete só arquiva; `tenant_id` sempre da sessão (posse por 404, não 403); defesa na query; estender CHECK junto do vocabulário; migração aditiva/reversível só na janela do dono. **Gate de qualidade:** `tsc` limpo + `vitest` verde + screenshot antes/depois em UI antes de todo merge.


## 2. Cronograma do MVP — semana a semana (≈12 semanas)

> **Como ler.** 6 sprints de 2 semanas (Sem 1→12). Ancorado no roteiro autoritativo (04-ROADMAP/CADERNO §14–15): **Fase 0** (estancar o irreversível) → **Fase 1** (ligar IA) → **Fase 2** (aplicar o represado — a JANELA GRANDE) → **Fase 3** (operar SEM planilha = MVP-mãe). Sem datas de calendário — as semanas correm conforme a capacidade e as janelas do dono liberam.
> **Responsáveis:** `EU-code` (implementação/migração-arquivo/E2E) · `VOCÊ-dono` (janelas Supabase, chaves, decisões de negócio, contas externas) · `Ramon` (chefe de devs — revisão, apoio de migração, QA).
> **Legenda de honestidade:** ✅ verde = executável já · 🟠 âmbar = depende de janela/chave/decisão (marcado) · 🧪 ilustrativo = número/premissa não confirmada · 🚩 = **JANELA DO DONO** (ele destrava).
> **Gate de qualidade em TODA WI (invariantes CAD §16):** `tsc` limpo + `vitest` verde antes do merge; migração **aditiva+reversível** e só na janela; screenshot antes/depois em UI; loop curto `1 WI → build → E2E ao vivo → dono reage → ajusta → backup`. Não repito isso em cada linha — vale para todas.

> **Reconciliação de fase (dívida DECISÃO-35):** o 00-PAINEL usa um esquema de fases ANTIGO e divergente. Este cronograma segue o 04/CADERNO. A reconciliação dos dois documentos-mestre é uma tarefa de doc na Sem 2 (abaixo), não um bloqueio técnico.

---

### SPRINT 1 — Fase 0: Estancar o irreversível (Sem 1–2)

**Objetivo binário do sprint:** nenhum negócio novo nasce sem raiz; markup <1 é rejeitado (UI+banco); `/api/ml/*` não quebra sem Anthropic; ganho sem valor avisa; CHECK de atividades blindado no CI; e os **P0 de segurança órfãos** (rotação de segredos, R7 fail-open, delete=arquiva) fechados. É o sprint que "para a hemorragia" antes de qualquer coisa nova.

#### Semana 1 — quick-wins de código (tudo EU-code, desbloqueado) + abertura das janelas longas

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 1.1 | **MET-01** — markup ≥1 no PUT + CHECK no banco | EU-code | — | PUT com markup 0/neg retorna **400**; `INSERT`/`UPDATE` com markup<1 viola CHECK; teste vitest cobre 0, -1, 0.99, 1.0 |
| 1.2 | **IA-02** — `ml.ts` sem modelo hardcoded → wrapper `llm-completion` c/ fallback | EU-code | — | grep por nome de modelo hardcoded = 0 em `lib/ia/ml.ts`; chamada sem Anthropic **não lança**, cai no fallback; `/api/ml/*` responde 200 com engine desligada |
| 1.3 | **FIN-03** — guard UI `valor_fechado` NULL no ganho | EU-code | — | mover p/ "ganho" sem valor: banner de aviso na UI + endpoint recusa/avisa; E2E mostra o banner |
| 1.4 | **EST-03** — blindar CHECK `hub_atividades` + teste dos 6 mercados no CI | EU-code | — | adicionar tipo fora do CHECK **falha o CI**, não a produção; job vitest lista os 6 mercados e um 7º inválido reprova |
| 1.5 | 🚩 **Abrir conta Apple Developer + verificação D-U-N-S** (fora do caminho do MVP, mas a verificação leva 1–2 sem — abrir AGORA) | VOCÊ-dono | — | e-mail de conta Apple ativa recebido (ou protocolo de verificação aberto) |
| 1.6 | 🚩 **Rotação de segredos P0** (órfã #4) — `SUPABASE_SERVICE_ROLE_KEY`, PAT `sbp_`, chaves Render, senha exposta no chat | VOCÊ-dono + EU-code | — | chaves antigas revogadas; novas no Render env; app sobe com as novas; PAT do dev demitido inválido |

**Fichas — Semana 1** (as 4 WIs de código referenciam o CADERNO; as órfãs recebem ficha completa aqui):

- **MET-01** → ficha CAD §9. Resumo do COMO: `PUT` de config de markup valida `markup >= 1` antes do `update`; adicionar `CHECK (markup >= 1)` na coluna via migração aditiva. Sem isso, IA sai "de graça". Aceite: os 4 casos de teste acima.
- **IA-02** → ficha CAD §10. COMO: extrair a chamada de completion para `lib/ia/llm-completion.ts` com `try/catch` que devolve resposta-sombra quando não há provider; `ml.ts:*` passa a importar o wrapper. Pré-requisito de IA-01 não quebrar produção.
- **FIN-03** → ficha CAD §8. COMO: validação cliente (banner no card de ganho) + guarda no endpoint de transição de estágio. Invariante: dinheiro nunca entra sem valor declarado.
- **EST-03** → ficha CAD §6. COMO: teste parametrizado que insere um `tipo` de atividade por mercado (6 válidos) + 1 inválido; o inválido deve estourar o CHECK. Blinda a "quebra silenciosa".
- **★ Órfã #4 — Rotação/higiene de segredos (P0/Fase 0).** *O que o dev faz:* (a) gerar novo `service_role` no painel Supabase, novo PAT pessoal do dono (revogar o `sbp_` do dev demitido que "vale até 2036"), regenerar chaves do Render; (b) atualizar `render.yaml`/env do Render; (c) confirmar que o app sobe e autentica com as novas; (d) trocar a senha que apareceu no chat. *Arquivos:* env do Render (não versionar), `render.yaml` (só nomes de var). *Aceite binário:* chave antiga retorna 401 ao ser testada; app em produção continua logando; grep no bundle não acha segredo.

#### Semana 2 — o IRREVERSÍVEL (RAS-01) + auto-código (RAS-02) + ator (RAS-03) + P0 de segurança órfãos

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 2.1 | 🚩 **RAS-01** — linhagem `negocio_pai_id`/`negocio_raiz_id` escrita pelo app ⚠️IRREVERSÍVEL | EU-code (código) + VOCÊ-dono (janela migração) | FND-01 idealmente, mas pode ir com migração aditiva mínima | 100% dos negócios **novos** nascem com raiz preenchida; backfill dos existentes rodado; E2E cria negócio-filho e a raiz aponta ao ancestral certo |
| 2.2 | **RAS-02** — UNIQUE código + auto-código no banco (trigger BEFORE INSERT + contador por-tenant) | EU-code | — | dois negócios não colidem código; código gerado no banco (não no app); teste concorrente de 100 inserts sem duplicata |
| 2.3 | **RAS-03** — `hub_eventos.ator_id`/`ator_codigo` (quem, não só papel) | EU-code | — | todo evento novo grava ator; consulta "quem fez X" resolve para pessoa; ajuda EVT-01 depois |
| 2.4 | **★ R7 fail-OPEN → fail-CLOSED** (órfã #23) — papel desconhecido cai em 'comercial' | EU-code | — | papel não mapeado retorna **negado**, não 'comercial'; teste com papel lixo é rejeitado |
| 2.5 | **★ delete=arquiva** (órfã #25) — 5 endpoints sem coluna de arquivo | EU-code | migração aditiva (coluna `arquivado_em`) | os 5 endpoints marcam `arquivado_em` em vez de `DELETE`; invariante #4 cumprida; registro some da lista mas existe no banco |
| 2.6 | **Reconciliar 2 docs-mestre** (DECISÃO-35) — 00-PAINEL alinhado ao 04 | EU-code (doc) | — | 00-PAINEL aponta ao esquema de fases do 04; tabela de gates corrigida; nota de dívida fechada |
| 2.7 | 🚩 **Push de backup próprio no GitHub** (órfã) + criar usuário demo do tenant zero (será usado no E2E e depois nas lojas) | VOCÊ-dono + EU-code | rotação de segredos | repo espelhado em conta do dono; login demo funciona |

**Fichas — Semana 2:**

- **RAS-01** → ficha CAD §2. ⚠️ **É a migração irreversível — exige JANELA DO DONO.** COMO: `hub_negocios` ganha `negocio_pai_id` e `negocio_raiz_id`; a criação de negócio no app passa a preencher (raiz = self quando não há pai; herda a raiz do pai quando há); backfill calcula a árvore para os existentes. Aceite acima. **Ordem:** idealmente depois de FND-01 (baseline), mas se a janela da Fase 2 escorregar, vai antes com uma migração aditiva mínima — o custo de esperar (negócios órfãos de raiz nascendo todo dia) é maior que o de baselinar depois.
- **RAS-02** → ficha CAD §2. COMO: `UNIQUE(tenant_id, codigo)` + trigger `BEFORE INSERT` que puxa contador por-tenant. Tira a geração de código do app (fonte de corrida).
- **RAS-03** → ficha CAD §2. COMO: colunas `ator_id`/`ator_codigo` em `hub_eventos`; o gravador de evento passa o autor da sessão.
- **★ Órfã #23 — R7 fail-open.** *O que o dev faz:* em `lib/crm/crm-permissoes.ts:46` (resolução de papel), trocar o default silencioso `'comercial'` por **negar** quando o papel não está no mapa; logar o papel desconhecido. *Aceite:* request com papel inexistente recebe 403/404, não acesso comercial.
- **★ Órfã #25 — delete=arquiva em 5 endpoints.** *O que o dev faz:* migração aditiva adiciona `arquivado_em timestamptz` onde falta; os 5 handlers de DELETE viram `UPDATE ... SET arquivado_em = now()`; as listagens filtram `arquivado_em IS NULL`. *Aceite:* invariante #4 (delete só arquiva) verdadeira em produção; item some da lista e persiste no banco.

> **Ponto de checagem fim-de-Sprint-1:** rodar o E2E ao vivo criando um negócio → confirmar raiz+código+ator gravados, markup<1 recusado, ganho-sem-valor avisando. Se verde, Fase 0 fechada.

---

### SPRINT 2 — Fase 1 (IA, se a chave vier) + PREP da Fase 2 + órfãs P0 de operação (Sem 3–4)

**Objetivo binário:** ligar a IA em "sugere e mostra" (WhatsApp→IA qualifica→1 toque confirma) **se** a chave Mistral chegar; e **em paralelo** preparar tudo o que a JANELA GRANDE da Fase 2 vai aplicar, para que a janela seja curta e ensaiada. Honestidade: Fase 1 é 🟠 âmbar — **depende da credencial+billing do dono**. Se não vier nesta janela, o sprint continua com a prep da Fase 2 e a IA desliza sem bloquear o MVP.

#### Semana 3 — Fase 1 (IA) quando a chave existir + rate-limit + auditoria de escrita da IA

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 3.1 | 🚩 **IA-01** — ligar Mistral + validar engine (copiloto, Agent Builder) em "sugere e mostra" | EU-code (código pronto) | 🚩 **credencial Mistral + billing do dono**, MET-01, IA-02 | lead entra via WhatsApp → IA qualifica → humano confirma em **1 toque** ponta-a-ponta; IA nunca aprova sozinha (invariante #1) |
| 3.2 | **★ Rate-limit distribuído (Redis)** (órfã #3) — anti-abuso em tudo que toca IA | EU-code | Redis provisionado no Render | rota de IA excede N req/min por tenant/IP → **429**; teste de estouro barra; sem Redis cai em limite em-memória degradado |
| 3.3 | **★ SEC-7 / `hub_acoes_ia`** (órfã #1) — IA grava auditoria de TUDO que escreve | EU-code | tabela nova (aditiva) | toda escrita da IA registra linha em `hub_acoes_ia` (ferramenta, alvo, antes/depois); ponto de injeção `executar-ferramenta-ia.ts:593` + `agente-ferramentas-registry.ts:1172` cobertos |
| 3.4 | **★ Cron/webhook forjável → HMAC real** (órfã #8) — timestamp/nonce; WhatsApp só via worker | EU-code | `CRON_SECRET`/`COPILOTO_HMAC_SECRET` no Render (dono) | webhook sem assinatura válida/nonce repetido = **rejeitado**; WhatsApp não escreve direto, só via fila→worker |

#### Semana 4 — PREP da JANELA (ensaiar FND-01/OBR/FIN em branch) + config Render + higiene de banco

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 4.1 | **FND-01 (ensaio)** — baseline migration montada e testada em branch Supabase | EU-code | — | `db reset` em branch reconstrói o schema limpo; `db diff` **vazio**; roteiro de aplicação escrito |
| 4.2 | **FIN-02 (código pronto, NÃO aplicado)** — fix escrow: trocar `GREATEST(0,…)` por `RAISE` + `FOR UPDATE` | EU-code | OBR-01 na aplicação | migração escrita e testada em branch; E6 **marcada como "não aplicar até FIN-02"**; teste reproduz a custódia-fantasma e o fix a barra |
| 4.3 | **TEN-03 (parcial) — vínculos** — fechar RLS de `hub_negocio_vinculos` (`USING(true)`+GRANT anon) | EU-code | — | policy trocada por `.eq(tenant_id)` da sessão; anon perde GRANT; teste: tenant A não lê vínculo de B — **pré-condição do motor de comissões** |
| 4.4 | **★ Config Render/cron** (órfã #5) — `CRON_SECRET`, `MOTOR_FONTE=fornecedores`, mover cron dos KPIs pro Render, matar alertas duplicados | VOCÊ-dono + EU-code | — | crons rodam no Render com secret; `MOTOR_FONTE=fornecedores` setado; sem disparo duplicado |
| 4.5 | **★ Higiene de banco** (órfã #6) — advisors: mover `pg_net`/`vector` do `public`, `search_path` de `_norm_tel`, apagar RPCs hard-delete dormentes, restringir buckets públicos | EU-code | migração aditiva | `get_advisors` sem os alertas tratados; RPCs de hard-delete não existem mais; buckets sensíveis privados |
| 4.6 | 🚩 **Decisões travantes ANTES da janela** (dono): escrow 2-chaves (papéis) · desfazer DEMO escrow R$15k · parceiro BaaS/KYC + contas-escrow por obra | VOCÊ-dono | — | decisões registradas em DECISIONS.md; DEMO de R$15k tem plano de desfazer definido |

**Fichas — Sprint 2 (órfãs):**

- **★ Órfã #3 — Rate-limit (Redis).** *O que o dev faz:* provisionar Redis (Render add-on); middleware de rate-limit por chave `tenant:user:ip` nas rotas que tocam IA (as ~mais quentes primeiro); fallback em-memória se Redis cair. *Aceite:* 429 ao estourar; teste de carga confirma o teto.
- **★ Órfã #1 — SEC-7 / `hub_acoes_ia`.** *O que o dev faz:* tabela append-only `hub_acoes_ia(id, ator_ia, ferramenta, alvo_tipo, alvo_id, payload_antes, payload_depois, ts)`; injetar o registrador nos dois pontos citados. *Aceite:* toda escrita da IA deixa rastro; casa com a Central de Aprovações (Fase 3).
- **★ Órfã #8 — Webhook/cron HMAC.** *O que o dev faz:* validar `X-Signature` = HMAC(timestamp+body) com `COPILOTO_HMAC_SECRET`; rejeitar timestamp fora de janela e nonce repetido; garantir que o handler do WhatsApp só enfileira. *Aceite:* replay e assinatura inválida rejeitados.
- **★ Órfã #6 — Higiene de banco.** *O que o dev faz:* migrações aditivas movendo extensões `pg_net`/`vector` para schema próprio, setando `search_path` seguro em `_norm_tel`, dropando RPCs de hard-delete dormentes (invariante #4), tornando buckets sensíveis privados e criando os buckets do "Passo D". *Aceite:* `get_advisors` limpo nos itens listados.
- **★ Órfã #5 — Config Render/cron** → aceite acima. É trabalho de config do dono + ajuste de `render.yaml`.

> **Honestidade:** se a chave Mistral **não** vier no Sprint 2, IA-01 (3.1) fica 🟠 pendente e desliza — **não bloqueia** Fase 2 nem o MVP. A prep da janela (Sem 4) é o que realmente carrega o cronograma aqui.

---

### SPRINT 3 — Fase 2: A JANELA GRANDE do dono (Sem 5–6)

**Objetivo binário:** obra real com **EAP + medição + escrow dupla-chave (2 humanos distintos)**; comissão real do estado **PREVISTA→PAGA**; dinheiro de terceiros só na camada aplicada (fecha a constatação **C2**); schema **reconstruível** (`db reset` limpo). Esta é **a** janela — tudo o que foi ensaiado no Sprint 2 é aplicado numa sequência exata, com o dono presente.

#### Semana 5 — 🚩 JANELA DE MIGRAÇÃO GRANDE (aplicar o represado, na ordem exata)

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 5.1 | 🚩 **FND-01** — aplicar baseline migration em produção | EU-code + VOCÊ-dono (janela) | ensaio 4.1 verde | `db reset` reconstrói prod-schema; `db diff` vazio pós-aplicação |
| 5.2 | 🚩 **OBR-01** — aplicar camada AEC na ordem `E0→E0b→E2→E3→E5→E7→E7b→A0→A1` | EU-code + VOCÊ-dono | FND-01 | as 13 tabelas AEC no ar; RLS ok; ⚠️ `custo_total` permanece soma inline `(loc+mat+mo)*qtd` — **não** vira GENERATED encadeado |
| 5.3 | 🚩 **FIN-02** — aplicar fix escrow (`RAISE`+`FOR UPDATE`) e **SÓ ENTÃO** aplicar **E6** | EU-code + VOCÊ-dono | OBR-01 | custódia-fantasma impossível (teste tenta valor negativo → `RAISE`); E6 aplicada depois do fix; **C2 fechada** |
| 5.4 | 🚩 **Desfazer DEMO escrow (R$15k)** — risco crítico vivo | EU-code + VOCÊ-dono | FIN-02 aplicado | os R$15k da camada NÃO-aplicada revertidos/migrados p/ a camada aplicada; auditoria confirma saldo correto |

#### Semana 6 — medição append-only + comissões em produção + validação E2E da obra real

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 6.1 | **OBR-02** — medição append-only atômica (RPC `rpc_registrar_medicao`) | EU-code | OBR-01 aplicado | medição só via RPC; correção = linha negativa (nunca update/delete); teste concorrente sem race |
| 6.2 | **FIN-01** — motor de comissões em produção (5 estados PREVISTA→APURADA→EXIGÍVEL→APROVADA→PAGA) | EU-code | TEN-03 vínculos (4.3), FND-01 | comissão real percorre os 5 estados; dupla-chave exigida na aprovação (chave_hub ≠ chave_técnica, 2 humanos) |
| 6.3 | 🚩 **JANELA-03** — `engenheiro_responsavel_id` amarra `escrow:chave_tecnica` à pessoa (não ao papel) (órfã #24) | EU-code + VOCÊ-dono | OBR-01 | escrow valida a chave técnica pela **pessoa** responsável da obra, não pelo papel; teste com pessoa errada é barrado |
| 6.4 | **★ Seed de dinheiro real + recuperar docs de obras do Asana** (órfã #9) | VOCÊ-dono + EU-code | acesso Asana | recebíveis/medições da obra Consulado seedados; docs de GESTÃO DE OBRAS (base do módulo Engenharia) recuperados |
| 6.5 | **E2E da obra real** — EAP → medição → escrow 2-chaves → comissão PREVISTA→PAGA | EU-code + Ramon (QA) | 6.1–6.3 | uma obra real roda o ciclo completo ao vivo; dono valida; screenshot antes/depois |

**Fichas — Sprint 3** (as WIs referenciam CAD §1/§7/§8; destaques):

- **FND-01** → CAD §1. É o baseline que torna o schema reconstruível — pré-requisito de tudo que aplica depois.
- **OBR-01** → CAD §7. ⚠️ **A ordem das migrações AEC é literal** — aplicar fora de ordem quebra dependências. A armadilha do `custo_total` (não encadear GENERATED) está na ficha.
- **FIN-02** → CAD §8. ⚠️ **Ordem travada:** fix (`GREATEST→RAISE` + `FOR UPDATE`) **antes** de E6. Sem isso, custódia-fantasma persiste. Fecha C2.
- **OBR-02 / FIN-01** → CAD §7/§8. Medição atômica e motor de comissões — invariantes #1 (2 humanos) e #3 (append-only).
- **★ Órfã #24 — chave técnica por pessoa (JANELA-03).** *O que o dev faz:* usar `hub_obras.engenheiro_responsavel_id`; o guard de `escrow:chave_tecnica` valida contra essa pessoa, não contra o papel. *Aceite:* aprovação técnica por quem não é o responsável é rejeitada.
- **★ Órfã #9 — docs Asana.** *O que o dev faz:* dono reabre acesso à conta convidado; exportar/trazer os docs de gestão de obras que são a base do módulo Engenharia. *Aceite:* docs no repo/insumos; seed de dinheiro real aplicado.

> **🚩 Este é o sprint mais dependente do dono.** Se a janela não abrir, **todo o Sprint 3 desliza em bloco** — é o caminho crítico do MVP. Recomendação franca: agendar a janela com o dono já no fim do Sprint 2, com o roteiro ensaiado em mãos.

---

### SPRINT 4 — Fase 2 conclusão + início Fase 3 (Sem 7–8)

**Objetivo binário:** fechar as arestas da Fase 2 (MDO como fonte única, resolvedor de rastreio dos 14 prefixos) e **começar** a Fase 3 desmontando os dois maiores bloqueadores de "operar sem planilha": o vocabulário de estágio duplicado (LEAD-02) e a entrega errada de IMB/FOR/PRO (EST-02).

#### Semana 7 — MDO fonte única + rastreio completo + vocabulário de estágio

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 7.1 | **RAS-05** — MDO fonte única (`hub_especialistas`+CPF+dedup) + `hub_obra_alocacoes` | EU-code | obra em prod (Sprint 3) | especialista cadastrado 1x por CPF (dedup); alocação obra↔especialista gravada; histórico de execução por pessoa |
| 7.2 | **RAS-04** — resolvedor de rastreio cobre os 14 prefixos (OBR/PRJ/SRV/MRC/MMR/VDR/FOR/ESP…) | EU-code | — | colar qualquer código dos 14 prefixos resolve para a entidade certa; teste cobre os 14 |
| 7.3 | **LEAD-02** — consolidar vocabulário de estágio (risco loop P0) via `legacyToFunil` | EU-code | — | um único vocabulário de estágio; `estagio-map.ts` normaliza legado; teste prova ausência de loop de auto-avanço |
| 7.4 | **★ Registros/atividades por entidade — gaps P0 do rastreador** (órfã #13) — próxima-ação OBRIGATÓRIA com bloqueio global na API + follow-up por prazo + alerta de oportunidade parada | EU-code | — | ganhar/avançar sem próxima-ação definida é **bloqueado na API**; oportunidade sem toque há N dias gera alerta; timeline nos 4 cadastros |

#### Semana 8 — entrega correta por mercado + financeiro operacional (fundação) + mobile-cadastros

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 8.1 | **EST-02** — entrega correta IMB/FOR/PRO (não "vira obra") | EU-code | 🚩 decisão dono #7/#8 (o que cada fecho gera) | fechar um IMB gera desfecho imobiliário (não obra); FOR/PRO idem; E2E por mercado |
| 8.2 | **EST-01** — funis próprios por mercado (config `hub_pipeline_estagios`) | EU-code | LEAD-02 | cada mercado tem estágios próprios por config (sem re-arquitetar); trocar estágios de um mercado não afeta os outros |
| 8.3 | **★ Financeiro OPERACIONAL — fundação** (órfã #14) — lançamentos automáticos por evento (ganho→receber / medição→pagar) + contas a pagar/receber | EU-code | FIN-01/OBR-02 (Sprint 3) | evento de ganho gera "a receber"; medição gera "a pagar"; menu ⋮ por linha corrige pago/recebido; consolidação elimina `#REF!` |
| 8.4 | **★ Mobile-cadastros** (órfã #10, PRIORIDADE ALTA do dono) — corrige criação de PF/empresa no mobile (`hidden md:block`), redesign da nav | EU-code | — | no mobile é possível criar PF e empresa; 3º header removido; E2E mobile ao vivo cria os dois |
| 8.5 | 🚩 **Decisões de produto travantes** (dono): captação pública (quais forms sem login) · fornecedor×parceiro×empresa · valor do lead (faixa/exato) | VOCÊ-dono | — | decisões registradas; destravam EVT-01 e captação da Fase 3 |

**Fichas — Sprint 4** (WIs → CAD §2/§5/§6; órfãs completas):

- **RAS-05 / RAS-04 / LEAD-02 / EST-01 / EST-02** → fichas CAD §2, §5, §6. Destaque: EST-02 depende de **decisão do dono** sobre o que cada tipo de fecho gera (por isso o gate 8.5).
- **★ Órfã #13 — gaps P0 do rastreador (próxima-ação/follow-up/alerta-parado).** *O que o dev faz:* guarda global na API que rejeita transição sem `proxima_acao`+prazo; job que varre oportunidades sem toque > N dias e emite alerta; componente de timeline reutilizável nos 4 cadastros (com "agendar reunião/registrar ligação/visita"). *Aceite:* binários acima. **É P0 pelo próprio rastreador do código.**
- **★ Órfã #14 — Financeiro operacional.** *O que o dev faz:* trigger/serviço que, no evento de ganho, cria linha em "a receber"; na medição aprovada, cria "a pagar"; menu ⋮ por linha para corrigir status; view de consolidação das 4 fontes que elimina `#REF!` da planilha. *Aceite:* binários acima. **É o coração do "sem planilha".**
- **★ Órfã #10 — Mobile-cadastros.** *O que o dev faz:* remover `hidden md:block` que esconde os forms no mobile; garantir POST de PF/empresa no viewport pequeno; redesenhar a nav (remover 3º header). *Aceite:* E2E mobile cria PF e empresa.

---

### SPRINT 5 — Fase 3: operar sem planilha — SLA, analytics, produtos (Sem 9–10)

**Objetivo binário:** montar as peças que faltam para o ciclo rodar **inteiro** dentro do sistema: SLA com relógio de verdade (LEAD-01), analytics que consome eventos + captura UTM (EVT-01), e a tela de Produtos/materiais (órfã #17) que hoje **não existe** e faz a tela de Compras abrir vazia.

#### Semana 9 — SLA com relógio + analytics/eventos + IA nas telas-âncora

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 9.1 | **LEAD-01** — SLA com relógio (`ts_oferta`/`ts_resposta`) + cron `*/5min` de redistribuição | EU-code | cron no Render (Sprint 2) | lead ofertado sem resposta no prazo é redistribuído pelo cron; relógio real gravado; teste simula estouro de SLA |
| 9.2 | **EVT-01** — analytics consome `hub_eventos` + captura UTM + coorte MERCADO×ORIGEM + CAC | EU-code | RAS-03 (ajuda), decisão captação (8.5) | dashboard lê eventos reais; UTM capturada no lead; coorte mercado×origem e CAC por bairro visíveis |
| 9.3 | **★ Injetar IA nas telas-âncora** (órfã #15) — negócio/lead/atendimento: sugerir próxima ação, preview de encaminhamento, card "A IA entendeu assim", barra "Perguntar à IA" | EU-code | IA-01 ligada | as 3 telas-âncora mostram sugestão da IA; rejeitar registra motivo→aprendizado; IA nunca decide sozinha |
| 9.4 | **★ Camada de eventos/Notificações in-app** (órfã #16) — fundação para SLA/alertas | EU-code | — | evento relevante gera notificação in-app; base para push da V1 |

#### Semana 10 — Produtos/materiais + Tela do Arquiteto + auditoria-IA na Central

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 10.1 | **★ `hub_produtos` + Tela Produtos** (órfã #17) — modelar PRODUTO/SERVIÇO-de-obra + catálogo materiais | EU-code | 🚩 dono: catálogo ~20 itens (BLOQUEANTE) | tabela `hub_produtos` existe; Tela Produtos lista/cria; ~20 itens seed + importar ~500 reais; **Compras deixa de abrir vazia** |
| 10.2 | **★ Onda A — Tela do Arquiteto / ficha de projeto** (órfã #20) — carteira de PROJETOS + `po-proj-ficha` (P0) | EU-code | A0/A1 (Sprint 3) | arquiteto vê carteira de projetos com financeiro próprio; ficha de projeto/briefing/aprovações abre |
| 10.3 | **★ Logs/observabilidade unificado — Onda D** (órfã #2) — `hub_error_logs`, request_id/trace_id, logger nas rotas, PII redigida | EU-code | — | erro grava com trace_id; PII redigida no log; retenção configurada; base para debugar produção |
| 10.4 | **FND-02 (início)** — centralizar `crmDb` (matar ~82 clients inline) + lint rule | EU-code | — | novo lint rule barra client inline; ao menos a fatia quente migrada para `crmDb` central |

**Fichas — Sprint 5:**

- **LEAD-01 / EVT-01** → CAD §5, §11. EVT-01 depende da decisão de captação (gate 8.5) para saber quais forms públicos capturam UTM.
- **★ Órfã #15 — IA nas telas-âncora.** *O que o dev faz:* componente de "sugestão da IA" plugado em negócio/lead/atendimento; endpoint que retorna próxima-ação sugerida + preview de encaminhamento; ao rejeitar, grava motivo em `hub_acoes_ia` (aprendizado). *Aceite:* as 3 telas exibem sugestão; humano confirma/rejeita.
- **★ Órfã #17 — `hub_produtos`/Tela Produtos.** *O que o dev faz:* migração cria `hub_produtos` (modelando PRODUTO e SERVIÇO-de-obra); UI de listagem/criação; seed dos ~20 itens de material (o dono fornece — **BLOQUEANTE**) e import dos ~500 reais. *Aceite:* Compras abre com catálogo, não vazia. **Sem os 20 itens do dono, esta WI trava.**
- **★ Órfã #20 — Tela do Arquiteto.** *O que o dev faz:* view de carteira de projetos usando A0/A1; ficha `po-proj-ficha` (briefing/programa/aprovações). *Aceite:* arquiteto opera projetos com financeiro próprio.
- **★ Órfã #2 — Logs/observabilidade (Onda D).** *O que o dev faz:* `hub_error_logs` + middleware de logger com `request_id`/`trace_id` nas ~187 rotas (fatia quente primeiro), redigindo PII; política de retenção. *Aceite:* erro rastreável por trace_id; sem PII no log.

---

### SPRINT 6 — Fase 3 conclusão: o E2E do cliente real SEM planilha (Sem 11–12)

**Objetivo binário — o MVP-mãe:** **o próximo cliente real roda ponta-a-ponta SEM planilha.** Este sprint fecha os polimentos de honestidade de tela, o design overhaul de marca, e executa o **E2E completo do cliente real** — captação → qualificação IA → CRM/funil → obra (EAP/medição/escrow 2-chaves) → comissão → financeiro operacional — tudo dentro do sistema.

#### Semana 11 — honestidade de telas + design overhaul + gestor de tarefas "Hoje"

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 11.1 | **★ Polimento UX + honestidade de telas** (órfã #12) — remover barra 42% falsa, "85% confiança" inventado; motivo de perda obrigatório; seletor por nome (não-UUID); KPIs sobre TODOS os registros; toasts/máscaras/skeleton; AA | EU-code | — | nenhum número inventado na UI; perda exige motivo; seletores mostram nome; KPIs batem com o total do banco |
| 11.2 | **★ Design overhaul** (órfã #11) — ~97 azuis-roxos off-brand em 29 arquivos → verde+dourado; `CadastroPremiumSideover` deixa de herdar azul Shadcn | EU-code | — | grep por azul-roxo off-brand = 0 nos 29 arquivos; tokens `--obra-*` aplicados; screenshot antes/depois |
| 11.3 | **★ Gestor de Tarefas universal + Tela "Hoje"** (órfã #22) — resolver stubs de menu (/crm/conteudo, Tarefas, Ferramentas IA) | EU-code | órfã #13 (próxima-ação) | todo verbo/pendência aparece na Tela "Hoje" por perfil; stubs de menu resolvidos ou honestamente marcados "em breve" |
| 11.4 | **★ LGPD-01 — anonimização** (WI, CAD §13) — `anonimizarPessoa` preserva linhagem, zera PII | EU-code | RAS-01 | anonimizar uma pessoa zera PII e mantém a linhagem do negócio; teste confirma PII removida |

#### Semana 12 — E2E do cliente real + Portal do Cliente (leitura) + fechamento do MVP

| # | Entrega (WI) | Responsável | Depende | Pronto (binário) |
|---|---|---|---|---|
| 12.1 | **E2E ponta-a-ponta do cliente real SEM planilha** | EU-code + Ramon (QA) + VOCÊ-dono | todo o Sprint 1–5 | captação→IA qualifica→CRM/funil→obra(EAP/medição/escrow 2-chaves)→comissão PREVISTA→PAGA→financeiro operacional, **tudo no sistema, zero planilha**; dono valida ao vivo |
| 12.2 | **POR-01 (leitura antecipável)** — Portal do Cliente MVP (os 5 medos), só leitura por ora | EU-code | OBR-01/02, FIN-02 (aplicados) | cliente vê status da obra/medição/próximos passos (os 5 medos endereçados em leitura); aprovações ficam para pós-Fase 2 concluída |
| 12.3 | **★ Deleção de código morto do Escritório Virtual legado** (órfã #26) — ~50 arquivos (`components/office/*`, `useOfficeLife`/`useLiveLeads`, mocks) ⚠️ **NÃO** remover `lib/data/office-map.ts` nem `/api/hub/agentes` | EU-code | — | `tsc`+`vitest` verdes após remoção; os 2 arquivos protegidos intactos; bundle menor |
| 12.4 | **Retro do MVP + backup + travar baseline** | EU-code + Ramon + VOCÊ-dono | 12.1 verde | MVP declarado pronto (critério-mãe atingido); backup nos 2 GitHubs; ponto de retorno documentado |

**Fichas — Sprint 6:**

- **★ Órfã #12 — honestidade de telas.** *O que o dev faz:* remover barras/percentuais/hard-coded ("42%", "85% confiança"); tornar motivo de perda obrigatório; trocar seletores UUID por nome; garantir que KPIs do backend agreguem sobre **todos** os registros (não a página); adicionar toasts/máscaras/skeleton; passar em contraste AA. *Aceite:* binários acima. **Regra do dono: funcional, não fachada.**
- **★ Órfã #11 — Design overhaul.** *O que o dev faz:* substituir os ~97 azuis-roxos por verde+dourado tokenizado `--obra-*` nos 29 arquivos; corrigir `CadastroPremiumSideover` que herda azul do Shadcn. *Aceite:* grep zero + screenshot antes/depois. (Usar ui-ux-pro-max/frontend-design conforme CLAUDE.md.)
- **★ Órfã #22 — Gestor de Tarefas + Tela "Hoje".** *O que o dev faz:* agregar toda próxima-ação/pendência (da órfã #13) numa Tela "Hoje" por perfil; resolver ou marcar honestamente os stubs de menu. *Aceite:* pendências aparecem por perfil; sem menu que leva a tela quebrada.
- **LGPD-01** → CAD §13. Anonimização preservando linhagem (invariante de rastreabilidade).
- **POR-01** → CAD (Fase 7 na fonte, mas **leitura antecipável** pós-Fase 3). Aprovações do portal só depois da Fase 2 100% estável.
- **★ Órfã #26 — código morto.** ⚠️ *Guarda-rail:* remover os ~50 arquivos legados **exceto** `lib/data/office-map.ts` e `/api/hub/agentes` (são vivos). *Aceite:* build verde, protegidos intactos.

---

### Resumo dos GATES DO DONO no caminho do MVP (onde ele destrava)

| Sprint | Janela/decisão do dono | O que ela destrava | Se atrasar |
|---|---|---|---|
| 1 | 🚩 Rotação de segredos P0 + abrir conta Apple | segurança da rede + trilha iOS (V1) | segurança fica exposta; iOS desliza (fora do MVP) |
| 1 | 🚩 Migração RAS-01 (linhagem irreversível) | raiz em 100% dos negócios | negócios órfãos de raiz nascendo — **não adiar muito** |
| 2 | 🚩 Chave Mistral + billing | Fase 1 (IA) inteira | IA-01 desliza; **não bloqueia** Fase 2/MVP |
| 2 | 🚩 Config Render/cron + `COPILOTO_HMAC_SECRET`/`CRON_SECRET` | SLA (cron), webhooks seguros | LEAD-01 e HMAC deslizam |
| 2 | 🚩 Decisões: escrow 2-chaves (papéis) · desfazer DEMO R$15k · BaaS/KYC | Fase 2 real | **bloqueia a janela grande** |
| **3** | 🚩🚩 **JANELA DE MIGRAÇÃO GRANDE** (FND-01+OBR-01+FIN-02+FIN-01) + JANELA-03 + docs Asana | **todo o núcleo de dinheiro/obra** | **caminho crítico — Sprint 3 inteiro desliza em bloco** |
| 4 | 🚩 Decisões: o que cada fecho IMB/FOR/PRO gera · captação pública · valor do lead | EST-02, EVT-01, captação | entrega errada por mercado persiste |
| 5 | 🚩 Catálogo ~20 itens de materiais | Tela Produtos / Compras não-vazia | Compras segue abrindo vazia |

**Nota final de honestidade.** O caminho crítico do MVP é a **JANELA GRANDE do Sprint 3** — sem ela, comissões/escrow/AEC continuam represados e o MVP não fecha, por mais que o resto avance. A **Fase 1 (IA)** é 🟠 âmbar e desacoplada: se a chave não vier, o MVP ainda fecha (IA entra "sugere e mostra" depois). As 12 semanas assumem capacidade estável da equipe (dono + Ramon + devs) e que as janelas do dono abram no início de cada sprint que as exige; qualquer atraso de janela empurra o bloco correspondente sem reordenar o resto. Publicação nas lojas (iOS/Android) **não** faz parte deste MVP — é escopo V1 (Parte 3), como o objetivo define.


## 3. Cronograma da V1 — semana a semana (pós-MVP até publicar)

> **Continuação da numeração.** O MVP (Fases 0–3) ocupou **Semanas 1–12** (Sprints S1–S6). A V1 começa na **Semana 13** e vai até a publicação nas lojas. Meta honesta: **V1 completo ≈ Semanas 13–37 (~6 sprints de receita/rede + verticais + mobile)**. A trilha iOS é o caminho crítico e o gargalo — por isso **abre-se a conta Apple Developer já na Semana 13** (verificação 1–2 semanas), mesmo que o build só aconteça nas Semanas 30+.
>
> **Modelo de trilhas paralelas.** A partir da V1 a equipe roda em **4 trilhas simultâneas**:
> - **Trilha A — Dinheiro & Rede (EU-code):** Fase 4 (receita) → Fase 5 (endurecer). Caminho crítico irreversível.
> - **Trilha B — Verticais & Produto (Ramon + devs):** marketing, portais, obras, serviços, materiais, MDO, copiloto.
> - **Trilha C — Órfãs & Higiene (dev rotativo):** as 32 pendências da varredura, distribuídas.
> - **Trilha D — Mobile & Lojas (dev + VOCÊ-dono nos gates):** greenfield, começa cedo por causa da verificação Apple.
>
> **Legenda:** 🚩 = JANELA/GATE DO DONO (chave, migração, decisão, custo, conta externa). Responsável: **EU-code** / **VOCÊ-dono** / **Ramon**. "Pronto" é sempre **binário/testável**. Para as 36 WIs do caderno cito a ficha (`CAD §x`); para órfãs e itens granulares escrevo a ficha completa.
>
> **Dívida de reconciliação herdada (MAPA DECISÃO-35):** o `00-PAINEL` usa numeração de fase ANTIGA divergente do `04-ROADMAP`. Este cronograma ancora **100% no 04**. Tarefa REC-00 (Semana 13, EU-code, P): reescrever o quadro de fases do `00-PAINEL` para bater com o 04 e marcar o `00` como "derivado". Pronto: os dois docs citam a mesma tabela de fases 0–8.

---

### 🔓 Pré-abertura de gates lentos (disparar na Semana 13, valem para toda a V1)

Estes não são "trabalho de dev" — são **relógios externos** que, se não começarem agora, viram o gargalo depois. Todos VOCÊ-dono.

| # | Gate | Por que abrir na Sem. 13 | Destrava | Pronto (binário) |
|---|---|---|---|---|
| 🚩 G1 | **Conta Apple Developer Program** (US$ 99/ano) + verificação D-U-N-S se PJ | Verificação leva **1–2 semanas**; é o caminho crítico do iOS | Toda a Trilha D iOS (Sem. 30+) | Conta "Active" no App Store Connect + 1 usuário de time |
| 🚩 G2 | **Google Play Console** (US$ 25 único) | Conta nova pode exigir **teste fechado 12 testers/14 dias** antes de produção | Trilha D Android | App criado no console + política de closed-testing confirmada |
| 🚩 G3 | **Domínio próprio HTTPS** (ex. `app.obra10.com.br`) + apontar no Render | TWA (`assetlinks`) e revisão Apple exigem sair de `*.onrender.com` | Mobile inteiro + credibilidade | `https://app.obra10.com.br` serve prod; `NEXT_PUBLIC_APP_URL` atualizado (`render.yaml:65`) |
| 🚩 G4 | **Credenciais Meta (Lead Ads/Direct) + Google Ads + Windsor** | Tráfego pago não roda sem token de sistema | Trilha B Marketing (Sem. 23) | Tokens no cofre do Render; webhook Meta valida assinatura |
| 🚩 G5 | **Parceiro BaaS/KYC de escrow** + abertura de contas-escrow por obra | Escrow real (não DEMO) precisa de custódia de terceiro | FIN-02 aplicado em prod real | Contrato assinado + sandbox conectado |
| 🚩 G6 | **Textos jurídicos** (Termos de Uso + Privacidade LGPD + doc usuário final) | Bloqueante nas 2 lojas E na Fase 5 | `/privacidade`, LGPD-01, submissão | URLs públicas revisadas por advogado |
| 🚩 G7 | **Decisão de preços SaaS** (planos + markup Tijolos) | Trava MET-05 | Fase 4 billing | 3 planos definidos com preço/entitlement por módulo |
| 🚩 G8 | **Rotação de segredos** (`SUPABASE_SERVICE_ROLE_KEY` + PAT `sbp_` do dev demitido + chaves Render + senha exposta no chat) + **push de backup no GitHub próprio** | Chave do dev demitido vale até 2036 — risco vivo | RBAC-01 / segurança de toda a V1 | Segredos antigos revogados; app roda com os novos; repo espelhado no GitHub do dono |

---

## TRILHA A — DINHEIRO & REDE (EU-code, caminho crítico)

### Sprint S7 · Semanas 13–14 · **Fase 4 (início): medir e cobrar a IA**

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 13 | **MET-02** — Consumo de IA atômico via `rpc_registrar_consumo_ia` | EU-code | MET-01 (feito na F0) | Toda chamada de IA grava 1 linha atômica em `hub_ia_creditos_mov`; teste de concorrência (2 chamadas simultâneas) não perde débito. `CAD §9` |
| 13 | **REC-00** — reconciliar `00-PAINEL` ↔ `04-ROADMAP` (DECISÃO-35) | EU-code | — | Os 2 docs citam a mesma tabela de fases |
| 14 | **MET-03** — Carteira fase 1 + top-up PIX (ledger `hub_ia_creditos_mov` + `hub_carteira_topups`, **idempotência 3 cadeados**) | EU-code | MET-02 | Top-up PIX credita 1x só (retry do webhook não duplica); saldo = soma do ledger; nunca soma BRL com Tijolo na UI (invariante #2). `CAD §9` |
| 14 | 🚩 **G7 travado** — decisão de preços SaaS entregue pelo dono | VOCÊ-dono | — | 3 planos + markup Tijolos definidos |

### Sprint S8 · Semanas 15–16 · **Fase 4 (fecho): régua de aviso + billing SaaS**

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 15 | **MET-04** — Régua de aviso 7/3/1 + ligar `IA_HARD_CAP` (**ordem travada** MET-03→régua→cap) | EU-code | MET-03 | Ao atingir 7/3/1 dias de saldo dispara notificação; com saldo 0 a IA bloqueia (não roda "de graça"). `CAD §9` |
| 15–16 | **MET-05** — Billing SaaS/MRR mínimo (`hub_planos`, `hub_tenant_assinatura`, entitlements por módulo) | EU-code | MET-03 + 🚩G7 | Tenant sem assinatura não acessa módulo pago (entitlement checa na rota); 1º boleto/PIX de assinatura registrado. `CAD §9` |
| 16 | **Órfã #16 — Camada de Eventos/Notificações (F4 in-app/push)** — fundação de F1/F5/F6 | EU-code | `hub_eventos` | Ficha abaixo |

**Ficha órfã #16 — Notificações in-app/push (fundação):**
- **COMO:** tabela `hub_notificacoes` (id, tenant_id, destinatario_id, tipo, payload jsonb, lida_em, canal). Trigger/worker lê `hub_eventos` e materializa notificação por regra. Endpoint `GET /api/notificacoes` (paginado, `tenant_id` da sessão) + `POST /marcar-lida`. Componente `<SinoNotificacoes>` no header com badge de não-lidas (polling 30s ou SSE).
- **ARQUIVOS:** nova migração `hub_notificacoes`; `app/api/notificacoes/route.ts`; `components/SinoNotificacoes.tsx`; consumer no worker de `hub_eventos`.
- **ACEITE:** evento "medição aprovada" gera notificação para o dono da obra em <5s; badge decrementa ao ler; `tenant_id` sempre da sessão (invariante #5). É a base do push mobile (Trilha D).

**Pronto Fase 4 (fim S8):** 1º R$ de MRR + 1º Tijolo cobrado; IA nunca roda sem saldo.

---

### Sprint S9 · Semanas 17–18 · **Fase 5 (início): inventário e NOT NULL de tenant** 🚩 GATE ABSOLUTO do 2º tenant

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 17 | **TEN-01** — Backfill `tenant_id NULL`→sentinela + `NOT NULL` (inventário das 36 tabelas) | EU-code | RAS-02 (feito) | Nenhuma linha com `tenant_id NULL` fora do master-data; coluna vira `NOT NULL`; migração aditiva/reversível na 🚩janela. `CAD §3` |
| 17 | 🚩 **Janela Supabase** para o backfill (migração grande) | VOCÊ-dono | — | Aplicada JUNTO via MCP na janela; virou arquivo em `supabase/migrations` |
| 18 | **TEN-02** — `.eq` puro nas policies (remover `OR tenant_id IS NULL`) | EU-code | TEN-01 | Nenhuma policy tem `IS NULL`; teste: sessão do tenant A não lê linha do tenant B (retorna 0, não erro). `CAD §3` |
| 18 | **Órfã #23 — R7 fail-OPEN → fail-CLOSED** (papel desconhecido caía em 'comercial') | EU-code | — | Ficha abaixo |

**Ficha órfã #23 — R7 fail-closed:**
- **COMO:** em `lib/crm/crm-permissoes.ts:46` o resolvedor de papel, ao não reconhecer o papel, retornava `'comercial'` (fail-open). Trocar por: papel desconhecido → **negar** (403/404 conforme invariante #5) e logar em `hub_error_logs`.
- **ARQUIVOS:** `lib/crm/crm-permissoes.ts:46`; testes em `__tests__/crm-permissoes`.
- **ACEITE:** usuário com papel `xyz` inválido não recebe permissões de comercial; teste unitário cobre "papel desconhecido → sem acesso".

### Sprint S10 · Semanas 19–20 · **Fase 5 (meio): fechar RLS, hierarquia, chaves**

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 19 | **TEN-03** — Fechar RLS das tabelas abertas (`fornecedores`, `pedidos_material`, `parceiros_*`) | EU-code | TEN-01/02 | Cada tabela tem policy `.eq(tenant_id)`; `get_advisors` não acusa RLS aberta. `CAD §3` |
| 19 | **TEN-04** — Hierarquia de tenant (`tenant_type`/`parent_tenant_id`) | EU-code | TEN-01/02/03 | Tenant-filho existe; Hub-raiz enxerga filhos por policy explícita, não por brecha. `CAD §3` |
| 19 | 🚩 **G8 — Rotação de segredos** aplicada (service_role + PAT + Render) + backup GitHub | VOCÊ-dono + EU-code | — | Segredos antigos revogados; app roda; repo espelhado |
| 20 | **RBAC-01** — Rotacionar `INTERNAL_API_KEY` + tirar `NEXT_PUBLIC_*` do browser | EU-code | 🚩G8 | Bundle do browser não contém `NEXT_PUBLIC_INTERNAL_API_KEY`/`TENANT_ID`; login retestado OK. `CAD §4` |
| 20 | **RBAC-02** — Chave do Hub à pessoa física do Hub-raiz (não ao papel `owner`) | EU-code | TEN-04 | `chave_hub` amarrada a `pessoa_id`, não a role; `CAD §4` |
| 20 | **RBAC-03** — `resolveInviteTenantId` restrito ao próprio/filhos | EU-code | TEN-04 | Convite não consegue apontar tenant fora da subárvore. `CAD §4` |

### Sprint S11 · Semanas 21–22 · **Fase 5 (fecho): guards de rota, RBAC de acesso, LGPD**

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 21–22 | **RBAC-05** — Guard de papel nas ~32 rotas service-role | EU-code | FND-02 | Cada rota service-role valida papel do chamador; teste de intrusão interno passa. `CAD §4` |
| 21 | **RBAC-04** — Tirar `CRM_OWNER_EMAILS` hardcoded + arquivar revoga acesso (status≠ativo) | EU-code | — | Owner definido em dado, não em código; usuário arquivado perde acesso na hora. `CAD §4` |
| 21 | **LGPD-01** — Fluxo de anonimização (`anonimizarPessoa`: preserva linhagem, zera PII) | EU-code | RAS-01 | Titular anonimizado zera nome/CPF/telefone mas mantém `negocio_raiz_id` (linhagem intacta). `CAD §13` |
| 22 | **Órfã #24 — `escrow:chave_tecnica` à pessoa** (JANELA-03: `hub_obras.engenheiro_responsavel_id`) | EU-code | 🚩JANELA-03 | Ficha abaixo |
| 22 | 🚩 **Decisão: política de hold do clawback (dias)** | VOCÊ-dono | — | Nº de dias travado em config |

**Ficha órfã #24 — chave técnica à pessoa (JANELA-03):**
- **COMO:** hoje `escrow:chave_tecnica` valida por **papel** (arquiteto/engenheiro). Amarrar à pessoa: coluna `hub_obras.engenheiro_responsavel_id` + guard que exige que a 2ª chave venha **daquela pessoa física** (invariante #1: 2 humanos distintos).
- **ARQUIVOS:** migração `engenheiro_responsavel_id` (🚩JANELA-03); `lib/ia/aprovacoes.ts:320/327/377-387`.
- **ACEITE:** liberação de escrow exige assinatura da pessoa responsável cadastrada, não "qualquer engenheiro"; IA/worker nunca assina (invariante #1).

**Pronto Fase 5 (fim S11):** 12/12 do checklist de segurança + teste de intrusão interno passa; **nenhum tenant lê outro**. Gate do 2º tenant liberado.

---

## TRILHA B — VERTICAIS & PRODUTO (Ramon + devs, em paralelo desde a Semana 13)

> Estas entregas rodam **em paralelo** à Trilha A. Só dependem da Trilha A onde marcado (ex.: portais que mexem em dinheiro esperam FIN-02/Fase 5).

### (c) MARKETING que gera leads — Sprints S9–S12 (Sem. 17–24)

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 17 | **MKT-01 — Captura de UTM** na captação pública | Ramon | — | Ficha abaixo |
| 18 | 🚩 **G4** — credenciais Meta/Google/Windsor entregues | VOCÊ-dono | — | Tokens no cofre |
| 19–20 | **MKT-02 — Ingestão Meta Lead Ads/Direct → fila de leads** | Ramon | 🚩G4, MKT-01 | Ficha abaixo |
| 21 | **MKT-03 — Landing/forms de captação pública sem login** | Ramon | 🚩Decisão "quais forms sem login" | Ficha abaixo |
| 22–24 | **EVT-01** — Analytics consome `hub_eventos` + coorte MERCADO×ORIGEM + **CAC por bairro/mercado** | Ramon | RAS-03 (ajuda) | `CAD §11`: dashboard mostra CAC por bairro; UTM→lead→negócio rastreável ponta a ponta |

**Ficha MKT-01 — Captura de UTM:**
- **COMO:** middleware de captação lê `utm_source/medium/campaign/content/term` + `fbclid/gclid` da querystring, persiste em `hub_leads.origem_utm jsonb` no primeiro toque; cookie de 1ª parte para atribuição pós-navegação.
- **ARQUIVOS:** rota pública de captação (`app/(public)/captar/*`); coluna `origem_utm` em `hub_leads`.
- **ACEITE:** lead criado via link `?utm_source=meta` tem `origem_utm.source='meta'` gravado; aparece no analytics.

**Ficha MKT-02 — Ingestão Meta Lead Ads/Direct:**
- **COMO:** webhook `/api/webhooks/meta` valida **assinatura HMAC do payload** (X-Hub-Signature-256), puxa o lead via Graph API com o token de sistema, normaliza e enfileira no mesmo pipeline de WhatsApp→fila→worker→IA. Rate-limit por origem.
- **ARQUIVOS:** `app/api/webhooks/meta/route.ts`; reuso do worker de qualificação; cofre de token no Render.
- **ACEITE:** lead submetido num formulário Meta aparece no CRM qualificado pela IA em <2min; assinatura inválida = 401; retry não duplica (idempotência por `lead_gen_id`).

**Ficha MKT-03 — Landing/forms públicos:**
- **COMO:** páginas públicas com form (nome/telefone/interesse) que criam lead **sem exigir login**, com captcha/rate-limit anti-spam; só os campos decididos pelo dono ficam públicos.
- **ARQUIVOS:** `app/(public)/lp/*`; rota `POST /api/publico/lead` (rate-limited).
- **ACEITE:** visitante anônimo cria lead; abuso (>N/min por IP) bloqueado; lead entra no funil com origem correta.

### (d) PORTAL IMOBILIÁRIO (vertical IMÓVEL) — Sprint S12 (Sem. 23–24)

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 23 | **EST-02 (parte IMB)** — Fechamento IMB correto (**não "vira obra"**) | Ramon | Decisão dono #7/#8 (feita na F3) | `CAD §6`: ganho de negócio IMÓVEL cria registro imobiliário, **não** gera obra/EAP |
| 23 | **IMB-01 — Captação de imóvel + funil imobiliário** | Ramon | EST-01 (funis por mercado, F3) | Ficha abaixo |
| 24 | **IMB-02 — Corretagem/atribuição `captado_por`** | Ramon | RAS-03 | Ficha abaixo |

**Ficha IMB-01 — Captação de imóvel + funil:**
- **COMO:** entidade `hub_imoveis` (ou lente sobre `hub_negocios` com `tipo=IMB`): endereço, tipo, valor, status; funil próprio via `hub_pipeline_estagios` (captado→visita→proposta→fechado) — config, não re-arquitetura.
- **ARQUIVOS:** `hub_pipeline_estagios` seed IMB; telas do funil imobiliário; `lib/crm/estagio-map.ts`.
- **ACEITE:** imóvel captado percorre o funil IMB sem cair no funil de obra; kanban IMB independente.

**Ficha IMB-02 — Corretagem `captado_por`:**
- **COMO:** campo `captado_por` (pessoa/parceiro) no negócio IMB, alimentado pelo link HMAC de atribuição (já existe para parceiro); comissão de corretagem liga no motor FIN-01 por esse campo.
- **ARQUIVOS:** `derivar-negocio.ts:32-38`; motor de comissões (`20260706170000`).
- **ACEITE:** venda de imóvel captada pelo parceiro X gera comissão PREVISTA para X; sem `captado_por`, comissão fica órfã e é sinalizada.

### (e) PROJETOS (ARQUITETURA) + OBRAS (ENGENHARIA) — Sprints S12–S13 (Sem. 23–26)

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 23 | **Órfã #20 — Onda A: Tela do Arquiteto / Módulo Arquitetura** (carteira de PROJETOS, financeiro do arquiteto, ficha `po-proj-ficha` P0) | Ramon | OBR-01 A0/A1 (feito na F2) | Ficha abaixo |
| 24 | **A0/A1 já aplicados (F2)** — expor UI: funil de projeto + aprovação por fase + programa/briefing | Ramon | OBR-01 | Projeto tem funil próprio + gate de aprovação por fase |
| 25 | **OBR — EAP/escopo + medição** já em prod (OBR-01/02) — expor **diário/RDO** | Ramon | OBR-02 | Ficha RDO abaixo |
| 26 | **OBR — Curva-S** (planejado × medido) | Ramon | OBR-02 | Curva-S renderiza a partir de medições append-only; bate com o físico medido |
| 25 | 🚩 **Recuperar docs de obras do Asana** (base do módulo Engenharia) | VOCÊ-dono | conta convidado | Docs acessíveis ao time |
| 26 | 🚩 **Seed de dinheiro real** (recebíveis/medições Consulado) | VOCÊ-dono | FIN-02 | Dados reais no ambiente |

**Ficha órfã #20 — Tela do Arquiteto (Onda A):**
- **COMO:** módulo `hub_projetos` com carteira de projetos do arquiteto; ficha de projeto `po-proj-ficha` (briefing/programa, fases, aprovações); bloco financeiro do arquiteto (honorários por fase). A0/A1 (schema) já entraram no OBR-01; falta a **tela**.
- **ARQUIVOS:** `app/crm/arquitetura/*`; leituras sobre `hub_projetos`; reuso do funil `hub_pipeline_estagios`.
- **ACEITE:** arquiteto vê carteira de projetos, aprova fase, e vê honorários previstos/recebidos — sem planilha.

**Ficha RDO/Diário de obra:**
- **COMO:** `hub_diario_rdo` append-only (data, obra_id, clima, efetivo, atividades, ocorrências, fotos); entrada por voz/foto no campo (base para mobile). Correção = linha nova (invariante #3).
- **ARQUIVOS:** `hub_diario_rdo`; tela `app/crm/obras/[id]/diario`; upload de mídia (buckets Passo D).
- **ACEITE:** RDO do dia registrado com foto; edição cria linha nova (nunca sobrescreve); aparece na curva-S/timeline.

### (f) SERVIÇOS + MRC/MMR/VDR — Sprint S13 (Sem. 25–26)

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 25 | **RAS-04** — Resolver de rastreio cobre os 14 prefixos (OBR/PRJ/SRV/MRC/MMR/VDR/FOR/ESP…) | Ramon | — | `CAD §2`: qualquer código dos 14 prefixos resolve para a entidade certa |
| 26 | **Órfã #18 — Módulo Serviços/ofícios** (marcenaria/marmoraria/vidraçaria/serralheria/pintura/elétrica) + motor "modelo-por-ofício" | Ramon | RAS-04 | Ficha abaixo |

**Ficha órfã #18 — Serviços/ofícios:**
- **COMO:** `tipo` de serviço por ofício (MRC/MMR/VDR/etc.) com **modelo de execução por ofício** (etapas: medição no local → orçamento → execução → medição final). Agendamento + prestadoras vinculadas. Estender CHECK junto com o vocabulário (invariante #7 + EST-03).
- **ARQUIVOS:** `hub_atividades` CHECK estendido; `lib/obras/escopo.ts`; telas de agendamento.
- **ACEITE:** serviço de marcenaria percorre etapas do ofício; adicionar ofício novo fora do CHECK falha o CI, não a produção (EST-03).

### (g) PRODUTOS/MATERIAIS + marketplace "iFood da construção" — Sprints S13–S14 (Sem. 25–28)

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 25 | **Órfã #17 — `hub_produtos` NÃO existe** (tabela + Tela Produtos + ficha) | Ramon | Decisão "modelar agora vs deferir" | Ficha abaixo (**BLOQUEANTE**: Compras abre vazia hoje) |
| 26 | 🚩 **Catálogo de materiais (~20 itens seed) + importar ~500 reais** | VOCÊ-dono + Ramon | `hub_produtos` | ~20 itens seed no ar; ~500 reais importados |
| 27 | **PRO — Pedidos + estoque (saída/devolução) + cotação** | Ramon | `hub_produtos` | Pedido cria movimento de estoque; devolução reverte; cotação direcionada gera pedido |
| 27 | **Órfã #19 — Portal do FORNECEDOR** (hoje 403/protótipo): cotações direcionadas + pedidos + link expirável | Ramon | TEN-03 | Ficha abaixo |
| 28 | **Marketplace "iFood" — fundação** (organizar as 160k lojas, spread por elo, distribuição de demanda) | Ramon | LEAD-03 (F6) | Ficha abaixo — **marcada ILUSTRATIVA/represada até F6** |

**Ficha órfã #17 — `hub_produtos`:**
- **COMO:** tabela `hub_produtos` (id, tenant_id, tipo [PRODUTO|SERVICO-de-obra], nome, unidade, preço_ref, sku); Tela Produtos (lista/criação determinística, esconde código pelo nome — invariante da MEMORY); modelar PRODUTO ≠ SERVIÇO no schema.
- **ARQUIVOS:** migração `hub_produtos`; `app/crm/produtos/*`.
- **ACEITE:** Compras deixa de abrir vazia; criar produto grava com `tenant_id` da sessão; ~20 itens seed visíveis.

**Ficha órfã #19 — Portal do Fornecedor:**
- **COMO:** área logada (ou link HMAC expirável) do fornecedor: recebe cotação direcionada, responde preço/prazo, vira pedido. Hoje retorna 403 — falta RLS + rota. Link expirável assinado (timestamp/nonce).
- **ARQUIVOS:** `app/(fornecedor)/*`; RLS `fornecedores`/`pedidos_material` (dependa de TEN-03); guard HMAC.
- **ACEITE:** fornecedor abre link, responde cotação, e não enxerga dado de outro tenant (invariante #5).

**Ficha marketplace "iFood" (represada, F6+):**
- **COMO (visão):** catálogo unificado das lojas; spread por elo na cadeia; distribuição de demanda para fornecedores homologados; predição de falta; CUB proprietário; homologação/selo. **NÃO consome hora de dev antes da F6** (regra do 04). Registrar como épico com fichas, não implementar agora.
- **ACEITE (F6+):** demanda de material roteada a ≥1 fornecedor homologado com spread aplicado; **até lá, marcado ILUSTRATIVO no painel.**

### (h) GESTÃO DE USUÁRIOS (RBAC UI + homologação) — Sprint S14 (Sem. 27–28)

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 27 | **Órfã #21 — Onda C: Configurações self-service** (empresa cadastra funcionários + permissões = RBAC operável) | Ramon | RBAC-05 (Fase 5) | Ficha abaixo — pré-req do multi-tenant self-service |
| 28 | **RBAC UI — Homologação de fornecedores/parceiros** (papéis: arquiteto/engenharia/campo/compras) | Ramon | RBAC-04/05 | Admin homologa fornecedor (status→ativo); papel concede/revoga acesso na hora |
| 28 | 🚩 **Rebalancear owners** (Ramon owner→admin, Ariane owner→comercial, promover `obradezmais`→owner, remover `e2e-arq@obra10.app`) | VOCÊ-dono | RBAC-04 | Só o dono é owner; e2e removido |

**Ficha órfã #21 — Configurações self-service (Onda C):**
- **COMO:** tela onde o admin do tenant cadastra funcionários, atribui papéis e permissões por módulo (usa entitlements do MET-05 + guards do RBAC-05). Convite restrito à subárvore (RBAC-03).
- **ARQUIVOS:** `app/crm/configuracoes/usuarios/*`; `lib/crm/crm-permissoes.ts`.
- **ACEITE:** admin cria funcionário com papel "campo" que só acessa obras/RDO; revogar papel corta acesso imediatamente.

### (i) MÃO DE OBRA EM CAMPO (MDO) — Sprints S13–S14 (Sem. 25–28)

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 25–26 | **RAS-05** — MDO fonte única (`hub_especialistas` + CPF + dedup) + `hub_obra_alocacoes` | Ramon | obra em prod (F3) | `CAD §2`: especialista único por CPF; alocação obra↔especialista com histórico de execução |
| 27 | **Órfã #17b — dedup por CPF/CNPJ** (merge + N:N) | Ramon | RAS-05 | Ficha abaixo |
| 28 | **Campo — ferramentas (tablet/totem/diário, foto/vídeo de medição)** — camada web (base do mobile) | Ramon | RDO, buckets | Foto/vídeo de medição anexa ao RDO/medição; funciona no navegador do tablet |

**Ficha órfã #17b (dedup CPF):**
- **COMO:** CPF/CNPJ como chave de deduplicação em pessoa/especialista; UI de merge (escolhe registro-mestre, funde vínculos N:N pessoa↔empresa↔negócio); nunca apaga (delete=arquiva, invariante #4).
- **ARQUIVOS:** `hub_especialistas` UNIQUE(cpf); rota de merge; `vinculos-nn`.
- **ACEITE:** cadastrar 2x o mesmo CPF sugere merge; merge preserva histórico e linhagem.

---

## TRILHA C — 32 PENDÊNCIAS ÓRFÃS + HIGIENE (dev rotativo, distribuídas)

> As órfãs já citadas acima (#16,17,18,19,20,21,23,24) entram nas trilhas. Aqui ficam as **restantes**, agrupadas por sprint. Cada uma com ficha executável.

### Sprint S15 · Semanas 29–30 · Registros/CRM + Financeiro operacional + IA nas telas

| Sem. | Entrega (órfã) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 29 | **#13 — Registros/atividades por entidade** (próxima-ação OBRIGATÓRIA com bloqueio global na API, follow-up por prazo, alerta de oportunidade parada, timeline nos 4 cadastros) — **gaps P0 do próprio rastreador** | EU-code | — | Ficha abaixo |
| 29 | **#25 — delete=arquiva em 5 endpoints** (falta coluna de arquivo) — invariante #4 | EU-code | — | Ficha abaixo |
| 30 | **#14 — Financeiro OPERACIONAL** (lançamentos automáticos por evento ganho→receber / medição→pagar; contas a pagar/receber; menu ⋮ corrigir pago/recebido; consolidação 4 fontes elimina #REF!) | Ramon | FIN-01/02 | Ficha abaixo |
| 30 | **#15 — Injetar IA nas telas-âncora** (negócio/lead/atendimento: sugerir próxima ação, preview de encaminhamento, card "A IA entendeu assim", barra "Perguntar à IA") | Ramon | IA-01 (F1) | Ficha abaixo |

**Ficha #13 — próxima-ação obrigatória + timeline:**
- **COMO:** cada negócio/lead exige `proxima_acao` (tipo + data); **guard global na API** rejeita transição de estágio sem próxima ação. Cron diário gera follow-up por prazo vencido e "alerta de oportunidade parada" (>N dias sem atividade). Timeline unificada nos 4 cadastros lê `hub_eventos`.
- **ARQUIVOS:** `hub_atividades`/`hub_registros`; guard em `lib/crm/crm-api-auth.ts`; componente `<Timeline>`; cron no Render.
- **ACEITE:** avançar estágio sem próxima ação → 422; lead parado 7 dias aparece no alerta; timeline mostra ligação/visita/reunião.

**Ficha #25 — delete=arquiva:**
- **COMO:** adicionar `arquivado_em timestamptz` nas 5 tabelas faltantes; endpoints trocam DELETE físico por UPDATE de arquivo; listagens filtram `arquivado_em IS NULL`.
- **ARQUIVOS:** os 5 endpoints (migração aditiva).
- **ACEITE:** "excluir" some da lista mas o registro persiste arquivado (invariante #4); nada é apagado.

**Ficha #14 — Financeiro operacional:**
- **COMO:** trigger/worker por evento: ganho→cria conta a receber; medição aprovada→conta a pagar. Telas de contas a pagar/receber; menu ⋮ por linha para corrigir status (append-only: correção = linha nova). Consolidação das 4 fontes numa view (elimina `#REF!` da planilha).
- **ARQUIVOS:** `hub_financeiro_lancamentos`; consumer de `hub_eventos`; telas financeiras.
- **ACEITE:** ganhar negócio cria recebível automático; consolidação bate sem `#REF!`.

**Ficha #15 — IA nas telas-âncora:**
- **COMO:** barra "Perguntar à IA" + card "A IA entendeu assim" + botão "sugerir próxima ação" nas telas de negócio/lead/atendimento; ao rejeitar sugestão, capturar motivo → sinal de aprendizado. IA sempre "sugere e mostra", humano confirma (invariante #1).
- **ARQUIVOS:** componentes nas telas CRM; `lib/ia/*`.
- **ACEITE:** em um lead, a IA sugere próxima ação; humano aceita em 1 toque ou rejeita com motivo.

### Sprint S15–S16 · Semanas 29–32 · Infra de plataforma (Ondas de segurança/observabilidade)

| Sem. | Entrega (órfã) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 29 | **#1 — SEC-7 / `hub_acoes_ia`** (IA grava auditoria de TUDO que escreve) | EU-code | pontos de injeção conhecidos | Ficha abaixo |
| 30 | **#2 — Logs/observabilidade unificado ("Onda D")** (`hub_error_logs`, request_id/trace_id, logger nas ~187 rotas, PII redigida, retenção) | EU-code | — | Ficha abaixo |
| 31 | **#3 — Rate-limit distribuído (Redis)** anti-abuso/DoS em tudo que toca IA | EU-code | — | Ficha abaixo |
| 31 | **#7 — IA security hardening** (prompt-injection via nome WhatsApp, RAG cross-tenant, memory-poisoning) | EU-code | IA-01 | Ficha abaixo |
| 32 | **#8 — Cron/webhook forjável** (HMAC real timestamp/nonce; WhatsApp só via worker) | EU-code | — | Ficha abaixo |
| 32 | **#6 — Higiene de banco** (advisors: mover pg_net/vector do public, `search_path` de `_norm_tel`, apagar RPCs hard-delete dormentes, restringir buckets públicos, criar buckets Passo D) | EU-code | — | Ficha abaixo |
| 32 | **#5 — Config Render/cron** (`CRON_SECRET`, `MOTOR_FONTE=fornecedores`, mover cron dos KPIs pro Render, alertas duplicados) | EU-code + VOCÊ-dono | — | Todos os crons no Render com `CRON_SECRET`; KPIs rodando lá |

**Ficha #1 — SEC-7 auditoria de IA:**
- **COMO:** `hub_acoes_ia` (id, tenant_id, ator_ia, ferramenta, payload, resultado, ts). Injetar gravação nos pontos `executar-ferramenta-ia.ts:593` e `agente-ferramentas-registry.ts:1172`. Junta com a Central de Aprovações.
- **ACEITE:** toda escrita feita por IA gera 1 linha de auditoria; nenhuma ação de IA sem rastro.

**Ficha #2 — Observabilidade (Onda D):**
- **COMO:** `hub_error_logs` + `request_id`/`trace_id` propagado; logger padrão nas ~187 rotas com **PII redigida** (CPF/telefone mascarados); política de retenção.
- **ACEITE:** um erro em prod tem trace_id rastreável; nenhum log vaza CPF em claro.

**Ficha #3 — Rate-limit distribuído:**
- **COMO:** Redis (Upstash/Render) com bucket por tenant/usuário/IP em toda rota que toca IA/pública. Substitui o rate-limit em memória (não sobrevive a múltiplas instâncias).
- **ACEITE:** rajada acima do teto → 429; teto compartilhado entre instâncias.

**Ficha #7 — IA hardening:**
- **COMO:** sanitizar entrada não-confiável (nome do WhatsApp) antes do prompt; escopar RAG por `tenant_id` (sem vazar contexto cross-tenant); validar memória contra poisoning.
- **ACEITE:** nome malicioso no WhatsApp não injeta instrução; RAG não retorna dado de outro tenant.

**Ficha #8 — Webhook/cron não-forjável:**
- **COMO:** HMAC com timestamp+nonce (rejeita replays); WhatsApp entra só via worker autenticado, nunca por rota aberta.
- **ACEITE:** requisição sem assinatura válida/replay → 401.

**Ficha #6 — Higiene de banco:**
- **COMO:** rodar `get_advisors`, mover `pg_net`/`vector` para schema próprio, fixar `search_path` de `_norm_tel`, DROP das RPCs hard-delete dormentes, restringir buckets públicos, criar buckets do Passo D; aplicar AUT-7 (`20260819120000`, já pronta).
- **ACEITE:** `get_advisors` limpo; nenhum bucket sensível público.

### Sprint S16 · Semanas 31–32 · UX/design/mobile-web + limpeza de código

| Sem. | Entrega (órfã) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 31 | **#10 — Mobile-cadastros** (não cria PF/empresa; `hidden md:block`; redesign nav) — **PRIORIDADE ALTA do dono** | Ramon | — | Cria PF/empresa no mobile; nav mobile redesenhada; sem 3º header |
| 31 | **#11 — Design overhaul** (~97 azuis-roxos off-brand em 29 arquivos → verde+dourado; `CadastroPremiumSideover` herda azul Shadcn) | Ramon | — | 0 azul/roxo off-brand; tokens `--obra-*` |
| 32 | **#12 — Polimento UX + honestidade de telas** (barra 42% falsa, 85% confiança inventado, motivo de perda obrigatório, seletor por nome não-UUID, KPIs sobre TODOS os registros, toasts/máscaras/skeleton, AA) | Ramon | — | Nenhum número inventado na UI; KPIs = query real; AA passa |
| 32 | **#26/#27 — Deleção de código morto** (Escritório Virtual legado ~50 arquivos; ⚠️NÃO remover `lib/data/office-map.ts` nem `/api/hub/agentes`) + **refactor `app/crm/layout.tsx`** (657 linhas) | EU-code | — | Build verde após remoção; layout extraído |
| 32 | **#22 — Gestor de Tarefas universal + Tela "Hoje" por perfil** + resolver stubs de menu | Ramon | — | Todo verbo vira tarefa; "Hoje" lista por perfil; sem stub morto no menu |

---

## TRILHA B (fecho) — PORTAL DO CLIENTE + COPILOTO + APROVAÇÕES

### Sprint S17 · Semanas 33–34

| Sem. | Entrega (WI) | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 33–34 | **POR-01 — Portal do Cliente MVP (os 5 medos)** | Ramon | OBR-01/02, FIN-02, 🚩janela altitude 1 p/ escrita | `CAD`: cliente vê progresso da obra, medições, o que falta — cura dos 5 medos (atrasar/não-acabar/não-saber/enganado/perder $) |
| 33 | **Central de Aprovações** — tela unificada que agrega todos os gates (escrow, medição, comissão, IA) | Ramon | SEC-7, aprovações | Todos os gates num só lugar; aprovar exige 2 humanos distintos (invariante #1) |
| 34 | **COPILOTO/IA conversacional** (voz/texto, agent builder fase 1, playbooks) + **Dashboards por persona** | Ramon | IA-01 | Copiloto responde e age com confirmação humana; dashboard troca por persona (dono/arquiteto/campo/cliente) |
| 34 | 🚩 **Janela altitude 1** (RLS Faixa B real → Hub lê a rede + bloco "Dinheiro do Hub") — se dono quiser antecipar F7 | VOCÊ-dono | Fase 5 completa | Hub lê a rede sem brecha; "Dinheiro do Hub" no ar |

> **Nota honesta:** Portal do Cliente com **aprovação/escrita** depende de FIN-02 aplicado e da janela de altitude 1. A **leitura** do portal pode ser antecipada logo após a Fase 3. Marcar como **âmbar** até a janela.

---

## TRILHA D — MOBILE & LOJAS → V1 PUBLICADO

> Greenfield (packaging = zero hoje). Roda em paralelo desde a Semana 13 (contas), mas o **build** concentra nas Semanas 30–37. iOS é o caminho crítico.

### Preparo PWA/infra — Semanas 29–30 (paralelo)

| Sem. | Entrega | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 29 | 🚩 **G3 — Domínio próprio HTTPS** ativo | VOCÊ-dono + EU-code | — | `app.obra10.com.br` serve prod |
| 29 | **MOB-01 — Reescrever `public/sw.js`** (SW real com `fetch`: cache de shell + network-first) e **registrar** via `navigator.serviceWorker.register('/sw.js')` (hoje não registra) | Ramon | — | Lighthouse "instalável" = pass; SW responde offline ao shell |
| 30 | **MOB-02 — Ícones/splash reais** (substituir placeholder "O+" de `app/icon.tsx`; Play 512×512, Apple 1024×1024 sem alpha, feature graphic 1024×500) | Ramon | marca | Assets de loja prontos; endpoints dinâmicos ficam como fallback |
| 30 | **MOB-03 — `/privacidade` (LGPD) + fluxo delete-account** + usuário demo do tenant zero | Ramon + 🚩G6 | 🚩G6 textos jurídicos | `/privacidade` público; delete-account funciona; login demo para revisores |

### Android TWA — Semanas 31–32

| Sem. | Entrega | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 31 | **MOB-04 — Bubblewrap/PWABuilder init** apontando para `manifest.json` + `applicationId`/versão/cor `#003b26`; gerar keystore | Ramon | MOB-01/02, 🚩G3 | AAB assinado gerado |
| 31 | **MOB-05 — `/.well-known/assetlinks.json`** com SHA-256 do keystore | Ramon | keystore | TWA abre full-screen sem barra de URL (validado) |
| 32 | **MOB-06 — Teste de cookie de sessão no TWA** (Supabase `CRM_ACCESS_COOKIE` persiste entre aberturas) | Ramon | login | Usuário não desloga ao reabrir |
| 32 | **MOB-07 — Play: teste interno** (Data Safety, content rating, screenshots, política) | Ramon + 🚩G2 | 🚩G2 | App em teste interno; Data Safety declara CPF/telefone/localização/fotos |

### iOS Capacitor — Semanas 33–35

| Sem. | Entrega | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 33 | **MOB-08 — Projeto Capacitor iOS** (`server.url = https://app.obra10.com.br`) + plugins que justificam o app (push APNs, câmera, geo, share, biometria) | Ramon | 🚩G1 | Projeto compila; plugins nativos presentes (sobrevive ao Guideline 4.2) |
| 34 | **MOB-09 — Build Xcode** (bundle id, certificados, provisioning, ícone 1024, splash) | Ramon + 🚩Mac/CI | 🚩G1 + 🚩Mac (EAS/Codemagic/MacinCloud) | Archive gerado |
| 34 | 🚩 **Decisão IAP** — manter billing **na web** (evita comissão 15–30% e rejeição 3.1.1) | VOCÊ-dono | — | App iOS não vende assinatura in-app; só "gerenciar pela web" |
| 35 | **MOB-10 — Teste cookie/sessão no WKWebView** + TestFlight | Ramon | build | Sessão persiste; TestFlight distribui para testers |

### Submissão + V1 PUBLICADO — Semanas 35–37

| Sem. | Entrega | Resp. | Depende | Pronto (binário) |
|---|---|---|---|---|
| 35 | **MOB-11 — Play produção** (screenshots phone/tablet, se conta nova: 🚩teste fechado 12 testers/14 dias) | Ramon | MOB-07 | **App na Play Store (produção)** — revisão horas a ~3 dias |
| 36 | **MOB-12 — App Store submit** (App Privacy labels declarando CPF/fotos de terceiros, screenshots 6.7"/6.9", conta demo, descrição) | Ramon | MOB-10, 🚩G1 | Submetido à revisão Apple |
| 36–37 | **MOB-13 — Ciclo de revisão Apple** (⚠️prever **1–2 rejeições** por Guideline 4.2 → idas-e-voltas) | Ramon | — | **App na App Store** |
| 37 | **✅ V1 PUBLICADO** | — | tudo acima | Play + App Store no ar; billing ligado; multitenant endurecido; portais/verticais funcionais |

---

## Resumo de marcos e honestidade

| Marco | Semana | Estado |
|---|---|---|
| **Fase 4 — Receita ligada** (MET-02..05) | fim S8 (Sem. 16) | 🟢 executável, sem janela grande |
| **Fase 5 — Rede endurecida** (TEN/RBAC/LGPD) | fim S11 (Sem. 22) | 🟡 depende de 🚩janela Supabase (TEN-01) + 🚩rotação de segredos |
| **Verticais completas** (imóvel/arq/obra/serviços/materiais/MDO/usuários) | Sem. 23–28 | 🟡 obras/portal cliente dependem de FIN-02 aplicado; marketplace iFood **🔴 represado até F6** |
| **Órfãs + higiene + observabilidade** | Sem. 29–32 | 🟢 mas #14 financeiro depende de FIN-01/02 |
| **Portal Cliente + Copiloto + Aprovações** | Sem. 33–34 | 🟡 escrita depende de 🚩janela altitude 1 |
| **Play Store publicado** | ~Sem. 35 | 🟡 risco: teste fechado 12/14d se conta nova |
| **App Store publicado (V1)** | ~Sem. 37 | 🔴 caminho crítico: 🚩conta Apple + 🚩Mac/CI + risco Guideline 4.2 (contar 1–2 rejeições) |

**Flags honestas:** (1) o marketplace "iFood" e os módulos de rede/escala (#31/#32) ficam **desenhados mas represados** — nada de hora de dev antes da F6, conforme o 04. (2) Unit economics do plano continuam **ILUSTRATIVOS** — não pintar de verde. (3) A DEMO de escrow de R$15k precisa ser **desfeita** antes de qualquer escrow real (risco crítico vivo, resolvido junto de FIN-02 na F2 — se não foi, é **bloqueante da F4/F5**). (4) iOS é o gargalo real do V1: sem Mac na equipe (`env win32`), **contratar CI Mac é 🚩decisão+custo do dono** e deve ser disparado junto com a conta Apple na Semana 13.


## 4. Workstream Mobile & App Stores (detalhado)

> **Escopo V1, NÃO-MVP.** O MVP (Fases 0–3, ~12 semanas) roda em **web/PWA** — o dono opera sem planilha no navegador/celular via "Adicionar à Tela de Início". **Publicar em loja é entregável de V1** e só faz sentido depois de a rede estar endurecida (Fase 5) e a LGPD publicada, porque a loja expõe o app a usuários externos e a formulários de privacidade que declaram CPF/fotos de terceiros. **Exceção crítica:** a **abertura da conta Apple Developer é ação de Fase 0 (abrir JÁ)** — a verificação de identidade demora 1–2 semanas (D-U-N-S se PJ) e é o gargalo do caminho-crítico iOS. Se ela não abrir cedo, todo o resto do iOS desliza.

**Estado real hoje (âncora, não reinventar):** PWA ~70% (manifest `public/manifest.json` OK, metadados iOS `app/layout.tsx:19-52` OK) · **SW é kill-switch** (`public/sw.js` v7: deleta todas as caches no `activate`, **sem `fetch` handler e nunca registrado** — grep não achou `navigator.serviceWorker.register`) · **ícones são placeholder gerado** ("O+" em `app/icon.tsx`/`app/apple-icon.tsx`, zero PNG de marca em disco) · **zero wrapper nativo** (sem Capacitor/Bubblewrap/`android/`/`ios/` no `package.json`) · **domínio ainda `escritorio-virtual-1.onrender.com`** (`render.yaml:50-54`) · auth por cookie de sessão (`proxy.ts:3,27-37`) que o webview **tem que persistir**. **Nada publicável hoje; o workstream de lojas é greenfield.**

---

### 4.0 Recomendação de packaging (app SSR hospedado)

O app é **server-rendered** (Next 16 App Router, React 19, SSR no Render) — **não** dá para "gerar APK do site" nem export estático. As opções reais:

| Plataforma | Recomendação | Por quê | Custo/gargalo |
|---|---|---|---|
| **Android** | **TWA** (Trusted Web Activity) via **Bubblewrap** ou PWABuilder | Casca que abre a URL hospedada em Chrome full-screen, validada por Digital Asset Links. Usa o SSR **ao vivo** (deploy Render = update instantâneo, sem re-submeter à loja p/ mudança de conteúdo). Build trivial, base única, sem re-escrita. | Play Console **US$25 taxa única**. Exige `assetlinks.json` + SW com `fetch` + ícones reais. |
| **iOS** | **Capacitor WKWebView shell + plugins nativos** (push APNs, câmera, geo, share, biometria) apontando `server.url` p/ a URL hospedada | Webview fino **reprova** no Guideline 4.2 (Apple). O valor nativo — que o produto **já quer** (foto/vídeo de medição em campo, push de aprovação/SLA, geo do RDO) — é exatamente o que sobrevive ao 4.2. | Apple Developer **US$99/ano** + **build SÓ em macOS/Xcode** (equipe é Windows → CI Mac: EAS/Codemagic/MacinCloud). |

**Alternativa (decisão do dono):** usar **Capacitor para os dois** — uma só toolchain, push/câmera compartilhados; custa um pouco mais que a TWA no Android, mas unifica. Mantém a recomendação acima como default.

**Pré-requisito comum às duas lojas:** domínio próprio HTTPS estável (sair de `*.onrender.com`), SW funcional, ícones/splash de marca, `/privacidade` LGPD + fluxo de exclusão de conta, usuário demo do tenant zero.

---

### 4.1 WIs do workstream (fichas completas — não existem no CADERNO)

Códigos novos **MOB-\*** (órfãos → ficha completa, estilo caderno). Dependem de WIs reais das Fases 0–5.

| WI | Título | Prio | Esf | Depende |
|---|---|---|---|---|
| **MOB-00** | Abrir conta Apple Developer + Play Console (JANELA DO DONO) | P0 | P(dono) | — |
| MOB-01 | Domínio próprio HTTPS + `NEXT_PUBLIC_APP_URL` | P1 | M | RBAC-01 (segredos) |
| MOB-02 | Reescrever + registrar Service Worker real | P1 | M | — |
| MOB-03 | Ícones/splash de marca reais (loja-grade) | P1 | M | — |
| MOB-04 | `/privacidade` LGPD + fluxo delete-account | P1 | M | **LGPD-01** |
| MOB-05 | Usuário demo do tenant zero (revisores) | P1 | P | TEN-01/02 |
| MOB-06 | Android TWA (Bubblewrap → AAB) + `assetlinks.json` | P1 | M | MOB-01/02/03 |
| MOB-07 | Submissão Play (Data Safety, screenshots, rating) | P1 | M | MOB-04/05/06 |
| MOB-08 | Projeto Capacitor iOS + plugins nativos (push/câmera/geo/share) | P1 | G | MOB-01/03, CI Mac |
| MOB-09 | QA cookie/sessão no WKWebView | **P0** | M | MOB-08 |
| MOB-10 | Submissão App Store (App Privacy, screenshots, TestFlight) | P1 | G | MOB-04/05/08/09 |
| MOB-11 | Push notifications backend (APNs + FCM) | P2 | G | MET-02, cron Render |

#### Fichas (o COMO técnico + arquivos + aceite binário)

**MOB-00 — Abrir contas de desenvolvedor** · *JANELA DO DONO (credencial + custo).*
- **Como:** Apple Developer Program (US$99/ano) — cadastro + verificação de identidade; se PJ, número **D-U-N-S** (pode levar 1–2 semanas). Google Play Console (US$25 taxa única). Contas novas de dev individual às vezes exigem **teste fechado com 12 testers por 14 dias** antes de produção — checar no cadastro.
- **Aceite:** conta Apple com status "Active" (App Store Connect acessível) **E** Play Console com app-shell criado em rascunho. *Ilustrativo:* prazo de verificação Apple é fora do nosso controle — marcar âmbar até "Active".

**MOB-01 — Domínio próprio HTTPS** · Depende de RBAC-01 (tirar `NEXT_PUBLIC_*` do bundle antes).
- **Como:** registrar/apontar `app.obra10.com.br` (ou equivalente) para o serviço Render; TLS válido; atualizar `NEXT_PUBLIC_APP_URL` (`render.yaml:65`) e qualquer origem hardcoded. Manter redirect do host antigo. Necessário porque **Digital Asset Links da TWA amarra o app ao host** e `*.onrender.com` "cheira a site" na revisão Apple.
- **Aceite:** `https://app.obra10.com.br` serve o app com cadeado válido; `curl` do manifest responde 200 no novo host; login funciona no domínio novo.

**MOB-02 — Service Worker real** · Bloqueador de qualidade PWA/TWA.
- **Como:** reescrever `public/sw.js` (hoje v7 kill-switch sem `fetch`) para SW com `fetch` handler: **cache-first do app-shell** (rotas estáticas/ícones) + **network-first dos dados** (nunca cachear respostas autenticadas/JSON de sessão). Registrar via `navigator.serviceWorker.register('/sw.js')` — **não existe hoje** (adicionar no `app/layout.tsx` client-side ou componente de bootstrap). Manter versionamento de cache p/ invalidar no deploy.
- **Aceite:** DevTools → Application → Service Workers mostra SW "activated and running" com `fetch` interceptando; Lighthouse PWA "installable" = pass; heurística de A2HS dispara; **nenhuma resposta autenticada aparece em cache** (verificar Cache Storage).

**MOB-03 — Ícones/splash de marca** · Bloqueador de qualidade de loja.
- **Como:** gerar PNGs estáticos de marca (verde `#003b26` + dourado, alinhado ao design system `--obra-*`): **Play 512×512**, **Apple 1024×1024 (sem alpha)**, maskable 192/512 no manifest, splash por densidade (Capacitor gera). Substituir o placeholder "O+" de `app/icon.tsx`/`app/apple-icon.tsx`; **manter os endpoints dinâmicos como fallback** para a web.
- **Aceite:** manifest referencia PNGs reais 192/512 maskable; arquivos 512 e 1024 existem em disco e passam no validador de ícone da respectiva loja (sem alpha no Apple); render no simulador não mostra "O+".

**MOB-04 — `/privacidade` LGPD + delete-account** · Depende de **LGPD-01** (fluxo `anonimizarPessoa`). *Bloqueante nas duas lojas.*
- **Como:** criar rota pública `/privacidade` (não existe) com política cobrindo LGPD: base legal, dados coletados (nome, telefone, **CPF de especialistas**, localização de campo, fotos de medição), retenção, direitos do titular, contato do DPO. Implementar **exclusão de conta**: Google exige URL/fluxo de "delete account"; Apple exige delete-**in-app**. Reusar `anonimizarPessoa` (LGPD-01) — preserva linhagem (RAS-01), zera PII.
- **Aceite:** `/privacidade` responde 200 público (sem login); botão "Excluir minha conta" no app dispara o fluxo e retorna confirmação; URL de exclusão pública documentada para o Data Safety.

**MOB-05 — Usuário demo do tenant zero** · Depende de TEN-01/02 (tenant isolado).
- **Como:** provisionar credencial demo (e-mail/senha) do tenant zero com dados de exemplo navegáveis, **sem PII real**, para o revisor Apple (Guideline 5.1.1 exige conta de teste quando há login). Congelar a conta para não expirar.
- **Aceite:** login com a credencial demo entra e navega as telas-âncora (Leads, Atendimento, Aprovações) sem dado real vazando; credencial registrada no formulário de revisão.

**MOB-06 — Android TWA** · Depende de MOB-01/02/03.
- **Como:** `npx @bubblewrap/cli init --manifest https://app.obra10.com.br/manifest.json` (ou PWABuilder). Configurar `applicationId`, `versionCode`/`versionName`, status bar `#003b26`. Gerar keystore (guardar em segredo; ativar **Play App Signing**), extrair **SHA-256 fingerprint**. Publicar `/.well-known/assetlinks.json` no Render com o fingerprint (remove a barra de URL / valida a TWA). `bubblewrap build` → **AAB** assinado.
- **Aceite:** `assetlinks.json` retorna 200 no host de produção e valida no [Statement List Generator]; app instalado abre **full-screen sem barra de URL**; cookie de sessão persiste entre aberturas.

**MOB-07 — Submissão Play** · Depende de MOB-04/05/06.
- **Como:** Play Console → criar app → subir AAB → **Data Safety form** (declarar nome, telefone, CPF, localização, fotos), política de privacidade (MOB-04), content rating, screenshots ≥2 por form-factor + **feature graphic 1024×500** → teste interno → (teste fechado 12 testers/14 dias **se conta nova exigir**) → produção.
- **Aceite:** app em "Produção" ou "Teste interno" aprovado; Data Safety completo e consistente com o que o app coleta; revisão Play passa (horas a ~3 dias).

**MOB-08 — Capacitor iOS + plugins nativos** · Depende de MOB-01/03 + **CI Mac (janela do dono)**. *Caminho-crítico.*
- **Como:** `npm i @capacitor/core @capacitor/ios`; `npx cap init`; `server.url = https://app.obra10.com.br` no `capacitor.config`. Adicionar **plugins que justificam o app** (mitiga 4.2): `@capacitor/push-notifications` (APNs), `@capacitor/camera` (foto/vídeo de medição — já é requisito de `campo-tablet-totem`), `@capacitor/geolocation` (RDO/diário), `@capacitor/share`, biometria no login. `npx cap add ios` → **Xcode (macOS)**: bundle id, certificados, provisioning, ícone 1024, splash. Bump `CFBundleVersion`/`CFBundleShortVersionString`.
- **Aceite:** build iOS compila no Xcode/CI Mac; app abre a URL hospedada; **ao menos um recurso nativo real funciona** (câmera abre e devolve foto para a tela de medição, ou push chega) — evidência para a defesa do 4.2.

**MOB-09 — QA cookie/sessão WKWebView** · **P0** — bloqueia usabilidade. Depende de MOB-08.
- **Como:** validar que o cookie `CRM_ACCESS_COOKIE` (`proxy.ts:3`) **persiste** no WKWebString ao fechar/reabrir o app (senão desloga a cada abertura). Testar `SameSite`/`Secure`/domínio no host novo. **Nota:** `proxy.ts` está morto (Next espera `middleware.ts`; export é `proxy`), então o gate de auth roda hoje só nos route handlers — QA tem que exercer o fluxo logado **dentro** do webview, não confiar no middleware.
- **Aceite:** login → matar app → reabrir → **continua logado**; sessão expira só no logout/TTL, não no restart.

**MOB-10 — Submissão App Store** · Depende de MOB-04/05/08/09. *Prever 1–2 rejeições por 4.2 (ver §4.5).*
- **Como:** App Store Connect → **App Privacy "Nutrition Labels"** (declarar CPF/fotos/geo/telefone), screenshots **6.7" e 6.5"/6.9"** (+ iPad se declarar), conta demo (MOB-05), descrição destacando recursos nativos → **TestFlight** → submeter revisão. **Billing/assinatura FORA do app** (web) para evitar IAP 15–30% e rejeição 3.1.1.
- **Aceite:** app "Ready for Sale" (ou "In Review" sem rejeição por 4.2); labels de privacidade batem com a coleta real.

**MOB-11 — Push backend (APNs + FCM)** · P2, depois do go-live básico. Depende de MET-02/eventos + cron Render.
- **Como:** APNs key (iOS) + FCM (Android) como segredos de infra; backend de envio disparado pela camada de eventos/notificações (item órfão 16) e cron do Render p/ aprovações/SLA/medição. HMAC real no webhook (item órfão 8).
- **Aceite:** aprovação criada → push chega no device físico; token de device persistido por usuário; sem envio cross-tenant.

---

### 4.2 Cronograma semana a semana (workstream próprio, ~9 semanas)

Numeração **relativa ao início do workstream** (não a Semana-1 do cronograma global). **Encaixe global:** o workstream **inicia dentro da Fase 5** (hardening), **exceto MOB-00** (conta Apple), que é acionado **na Fase 0** por causa do lag de verificação. Assume 1 dev + apoio de QA; Android e iOS correm em paralelo a partir da Semana 3.

**Sprint M1 (Sem. 1–2) — Preparo PWA/infra (comum às duas lojas)**

| Sem | Entrega | Resp | Depende | Pronto (binário) |
|---|---|---|---|---|
| 1 | MOB-01 domínio próprio HTTPS + `NEXT_PUBLIC_APP_URL` | EU-code + **VOCÊ (DNS/registro)** | RBAC-01 | cadeado válido no host novo; login OK |
| 1 | MOB-02 SW real com `fetch` + registro | EU-code | — | Lighthouse "installable"=pass; sem resposta auth em cache |
| 1–2 | MOB-03 ícones 512/1024/maskable + splash | EU-code (+ design) | — | PNGs em disco passam validador; sem "O+" |
| 2 | MOB-04 `/privacidade` LGPD + delete-account | EU-code | LGPD-01 | `/privacidade` 200 público; delete-in-app confirma |
| 2 | MOB-05 usuário demo tenant zero | EU-code | TEN-01/02 | login demo navega sem PII real |
| **0** (Fase 0) | **MOB-00 abrir conta Apple + Play** 🚩 | **VOCÊ-dono** | — | Apple "Active"; Play app em rascunho |

**Sprint M2 (Sem. 3–4) — Android TWA**

| Sem | Entrega | Resp | Depende | Pronto (binário) |
|---|---|---|---|---|
| 3 | MOB-06 Bubblewrap init + keystore + AAB | EU-code | MOB-01/02/03 | AAB assinado gerado |
| 3 | `assetlinks.json` publicado no Render 🚩 | EU-code + **VOCÊ (deploy)** | MOB-06 | assetlinks 200 e valida; app abre sem barra de URL |
| 4 | MOB-07 Play: Data Safety + screenshots + feature graphic | EU-code + **VOCÊ (conta)** | MOB-04/05/06 | app em Teste Interno aprovado |

**Sprint M3 (Sem. 4–7) — iOS Capacitor + nativo (em paralelo)**

| Sem | Entrega | Resp | Depende | Pronto (binário) |
|---|---|---|---|---|
| 4–5 | MOB-08 projeto Capacitor + plugins push/câmera/geo/share | EU-code | MOB-01/03 | build compila; ≥1 recurso nativo funciona |
| 5 | Build Xcode em **CI Mac** (EAS/Codemagic) 🚩 | EU-code + **VOCÊ (custo CI Mac)** | MOB-08 | archive gerado em macOS/CI |
| 6 | MOB-09 QA cookie/sessão WKWebView (**P0**) | EU-code + Ramon/QA | MOB-08 | reabrir app = continua logado |
| 6–7 | MOB-03 assets iOS (1024 sem alpha, splash), TestFlight interno | EU-code | MOB-08 | build no TestFlight instalável |

**Sprint M4 (Sem. 7–9) — Publicação App Store**

| Sem | Entrega | Resp | Depende | Pronto (binário) |
|---|---|---|---|---|
| 7 | MOB-10 App Privacy labels + screenshots 6.7"/6.9" + conta demo | EU-code + **VOCÊ (conta)** | MOB-04/05/09 | metadados completos; submetido |
| 7–9 | Revisão Apple + **ciclos de rejeição 4.2** 🚩 | EU-code responde | MOB-10 | "Ready for Sale" ou "In Review" sem 4.2 |
| 8+ | MOB-11 push backend (APNs+FCM) — pós go-live | EU-code | MET-02, cron | push chega no device físico |

---

### 4.3 Onde encaixa na V1 (âncora ao cronograma global)

- **Fase 0 (Sem. globais 1–2):** disparar **MOB-00** (conta Apple) — única ação mobile antecipada, por causa do lag de verificação. Cai junto com a **rotação de segredos** (RBAC-01 / órfã #4), que MOB-01 também precisa.
- **Fases 1–4 (MVP + receita):** **nenhuma hora de dev mobile** — o MVP é web/PWA. Não abrir o workstream aqui.
- **Fase 5 (endurecer p/ rede):** **abre o workstream** (Sprints M1–M4). Faz sentido aqui porque a loja expõe o app a externos e os formulários de privacidade dependem de **LGPD-01** (MOB-04), tenant isolado **TEN-01/02** (MOB-05) e segredos rotacionados **RBAC-01** (MOB-01). Publicar antes disso = expor rede aberta.
- **Fase 7 (Portal + Altitude 1):** MOB-11 (push) casa com a camada de eventos/notificações (órfã #16) e com o Portal do Cliente (POR-01).

**Regra de ouro:** **não publicar em loja enquanto a Fase 5 não fechar** (12/12 do checklist, teste de intrusão interno passa, nenhum tenant lê outro). App em loja com RLS aberta = incidente público.

---

### 4.4 Janelas do dono (onde ele destrava) 🚩

| Item | Destrava | Tipo | Fase |
|---|---|---|---|
| **Conta Apple Developer** (US$99/ano + verificação 1–2 sem) | toda a trilha iOS (MOB-08/10) | Credencial + custo | **Fase 0 (abrir JÁ)** |
| Play Console (US$25) | MOB-07 | Custo | Fase 0/5 |
| **CI Mac** (EAS/Codemagic/MacinCloud) — equipe é Windows | build iOS (MOB-08) | Custo + contratação | Fase 5 |
| **Domínio próprio + DNS** | assetlinks TWA + credibilidade Apple (MOB-01/06) | Config | Fase 5 |
| **Decisão IAP:** billing na web, não no app iOS | evita comissão 15–30% + rejeição 3.1.1 (MOB-10) | Decisão | Fase 5 |
| Deploy do `assetlinks.json` no Render | valida TWA (MOB-06) | Config/deploy | Fase 5 |
| Textos jurídicos (termos + privacidade) | MOB-04 (LGPD) | Decisão/conteúdo | Fase 5 |
| APNs key + FCM (segredos) | push (MOB-11) | Credencial | Fase 7 |

---

### 4.5 Requisitos de submissão (checklist duro)

**Legal/LGPD (bloqueante nas duas):** política de privacidade pública (URL) cobrindo LGPD; **exclusão de conta** (Google: URL/fluxo; Apple: delete-in-app); **App Privacy labels (Apple)** + **Data Safety (Play)** declarando cada dado — atenção a **CPF de especialistas + fotos de terceiros (MDO)**, que são sensíveis e reprovam se mal declarados.

**Assets (hoje só placeholder "O+"):** ícone Play 512×512; ícone Apple 1024×1024 sem alpha; splash por densidade; screenshots (Play ≥2/form-factor; Apple 6.7" e 6.5"/6.9" + iPad se declarar); feature graphic 1024×500 (Play).

**Técnico:** build iOS **só em macOS/Xcode ou CI Mac**; `versionCode`/`versionName` (Android) e `CFBundleVersion`/`CFBundleShortVersionString` (iOS) bumpados por submissão; assinatura (keystore Android + Play App Signing; certificados/provisioning iOS); push = APNs key + FCM se ligado.

**Conta de teste (Apple 5.1.1):** usuário demo do tenant zero (MOB-05) obrigatório porque há login.

---

### 4.6 Riscos de reprovação + mitigação (honesto)

| Risco | Loja | Mitigação | Custo do risco |
|---|---|---|---|
| **Guideline 4.2 (webview fino "é só um site")** | Apple | iOS = Capacitor **com push APNs + câmera + geo reais** (recursos que o produto já quer); destacar nativo nas screenshots e na descrição | **Alto** — prever **1–2 ciclos de rejeição → +1–2 semanas** |
| **IAP 3.1.1** (assinatura vendida dentro do app iOS exige comissão 15–30%) | Apple | Billing **na web**; app só "gerenciar pela web". Decisão do dono | Médio — rejeição se cobrar in-app |
| **5.1.1** login sem conta de teste | Apple | MOB-05 (demo tenant zero) | Baixo se feito |
| **Sign in with Apple** obrigatório se houver login social 3rd-party | Apple | Login é e-mail/senha próprio → **dispensável**; se adicionar social, incluir SIWA | Baixo hoje |
| Data Safety/App Privacy inconsistente com coleta real (CPF/fotos) | ambas | Auditar o que o app coleta antes de preencher; declarar CPF/geo/fotos | Médio |
| Domínio `onrender.com` "cheira a site" + quebra assetlinks | ambas | MOB-01 domínio próprio antes da TWA | Médio |
| **SW kill-switch + não registrado** derruba instalabilidade | ambas | MOB-02 | Médio (bloqueia qualidade) |
| Cookie de sessão some no WKWebView (desloga a cada abertura) | iOS | MOB-09 (P0) | Alto de UX |
| Conta dev individual nova exige teste fechado 12/14d | Play | Verificar no cadastro; se exigir, **+2 semanas** | Cronograma |

---

### 4.7 Timeline por loja (honesto — sem datas fixas)

| Trilha | Duração | Gargalo |
|---|---|---|
| **Play (Android/TWA)** | **~4–6 semanas** | Se conta nova exigir teste fechado 12 testers/14 dias: **+2 sem**. Revisão Play: horas a ~3 dias. |
| **App Store (iOS/Capacitor)** | **~7–9 semanas** | **Caminho-crítico.** Verificação de conta Apple (1–2 sem, Fase 0) + build Mac + **revisão ~1–3 dias/ciclo com 1–2 rejeições 4.2 prováveis (+1–2 sem)**. |

**Total do workstream:** ~9 semanas de calendário (Android e iOS em paralelo a partir da Sem. 3), consumindo ~5–6 semanas de dev efetivo. **Cabe em V1, fora do MVP de 1 trimestre.**

---

### 4.8 Critério de PRONTO (V1 mobile) — binário

App Obra10+ **publicado e instalável** na **Play Store** (produção, Data Safety completo) **E** na **App Store** ("Ready for Sale", App Privacy completo, sobreviveu ao 4.2); login do tenant zero **persiste** entre aberturas no wrapper (MOB-09); `/privacidade` LGPD + exclusão de conta no ar (MOB-04); ícones/splash de marca (sem "O+"); domínio próprio HTTPS ativo; **e a Fase 5 fechada antes da publicação** (nenhum tenant lê outro). *Marcar verde só quando ambas as lojas estiverem publicadas — até lá, âmbar; a revisão Apple é fora do nosso controle.*


## 5. Gates do dono, dependências críticas & riscos

> **Como ler esta parte.** Aqui está tudo que **NÃO depende de código** — o que só o dono (VOCÊ-dono) destrava: credenciais, janelas de migração no Supabase, decisões de produto/negócio, contas de loja, e o jurídico do dinheiro de terceiros. Cada gate está amarrado à **semana** em que ele vira caminho-crítico (ou seja: se não estiver destravado até ali, a WI que depende dele **para**). O mapa de semanas segue o sprint canônico (CAD §15): **Sprint 1 = Fase 0 (Sem 1–2) · S2 = Fase 1 (Sem 3–4) · S3–4 = Fase 2 / janela grande (Sem 5–8) · S5–7 = Fase 3 / MVP (Sem 9–14) · S8–10 = Fase 4 (Sem 15–20) · S11–13 = Fase 5 (Sem 21–26) · Fase 6 (Sem 27–28) · Fase 7/8 (Sem 29+)**. Mobile/Lojas é workstream paralelo de **V1** (fora do MVP).
> **Honestidade:** a meta "MVP em ~1 trimestre (12 semanas)" e o sprint canônico **divergem em ~2 semanas** (Fase 3 = S5–7 empurra o MVP para Sem 12–14). Isso é âmbar, não verde — está no risco R-1 abaixo. Unit economics do Plano são **ILUSTRATIVOS** (o próprio doc marca). Nenhum gate abaixo tem data fixa de calendário — todos dependem de capacidade + disponibilidade do dono.

---

### 5.1 — Catálogo mestre dos gates do dono (o que SÓ ele destrava)

Cinco famílias: **(A) Credenciais/segredos · (B) Janelas de migração Supabase · (C) Decisões de produto/negócio · (D) Jurídico & dinheiro de terceiros · (E) Contas de loja & infra mobile.** Cada linha: quando é necessário, o que destrava, e o critério de pronto binário.

#### (A) Credenciais, segredos e rotação — a maioria é Fase 0

| Sem | Gate (VOCÊ-dono) | Destrava (WI) | Depende de | Pronto (binário) |
|---|---|---|---|---|
| **1–2** | 🚩 **Rotacionar `SUPABASE_SERVICE_ROLE_KEY`** (chave do dev demitido vale até 2036) | RBAC-01, e **toda** a operação segura | — | Chave antiga revogada no painel Supabase; nova em `render.yaml`/env; app sobe e loga; `git grep` não acha a antiga |
| **1–2** | 🚩 **Rotacionar PAT `sbp_`** do dev demitido + **chaves Render** + **trocar senha exposta no chat** | RBAC-01 | — | PAT antigo revogado; tokens Render novos; senha trocada; nenhum segredo antigo válido |
| **1–2** | 🚩 **Push de backup próprio no GitHub** (o repo atual é conta do dev demitido) | Continuidade / risco de perda | conta GitHub do dono | Repo espelhado em conta do dono; 2º remote configurado; push OK |
| **1–2** | 🚩 **Config Render/cron:** `CRON_SECRET`, `MOTOR_FONTE=fornecedores`, `COPILOTO_HMAC_SECRET`, mover cron dos KPIs pro Render | LEAD-01 (SLA cron), MET, órfãs #5/#8 | Render | Vars setadas; cron dispara autenticado (401 sem secret); KPIs recalculam no Render |
| **1–2** | 🚩 **Tirar `NEXT_PUBLIC_INTERNAL_API_KEY` e `NEXT_PUBLIC_TENANT_ID` do bundle** + retestar login | RBAC-01, órfã #4 | — | `view-source`/bundle não expõe chave; login e rotas internas seguem OK |
| **3–4** | 🚩🔑 **Chave Mistral + billing ligado** | **IA-01 / Fase 1 inteira** | MET-01, IA-02 (código, EU) | Chave em env; `/api/ml/*` responde com modelo real; 1 lead qualificado ponta-a-ponta |
| **3–4** | 🚩 **UAZAPI** (WhatsApp) credenciada | IA-01 (canal de entrada do lead) | — | WhatsApp→fila→worker→IA num número real de teste |
| **1–2/5** | 🚩 **HaveIBeenPwned** (verificação de senha vazada) | hardening auth | — | Cadastro rejeita senha vazada conhecida |
| **~9–14** | 🚩 **Credenciais Meta (Lead Ads/Direct) + Windsor** | EVT-01, workstream Marketing | política de privacidade pública (D) | Lead Ad real cai no CRM com UTM; painel de canal mostra CAC por bairro |

> **Nota de sequência honesta (âmbar):** a rotação de segredos é o **primeiro** gate do cronograma inteiro. Enquanto a `service_role` do dev demitido estiver viva, qualquer outra WI de segurança (TEN-*, RBAC-*) é teatro. Por isso Sem 1–2 é bloqueante-mãe.

#### (B) Janelas de migração Supabase — onde o schema muda em prod

Regra-invariante #8: **migração em prod só na janela do dono**, aditiva e reversível, sempre virando arquivo (`supabase/migrations`). Há **cinco** janelas distintas no cronograma:

| Sem | Janela (VOCÊ-dono aplica junto via MCP) | WIs aplicadas na ordem | Depende de | Pronto (binário) |
|---|---|---|---|---|
| **1–2** | **Janela-mini Fase 0** — aplicar **AUT-7** (`20260819120000`, DROP idx redundante, já pronta) + higiene advisors (mover `pg_net`/`vector` do `public`, `search_path` de `_norm_tel`, restringir buckets públicos, criar buckets do Passo D), + **RAS-02** (UNIQUE código + trigger auto-código) + **MET-01** CHECK markup≥1 + **EST-03** CHECK atividades | AUT-7 → advisors → RAS-02 → MET-01 → EST-03 | rotação (A) feita | `get_advisors` limpo nesses itens; código duplicado rejeitado pelo banco; markup<1 barrado no banco |
| **5–8** | 🚩🔴 **JANELA GRANDE (única) da Fase 2** — o destravamento do represado | **FND-01** (baseline; `db reset` limpo) → **TEN-03(parcial)**: fechar RLS de `hub_negocio_vinculos` (`USING(true)`+GRANT anon) → **OBR-01** camada AEC na **ordem exata** `E0→E0b→E2→E3→E5→E7→E7b→A0→A1` → **FIN-02** (trocar `GREATEST(0,…)`→`RAISE` + `FOR UPDATE`, **só então** aplicar E6 `20260730120000`) → **OBR-02** (`rpc_registrar_medicao`) → **FIN-01** (motor 5 estados) → **JANELA-03** (`engenheiro_responsavel_id`) | rotação (A); decisão escrow 2-chaves (C); BaaS/KYC (D); seed real (D) | `db reset` reconstrói do zero; `db diff` vazio; obra real com EAP+medição+escrow **2 humanos distintos**; comissão PREVISTA→PAGA; **DEMO R$15k desfeita**; C2 fechada |
| **5–8** | 🚩 **Desfazer a DEMO de escrow (R$15k)** — risco crítico vivo | reversão da camada não-aplicada antes/dentro da janela grande | FIN-02 (fix do bug) | Saldo fantasma zerado; ledger sem R$ de terceiros na camada não-aplicada |
| **~9–14** | **Janela Fase 3** — RAS-01 (linhagem escrita pelo app; ⚠️IRREVERSÍVEL) só é segura **depois** do FND-01; RAS-05 (`hub_especialistas`+CPF+dedup+`hub_obra_alocacoes`); LGPD-01 (`anonimizarPessoa`) | RAS-01 → RAS-05 → LGPD-01 | **FND-01 (janela grande)** | 100% dos negócios novos nascem com `negocio_raiz_id`; MDO deduplicado por CPF; anonimização preserva linhagem e zera PII |
| **~21–26** | **Janela Fase 5 (rede)** — **TEN-01** backfill `tenant_id NULL`→sentinela + NOT NULL (36 tabelas) → **TEN-02** `.eq` puro (tirar `OR tenant_id IS NULL`) → **TEN-03** fechar RLS restantes → **TEN-04** hierarquia (`tenant_type`/`parent_tenant_id`) | TEN-01→02→03→04 | RAS-02 (código único) | Inventário 36 tabelas migrado; teste de intrusão interno passa; **nenhum tenant lê outro** |
| **~29+** | 🚩 **Janela Altitude 1 (RLS Faixa B real)** — Hub lê a rede + bloco "Dinheiro do Hub" | Fase 7 (POR-01 lado Hub) | TEN-04 | Hub enxerga a rede sob RLS Faixa B; painel Dinheiro do Hub no ar |

> **Armadilha a preservar (âmbar técnico, vale na janela grande):** `custo_total` **NÃO** pode virar GENERATED encadeado — soma inline `(loc+mat+mo)*qtd` (`lib/obras/escopo.ts:98-112`). E6 (`20260730120000`) **não pode ser aplicada antes** do FIN-02, senão a custódia fantasma vai a prod. Essa é a linha mais perigosa do cronograma.
>
> **Tensão de sequência RAS-01 (honesto):** o backlog lista RAS-01 como **P0/Fase 0**, mas sua dependência real é **FND-01** (Fase 2). Resolução adotada no cronograma: o **código** que escreve linhagem entra na Fase 0 (dark/atrás de flag); a **migração irreversível** só roda na **janela Fase 3**, após o baseline. Não pinte RAS-01 de verde antes disso.

#### (C) Decisões de produto/negócio — travam WIs até o dono decidir

| Sem | Decisão (VOCÊ-dono) | Trava (WI) | Pronto (binário) |
|---|---|---|---|
| **3–4** | **Valor do lead: faixa ou exato** | LEAD-02/FIN | Regra escrita; motor usa faixa OU valor exato sem ambiguidade |
| **5–8** | 🚩 **Escrow 2-chaves — quais papéis** (`chave_hub`≠`chave_tecnica`; técnica=arq OU eng) | FIN-02, JANELA-03 | Matriz de papéis definida; guard rejeita mesma pessoa nas 2 chaves |
| **~9–12** | 🚩 **Entrega IMB/FOR/PRO (decisão #7/#8): não "vira obra"** | EST-02 | Fechamento imobiliário gera negócio IMB correto, não OBR |
| **~9–14** | 🚩 **`hub_produtos`: modelar agora ou deferir** + **catálogo ~20 itens de materiais (BLOQUEANTE — Compras abre vazia)** | órfã #17, módulo PRO | Decisão registrada; se "agora": tabela criada + ~20 itens seedados + ~500 importáveis |
| **~9–14** | **Captação pública: quais forms sem login** | EST-02, Marketing | Lista de forms públicos aprovada; captação pública liga só neles |
| **~15–20** | 🚩 **Planos SaaS + markup Tijolos (preço)** | **MET-05** | Tabela `hub_planos` preenchida; entitlements por módulo; 1º MRR cobrável |
| **~21–26** | 🚩 **Modelo multi-tenant A/B** (fornecedor×parceiro×empresa) | TEN-04 | Modelo escolhido; hierarquia de tenant reflete a escolha |
| **~21–26** | 🚩 **Política de hold do clawback (dias)** | Fase 5 | Nº de dias definido; motor de comissão aplica o hold |
| **1–2 / 21–26** | **Rebalancear owners** (Ramon owner→admin, Ariane owner→comercial, promover obradezmais→owner, remover `e2e-arq@obra10.app`) | RBAC-04 | Papéis corrigidos no banco; arquivar revoga acesso (status≠ativo) |
| **~20–30** | 🚩 **IAP: billing fica na WEB** (evitar Apple 3.1.1, comissão 15–30%) | Mobile iOS | Decisão registrada; app iOS só "gerenciar pela web", sem venda in-app |
| **~26–30** | **`legacyToFunil` / reconciliação dos 2 docs-mestre** (MAPA DECISÃO-35: 00-PAINEL usa esquema antigo divergente do 04) | dívida de governança | Um único doc-mestre autoritativo; 00 alinhado ao 04 |

#### (D) Jurídico & dinheiro de terceiros — bloqueia a Fase 2 real

| Sem | Gate (VOCÊ-dono) | Trava (WI) | Pronto (binário) |
|---|---|---|---|
| **5–8** | 🚩💰 **Parceiro BaaS/KYC p/ escrow + abrir contas-escrow por obra** | FIN-02 real (dinheiro de terceiros) | Contrato BaaS assinado; conta-escrow real por obra; base legal de custódia documentada |
| **5–8** | 🚩 **Seed de dinheiro real** (recebíveis/medições Consulado Itália) | OBR-01/02, FIN-01 (obra real p/ validar) | Dados reais no tenant zero; medição real registrada append-only |
| **5–8** | 🚩 **Recuperar docs de GESTÃO DE OBRAS do Asana** (base do módulo Engenharia; conta convidado inacessível) | OBR-01, órfã #9/#20 | Docs exportados; EAP/escopo do módulo ancorado neles |
| **~21–26 / mobile** | 🚩⚖️ **Textos jurídicos: Termos de Uso + Política de Privacidade (LGPD)** | LGPD-01, órfã #28, **e BLOQUEANTE das lojas** | `/privacidade` público no ar; termos publicados; cobre CPF de terceiros e fotos de campo |

#### (E) Contas de loja & infra mobile — abrir CEDO, publicar em V1

> Publicação em loja é **escopo V1**, fora do MVP. Mas **dois gates precisam abrir já na Sem 1–2** porque a verificação demora e vira caminho-crítico da trilha iOS.

| Sem | Gate (VOCÊ-dono) | Destrava | Pronto (binário) |
|---|---|---|---|
| **1–2** (abrir) | 🚩🍎 **Apple Developer Program (US$99/ano)** — verificação de identidade/D-U-N-S leva **1–2 semanas** | toda a trilha iOS (TestFlight, App Store) | Conta aprovada; acesso ao App Store Connect |
| **1–2** (abrir) | 🚩🤖 **Google Play Console (US$25 único)** — conta nova pode exigir **teste fechado 12 testers/14 dias** | trilha Android (TWA) | Conta ativa; app criado em rascunho |
| **~4–7** | 🚩 **Mac/Xcode ou CI Mac** (equipe é win32) — EAS/Codemagic/MacinCloud (custo + decisão) | build iOS Capacitor | Pipeline de build iOS funcional (Archive gera .ipa) |
| **1–2** | 🚩 **Domínio próprio HTTPS** (sair de `*.onrender.com`) | TWA (`assetlinks.json`), credibilidade na revisão Apple | `app.obra10.com.br`→Render; `NEXT_PUBLIC_APP_URL` atualizado |
| **~20–30** | **Usuário demo do tenant zero** para revisores (Apple 5.1.1) | revisão Apple/Play | Login demo funciona no webview; entregue ao revisor |
| **~20–30** | **App Privacy labels / Data Safety** declarando CPF de especialistas + fotos de terceiros + geo de campo | submissão nas 2 lojas | Formulários preenchidos e coerentes com o que o app coleta |

---

### 5.2 — Linha do tempo: quando cada gate vira caminho-crítico

| Semana | Gates que DEVEM estar destravados até aqui | Se atrasar, para… |
|---|---|---|
| **Sem 1–2 (Fase 0)** | Rotação service_role + PAT + Render + senha; backup GitHub; config cron/Render; tirar `NEXT_PUBLIC_*`; janela-mini (AUT-7+advisors+RAS-02+MET-01+EST-03); **abrir Apple Developer + Play Console**; domínio próprio | segurança inteira; qualquer WI de rede; abre a fila de verificação das lojas |
| **Sem 3–4 (Fase 1)** | **Chave Mistral+billing**; UAZAPI; decisão valor do lead | IA-01 e **toda a Fase 1** (WhatsApp→IA→1 toque) |
| **Sem 5–8 (Fase 2 — JANELA GRANDE)** | Decisão escrow 2-chaves; **BaaS/KYC + contas-escrow**; seed real Consulado; docs Asana; janela grande completa; **desfazer DEMO R$15k** | FND-01, OBR-01/02, FIN-01/02, JANELA-03 — o represado inteiro; sem isso não há MVP |
| **Sem 9–14 (Fase 3 — MVP)** | Janela Fase 3 (RAS-01 irreversível, RAS-05, LGPD-01); decisão IMB/FOR/PRO; decisão `hub_produtos`+catálogo materiais; forms públicos; Meta+Windsor (marketing) | LEAD/EST/RAS/EVT — fechar "cliente real sem planilha" |
| **Sem 15–20 (Fase 4 — receita)** | **Preços SaaS + markup Tijolos** | MET-05, MET-04 (ligar `IA_HARD_CAP`) — 1º MRR |
| **Sem 21–26 (Fase 5 — rede)** | Janela Fase 5 (TEN-01→04); política de hold clawback; modelo multi-tenant A/B; rebalancear owners; textos jurídicos | gate absoluto do 2º tenant |
| **Sem 20–30 (Mobile V1, paralelo)** | Mac/CI Mac; decisão IAP-na-web; `/privacidade`+delete-account; usuário demo; App Privacy/Data Safety | publicação Play e App Store |
| **Sem 29+ (Fase 7)** | Janela Altitude 1 (RLS Faixa B) | Hub lê a rede + Dinheiro do Hub + Portal |

---

### 5.3 — Grafo de dependências críticas (caminho-crítico)

**Legenda:** `→` = "destrava"; **[JANELA]** = migração do dono; **[CHAVE]** = credencial do dono; **[DEC]** = decisão do dono; **⚠️** = irreversível.

**Espinha do MVP (Fases 0→3):**
```
[CHAVE rotação service_role] ──► segurança viável
        │
        ▼
RAS-02 + MET-01 + EST-03 (janela-mini)      IA-02 + MET-01 (código EU)
        │                                            │
        │                                            ▼
        │                                   [CHAVE Mistral+billing] ──► IA-01 (Fase 1)
        ▼
[JANELA GRANDE Fase 2] ──► FND-01 ──► TEN-03(vínculos) ──► FIN-01
                              │                              ▲
                              ├──► OBR-01 (AEC ordem exata) ─┤
                              │        │                     │
                              │        ▼                     │
                              │     OBR-02 (medição)         │
                              │        │                     │
                              ▼        ▼                     │
                       FIN-02 (fix escrow) ──► [aplica E6]   │
                       ⚠️ + desfazer DEMO R$15k              │
                              │                              │
   [DEC escrow 2-chaves]──────┘   [D: BaaS/KYC + seed real]──┘
                              │
                              ▼
              FND-01 pronto ──► RAS-01 ⚠️ (linhagem, janela Fase 3)
                              │
                              ▼
          LEAD-02 ──► EST-01/EST-02[DEC IMB/FOR/PRO] ; RAS-05 ; EVT-01[CHAVE Meta]
                              │
                              ▼
                   ✅ MVP: cliente real SEM planilha
```

**Ramais de receita e rede (Fases 4→5):**
```
MET-02 ──► MET-03 ──► MET-04 (liga IA_HARD_CAP)
              │
              └──► MET-05 [DEC preços SaaS] ──► ✅ 1º MRR
RAS-02 ──► [JANELA F5] TEN-01 ──► TEN-02 ──► TEN-03 ──► TEN-04 [DEC multi-tenant A/B]
                                                            │
FND-02 ──► RBAC-05 (guard 32 rotas) ; RBAC-01/02/03/04     ▼
                                                    ✅ gate 2º tenant (nenhum tenant lê outro)
```

**Ramal Mobile/Lojas (V1, paralelo — não bloqueia MVP):**
```
[CHAVE domínio próprio] + reescrever sw.js + ícones reais + /privacidade[D jurídico]
        │
        ├──► assetlinks.json ──► TWA (Bubblewrap) ──► AAB ──► Play [conta aberta Sem1-2]
        │
        └──► [CHAVE Mac/CI] Capacitor iOS + push/câmera/geo (sobrevive à Guideline 4.2)
                    │
                    └──► [DEC IAP-na-web] ──► TestFlight ──► App Store [Apple aberta Sem1-2]
```

**Os 4 nós de maior alavancagem (se um atrasar, arrasta cadeias inteiras):**
1. **Rotação de segredos (Sem 1–2)** — bloqueia toda a trilha de segurança.
2. **[CHAVE Mistral] (Sem 3–4)** — bloqueia Fase 1 inteira; sem ela o IA-first do produto é fachada.
3. **[JANELA GRANDE Fase 2] (Sem 5–8)** — nó de maior fan-in do cronograma: FND-01 + OBR + FIN + escrow. É o único ponto onde o represado inteiro sai do file-only. Um adiamento aqui empurra MVP **e** Fase 4/5 em bloco.
4. **[CHAVE Apple Developer] (abrir Sem 1–2)** — caminho-crítico do V1 iOS por causa da verificação de 1–2 semanas + risco de rejeição 4.2.

---

### 5.4 — Riscos & mitigações (do plano de negócio, aplicados ao cronograma)

| # | Risco | Prob./Impacto | Onde bate no cronograma | Mitigação (ação concreta + responsável) | Gatilho de alerta |
|---|---|---|---|---|---|
| **R-1** | **MVP estoura o trimestre** (Fase 3 = S5–7 → Sem 12–14, não 12) | Alta / Médio | Fim da Fase 3 | Cortar escopo da Fase 3 ao critério-mãe ("cliente real sem planilha"); empurrar RAS-04, FND-02, refactor 2.3 (órfã #27) para pós-MVP. **EU-code** protege o caminho-crítico; **VOCÊ-dono** aceita o corte | Sem 10 sem obra real rodando |
| **R-2** | **Janela grande (Fase 2) escorrega** — depende de BaaS/KYC + seed + docs Asana + decisão escrow, todos do dono | Alta / **Crítico** | Sem 5–8; arrasta MVP e receita | Pré-carregar os 4 gates de D e a decisão de C **na Fase 0–1** (não esperar Sem 5); dividir a janela em ensaio (branch Supabase `create_branch`→`db reset`) antes de tocar prod | BaaS não fechado até Sem 4 |
| **R-3** | **Custódia fantasma vai a prod** — E6 aplicada antes do FIN-02; DEMO R$15k viva | Média / **Crítico (dinheiro real)** | Sem 5–8 | Ordem travada na janela: **FIN-02 (`RAISE`+`FOR UPDATE`) ANTES de E6**; desfazer DEMO como 1ª linha; PR rejeitado se `GREATEST(0,…)` sobreviver; teste de custódia negativa no CI | Qualquer saldo de escrow ≠ soma das medições |
| **R-4** | **Chave do dev demitido comprometida** (service_role/PAT válidos até 2036) | Média / **Crítico** | Sem 1–2 | Rotação é a **primeira** entrega do cronograma; até lá, tratar prod como exposto (sem seed de dado sensível novo) | Acesso anômalo nos logs Supabase |
| **R-5** | **IA sai cara sem teto** (markup<1 dava IA de graça; `IA_HARD_CAP` em sombra) | Média / Alto | Sem 3–4 (liga IA) → Sem 15–20 | MET-01 (CHECK≥1) **antes** de IA-01; ordem MET-03→régua 7/3/1→`IA_HARD_CAP` on (MET-04); rate-limit distribuído (órfã #3) na Fase 1 | Custo Mistral/dia acima do orçado |
| **R-6** | **Apple reprova por Guideline 4.2** (webview fino) — contar 1–2 ciclos | Alta / Médio (só V1) | Sem 20–30 | iOS = Capacitor **com** push APNs + câmera + geo (valor nativo que o produto já quer); abrir conta cedo; prever 1–2 semanas de idas-e-voltas no plano | 1ª rejeição na revisão |
| **R-7** | **IAP forçado no iOS** (Apple 3.1.1, comissão 15–30%) | Média / Alto | Sem 20–30 | **Decisão do dono: billing na web**; app iOS só "gerenciar pela web", zero venda in-app | Revisor sinaliza venda no app |
| **R-8** | **RLS aberta / tenant vaza** (TEN-03 aberta; `.eq` puro faltando) | Alta / **Crítico p/ rede** | Sem 21–26 (gate 2º tenant) | Fase 5 é **gate absoluto**: nenhuma hora no 2º tenant antes de 12/12 do checklist + teste de intrusão interno; TEN-01→04 na ordem; RBAC-05 guarda 32 rotas service-role | Teste de intrusão lê dado de outro tenant |
| **R-9** | **R7 fail-OPEN** (papel desconhecido cai em 'comercial') | Média / Alto | Sem 1–2 ou 21–26 | Trocar para **fail-closed** (papel desconhecido = negar); teste unitário cobrindo papel inexistente | Papel novo herda permissão indevida |
| **R-10** | **Compras abre vazia** (`hub_produtos` não existe; catálogo materiais bloqueante) | Alta / Médio | Sem 9–14 | Decisão do dono (C) + seed de ~20 itens; se deferir, esconder o módulo em vez de mostrar vazio | Tela de Compras sem 1 item |
| **R-11** | **Unit economics ilustrativos viram meta** (LTV R$38,7k, take 2,8%) | — / Reputacional | Planejamento de receita (Fase 4) | Marcar **ILUSTRATIVO** em toda projeção; validar com o 1º MRR real antes de prometer | Alguém cita os números como reais |
| **R-12** | **Divergência dos 2 docs-mestre** (00-PAINEL antigo × 04 autoritativo) | Média / Médio | Governança contínua | Ancorar tudo no **04/CADERNO**; MAPA DECISÃO-35 (reconciliar) na Fase 5/6; 00 marcado como legado até lá | Decisão tomada pelo doc errado |
| **R-13** | **Sem Mac na equipe** (env win32) trava build iOS | Alta / Médio (V1) | Sem 4–7 | Contratar CI Mac (EAS/Codemagic) cedo; decisão + custo do dono na Fase 0–1 | Sem pipeline iOS até Sem 6 |
| **R-14** | **Delete=arquiva não cumprido** (5 endpoints sem coluna de arquivo; invariante #4 furada em prod) | Média / Alto (perda de dado) | Sem 1–2 / 9–14 | Adicionar coluna de arquivo + trocar DELETE por UPDATE nos 5 endpoints; teste que prova que nada some | Registro some do banco após delete |

**Postura geral de risco (do contrato CEO honesto):** nenhum item acima é pintado de verde antecipadamente. Os três riscos **críticos vivos hoje** — R-3 (custódia fantasma / DEMO R$15k), R-4 (chave do dev demitido), R-8 (RLS aberta) — são os que justificam a ordem do cronograma: **estancar o irreversível (Fase 0) → só então ligar a IA → só então destravar o dinheiro na janela grande.** Qualquer inversão dessa ordem troca velocidade por risco financeiro/segurança real.

---

*Fim da Parte 5. Gates ancorados em 04-ROADMAP/CADERNO §14–16, PLANO-DE-NEGOCIO e PENDENCIAS-VARREDURA-07JUL. Semanas relativas ao sprint canônico; nenhuma data de calendário fixada (dependem de capacidade + janelas do dono).*


## 6. Painel de acompanhamento & a regra "não sair dos trilhos"

> Esta parte não entrega features — entrega o **instrumento** que impede o projeto de derivar. É o painel que o dono abre toda semana e a régua que decide, a cada bifurcação, se uma tarefa entra ou espera. Tudo aqui é operável hoje, com os arquivos que já existem (`docs/00-PAINEL-DE-CONTROLE.md`, `docs/04-ROADMAP-E-PLANO.md`, `docs/CADERNO-ENGENHARIA-AUDITORIA.md`). Onde algo é ilustrativo, está marcado 🟡. Onde depende do dono, está marcado 🔑.

---

### 6.1 A métrica-mãe (a bússola que decide tudo)

Só existem **dois destinos** neste cronograma, e todo trabalho é medido pela distância até eles:

- **MVP** = *"consigo rodar o próximo cliente real, ponta-a-ponta, SEM a planilha?"* (critério de pronto da **Fase 3**).
- **V1** = *"consigo COBRAR (MRR + Tijolo) e o app está PUBLICADO nas duas lojas, com a rede endurecida?"* (Fases 4–5 + workstream MOBILE-LOJAS).

**Regra de ouro do painel:** nenhuma linha do cronograma é "verde" por estar *codada*. Ela é verde só quando o **critério de pronto binário** passou **em produção** (ou no ambiente onde o dono a usa). Codar ≠ pronto. Deploy ≠ pronto. **Usado pelo dono sem planilha = pronto.**

---

### 6.2 Vocabulário de estado de uma WI (sem meio-termo pintado de verde)

Toda WI (RAS-01…MET-05, TEN-01…, e as 32 órfãs) carrega **exatamente um** destes estados. O estado é honesto por definição — não há "quase pronto".

| Estado | Símbolo | Significado binário | O que comprova |
|---|---|---|---|
| Não iniciada | ⬜ | Ninguém tocou | — |
| Em curso | 🔵 | Dev com as mãos no código | branch aberto |
| Em revisão | 🟣 | Código pronto, no gate de qualidade | PR + `tsc` limpo + `vitest` verde |
| **Bloqueada por janela** | 🔑 | Depende de destrave do dono (chave/migração/decisão) | linha aponta o gate exato (§6.7) |
| Pronta-em-staging | 🟡 | Passou no gate, deployada, **ainda não validada ao vivo** | screenshot antes/depois |
| **Verde (pronta)** | 🟢 | Critério binário **passou em produção / uso real** | E2E ao vivo OK + dono reagiu |
| Regrediu | 🔴 | Estava verde, quebrou | teste/E2E vermelho |

**Proibições de honestidade (anti-slop):**
- 🟡 nunca vira 🟢 sem E2E ao vivo. "Fachada" (barra 42% falsa, "85% de confiança" inventado — pendência órfã #12) conta como 🔴, não 🟢.
- Número ilustrativo (unit economics do Plano: LTV ~R$38,7k, take 2,8% 🟡) **nunca** entra no painel como fato.
- WI represada (motor de comissões, escrow, camada AEC) fica 🔑 até a janela — **não** 🟢 — porque "testado via MCP" não é "aplicado em prod".

---

### 6.3 Progresso por WI — o **Ledger de WIs** (fonte única da verdade)

Vive em `docs/00-PAINEL-DE-CONTROLE.md` (uma tabela por fase). É a linha de base do painel. Cada WI já tem ficha técnica (36 no CADERNO por seção; 32 órfãs com ficha escrita nas Partes 2–5) — **o Ledger não repete a ficha, só rastreia o estado**.

**Esquema de cada linha (colunas obrigatórias):**

`WI · Título · Fase · Prio(P0/P1/P2) · Esf(P/M/G/GG) · Responsável · Depende · Critério-de-pronto BINÁRIO · Estado · Evidência(link) · Janela?(🔑)`

Exemplo do Ledger preenchido (recorte da Fase 0 e Fase 2 — os estados abaixo refletem o RECON):

| WI | Título | Fase | Prio | Resp | Depende | Critério de pronto (binário) | Estado | Evidência | 🔑 |
|---|---|---|---|---|---|---|---|---|---|
| RAS-01 | Linhagem escrita pelo app ⚠️irreversível | 0 | P0 | EU-code + 🔑dono | FND-01 | Todo negócio novo nasce com `negocio_raiz_id`≠NULL; `SELECT count(*) WHERE raiz IS NULL` = 0 nos novos | 🔑 | — | Janela migração linhagem |
| RAS-02 | UNIQUE código + auto-código (trigger) | 0 | P0 | EU-code | — | 2 inserts concorrentes → 0 código duplicado; trigger BEFORE INSERT ativo | ⬜ | — | — |
| MET-01 | Markup ≥1 (PUT 400 + CHECK) | 0 | P0 | EU-code | — | PUT com markup 0/neg → 400; `INSERT markup<1` → erro do banco | ⬜ | — | — |
| IA-02 | `ml.ts` wrapper c/ fallback | 0 | P1 | EU-code | — | `/api/ml/*` responde sem Anthropic (fallback), 0 exceção | ⬜ | — | — |
| FIN-03 | Guard `valor_fechado` NULL no ganho | 0 | P1 | EU-code | — | Ganho sem valor → banner UI + endpoint recusa | ⬜ | — | — |
| EST-03 | CHECK `hub_atividades` + teste 6 mercados CI | 0 | P1 | EU-code | — | Tipo fora do CHECK → **CI vermelho**, não prod | ⬜ | — | — |
| FND-01 | Baseline migration | 2 | P1 | EU-code + 🔑 | — | `supabase db reset` limpo + `db diff` **vazio** | 🔑 | — | Janela migração grande |
| OBR-01 | Camada AEC E0→…→A1 na ordem | 2 | P1 | EU-code + 🔑 | FND-01, FIN-02 | 13/13 tabelas AEC no ar; ordem exata aplicada | 🔑 | testado MCP | Janela migração grande |
| FIN-02 | Fix escrow (`GREATEST`→RAISE, `FOR UPDATE`) **antes** de E6 | 2 | P0 | EU-code + 🔑 | OBR-01 | Custódia negativa → RAISE; E6 só aplicado após fix; C2 fechada | 🔑 | — | Janela migração grande |
| FIN-01 | Motor comissões em prod (5 estados) | 2 | P1 | EU-code + 🔑 | TEN-03(vínculos), FND-01 | Comissão real PREVISTA→APURADA→EXIGÍVEL→APROVADA→PAGA numa obra real | 🔑 | testado MCP | Janela migração grande |
| TEN-03(parcial) | Fechar RLS `hub_negocio_vinculos` | 2 | P0 | EU-code | — | `USING(true)` removido; anon sem GRANT; leitura cross-tenant = 0 linhas | ⬜ | — | — |

> O Ledger completo replica este formato para **todas** as WIs das Fases 0–8 + as 32 órfãs (registros/timeline #13, financeiro operacional #14, SEC-7 auditoria-IA #1, R7 fail-open #23, delete=arquiva #25, `hub_produtos` #17, mobile-cadastros #10 etc.). Cada órfã já tem a ficha "como o dev sana" nas Partes anteriores; aqui ela **só ganha estado + evidência**.

**Como o dev/dono atualiza uma linha (protocolo de 30 segundos):** ao fechar uma WI o dev muda o estado, cola o **link da evidência** (screenshot antes/depois, print do E2E ao vivo, ou o SQL que retorna 0), e comita `docs/00-PAINEL-DE-CONTROLE.md`. **Sem evidência, o estado não avança.** É a trava anti-fachada.

---

### 6.4 Progresso por semana — o **Quadro de Checkpoints** (barômetro)

Numeração por **semana**, agrupada em **sprints de 2 semanas**, ancorada nos sprints canônicos (CAD §15): S1=Fase 0 · S2=Fase 1 · **S3–4=Fase 2 (1 janela)** · S5–7=Fase 3 (MVP) · S8–10=Fase 4 · S11+=Fase 5. Meta-âncora: **Fases 0–3 = MVP em ~12 semanas**. **Sem datas fixas** — a semana avança por capacidade real + abertura das janelas 🔑.

Formato do quadro (uma linha por semana; a coluna "Pronto" é o gate binário que fecha a semana):

| Sem | Sprint/Fase | Entregas-âncora (WIs) | Responsável | Depende de | Pronto da semana (binário) |
|---|---|---|---|---|---|
| 1 | S1 / Fase 0 | RAS-02, MET-01, EST-03, +órfãs #4 (rotação segredos), #23 (R7 fail-closed), #25 (delete=arquiva) | EU-code / 🔑dono (segredos) | — | markup<1 rejeitado (UI+banco); CI barra tipo fora do CHECK; segredos rotacionados |
| 2 | S1 / Fase 0 | RAS-01 (na janela), IA-02, FIN-03, #10 mobile-cadastros (P0 dono) | EU-code + 🔑dono | janela linhagem | 0 negócio novo sem raiz; `/api/ml/*` não quebra; mobile cria PF/empresa |
| 3 | S2 / Fase 1 | IA-01 (ligar Mistral), #3 rate-limit, #7 IA-hardening, #8 HMAC webhook | EU-code + 🔑dono (chave+billing) | MET-01, IA-02, chave Mistral | WhatsApp→IA qualifica→humano confirma em 1 toque |
| 4 | S2 / Fase 1 | Estabilizar IA (sombra `IA_HARD_CAP`), #16 eventos/notificações base | EU-code | IA-01 | IA em "sugere e mostra"; nenhum auto-aprovar |
| 5–6 | **S3–4 / Fase 2** 🔑 | **JANELA GRANDE**: FND-01 → OBR-01 → FIN-02 → E6 → FIN-01; OBR-02; TEN-03(vínculos); #24 JANELA-03 chave técnica; **desfazer DEMO escrow R$15k** | EU-code + 🔑dono (janela única) | FND-01 primeiro | obra real EAP+medição+escrow **2-chaves**; comissão PREVISTA→PAGA; `db reset` reconstrói; C2 fechada |
| 7–9 | S5–7 / Fase 3 | LEAD-02, EST-01/02, LEAD-01(SLA cron), RAS-05(MDO), EVT-01(UTM/CAC), #13 registros/próxima-ação, #14 financeiro operacional, #17 `hub_produtos`+catálogo, #1 SEC-7, #11 design overhaul | EU-code / 🔑dono (catálogo, Asana) | Fase 2 fechada | **próximo cliente real roda ponta-a-ponta SEM planilha** (MVP 🟢) |
| 10–12 | S8–10 / Fase 4 | MET-02→MET-03→MET-04→MET-05 (ordem travada) | EU-code + 🔑dono (preços SaaS) | MET-03 primeiro | 1º R$ de MRR + 1º Tijolo cobrado |
| 11+ (paralelo) | Workstream MOBILE-LOJAS | Domínio próprio, SW real, ícones/splash, `/privacidade`+delete-account, TWA Android, Capacitor iOS | EU-code + 🔑dono (conta Apple, Mac/CI, domínio) | abrir conta Apple JÁ | AAB no teste interno Play; TestFlight iOS |
| 13+ | S11+ / Fase 5 | TEN-01→02→03→04, RBAC-01…05, LGPD-01, #21 config self-service | EU-code + 🔑dono (hold clawback) | Fase 2 | teste de intrusão interno passa; **nenhum tenant lê outro** |

**Barômetro que fecha cada semana (o número que o dono lê):**
- **% da fase corrente** = (WIs 🟢 da fase) ÷ (total de WIs da fase). Ex.: Fase 0 tem 7 WIs → 4/7 = 57%.
- **Regra**: a semana só "vira" quando o *Pronto da semana* está 🟢. Se virou a semana sem o pronto, a linha fica **🔴 arrastada** e aparece explicitamente no 1-pager (não some, não é reescrita para parecer no prazo — isso é "sair dos trilhos").

---

### 6.5 O ritual de revisão — o **loop curto** (build → mostrar → reagir → ajustar → backup)

O anti-deriva do dia a dia. Uma WI **nunca** avança em bloco de semanas sem passar por este loop. É o processo já travado na memória (E2E → mesa → CEO aprova → dono reage).

**Loop por WI (o ciclo mínimo):**
1. **Build** — dev implementa 1 WI (não 3). Gate obrigatório antes de qualquer merge: `tsc` limpo + `vitest` verde + migração **aditiva/reversível** + screenshot antes/depois se toca UI.
2. **Mostrar** — deploy em staging/prod e **E2E ao vivo** (chrome-devtools/Playwright), no fluxo real, desktop + mobile. Não "abriu a tela": *clicou o CTA e o dado persistiu*.
3. **Reagir** — o dono usa e reage; a mesa/CEO revisa. Critério: *isto facilita a vida dele?* (métrica-mãe da memória).
4. **Ajustar** — correção na mesma WI (loop curto), não vira backlog novo.
5. **Backup** — `git pull` antes de push; `wendel/dev` → `feature/escritorio-visual` (prod, auto-deploy Render); push de backup próprio 🔑 (repo ainda é do dev demitido).

**Cadência dos rituais:**

| Ritual | Frequência | Quem | Saída |
|---|---|---|---|
| Loop curto por WI | a cada WI fechada | EU-code + dono | estado no Ledger + evidência |
| **Checkpoint de semana** | fim de cada semana | EU-code | barômetro % + 1-pager atualizado |
| **Revisão de sprint** | fim de cada sprint (2 sem) | dono + Ramon + CEO | replanejar próxima quinzena; mover 🔴 arrastadas |
| **Abertura de janela 🔑** | quando o dono destrava | dono + EU-code juntos | migração/chave aplicada **junta**, virada em arquivo |
| Revisão de invariantes | todo PR | reviewer | rejeita PR que fere os 8 invariantes (CAD §16) |

---

### 6.6 A régua de decisão — *"isto me aproxima de cobrar/publicar?"*

O filtro que barra a deriva. Toda tarefa nova (ideia do dono, bug, pedido de feature, refactor tentador) passa por esta régua **antes** de entrar na semana. É o dispositivo que impede o cronograma de inchar.

**Fluxo de decisão (aplicar em ordem — para no primeiro NÃO relevante):**

1. **É P0 de dinheiro ou de segurança irreversível?** (escrow fantasma FIN-02, linhagem RAS-01, RLS aberta TEN-03, DEMO R$15k, rotação de segredos) → **entra JÁ**, fura fila. Estes bloqueiam ou corrompem — não esperam régua.
2. **Aproxima do MVP** (deixa o dono operar sem planilha — Fase 3)? → entra na fila da fase corrente.
3. **Aproxima de COBRAR** (Fase 4: MRR/Tijolo) **ou de PUBLICAR** (V1: lojas)? → entra, mas **depois** do MVP (não antecipar Fase 4/lojas se atrasa Fase 3).
4. **É Fase 5+ (rede/2º tenant/marketplace)?** → **congela**. Regra dura das fontes: *"sem hora de dev antes da Fase 6"* para escala/internacional. Endurecimento (Fase 5) só depois do MVP rodar.
5. **Não move nenhum dos dois destinos** (polish estético não-bloqueante, feature "seria legal") → **backlog frio**, sai da semana.

**Cartão de pontuação (quando 2 tarefas competem pela mesma semana):** ganha a que (a) desbloqueia dinheiro, depois (b) tem menor esforço (P<M<G<GG) para o mesmo destino, depois (c) destrava mais dependências à jusante. Empate → a que fecha um critério de pronto de fase.

**Pergunta-guilhotina (o dono faz em voz alta a cada pedido):** *"Se eu parar tudo e só fizer isto, o próximo cliente real roda sem planilha mais cedo? Ou eu cobro mais cedo? Ou publico mais cedo?"* Se a resposta for "não" para os três → não é para agora.

---

### 6.7 As **janelas do dono** — o quadro de destrave (🔑)

O cronograma **mostra onde ele destrava**. Nada 🔑 avança sem o dono. Consolidado do RECON (autoritativo = 04) + os gates órfãos do PENDENCIAS.

| 🔑 Janela / chave / decisão | Destrava | Tipo | Quando (fase) | Sem isto… |
|---|---|---|---|---|
| **Chave Mistral + billing** | IA-01 / toda Fase 1 | Credencial | Fase 1 (Sem 3) | IA fica desligada (já ~60d) |
| **Janela de migração GRANDE (única)** | FND-01+OBR-01+FIN-02+FIN-01 **juntas** | Migração Supabase | Fase 2 (Sem 5–6) | motor/escrow/AEC seguem represados |
| **Migração da linhagem** ⚠️irreversível | RAS-01 | Migração Supabase | Fase 0 (Sem 2) | negócios nascem sem raiz (dívida eterna) |
| **Desfazer DEMO escrow (R$15k)** | fecha risco crítico vivo | Ação em prod | Fase 2 (junto janela) | dinheiro de terceiro em camada não-aplicada |
| **Rotação de segredos** (service_role + PAT `sbp_` do dev demitido + Render + senha exposta no chat) | Fase 0 inteira / segurança | Credencial | Fase 0 (Sem 1) | chave do demitido vale até 2036 |
| **Push GitHub de backup próprio** | posse do repo | Config | Fase 0 | repo ainda é do dev demitido |
| **Config Render/cron** (CRON_SECRET, MOTOR_FONTE=fornecedores, COPILOTO_HMAC_SECRET, mover cron KPIs) | LEAD-01 SLA, motor, copiloto | Config | Fase 0/3 | cron forjável / motor sem fonte |
| **Tirar `NEXT_PUBLIC_INTERNAL_API_KEY`/`TENANT_ID`** do bundle | RBAC-01 | Config + retest login | Fase 5 | chave interna vaza no browser |
| **Catálogo ~20 materiais + importar ~500** | `hub_produtos` #17 / Compras | Decisão + dado | Fase 3 | Compras abre vazia (BLOQUEANTE) |
| **Recuperar docs de obras do Asana** | base do módulo Engenharia | Acesso | Fase 2/3 | EAP/RDO sem lastro |
| **Seed de dinheiro real (Consulado)** | validar medição/escrow reais | Dado | Fase 2/3 | escrow sem obra real |
| **Parceiro BaaS/KYC + contas-escrow por obra** | FIN-02 real | Config externa | Fase 2 | escrow não movimenta real |
| **Decisão preços SaaS + markup Tijolos** | MET-05 | Decisão | Fase 4 | não há como cobrar |
| **Política de hold do clawback (dias)** | Fase 5 | Decisão | Fase 5 | comissão sem trava de estorno |
| **Credenciais Meta (Lead Ads/Direct) + Windsor** | tráfego pago / EVT-01 CAC | Credencial | Fase 3+ | marketing não gera lead rastreável |
| **Textos jurídicos** (termos + privacidade) | `/privacidade` LGPD (lojas) | Conteúdo | Fase 5 / lojas | reprova nas duas lojas |
| **Janela Altitude 1 (RLS Faixa B real)** | Fase 7 (Hub lê a rede + Dinheiro do Hub) | Migração Supabase | Fase 7 | Hub não enxerga a rede |
| **Conta Apple Developer (US$99/ano, verif. 1–2 sem)** | toda trilha iOS | Credencial + custo | abrir **JÁ** (paralelo) | iOS trava por semanas |
| **Google Play Console (US$25 único)** | trilha Android | Credencial + custo | Sem 3–4 | sem publicação Android |
| **Mac/Xcode ou CI Mac** (equipe é Windows) | build iOS | Infra + custo | Sem 4–7 | impossível compilar iOS |
| **Domínio próprio HTTPS** (sair de `onrender.com`) | TWA assetlinks + credibilidade Apple | Config | Sem 1–2 (mobile) | TWA não valida; Apple desconfia |

> **Reconciliação pendente (DECISÃO-35):** o `00-PAINEL` usa numeração de fase **antiga e divergente** do `04`. O painel vivo **ancora no 04**; reconciliar os dois documentos-mestre é dívida registrada e deve virar WI de higiene documental (Fase 0/3).

---

### 6.8 O **1-pager de status** (o que o dono abre)

Uma página. Sem rolagem. Gerada/atualizada ao fim de cada semana a partir do Ledger. Vive no topo de `docs/00-PAINEL-DE-CONTROLE.md`. Template:

```
════════════════════════════════════════════════════════
 OBRA10+ — STATUS  ·  Semana N (Sprint Sx / Fase Y)
════════════════════════════════════════════════════════
 POSSO COBRAR?   NÃO  (Fase 4 — depende de MVP + MET-05 🔑preços)
 POSSO PUBLICAR? NÃO  (V1 — Play em Sem ~4-6 / Apple Sem ~7-9)
────────────────────────────────────────────────────────
 MVP (sem planilha):  ▓▓▓▓▓▓░░░░  ~70% de MVP single-tenant
 VISÃO total:         ▓▓▓▓░░░░░░  ~40%
 Fase corrente (Y):   X/Z WIs 🟢  (barômetro da semana)
────────────────────────────────────────────────────────
 🟢 FECHOU esta semana:  RAS-02, MET-01, EST-03  (+evidência)
 🔵 EM CURSO:            IA-02, FIN-03
 🔑 TRAVADO EM VOCÊ:     RAS-01 (janela linhagem) · Mistral+billing
 🔴 ARRASTANDO:          — (nada) | ou: LEAD-01 atrasou 1 sem, motivo X
────────────────────────────────────────────────────────
 PRÓXIMA JANELA DO DONO:  Migração GRANDE (Fase 2) — FND-01+OBR-01
                          +FIN-02+FIN-01 JUNTAS + desfazer DEMO R$15k
 TOP RISCO VIVO:          escrow fantasma (FIN-02) até a janela
 PRÓXIMO PRONTO BINÁRIO:  "cliente real roda sem planilha" (Fase 3)
════════════════════════════════════════════════════════
```

**Regras do 1-pager:**
- As duas primeiras linhas (**cobrar? / publicar?**) são a essência — respondem à métrica-mãe em 1 segundo.
- 🔴 arrastando **sempre aparece com motivo** — é o detector de deriva. Se essa linha cresce semana após semana, o projeto está saindo dos trilhos e a revisão de sprint corta escopo.
- Barra de % é **honesta** (do Ledger, não estimada). "70% de MVP / 40% da visão" é o estado real do RECON — não pintar melhor.

---

### 6.9 Como o cronograma é mantido **vivo** (e o protocolo "voltou aos trilhos")

**Onde vive:** o cronograma-mestre (Partes 1–5) é o *plano*; `docs/00-PAINEL-DE-CONTROLE.md` (Ledger + 1-pager) é o *estado vivo*; `docs/04-ROADMAP-E-PLANO.md` é a *fonte autoritativa das fases*; `docs/CADERNO-ENGENHARIA-AUDITORIA.md` são as *fichas*. O painel **referencia**, não duplica.

**Gatilhos de atualização (quem toca o quê, quando):**
1. **Fim de WI** → dev muda estado no Ledger + cola evidência + comita. (30s, §6.3)
2. **Fim de semana** → EU-code recalcula barômetro + regenera o 1-pager.
3. **Fim de sprint** → dono + Ramon + CEO: mover 🔴, repriorizar próxima quinzena pela régua (§6.6), reordenar só dentro do que a régua permite.
4. **Nova pendência descoberta** (varredura acha órfã nova, bug em prod) → passa pela régua (§6.6) e entra no Ledger com ficha "como sanar" (não fica solta num doc perdido — foi exatamente o problema que gerou o MAPA-MESTRE de 207 docs → 119 pendências).
5. **Janela do dono aberta** → aplicar tudo da janela **junto**, virar em arquivo de migração (`supabase/migrations`, versionado), nunca à mão. Invariante #8.

**Definição binária de "saiu dos trilhos"** (dispara o protocolo de recuperação):
- 🔴 arrastadas **crescem** 2 sprints seguidos; **ou**
- uma janela 🔑 fica aberta > 1 sprint sem o dono destravar (o caminho-crítico congela); **ou**
- entrou trabalho de Fase 5+ **antes** do MVP fechar (violou a régua §6.6.4); **ou**
- o barômetro da fase corrente **não** subiu em um sprint inteiro.

**Protocolo de recuperação (voltar aos trilhos):**
1. **Parar de abrir WI nova.** Congelar a fila.
2. Rodar a régua (§6.6) sobre **tudo** que está 🔵/🟣 — o que não aproxima de cobrar/publicar volta ao backlog frio.
3. Isolar o **caminho-crítico** até o próximo pronto binário de fase e alocar 100% da capacidade nele (trabalho cirúrgico — mexer no item = só nele, diretriz da memória).
4. Se a trava é 🔑 do dono → escalar no 1-pager como **bloqueio único**, com o custo em semanas explícito.
5. Retomar o loop curto (§6.5) só depois do pronto binário voltar a 🟢.

**Dívida de manutenção do próprio painel (registrar como WI):** reconciliar 00×04 (DECISÃO-35); manter o Ledger como *única* lista de pendências (aposentar a nuvem de docs de pendência); garantir que cada órfã incorporada (as 32) tenha estado + evidência, não só título.

---

### 6.10 Resumo operacional — as 5 travas que impedem a deriva

1. **Ledger com evidência obrigatória** → nada é 🟢 sem prova em prod (§6.3).
2. **Loop curto build→mostrar→reagir** → nenhuma WI avança semanas às cegas (§6.5).
3. **Régua "cobrar/publicar?"** → toda tarefa nova é filtrada antes de entrar (§6.6).
4. **Quadro de janelas 🔑** → o dono vê exatamente onde ele — e só ele — destrava (§6.7).
5. **1-pager honesto com linha "arrastando"** → a deriva é visível na hora, não escondida atrás de verde falso (§6.8–6.9).

> Enquanto o 1-pager responder as duas perguntas do topo com um caminho binário claro até o próximo 🟢, o projeto está nos trilhos. No dia em que "arrastando" virar a maior seção da página, o protocolo de recuperação (§6.9) entra — e corta escopo até a métrica-mãe voltar a andar.


## 7. Matriz de Cobertura de Produto (todo produto × estado × fase de pronto)

> **Propósito desta parte.** Provar, item por item, que **todo o produto** — não só o núcleo — está dentro do cronograma-mestre. Cada workstream aparece com (a) **estado real hoje**, (b) as **WIs reais** (RAS/FIN/OBR… do CADERNO) e/ou **pendências órfãs** (#1–#32 da varredura 07/jul) que o levam a pronto, (c) a **semana/sprint/fase** em que fica PRONTO com **critério binário**, (d) o **responsável**, e (e) a **🚩 janela do dono** onde ele destrava.
>
> **Ancoragem temporal (sem datas de calendário — dependem de capacidade + janelas):**
> `S1 = Sem 1–2 (Fase 0) · S2 = Sem 3–4 (Fase 1) · S3–S4 = Sem 5–8 (Fase 2, JANELA GRANDE única) · S5–S7 = Sem 9–14 (Fase 3 = MVP) · S8–S10 = Sem 15–20 (Fase 4) · S11+ = Sem 21+ (Fase 5) · depois Fases 6/7/8`.
> **Honestidade de prazo (âmbar):** a meta do Plano é "MVP em ~12 semanas", mas os sprints canônicos F0→F3 somam **14 semanas** (S1–S7). O masterplan assume MVP realista em **Sem 12–14**, condicionado à cadência das janelas do dono (não é verde — é âmbar).

### Legenda de estado
| Símbolo | Estado | Significado |
|---|---|---|
| 🟩 | **Construído** | Em produção / funcional hoje |
| 🟧 | **Represado** | Construído mas file-only / atrás da janela do dono (não aplicado) |
| 🟦 | **Desenhado** | Spec/decisão existe; código não |
| ⬛ | **Desligado** | Existe mas OFF (ex.: IA/Mistral ~60d) |
| ⬜ | **Zero/Greenfield** | Não iniciado |

Responsáveis: **EU-code** (implementação) · **VOCÊ-dono** (janela/chave/decisão) · **Ramon+devs** (execução com o time).

---

### 7.1 MATRIZ-MESTRE (visão de uma página — 19 workstreams)

| # | Workstream | Estado hoje | WIs / Órfãs que levam a pronto | PRONTO em | Resp | 🚩 Janela do dono |
|---|---|---|---|---|---|---|
| 1 | **Marketing / Leads** | 🟩 captura + funil · ⬜ tráfego pago/UTM/CAC | LEAD-01, LEAD-02, EVT-01, órfã #16 (notif.) | Núcleo **S5–S7 (F3)**; tráfego pago **S8+ (F4)** | EU-code | Meta Lead Ads + Windsor (credenciais) |
| 2 | **Portal Imobiliário (IMÓVEL)** | 🟦 desenhado; fecho IMB "vira obra" (bug) | EST-02, EST-01, RAS-04, decisão #7/#8 | **S5–S6 (F3)** | EU-code | Decisão entrega IMB/FOR/PRO |
| 3 | **Projetos (Arquitetura)** | 🟧 A0/A1 na camada AEC represada; tela ⬜ | OBR-01(A0/A1), órfã #20 (Tela Arquiteto/`po-proj-ficha`) | Backend **S3–S4 (F2)**; tela **S5–S7 (F3)** | EU-code + Ramon | **Janela GRANDE F2** |
| 4 | **Obras (Engenharia: EAP/medição/diário/curva-S)** | 🟧 camada AEC construída+represada | OBR-01, OBR-02, FIN-02, RAS-05, órfã #9 (Asana) | EAP+medição+escrow **S3–S4 (F2)**; diário/curva-S/RDO **S5–S7 (F3)** + campo **F6** | EU-code + Ramon | **Janela GRANDE F2** + recuperar Asana |
| 5 | **Serviços (SRV)** | 🟦 desenhado | EST-01, RAS-04, órfã #18 | Agendamento/medição **S5–S7 (F3)**; motor por-ofício **F6+** | EU-code | — |
| 6 | **Marcenaria/Mármore/Vidraçaria (MRC/MMR/VDR)** | 🟦 prefixos previstos, sem UI | RAS-04, órfã #18 | Prefixos+funil **S5–S7 (F3)**; verticais completas **F6+** | EU-code | — |
| 7 | **Produtos/Materiais (PRO)** | ⬜ `hub_produtos` **NÃO existe** (BLOQUEANTE) | órfã #17 (tabela+tela+catálogo), decisão catálogo | **S5–S7 (F3)** | EU-code | Decisão modelar já + catálogo ~20 itens |
| 8 | **Marketplace "iFood" (160k lojas/spread/predição)** | 🟦 visão/spec | (sem WI de núcleo) órfã #31/#32 | **F8** (pós-F6) | EU-code + Ramon | Decisões de rede/spread/CUB |
| 9 | **Gestão de Usuários & RBAC** | 🟩 papéis básicos · 🟦 UI · bug R7 fail-open | RBAC-01…05, RBAC (R7 #23), órfã #21 (Config self-service) | Hardening **S11+ (F5)**; UI self-service **F5** | EU-code | Rotação segredos + rebalancear owners |
| 10 | **Homologação de fornecedores** | 🟩 cadastro · 🟧 selo/status | TEN-03, RBAC-04, LEAD-03 (STATUS_HOMOLOGADO) | Núcleo **S3–S4/F2** (RLS) + **F5**; selo/rede **F6** | EU-code | Fechar RLS fornecedores |
| 11 | **Mão de Obra em Campo (MDO)** | 🟦 desenhado; sem fonte única | RAS-05, órfã #31 (campo E8–E10) | Cadastro+alocação+histórico **S5–S7 (F3)**; totem/GPS **F6+** | EU-code | Tablet comodato (config/custo) |
| 12 | **Portal do Cliente (5 medos)** | 🟦 desenhado | POR-01, órfã #19 (Portal Fornecedor) | **F7** (leitura antecipável pós-F3) | EU-code | Depende de F2 aplicada |
| 13 | **Copiloto / IA conversacional** | ⬛ **desligada** (Mistral OFF) | IA-01, IA-02, IA-03, MET-01, órfãs #1/#3/#7/#8/#15/#30 | Base **S3–S4 (S2/F1)**; IA nas telas **F3+** | EU-code | **Chave Mistral + billing** |
| 14 | **Dashboards por persona** | 🟩 dashboard base (sprint 07/jul) | EVT-01, órfã #12 (honestidade KPIs) | **S5–S7 (F3)** | EU-code | — |
| 15 | **Central de Aprovações** | 🟩 espinha (aprovações IA) · 🟦 unificada | órfã #1 (SEC-7 auditoria-IA), invariante #1 | **S5–S7 (F3)** | EU-code | — |
| 16 | **Gestor de Tarefas ("Hoje")** | 🟦 desenhado; stubs de menu | órfã #22 | **S5–S7 (F3)** | EU-code | — |
| 17 | **Financeiro / Escrow / Comissões** | 🟧 **motor construído+REPRESADO**; DEMO R$15k viva | FIN-02, FIN-01, OBR-02, TEN-03(parcial), órfã #14 | **S3–S4 (F2)** — a mais crítica | EU-code | **Janela GRANDE F2** + desfazer DEMO + BaaS/KYC |
| 18 | **Billing / Tijolos (receita)** | 🟦 metering existe; carteira/planos ⬜ | MET-02…05, MET-01 | **S8–S10 (F4)** | EU-code | Decisão preços SaaS + markup Tijolos |
| 19 | **Mobile / Lojas (iOS + Android)** | ⬜ greenfield (PWA ~70%, SW morto, ícones placeholder) | (workstream próprio MOBILE-LOJAS) | Play **~F5**; App Store **~F5/F6 (V1)** | EU-code + Ramon | **Conta Apple + Mac/CI + domínio + IAP** |

**Cobertura:** 19/19 workstreams mapeados a WIs/órfãs e a uma fase de pronto. Nenhum fica de fora. Abaixo, o detalhe semana×entrega de cada um.

---

### 7.2 Marketing / Leads
Estado: 🟩 captação pública + funil do Hub + distribuição existem (sprint 07/jul shipou Leads). **Represado/zero:** tráfego pago (Meta/Google), captura de UTM, coorte de canal, CAC por bairro.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto (binário) | 🚩 |
|---|---|---|---|---|---|---|
| S5 (F3) | Consolidar vocabulário de estágio (mata risco de loop P0) | **LEAD-02** — CAD §5 | EU-code | — | `legacyToFunil` normaliza 100% dos estágios; nenhum lead "some" entre vocabulários | — |
| S5–S6 (F3) | SLA com relógio + cron de redistribuição | **LEAD-01** — CAD §5 | EU-code | Config Render (cron) | `ts_oferta`/`ts_resposta` gravados; cron `*/5min` reoferta lead sem resposta; teste E2E vê passagem de dono | 🚩 CRON_SECRET |
| S6–S7 (F3) | Analytics de canal + UTM + CAC | **EVT-01** — CAD §11 | EU-code | RAS-03 (ajuda) | `hub_eventos` gera coorte MERCADO×ORIGEM; UTM capturada no form público; painel mostra CAC por bairro | — |
| S8+ (F4) | Tráfego pago (Meta Lead Ads/Direct, Google) | órfã #16 (notif.) + ingestão Meta | EU-code | **Credenciais Meta + Windsor** | Lead Ads cai direto no funil com origem; deduplica; UTM preenchida | 🚩 **Meta + Windsor (dono)** |

**Ficha órfã (tráfego pago — não há WI):** *COMO:* endpoint `POST /api/webhooks/meta-lead` (HMAC), mapeia payload Lead Ads → `hub_leads` com `origem='meta'`+UTM; conector Windsor para custo/canal → alimenta EVT-01. *ARQUIVOS:* nova rota em `app/api/webhooks/`, `lib/crm/derivar-negocio.ts:32-38` (origem). *ACEITE:* lead de campanha real entra sem digitação e o CAC aparece no dashboard. **Âmbar:** unit economics (CAC/LTV) do Plano são **ILUSTRATIVOS** — não pintar de verde.

---

### 7.3 Portal Imobiliário (vertical IMÓVEL)
Estado: 🟦 desenhado. **Bug conhecido:** fecho IMB "vira obra" (EST-02). Corretagem/atribuição (`captado_por`) parcial.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S5 (F3) | Funil próprio do mercado imobiliário | **EST-01** — CAD §6 | EU-code | LEAD-02 | `hub_pipeline_estagios` config do mercado IMB (sem re-arquitetar); estágios editáveis | — |
| S5–S6 (F3) | Entrega correta IMB (não gera obra) | **EST-02** — CAD §6 | EU-code | **Decisão dono #7/#8** | Ganho IMB cria registro imobiliário, **não** `hub_obras`; teste E2E confirma tipo de fecho | 🚩 decisão entrega |
| S6 (F3) | Rastreio cobre prefixo imobiliário + captado_por | **RAS-04** — CAD §2 | EU-code | — | Resolver reconhece prefixo IMB; `captado_por` atribui corretagem na linhagem | — |

---

### 7.4 Projetos (Arquitetura)
Estado: 🟧 camadas **A0/A1** existem na camada AEC **represada**; **Tela do Arquiteto** ⬜ não existe.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S3–S4 (F2) | Aplicar A0/A1 na janela (dentro da ordem AEC) | **OBR-01** — CAD §7 | EU-code | FND-01, FIN-02 | `hub_projetos` + funil de projeto no schema aplicado; `db diff` vazio | 🚩 **JANELA GRANDE F2** |
| S5–S7 (F3) | Tela do Arquiteto (carteira de projetos + ficha) | órfã **#20** (`po-proj-ficha` P0) | EU-code + Ramon | OBR-01 aplicada | Arquiteto vê carteira, cria ficha de projeto (briefing/programa), aprova por fase; financeiro do arquiteto lista | — |

**Ficha órfã #20 (Tela Arquiteto):** *COMO:* rota `app/crm/arquitetura/` reusando `CrmShell`; ficha `po-proj-ficha` = form briefing→programa→fases→aprovação; lê `hub_projetos`. *ARQUIVOS:* `app/crm/layout.tsx` (já extraído p/ `CrmShell` — commit d0fea5b), nova página + card financeiro do arquiteto. *ACEITE:* arquiteto cria projeto, registra briefing e move por fases sem tocar planilha.

---

### 7.5 Obras (Engenharia: EAP · medição · diário/RDO · curva-S)
Estado: 🟧 **camada AEC (13/13 tabelas) construída e represada**; escrow por medição DORMENTE. É o coração do MVP de obra real.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S3 (F2) | Baseline migration (schema reconstruível) | **FND-01** — CAD §1 | EU-code | — | `db reset` limpo + `db diff` vazio | 🚩 **JANELA GRANDE F2** |
| S3–S4 (F2) | Aplicar AEC E0→E0b→E2→E3→E5→E7→E7b→A0→A1 (ordem exata) | **OBR-01** — CAD §7 | EU-code | FND-01, FIN-02 | `hub_obras`+EAP/escopo aplicados; ⚠️`custo_total` = soma **inline** (não GENERATED encadeado) | 🚩 janela |
| S4 (F2) | Medição append-only atômica | **OBR-02** — CAD §7 | EU-code | OBR-01 | `rpc_registrar_medicao` grava linha imutável; correção = linha negativa (invariante #3) | 🚩 janela |
| S5–S6 (F3) | Diário/RDO + curva-S | (deriva de OBR-01/02) + órfã #9 (Asana) | EU-code + Ramon | Obra em prod | RDO por dia; curva-S planejado×medido renderiza; docs base recuperados do Asana | 🚩 recuperar Asana |
| S5–S7 (F3) | MDO fonte única + alocação (ver 7.11) | **RAS-05** — CAD §2 | EU-code | Obra em prod | especialista alocado à obra; histórico de execução | — |

---

### 7.6 Serviços (SRV)
Estado: 🟦 desenhado (prefixo previsto; sem funil/UI próprios).

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S5–S6 (F3) | Funil de serviços + agendamento + medição no local | **EST-01** + **RAS-04** | EU-code | LEAD-02 | Estágios de serviço configurados; agenda + medição no local gravam evento | — |
| F6+ | Motor "modelo-por-ofício" | órfã **#18** | EU-code | rede | Cada ofício herda template de execução | — |

---

### 7.7 Marcenaria / Mármore / Vidraçaria (MRC/MMR/VDR) + demais ofícios
Estado: 🟦 prefixos previstos (RAS-04 cobre os 14), sem verticalização.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S6 (F3) | Prefixos MRC/MMR/VDR no resolver + funil genérico | **RAS-04** — CAD §2 | EU-code | — | Os 14 prefixos (OBR/PRJ/SRV/MRC/MMR/VDR/FOR/ESP…) resolvem sem erro | — |
| F6+ | Verticais completas (marcenaria/marmoraria/vidraçaria/serralheria/pintura/elétrica + prestadoras) | órfã **#18** | EU-code + Ramon | marketplace | Cada vertical tem medição/execução própria | — |

---

### 7.8 Produtos / Materiais (PRO) — ⚠️ BLOQUEANTE
Estado: ⬜ **`hub_produtos` NÃO existe** → tela Compras abre vazia. Catálogo de ~20 itens é decisão travante.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S5 (F3) | Criar `hub_produtos` + modelar PRODUTO/SERVIÇO-de-obra | órfã **#17** | EU-code | **Decisão modelar já** | Tabela criada (migração aditiva na janela); tipos PRODUTO×SERVIÇO distinguidos | 🚩 decisão |
| S5–S6 (F3) | Tela Produtos + ficha + pedidos/estoque (saída/devolução) | órfã **#17** + #14 | EU-code | `hub_produtos` | CRUD de produto; pedido gera saída de estoque; devolução estorna | — |
| S6 (F3) | Catálogo semente ~20 itens + importar ~500 reais | órfã **#17** | EU-code + **VOCÊ-dono** | catálogo definido | Compras não abre vazia; cotação lista itens | 🚩 **catálogo ~20 (dono)** |

**Ficha órfã #17:** *COMO:* migração `create table hub_produtos` (tenant_id NOT NULL, tipo CHECK, preço, unidade); RLS `.eq(tenant)`; tela em `app/crm/produtos/`; seed via script. *ARQUIVOS:* nova migração `supabase/migrations/`, nova rota, `lib/tenant-default.ts` (scope). *ACEITE:* dono cadastra produto pela UI e ele aparece na cotação de uma obra real.

---

### 7.9 Marketplace "iFood" da construção (160k lojas · spread · predição · CUB)
Estado: 🟦 visão/spec (moat preditivo). **Sem WI de núcleo** — é escopo de escala.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| F8 | Organizar lojas + spread por elo + distribuição de demanda | órfã **#32** | EU-code + Ramon | F6 (rede viva) | Loja recebe demanda distribuída; spread por elo calculado | 🚩 decisões spread |
| F8 | Predição de falta + CUB proprietário + selo/homologação | órfã **#31/#32** | EU-code | dados de rede | Alerta preditivo de material; CUB calculado de dados reais | 🚩 decisões CUB |

**Âmbar:** nenhuma hora de dev antes da **F6** (gate do Plano). Fica documentado no cronograma, mas não compete com o MVP.

---

### 7.10 Gestão de Usuários & RBAC
Estado: 🟩 papéis básicos · 🟦 UI de permissões · **bug R7 fail-open** (papel desconhecido → 'comercial').

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S1 (F0) | Corrigir R7 fail-OPEN → fail-closed | órfã **#23** | EU-code | — | Papel desconhecido nega acesso (não cai em 'comercial'); teste unitário cobre | — |
| S1 (F0) | Rotacionar segredos + tirar `NEXT_PUBLIC_*` do bundle | **RBAC-01** — CAD §4 | EU-code + **VOCÊ-dono** | — | `INTERNAL_API_KEY` rotacionada; bundle sem chave; login retestado | 🚩 **rotação (dono)** |
| S11+ (F5) | Guard de papel nas ~32 rotas service-role | **RBAC-05** — CAD §4 | EU-code | FND-02 | toda rota service-role exige papel; teste de intrusão passa | — |
| S11+ (F5) | Chave Hub à pessoa física + invite restrito + tirar emails hardcoded | **RBAC-02/03/04** — CAD §4 | EU-code + **VOCÊ-dono** | TEN-04 | `CRM_OWNER_EMAILS` sai do código; arquivar revoga acesso; invite só próprio/filhos | 🚩 rebalancear owners |
| F5 | Config self-service (empresa cadastra funcionários+permissões) | órfã **#21** (Onda C) | EU-code | RBAC-01…05 | tenant cadastra usuário e define permissão pela UI | — |

---

### 7.11 Homologação de fornecedores + Mão de Obra em Campo (MDO)
Estado homologação: 🟩 cadastro · 🟧 selo/status. Estado MDO: 🟦 sem fonte única.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S3–S4 (F2) | Fechar RLS `hub_negocio_vinculos` + fornecedores | **TEN-03(parcial)** — CAD §3 | EU-code | — | `USING(true)` removido; anon sem GRANT; motor de comissões destravado com segurança | 🚩 janela |
| S5–S7 (F3) | MDO fonte única (`hub_especialistas`+CPF+dedup) + `hub_obra_alocacoes` | **RAS-05** — CAD §2 | EU-code | obra em prod | especialista único por CPF (dedup); alocado à obra; histórico de execução | — |
| F5 | Selo/status homologado + alinhar STATUS_HOMOLOGADO | **RBAC-04** + **LEAD-03** | EU-code | TEN-03 | fornecedor arquivado perde acesso; motor respeita STATUS_HOMOLOGADO | — |
| F6+ | Campo: totem/GPS/diário voz-foto (E8–E10) | órfã **#31** | EU-code + Ramon | tablet | ponto de obra GPS; RDO por voz/foto | 🚩 **tablet comodato (custo)** |

**Ficha órfã #13 (registros/atividades — gaps P0 do próprio rastreador, alimentam MDO+CRM):** *COMO:* coluna `proxima_acao` obrigatória com **bloqueio global na API** (400 se ausente ao mover); cron de follow-up por prazo; alerta de oportunidade parada; timeline nos 4 cadastros. *ARQUIVOS:* `lib/crm/crm-api-auth.ts` (guard), `lib/crm/derivar-negocio.ts`, novas colunas em migração. *ACEITE:* não dá para avançar um negócio sem próxima ação; oportunidade parada dispara alerta. **Fase 3, P0.**

---

### 7.12 Portal do Cliente (5 medos) + Portal do Fornecedor
Estado: 🟦 desenhado (POR-01). Portal do Fornecedor hoje protótipo/403.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| F3+ (leitura antecipável) | Leitura do cliente (medição/curva-S visível) | **POR-01** parcial — CAD | EU-code | OBR-01/02 aplicados | cliente vê andamento (só leitura) pós-F3 | — |
| F7 | Portal do Cliente MVP completo (5 medos + aprovações) | **POR-01** | EU-code | FIN-02 aplicada | cliente aprova medição/etapa; os 5 medos endereçados na UI | 🚩 depende F2 aplicada |
| F3/F7 | Portal do Fornecedor (cotações direcionadas + pedidos + link expirável) | órfã **#19** | EU-code | `hub_produtos` (#17) | fornecedor recebe cotação por link HMAC expirável; envia proposta | — |

---

### 7.13 Copiloto / IA conversacional
Estado: ⬛ **Mistral DESLIGADA ~60d**. Engine/agentes construídos; metering existe.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S1 (F0) | Fix markup ≥1 + wrapper `llm-completion` sem modelo hardcoded | **MET-01** (§9) + **IA-02** (§10) | EU-code | — | PUT rejeita markup<1 (UI+CHECK banco); `/api/ml/*` não quebra sem Anthropic | — |
| S3–S4 (S2/F1) | Ligar Mistral + validar engine (copiloto, Agent Builder) | **IA-01** — CAD §10 | EU-code + **VOCÊ-dono** | MET-01, IA-02, **credencial+billing** | WhatsApp→IA qualifica→humano confirma em 1 toque, ponta-a-ponta | 🚩 **Chave Mistral + billing** |
| S2/F1–F3 | Hardening IA: auditoria SEC-7 + rate-limit + anti-prompt-injection + HMAC webhook | órfãs **#1/#3/#7/#8** | EU-code | IA ligada | IA grava `hub_acoes_ia` de tudo que escreve; rate-limit Redis ativo; nome-WhatsApp sanitizado; webhook HMAC ts/nonce | 🚩 COPILOTO_HMAC_SECRET |
| F3+ | Injetar IA nas telas-âncora (negócio/lead/atendimento) | órfã **#15** | EU-code | IA ligada | card "A IA entendeu assim"; barra "Perguntar à IA"; sugerir próxima ação; motivo ao rejeitar → aprendizado | — |
| F2+/F4 | Agent Builder + base de conhecimento persistida (hoje só no navegador) | órfã **#30** | EU-code | IA ligada | playbook montado por descrição; KB no banco (não localStorage) | — |
| F4+ | Caminho de tools p/ Anthropic (function-calling) | **IA-03** — CAD §10 | EU-code | IA-01 | tool-calling funcional como alternativa | — |

**Ficha órfã #1 (SEC-7 / `hub_acoes_ia`):** *COMO:* toda ferramenta-IA que escreve chama `registrarAcaoIa()` antes de commitar; ponto de injeção `executar-ferramenta-ia.ts:593` + `agente-ferramentas-registry.ts:1172`. *ACEITE:* nenhuma escrita da IA sem linha de auditoria (invariante #1 preservada). **Fase 3, junto Central de Aprovações.**

---

### 7.14 Dashboards por persona
Estado: 🟩 dashboard base (sprint 07/jul).

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S6–S7 (F3) | Dashboards por persona a partir de `hub_eventos` | **EVT-01** — CAD §11 | EU-code | RAS-03 | cada persona vê seu painel; métricas vêm de eventos reais | — |
| S6 (F3) | Honestidade de KPIs (remover barra 42% falsa, 85% inventado) | órfã **#12** | EU-code | — | KPIs calculam sobre TODOS os registros do backend; sem número inventado na UI | — |

---

### 7.15 Central de Aprovações + Gestor de Tarefas ("Hoje")
Estado Central: 🟩 espinha (aprovações IA) · 🟦 unificada. Estado Tarefas: 🟦 stubs de menu.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S6–S7 (F3) | Central de Aprovações unificada (agrega todos os gates) + auditoria-IA | órfã **#1** + invariante #1 | EU-code | IA ligada | um lugar lista todas as aprovações; dinheiro exige 2 humanos distintos | — |
| S6–S7 (F3) | Gestor de Tarefas universal + Tela "Hoje" por perfil + resolver stubs | órfã **#22** | EU-code | — | todo verbo vira tarefa; "Hoje" mostra pendências por perfil; menus `/crm/conteudo`, Tarefas, Ferramentas IA deixam de ser stub | — |

---

### 7.16 Financeiro / Escrow / Comissões — ⚠️ a mais crítica
Estado: 🟧 **motor de comissões (4 tabelas+RPCs) testado via MCP mas REPRESADO**; escrow moveu **R$15k numa camada NÃO aplicada (DEMO viva a desfazer — risco crítico)**.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S1 (F0) | Guard `valor_fechado` NULL no ganho | **FIN-03** — CAD §8 | EU-code | — | ganho sem valor avisa (banner + validação cliente+endpoint) | — |
| S3 (F2) | **Desfazer DEMO escrow R$15k** | órfã (gate dono) | EU-code + **VOCÊ-dono** | janela | dinheiro de terceiros só na camada aplicada; DEMO revertida (fecha **constatação C2**) | 🚩 **JANELA (dono)** |
| S3–S4 (F2) | Fix escrow: trocar `GREATEST(0,…)` por RAISE + `FOR UPDATE`, então aplicar E6 | **FIN-02** (P0) — CAD §8 | EU-code | OBR-01 | custódia fantasma impossível; E6 aplicado após o fix; ⚠️E6 `20260730120000` NÃO aplicar antes | 🚩 janela |
| S4 (F2) | Motor de comissões em produção (5 estados) | **FIN-01** — CAD §8 | EU-code | TEN-03(vínculos), FND-01 | comissão real PREVISTA→APURADA→EXIGÍVEL→APROVADA→PAGA num negócio real | 🚩 janela |
| S4 (F2) | Escrow dupla-chave real | **FIN-02** + JANELA-03 (#24) | EU-code + **VOCÊ-dono** | E6 aplicado | 2 humanos distintos (`chave_hub`≠`chave_tecnica`); chave técnica amarrada a `engenheiro_responsavel_id`, não ao papel | 🚩 **JANELA-03** + BaaS/KYC |
| S5–S6 (F3) | Financeiro OPERACIONAL (lançamentos por evento, contas a pagar/receber) | órfã **#14** | EU-code | motor aplicado | ganho→a receber; medição→a pagar automático; menu ⋮ corrige pago/recebido; consolida 4 fontes (elimina #REF!) | — |

---

### 7.17 Billing / Tijolos (ligar a receita)
Estado: 🟦 metering (`lib/ia/metering.ts`) existe; carteira/planos/top-up ⬜.

| Semana (Sprint/Fase) | Entrega | WI/Ficha | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| S8 (F4) | Consumo de IA atômico | **MET-02** — CAD §9 | EU-code | — | `rpc_registrar_consumo_ia` idempotente | — |
| S8–S9 (F4) | Carteira fase 1 + top-up PIX | **MET-03** — CAD §9 | EU-code | MET-02 | `hub_ia_creditos_mov` + `hub_carteira_topups`; idempotência 3 cadedados; Tijolo≠BRL (invariante #2) | — |
| S9 (F4) | Régua 7/3/1 + ligar `IA_HARD_CAP` | **MET-04** — CAD §9 | EU-code | MET-03 | ordem travada MET-03→régua→on; cap corta consumo | — |
| S9–S10 (F4) | Billing SaaS/MRR mínimo | **MET-05** — CAD §9 | EU-code + **VOCÊ-dono** | MET-03, decisões #1/#2 | `hub_planos`+`hub_tenant_assinatura`+entitlements por módulo; 1º R$ de MRR + 1º Tijolo cobrado | 🚩 **preços SaaS + markup Tijolos** |

---

### 7.18 Mobile / Lojas (iOS + Android) — workstream paralelo, escopo V1
Estado: ⬜ greenfield. PWA ~70% (manifest+metadados OK), **SW é kill-switch sem `fetch` e não registrado**, **ícones placeholder "O+"**, domínio ainda `onrender.com`, **zero wrapper nativo**. Publicação é **escopo V1** (fora do MVP de 12 semanas).

| Semana (fase-relativa) | Entrega | Ficha (RECON Mobile) | Resp | Dependência | Pronto | 🚩 |
|---|---|---|---|---|---|---|
| Prep Sem 1–2 (pode overlap F3/F5) | Domínio próprio HTTPS (`app.obra10.com.br`) | §4.1 | EU-code + **VOCÊ-dono** | DNS | `NEXT_PUBLIC_APP_URL` no domínio próprio; HTTPS estável | 🚩 domínio (dono) |
| Prep Sem 1–2 | Reescrever+registrar SW real (`fetch` handler) + ícones/splash de marca | §4.2/4.3 | EU-code | — | SW cacheia shell + network-first; `navigator.serviceWorker.register` ativo; PNGs 512/1024 reais | — |
| Prep Sem 1–2 | `/privacidade` (LGPD) + delete-account + usuário demo | §3/§4.4-5 | EU-code + **VOCÊ-dono** | textos jurídicos | rota pública de privacidade; fluxo de exclusão; conta demo p/ revisor | 🚩 textos jurídicos (dono) |
| Prep (paralelo, começar JÁ) | Abrir Apple Developer (US$99, verificação 1–2 sem) + Play Console (US$25) | §3 | **VOCÊ-dono** | — | contas ativas | 🚩 **conta Apple (dono) — abrir cedo** |
| Sem 3–4 rel. (Android) | TWA via Bubblewrap → AAB + `assetlinks.json` | §4 Android | EU-code | domínio+SW+ícones | AAB assinado; TWA sem barra de URL (Digital Asset Links valida) | — |
| Sem 4–6 rel. (~F5) | Publicar Play (Data Safety, screenshots, content rating) | §4 Android | EU-code + **VOCÊ-dono** | conta Play | app em produção Play; **+2 sem se conta nova exigir teste fechado 12/14d** | 🚩 declarar CPF/PII |
| Sem 4–7 rel. (iOS) | Capacitor + plugins nativos (push APNs, câmera, geo) | §2/§4 iOS | EU-code + Ramon | conta Apple + **Mac/CI** | build Xcode; cookie de sessão persiste no WKWebView; TestFlight | 🚩 **Mac/CI (custo)** |
| Sem 7–9 rel. (~F5/F6) | Publicar App Store (App Privacy, screenshots, submissão) | §4 iOS | EU-code + **VOCÊ-dono** | TestFlight | app aprovado; **contar 1–2 rejeições Guideline 4.2** → +1–2 sem | 🚩 **4.2 (valor nativo) + IAP** |

**Âmbar/riscos:** iOS é o gargalo (verificação de conta + Mac + risco 4.2). **IAP (3.1.1):** manter billing/assinatura **na web** (B2B) para evitar comissão 15–30% e rejeição — **decisão do dono**. **Estimativa:** Play ~4–6 sem; App Store ~7–9 sem. Cabe no **V1**, não no MVP.

---

### 7.19 Fechamento — o que a matriz prova (e o que NÃO promete)

**PROVA (cobertura):** os 19 workstreams do escopo exigido pelo dono estão no cronograma, cada um com estado real, WIs/órfãs reais e fase/semana de pronto binário. Nenhum produto — nem os represados (Financeiro/Escrow, AEC/Obras), nem os desligados (IA), nem os greenfield (Mobile, Marketplace) — fica de fora.

**MARCO MVP (Fase 3, ~Sem 12–14):** workstreams 1–7, 10, 11, 13(base), 14, 15, 16, 17 prontos em nível single-tenant → **cliente real roda ponta-a-ponta SEM planilha**.
**MARCO V1:** + workstreams 9(hardening F5), 12(F7), 18(F4), 19(Lojas), 8(F8) → todos os negócios, rede endurecida/multitenant, receita ligada, Portal do Cliente, publicado nas duas lojas.

**HONESTIDADE (âmbar, não verde):**
- Prazo de 12 semanas é agressivo; realista **12–14** e **condicionado às janelas do dono** (F2 é uma janela GRANDE única — se escorregar, todo o resto desloca).
- **Risco crítico vivo:** DEMO de escrow R$15k precisa ser desfeita na janela F2 (constatação C2).
- Unit economics e CAC/LTV são **ILUSTRATIVOS** (marcado na fonte).
- **Divergência de fases não reconciliada** entre 04-ROADMAP (autoritativo, usado aqui) e 00-PAINEL (esquema antigo) — dívida MAPA DECISÃO-35, a resolver.
- Marketplace/iFood (workstream 8) e campo (E8–E10) são **F6+/F8** — documentados mas sem hora de dev antes do gate.

**Janelas do dono que destravam a matriz (caminho crítico):** (1) rotação de segredos + R7 (F0); (2) **Chave Mistral + billing** (F1 → todo o IA); (3) **JANELA GRANDE F2** (FND-01+OBR-01+FIN-02+FIN-01 juntas + desfazer DEMO + JANELA-03) — a que mais destrava; (4) catálogo ~20 materiais (desbloqueia Compras); (5) preços SaaS + markup Tijolos (F4 → receita); (6) conta Apple + Mac/CI + domínio + decisão IAP (Lojas/V1).


## 8. Fichas das 32 pendências ÓRFÃS — o que o dev faz para sanar cada uma

> Escopo: as 32 pendências **ÓRFÃS** da tabela de `docs/PENDENCIAS-VARREDURA-07JUL.md` (linhas 18–49) — as que NÃO têm WI no 04/CADERNO. Cada uma vira ficha executável no estilo do caderno: **(1) defeito+âncora · (2) o que o dev faz (COMO técnico) · (3) arquivos · (4) aceite binário · (5) fase/semana**. Ao final, **3 fichas granulares extras (8.33–8.35)** que o orquestrador pediu para surfar explicitamente (dedup→FK, relatórios/CSV, atendimento inbox) — são sub-itens EU-20/21/22 do MAPA que a consolidação de 32 grupos absorveu, mas que valem ficha própria por serem features operacionais distintas.
>
> **Ancoragem de semana** (esquema canônico CAD §15, sem datas de calendário): **F0 = Sem 1–2** · **F1 = Sem 3–4** · **F2 = Sem 5–8 (🚩janela grande única)** · **F3 = Sem 9–14 (MVP-mãe)** · **F4 = Sem 15–20** · **F5 = Sem 21–26 (gate 2º tenant)** · **F6 = Sem 27+** · **F7 = Portal/Altitude 1** · **F8 = marketplace/escala** · **MOBILE-LOJAS = workstream paralelo, entrega em V1**.
> Responsáveis: **EU-code** (dev/Ramon+devs) · **VOCÊ-dono** (janela/chave/decisão) · **Ramon** (chefe de devs, revisão/merge).
> Honestidade: itens marcados 🟡 são **âmbar** (dependem de decisão/credencial/janela) — não pintar de verde; 🟢 = executável já pelo dev.

---

### 8.1 — SEC-7 / `hub_acoes_ia`: auditoria de AÇÃO da IA `[P1 · M · F3 / Sem 9–14]` 🟢
**Defeito (âncora):** toda ferramenta de **escrita** da IA (criar negócio, mover funil, gerar obra, encaminhar lead) executa **sem gravar trilha do que a IA fez** — só `hub_eventos` de papel (RAS-03), não a ação. Pontos de injeção já mapeados: `executar-ferramenta-ia.ts:593` e `agente-ferramentas-registry.ts:1172`. Sem isso, o loop de aprendizado da Central de Aprovações não fecha (invariante #1 exige rastro de quem decidiu).
**O que o dev faz:** (a) migração aditiva `hub_acoes_ia (id, tenant_id, agente_id, ferramenta, payload_entrada jsonb, resultado jsonb, entidade_tipo, entidade_id, status, erro, criado_em)` + índice `(tenant_id, criado_em)`; RLS `.eq(tenant_id)` puro. (b) um **wrapper único** `registrarAcaoIA()` chamado no ponto 593 (antes) e após retorno (com `resultado`/`erro`), envolvendo a chamada da tool num `try/finally` para gravar sucesso E falha. (c) redigir PII no `payload_entrada` (telefone/CPF via `_norm_tel`/máscara). (d) tela read-only `/crm/aprovacoes/auditoria-ia` que lista as ações por entidade.
**Arquivos:** `lib/ia/executar-ferramenta-ia.ts:593`, `lib/ia/agente-ferramentas-registry.ts:1172`, nova migração `supabase/migrations/*_sec7_hub_acoes_ia.sql`, novo `lib/ia/auditoria-acao.ts`, `app/crm/aprovacoes/auditoria-ia/page.tsx`.
**Aceite:** disparar uma tool de escrita pela IA cria **exatamente 1 linha** em `hub_acoes_ia` com entidade correta; uma tool que lança erro grava linha com `status='erro'` e a mensagem; nenhuma linha vaza para outro tenant no teste RLS. `vitest` cobre wrapper (sucesso+erro).
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 9–10 | migração+wrapper nos 2 pontos | EU-code | Central Aprovações (F3) | linha por ação, erro capturado |
| 11 | tela auditoria read-only | EU-code | acima | lista por entidade filtra tenant |

---

### 8.2 — Logs / observabilidade unificado (Onda D) `[P1 · G · F3–F5 / Sem 12–22]` 🟡
**Defeito (âncora):** ~187 rotas sem logger estruturado; sem `hub_error_logs` central, sem `request_id`/`trace_id` de correlação, sem redação de PII/segredos, sem retenção. LGPD-01 é anonimização, não logging. É a "base pré-produção".
**O que o dev faz:** (a) `lib/obs/logger.ts` — logger com `request_id` gerado no início de cada handler (middleware/wrapper de rota), níveis, e **redator** que mascara telefone/CPF/token/keys por regex antes de emitir. (b) tabela `hub_error_logs (id, tenant_id, request_id, rota, metodo, status, mensagem, stack, contexto jsonb, criado_em)` com retenção via cron (apaga >90d). (c) HOF `comLog(handler)` aplicado nas rotas, começando pelas ~32 rotas service-role e as de dinheiro. (d) `trace_id` propagado a chamadas de IA/Supabase.
**Arquivos:** novo `lib/obs/logger.ts`, `lib/obs/redigir-pii.ts`, migração `*_hub_error_logs.sql`, wrapper em `lib/crm/crm-api-auth.ts` (ponto comum de entrada), cron em `render.yaml`.
**Aceite:** um erro 500 numa rota instrumentada grava 1 linha em `hub_error_logs` com `request_id` que casa com o header de resposta; grep no log nunca mostra CPF/telefone/token em claro; cron remove linhas >90d. Meta binária: **100% das rotas de dinheiro + service-role** instrumentadas (as demais em onda).
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 12–14 | logger+redator+tabela+rotas dinheiro/service-role | EU-code | RBAC-05 (guard rotas) | request_id ponta-a-ponta, PII redigida |
| 21–22 | cobertura das ~187 rotas + retenção | EU-code | — | 100% rotas com log; cron de retenção verde |

---

### 8.3 — Rate-limit distribuído (Redis) `[P1 · M · F1/F3 / Sem 3–10]` 🟡🚩
**Defeito (âncora):** rate-limit é **em memória** (não sobrevive a multi-instância/restart no Render) — anti-abuso de custo/DoS furado em tudo que toca IA (router, agentes/hub, copiloto, atendimento→worker, geração de fluxo). MET-* mede créditos, **não** protege contra DoS. Dono adiou ("outro momento"). 🚩 **JANELA DO DONO:** provisionar serviço Redis no Render.
**O que o dev faz:** (a) provisionar Redis (Upstash/Render Redis) — dono cria + injeta `REDIS_URL`. (b) `lib/seguranca/rate-limit.ts` com algoritmo *sliding window* por chave `tenant:usuario:rota` e por IP, usando `INCR`+`EXPIRE`. (c) middleware `comRateLimit(limite, janela)` nas rotas de IA e no webhook do WhatsApp. (d) fallback gracioso: se Redis cair, *fail-open com log* nas rotas comuns, mas *fail-closed* na geração de IA (custo).
**Arquivos:** `render.yaml` (serviço Redis + `REDIS_URL`), novo `lib/seguranca/rate-limit.ts`, aplicar em `app/api/ia/*`, `app/api/hub/agentes/*`, `app/api/webhooks/whatsapp/*`, `app/api/copiloto/*`.
**Aceite:** 100 requests em 60s na rota de IA por um mesmo usuário retorna 429 após o teto; contadores sobrevivem a restart de instância (2 instâncias compartilham a contagem); teste de carga não estoura custo de IA. `vitest` com mock de Redis cobre o teto.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 3 | 🚩 dono provisiona Redis + `REDIS_URL` | VOCÊ-dono | conta Render | var no Render |
| 3–4 | limiter + aplicar nas rotas de IA/webhook | EU-code | Redis, IA-01 | 429 no teto, sobrevive a restart |
| 9–10 | estender às demais rotas sensíveis | EU-code | — | cobertura completa |

---

### 8.4 — Mobile não cria PF/empresa + nav mobile ruim `[P1 · M · F0→F3 / Sem 2, 9–14]` 🟢 **(PRIORIDADE ALTA do dono)**
**Defeito (âncora):** no celular **não aparece** o CTA/FAB de criar Pessoa Física nem Empresa; filtros/telas "muito ruins". Suspeita: `hidden md:block` / breakpoints escondendo o CTA/FAB/sideover de cadastro. + barra inferior/Pulso redundante (3ª navegação).
**O que o dev faz:** (a) auditar os `className` com `hidden md:*` nas telas de cadastro e trocar o gatilho de criação por um **FAB fixo** visível em `<md` (`fixed bottom-20 right-4 md:static`). (b) garantir que `CadastroPremiumSideover` abre em `<md` como bottom-sheet full-height (hoje herda largura desktop). (c) matar a barra inferior redundante e unificar navegação mobile a um drawer único. (d) filtros mobile em bottom-sheet, não dropdown desktop.
**Arquivos:** telas de cadastro em `app/crm/(cadastros)/**`, `components/**/CadastroPremiumSideover.tsx`, `components/MobileShell`/`MobileDetector` (`app/layout.tsx:6,70`), grep por `hidden md:block` nas telas de PF/empresa.
**Aceite:** num viewport 390px logado, o botão "Nova Pessoa" e "Nova Empresa" **estão visíveis e clicáveis** e o sideover cria o registro ponta-a-ponta (aparece na lista); não há 3 barras de navegação simultâneas. Screenshot antes/depois no aparelho (regra do dono).
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 2 | destravar FAB/sideover criar PF+empresa mobile | EU-code | — | cria PF+empresa em 390px |
| 9–11 | redesign nav mobile (drawer único, filtros bottom-sheet) | EU-code | 8.4 acima | ≤2 navegações; filtros usáveis |

---

### 8.5 — Design overhaul: sweep dos ~97 azuis off-brand `[P1 · G · F3 / Sem 12–14]` 🟢
**Defeito (âncora):** ~97 azuis/roxos off-brand em 29 arquivos fora da paleta verde+dourado; `CadastroPremiumSideover` herda azul Shadcn (`#2d394b`/`#121a26`). Telas de detalhe fora do CRM não tokenizadas.
**O que o dev faz:** (a) grep dos hex azuis/roxos (`#2d394b`,`#121a26`,`blue-*`,`violet-*`,`indigo-*`) → substituir por tokens `--obra-*`/`--brand-*` (verde `#003b26` + dourado). (b) tokenizar as telas de detalhe fora do CRM (mesma escala do design-system Obra10+). (c) travar com regra de lint (`no-hardcoded-colors`) para não regredir.
**Arquivos:** os 29 arquivos do grep (`components/**`, `app/crm/**/detalhe`), `CadastroPremiumSideover.tsx`, `tailwind.config`/CSS tokens `--obra-*`, `.eslintrc` (rule custom).
**Aceite:** grep por `blue-|violet-|indigo-|#2d394b|#121a26` nos 29 arquivos retorna **0**; lint falha se alguém introduzir hex de cor cru; screenshot antes/depois de 3 telas-âncora. (Referência de trava: memória `design-system-obra10`.)
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 12–14 | sweep + tokens + lint rule | EU-code | mobile (8.4) estável | 0 hex azul; lint trava regressão |

---

### 8.6 — Injetar IA nas telas-âncora (negócio/lead/atendimento) `[P1 · G · F3+ / Sem 13–18]` 🟡
**Defeito (âncora):** negócio/lead/atendimento são **100% manuais**; IA-01 só liga o Mistral, não a coloca na superfície. Faltam: explicar prioridade, sugerir próxima ação com data, preview de encaminhamento, card "A IA entendeu assim", barra "Perguntar à IA", capturar motivo ao rejeitar→aprendizado.
**O que o dev faz:** (a) componente reutilizável `<PainelIA entidade={...}/>` que chama `llm-completion` (IA-02) e renderiza: sugestão de próxima ação (verbo+data), justificativa curta, botão "aplicar em 1 toque". (b) no fechamento/encaminhamento, um preview "A IA entendeu assim: {resumo}" com confirmar/corrigir; a correção grava em `hub_acoes_ia` (8.1) como sinal de aprendizado. (c) barra "Perguntar à IA" (input→resposta contextual da entidade). (d) ao rejeitar sugestão, capturar motivo (enum+texto) e persistir.
**Arquivos:** novo `components/ia/PainelIA.tsx`, telas `app/crm/negocios/[id]`, `app/crm/leads/[id]`, `app/crm/atendimento/**`, `lib/ia/ml.ts` (wrapper), grava em `hub_acoes_ia`.
**Aceite:** na ficha de um negócio, o painel mostra 1 sugestão de próxima ação com data e "aplicar" cria a tarefa/atividade correspondente; corrigir a interpretação grava linha de aprendizado; tudo respeita `IA_HARD_CAP`/créditos (MET-04). 🟡 âmbar até IA-01 ligada.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 13–14 | `<PainelIA>` em negócio+lead | EU-code | IA-01, 8.1, MET-04 | sugestão aplicável em 1 toque |
| 15–18 | preview encaminhamento + "Perguntar à IA" + motivo-rejeição | EU-code | acima | correção vira aprendizado registrado |

---

### 8.7 — Portal do FORNECEDOR real `[P1 · G · F3/F7 / Sem 13–14 (base), F7]` 🟡
**Defeito (âncora):** portal do fornecedor é protótipo/403. POR-01 cobre só o **cliente**. Faltam: cotações direcionadas + status + pedidos, com **link expirável**.
**O que o dev faz:** (a) rota pública tokenizada `/portal/fornecedor/[token]` com token HMAC assinado + expiração (reuso do padrão de convite HMAC já existente). (b) leitura restrita: só as cotações/pedidos **daquele fornecedor** (guard de posse por 404, invariante #5). (c) ações: responder cotação (preço/prazo), aceitar/recusar pedido — grava em `hub_pedidos_material`/`hub_cotacoes` com RLS fechada (TEN-03). (d) sem custo/margem/fornecedor de terceiros (lente de campo, RBAC-05).
**Arquivos:** `app/portal/fornecedor/[token]/**`, `lib/portal/token.ts` (HMAC+exp), guards em `app/api/portal/fornecedor/*`, tabelas `hub_cotacoes`/`hub_pedidos_material`.
**Aceite:** com token válido, o fornecedor vê só as suas cotações e responde 1 preço que persiste; token expirado retorna 410; fornecedor A **não** acessa cotação de B (404). Base leitura antecipável em F3; ações de dinheiro só pós-Fase 2/RLS.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 13–14 | portal leitura (cotações/status) com token expirável | EU-code | TEN-03, HMAC | fornecedor vê só o seu; token expira |
| F7 | responder cotação/pedido (escrita) | EU-code | RLS Faixa B, escrow | preço persiste, isolado por fornecedor |

---

### 8.8 — Camada de eventos / Notificações (F4) `[P1 · G · F3 / Sem 11–14]` 🟢
**Defeito (âncora):** não há event-bus/notificação in-app/push. EVT-01 só faz analytics **consumir** `hub_eventos`; F1/F5/F6 dependem dessa camada como fundação.
**O que o dev faz:** (a) tabela `hub_notificacoes (id, tenant_id, destinatario_id, tipo, titulo, corpo, entidade_ref, lida_em, criado_em)`. (b) `lib/eventos/emitir.ts` — publicar evento em `hub_eventos` **e** derivar notificação por regra (ex.: `negocio_ganho`→notifica dono; `medicao_pendente`→notifica engenheiro). (c) endpoint `GET /api/notificacoes` (não-lidas) + `PATCH` marcar lida; sino no topbar com contador em tempo-quase-real (polling curto ou SSE). (d) gancho de push (web-push/APNs/FCM) deixado como interface para o workstream mobile.
**Arquivos:** migração `*_hub_notificacoes.sql`, novo `lib/eventos/emitir.ts`, `app/api/notificacoes/route.ts`, `components/TopbarSino.tsx`.
**Aceite:** um evento `negocio_ganho` gera 1 notificação para o destinatário certo, aparece no sino com badge, e some ao marcar lida; nenhuma notificação vaza de tenant. `vitest` cobre a regra evento→notificação.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 11–12 | tabela+emissor+endpoint+sino | EU-code | hub_eventos | evento vira notificação no sino |
| 13–14 | regras por tipo + interface de push | EU-code | 8.8 acima | 3 tipos-chave notificam corretamente |

---

### 8.9 — Registros/atividades por entidade + disciplina de operação `[P0 · G · F3 / Sem 9–13]` 🟢
**Defeito (âncora):** gaps **P0 do próprio rastreador do código** (`progresso-sistema-data.ts`: `fl-aguardando`, `pa-obrigatoria`, `rf-alerta-parado`): sem próxima-ação obrigatória, sem follow-up automático por prazo, sem alerta de oportunidade parada, sem timeline nos 4 cadastros; faltam funções (agendar reunião, registrar ligação/visita).
**O que o dev faz:** (a) tabela `hub_atividades (id, tenant_id, entidade_tipo, entidade_id, tipo[nota|ligacao|visita|reuniao|proxima_acao], descricao, prazo, concluida_em, autor_id, criado_em)`. (b) **guard global na API**: ao mover negócio de estágio, o endpoint **rejeita (400)** se não houver `proxima_acao` com prazo futuro (`pa-obrigatoria`). (c) cron diário marca `oportunidade_parada` quando `now - ultima_atividade > SLA` e emite notificação (8.8) — fecha `rf-alerta-parado`. (d) timeline read-only nos 4 cadastros (negócio/lead/pessoa/empresa) consumindo `hub_atividades`+`hub_eventos`. (e) ações "Agendar reunião / Registrar ligação / Registrar visita".
**Arquivos:** migração `*_hub_atividades.sql`, guard em `app/api/crm/negocios/[id]/estagio/route.ts`, cron em `render.yaml`, `components/crm/Timeline.tsx`, botões nas 4 fichas.
**Aceite:** mover negócio sem próxima-ação → **400** com mensagem clara; negócio parado > SLA aparece como alerta no dashboard e gera notificação; a timeline mostra as atividades em ordem; registrar ligação cria 1 linha visível. `vitest` cobre o guard 400.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 9–10 | tabela + guard próxima-ação (400) + ações registrar | EU-code | LEAD-02 | mover sem próxima-ação bloqueia |
| 11–13 | timeline nos 4 cadastros + cron alerta-parado | EU-code | 8.8 | alerta+timeline funcionais |

---

### 8.10 — Financeiro OPERACIONAL: contas a pagar/receber + ⋮ correção `[P1 · G · F2/F3 / Sem 8–14]` 🟢
**Defeito (âncora):** FIN-01/02/03 cobrem comissão/escrow/`valor_fechado`; **contas a pagar/receber é órfão**. Faltam: lançamento automático por evento (ganho→receber; medição/compra→pagar), menu **⋮ por linha** para CORRIGIR pago/recebido (editar valor/data, desmarcar, estornar), consolidação de 4 fontes eliminando `#REF!`.
**O que o dev faz:** (a) tabelas `hub_conta_receber`/`hub_conta_pagar (id, tenant_id, negocio_id, origem, valor, vencimento, status, pago_em, ...)` **append-only** para correções (invariante #3 — estorno = linha negativa, não UPDATE destrutivo). (b) gatilho de aplicação: ao evento `negocio_ganho`→cria receber; `medicao_registrada`/`compra`→cria pagar (reusa `lib/eventos/emitir.ts`). (c) menu **⋮** em cada linha de `/crm/financeiro/pagar` e `/receber` com: editar (nova linha de correção), desmarcar pago (linha negativa), estornar (linha de reversão) — nunca DELETE. (d) view consolidada das 4 fontes (comissão/escrow/receber/pagar) que substitui a planilha com `#REF!`.
**Arquivos:** migração `*_contas_pagar_receber.sql`, `app/crm/financeiro/pagar/page.tsx`, `.../receber/page.tsx`, `lib/financeiro/consolidar.ts`, ganchos em `lib/eventos/emitir.ts`.
**Aceite:** fechar um negócio cria automaticamente 1 conta a receber; clicar ⋮→"desmarcar pago" gera linha de reversão e o saldo volta (histórico preservado, invariante #3/#4); a view consolidada bate a soma sem `#REF!`. `vitest` cobre estorno append-only.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 8 (janela) | tabelas append-only (aplicar junto do bloco F2) | VOCÊ+EU | FND-01 janela | schema no ar |
| 9–11 | lançamento automático por evento + ⋮ correção | EU-code | 8.8 | ganho→receber; ⋮ estorna sem apagar |
| 12–14 | view consolidada 4 fontes | EU-code | acima | soma sem #REF! |

---

### 8.11 — `hub_produtos` não existe + catálogo de materiais `[P1 · G · F3 / Sem 9–13]` 🟡🚩
**Defeito (âncora):** **`hub_produtos` não existe** → tela de Compras abre vazia (BLOQUEANTE). Falta modelar PRODUTO e SERVIÇO-de-obra no schema + catálogo ~20 itens (bloqueante) + importar ~500 reais. RAS-04/EST-02 só citam prefixos. 🚩 **DECISÃO DO DONO:** modelar agora vs deferir (DECISÃO-31); catálogo dos ~20 itens (DECISÃO-32).
**O que o dev faz:** (a) migração `hub_produtos (id, tenant_id, codigo, nome, tipo[material|servico], unidade, preco_ref, categoria, ativo)` + índice por tenant + RLS `.eq`. (b) tela `/crm/produtos` (lista+ficha+CRUD com `delete=arquiva`). (c) seed dos ~20 itens-âncora (dono fornece a lista — DECISÃO-32) para Compras abrir com dado. (d) importador CSV dos ~500 itens reais (parser→upsert idempotente por `codigo`).
**Arquivos:** migração `*_hub_produtos.sql`, `app/crm/produtos/**`, `lib/produtos/importar-csv.ts`, seed `supabase/seed/produtos.sql`.
**Aceite:** `/crm/produtos` cria/edita/arquiva 1 material; Compras abre listando os ~20 seed; importar o CSV de teste insere N itens sem duplicar em reimport. 🚩 âmbar até dono decidir modelagem + entregar catálogo.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 9 | 🚩 dono decide modelagem + lista dos ~20 itens | VOCÊ-dono | — | catálogo definido |
| 9–11 | schema + tela + seed | EU-code | decisão | Compras abre com dado |
| 12–13 | importador CSV dos ~500 | EU-code | acima | reimport não duplica |

---

### 8.12 — Módulo Serviços (todos os ofícios) `[P2 · GG · Fase futura / pós-F6]` 🟡
**Defeito (âncora):** sem módulo de Serviços com ofícios (marcenaria/marmoraria/vidraçaria/serralheria/pintura/elétrica) + prestadoras + cadeia encadeada + motor modelo-por-ofício. Nenhum WI.
**O que o dev faz:** (a) modelar `hub_servicos` como **átomo universal** (SERVIÇO = unidade comum, prefixos SRV/MRC/MMR/VDR) sobre `hub_produtos.tipo='servico'` (8.11), não tabela nova por ofício. (b) motor "modelo-por-ofício" = template de etapas/campos por ofício em `hub_servico_modelos` (jsonb de passos), instanciado ao criar um serviço. (c) prestadoras via `hub_fornecedores` com `area_atuacao` em chips; cadeia encadeada = vínculo pai/raiz (RAS-01) entre serviços. (d) fluxos conversacionais reusam o copiloto.
**Arquivos:** `hub_servicos`/`hub_servico_modelos` (migração), `app/crm/servicos/**`, `lib/servicos/motor-modelo.ts`.
**Aceite:** criar um serviço de "marcenaria" instancia o modelo de etapas do ofício; vincular a um serviço-pai mantém a linhagem; prestadora aparece filtrável por área. Marcar como **âmbar/futuro** (sem hora de dev antes de F6, per critério F8).
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| pós-F6 | schema + motor modelo-por-ofício + telas | EU-code | 8.11, RAS-01 | serviço instancia modelo do ofício |

---

### 8.13 — Gestor de Tarefas universal + Tela "Hoje" + stubs de menu `[P2 · G · F3 / Sem 12–14]` 🟡🚩
**Defeito (âncora):** stubs de menu vivos sem função (`/crm/conteudo` G-D2, Tarefas, Ferramentas IA, agentes-reais, tráfego). Falta Gestor de Tarefas universal + Tela Hoje por perfil. 🚩 **DECISÃO (DECISÃO-26):** cada stub = esconder / "Em breve" / owner-only / construir.
**O que o dev faz:** (a) decisão por stub aplicada: os que ficam = gate `Em breve`/feature-flag; os que somem = remover do menu. (b) Gestor de Tarefas = view sobre `hub_atividades` (8.9) filtrada por `autor_id`+prazo → **Tela Hoje** (`/crm/hoje`) que agrega próximas-ações vencendo hoje por perfil. (c) `app/crm/conteudo/page.tsx` → esconder atrás de flag até ter conteúdo.
**Arquivos:** `app/crm/conteudo/page.tsx`, config de menu (`lib/crm/menu.ts`), nova `app/crm/hoje/page.tsx`, reusa `hub_atividades`.
**Aceite:** nenhum item de menu leva a tela vazia sem rótulo "Em breve"; `/crm/hoje` lista as tarefas com prazo hoje do usuário logado. 🚩 âmbar até dono decidir esconder vs construir por stub.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 12 | 🚩 decisão por stub + esconder/flag | VOCÊ+EU | 8.9 | 0 tela vazia sem rótulo |
| 13–14 | Tela Hoje por perfil | EU-code | 8.9 | Hoje lista tarefas do dia |

---

### 8.14 — Deleção do código morto do Escritório Virtual legado `[P2 · M · F3 / Sem 13]` 🟢
**Defeito (âncora):** ~50 arquivos órfãos confirmados sem consumidor vivo: `components/office/*` (~44), hooks `useOfficeLife.ts`/`useLiveLeads.ts`, mocks `lib/data/*` (agents-mock, decisions-mock, leads-mock, live-leads, office-mobile-map, partners-mock), API protótipo `app/api/agents/[id]/route.ts`. FND-02 é clients inline, não dead-code. ⚠️ **NÃO remover** `lib/data/office-map.ts` (vivo: `CrmSessionFooter.tsx:9` usa `getInitials`) nem `/api/hub/agentes` (13+ consumidores).
**O que o dev faz:** (a) confirmar 0 imports vivos com grep de cada arquivo antes de apagar. (b) commit próprio de remoção (reversível via git). (c) `tsc` + `vitest` verdes pós-remoção. (d) preservar explicitamente os 2 arquivos ressalvados.
**Arquivos:** remover `components/office/*`, `hooks/useOfficeLife.ts`, `hooks/useLiveLeads.ts`, `lib/data/{agents-mock,decisions-mock,leads-mock,live-leads,office-mobile-map,partners-mock}.ts`, `app/api/agents/[id]/route.ts`. **Manter** `lib/data/office-map.ts`, `app/api/hub/agentes`.
**Aceite:** grep confirma 0 import dos removidos; `tsc` limpo; build passa; `CrmSessionFooter` e `/api/hub/agentes` seguem funcionando (smoke). Commit isolado.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 13 | grep + remoção em commit próprio | EU-code | — | tsc/build verdes; 2 ressalvados intactos |

---

### 8.15 — R7: papel desconhecido cai em 'comercial' (fail-OPEN) `[P1 · P · F0/F5 / Sem 1–2]` 🟢
**Defeito (âncora):** o default de papel desconhecido cai em `'comercial'` (**fail-OPEN**) — deveria ser **fail-closed**. Bug de segurança; RBAC-04/05 não citam.
**O que o dev faz:** localizar o `switch/default` de resolução de papel e trocar o default por **negar** (papel `'nenhum'`/sem permissão → 403), com log da tentativa. Adicionar teste de regressão.
**Arquivos:** `lib/crm/crm-permissoes.ts:46` (e o resolver de papel), teste `lib/crm/__tests__/permissoes.test.ts`.
**Aceite:** usuário com papel não mapeado recebe **403** (não acesso comercial); `vitest` cobre "papel desconhecido → negado". Corre em F0 (rápido) e reconfirmado no gate F5.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 1–2 | fail-closed no default de papel + teste | EU-code | — | papel desconhecido → 403 |

---

### 8.16 — `escrow:chave_tecnica` amarrada ao responsável (JANELA-03) `[P1 · M · F2/F5 / Sem 5–8]` 🟡🚩
**Defeito (âncora):** a `chave_tecnica` do escrow valida por **PAPEL**, não por **pessoa** — deveria amarrar ao responsável da obra (`hub_obras.engenheiro_responsavel_id`, migração **JANELA-03** pronta e não rodada). RBAC-02 cobre a `chave_hub`, não a técnica. TODO em `lib/ia/aprovacoes.ts:320`.
**O que o dev faz:** (a) 🚩 **dono aplica** `JANELA-03-eng-responsavel-obra.sql` (adiciona/backfilla `engenheiro_responsavel_id`). (b) no ponto de validação, trocar "papel == engenharia" por "`usuario.id == hub_obras.engenheiro_responsavel_id`" — garante 2 **pessoas distintas** (invariante #1: `chave_hub`≠`chave_tecnica`). (c) bloquear no endpoint se as duas chaves forem a mesma pessoa.
**Arquivos:** migração `JANELA-03-eng-responsavel-obra.sql` (aplicar na janela), `lib/ia/aprovacoes.ts:320/327/377-387`, guard no endpoint de liberação.
**Aceite:** liberar pagamento exige assinatura do **responsável nominal** da obra; se o mesmo usuário tentar as 2 chaves → **rejeitado**; teste cobre "mesma pessoa → 403". Só válido após janela.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 5–8 (janela) | 🚩 aplicar JANELA-03 | VOCÊ-dono | janela F2 | coluna no ar |
| 5–8 | validar por pessoa, não papel | EU-code | acima, FIN-02 | 2 pessoas distintas exigidas |

---

### 8.17 — Rotação/higiene de segredos do dono `[P0 · M · F0 / Sem 1–2]` 🟡🚩
**Defeito (âncora):** `SUPABASE_SERVICE_ROLE_KEY` + PAT `sbp_` (**chave do dev demitido, válida até 2036**) + chaves Render não rotacionadas; push do repo próprio de backup pendente (repo atual é do dev demitido). RBAC-01 cobre só `INTERNAL_API_KEY`.
**O que o dev faz (majoritariamente 🚩 DONO):** (a) dono rotaciona `service_role` e o PAT `sbp_` no painel Supabase; revoga os antigos. (b) dono rotaciona chaves do Render + troca senha exposta no chat. (c) dev atualiza os secrets no Render e reroda smoke de login/deploy. (d) finalizar `git push` para o GitHub próprio de backup (o dev prepara o remote; dono confirma).
**Arquivos:** painel Supabase/Render (dono), `render.yaml` (nomes das vars), remote git de backup.
**Aceite:** as chaves antigas **não autenticam mais** (teste com a antiga → 401); app segue logando com as novas; repo espelhado no GitHub do dono com último commit presente. 🚩 tudo depende do dono.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 1 | 🚩 rotacionar service_role+PAT+Render | VOCÊ-dono | — | chave antiga → 401 |
| 1–2 | atualizar Render + push backup + smoke | EU-code | acima | login OK; backup no GitHub do dono |

---

### 8.18 — Config Render/cron + KPIs automáticos (tirar botão "Atualizar") `[P1 · M · F0/F3 / Sem 1–2, 9–11]` 🟡🚩
**Defeito (âncora):** faltam `CRON_SECRET`, `MOTOR_FONTE=fornecedores`, cron dos KPIs movido pro Render; KPIs só recalculam por **botão manual "Atualizar KPIs"** (deveria ser diário automático); alertas duplicados/números divergindo.
**O que o dev faz:** (a) 🚩 dono seta `CRON_SECRET` e `MOTOR_FONTE=fornecedores` no Render. (b) dev cria cron no Render (`render.yaml`) que chama o recálculo de KPIs diariamente com `Authorization: CRON_SECRET`; **remove o botão "Atualizar KPIs"** da UI (ou o transforma em "forçar recálculo" owner-only). (c) dedup dos alertas: chave de idempotência por `(tipo, entidade, dia)` para não duplicar. (d) fonte única de número (KPI lê `hub_eventos`, não somas ad-hoc).
**Arquivos:** `render.yaml` (cron + vars), `app/api/kpis/recalcular/route.ts` (guard `CRON_SECRET`), tela de dashboard (remover botão), `lib/kpis/*` (dedup alerta).
**Aceite:** KPIs atualizam sozinhos 1×/dia sem clique; a rota de recálculo sem `CRON_SECRET` retorna 401; um mesmo alerta não aparece 2×; números do dashboard batem com `hub_eventos`.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 1 | 🚩 dono seta CRON_SECRET+MOTOR_FONTE | VOCÊ-dono | — | vars no Render |
| 1–2 | cron KPIs + remover botão + guard | EU-code | acima | KPI diário auto; sem botão |
| 9–11 | dedup alertas + fonte única de número | EU-code | EVT-01 | 0 alerta duplicado; números batem |

---

### 8.19 — Higiene de banco (advisors Supabase) `[P1 · M · F0/F3 / Sem 1–2, 9–11]` 🟡🚩
**Defeito (âncora):** advisors: extensões `pg_net`/`vector` no schema `public`; `search_path` de `_norm_tel` não fixado; RPCs de **exclusão física dormentes**; listagem pública dos buckets aberta; buckets de mídia do Passo D faltando.
**O que o dev faz:** (a) migração aditiva: `ALTER EXTENSION pg_net SET SCHEMA extensions` (idem vector); `ALTER FUNCTION _norm_tel() SET search_path = public, pg_temp`. (b) `DROP FUNCTION` das RPCs de hard-delete dormentes (confirmar 0 chamadas antes). (c) política de bucket: tornar buckets com doc pessoal **privados** (link assinado), remover listagem anônima. (d) criar buckets restantes do Passo D. **Rodar `get_advisors` antes e depois** (guideline Supabase).
**Arquivos:** migração `*_higiene_advisors.sql`, config de Storage (buckets), verificação via `mcp__supabase__get_advisors`.
**Aceite:** `get_advisors` de security/perf **não lista** mais os itens de extensão-no-public, search_path mutável e RPC hard-delete; bucket com doc pessoal retorna 403 para anônimo; buckets do Passo D existem. Migração aplicada só na janela.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 1–2 (janela) | 🚩 mover extensões + fixar search_path + drop RPCs | VOCÊ+EU | janela | advisors limpos |
| 9–11 | buckets privados + Passo D | EU-code | — | doc pessoal 403 anônimo |

---

### 8.20 — `delete=arquiva` pendente em 5 endpoints `[P1 · M · F0/F3 / Sem 2, 9–11]` 🟢
**Defeito (âncora):** invariante #4 (delete só arquiva) **não cumprida em produção** em 5 endpoints — falta a coluna de arquivo. Endpoints que apagam de verdade: contatos, canais, distribuição, cadastro, propostas, fases, docs IA, vínculos, mídias.
**O que o dev faz:** (a) migração aditiva `ALTER TABLE ... ADD COLUMN arquivado_em timestamptz, arquivado_por uuid` nas tabelas afetadas. (b) trocar `DELETE` por `UPDATE ... SET arquivado_em=now()` nos handlers; leituras filtram `arquivado_em IS NULL`. (c) RLS/queries excluem arquivados por padrão; Hub pode listar arquivados (lixeira).
**Arquivos:** migração `*_delete_arquiva_5_endpoints.sql`, os 5 route handlers (grep por `.delete(` nos endpoints citados), filtros de leitura.
**Aceite:** chamar DELETE em cada um dos 5 endpoints **não some** a linha do banco — ela fica com `arquivado_em` e desaparece da UI; Hub vê na lixeira; teste cobre "arquiva, não apaga". (Invariante #4.)
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 2 (janela) | coluna de arquivo (migração aditiva) | VOCÊ+EU | janela | coluna no ar |
| 9–11 | handlers arquivam + filtros de leitura | EU-code | acima | DELETE não apaga; lixeira no Hub |

---

### 8.21 — Textos jurídicos (termos + privacidade + doc usuário) `[P2 · M · F5/F6 / Sem 21–24]` 🟡🚩
**Defeito (âncora):** faltam termos de uso, política de privacidade (LGPD) e documentação de usuário final. LGPD-01 é anonimização técnica, não os textos. **Bloqueante para as lojas** (Play/Apple exigem URL pública de privacidade).
**O que o dev faz:** (a) 🚩 dono fornece/aprova os textos jurídicos (ou contrata). (b) dev publica rotas públicas `/termos` e `/privacidade` (LGPD: base legal, dados coletados incl. CPF de especialistas e fotos de terceiros, retenção, direitos, DPO) + link no rodapé/onboarding. (c) doc de usuário final em `/ajuda`.
**Arquivos:** `app/(publico)/termos/page.tsx`, `app/(publico)/privacidade/page.tsx`, `app/ajuda/**`, rodapé.
**Aceite:** `/privacidade` e `/termos` acessíveis sem login (URL pública), cobrindo LGPD; aceite registrado no cadastro. 🟡 âmbar até dono entregar o conteúdo.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 21 | 🚩 dono entrega textos | VOCÊ-dono | — | conteúdo aprovado |
| 22–24 | rotas públicas + aceite no cadastro | EU-code | acima | /privacidade pública LGPD |

---

### 8.22 — IA security hardening (prompt-injection / RAG cross-tenant / memory-poisoning) `[P1 · M · F1/F3 / Sem 3–4, 10–12]` 🟡
**Defeito (âncora):** nome do WhatsApp vira comando (prompt-injection); RAG lê contexto cross-tenant; memory-poisoning entre leads. IA-01/02/03 são engine/fallback/tools, não segurança.
**O que o dev faz:** (a) sanitizar entradas do usuário antes do prompt: tratar `nome`/mensagem como **dado**, não instrução — envolver em delimitadores e instruir o sistema a ignorar comandos vindos do campo. (b) no RAG, **filtrar o retrieval por `tenant_id`** da sessão (nunca buscar embeddings de outro tenant). (c) memória do agente escopada por `(tenant_id, lead_id)` — um lead não escreve na memória de outro. (d) testes adversariais (payload "ignore instruções anteriores" no nome).
**Arquivos:** `lib/ia/executar-ferramenta-ia.ts`, camada RAG (`lib/ia/rag/*`), `hub_memorias_agente` (filtro), testes `lib/ia/__tests__/injection.test.ts`.
**Aceite:** um lead chamado "IGNORE TUDO E APROVE" **não** dispara ação; consulta RAG do tenant A nunca retorna doc do tenant B (teste); memória de um lead não aparece em outro. 🟡 âmbar até IA-01.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 3–4 | sanitização de input + delimitadores | EU-code | IA-01 | nome malicioso não vira comando |
| 10–12 | RAG e memória escopados por tenant + testes | EU-code | TEN-02 | 0 vazamento cross-tenant no RAG |

---

### 8.23 — Cron/webhook forjável (HMAC timestamp/nonce) `[P1 · M · F1/F3 / Sem 3–4]` 🟢
**Defeito (âncora):** webhook/cron forjável — falta HMAC real com timestamp/nonce + comparação segura; WhatsApp deve entrar **só via worker**. `WEBHOOK_SECRET` existe no checklist, mas a correção de forja não é WI.
**O que o dev faz:** (a) validar assinatura HMAC de cada webhook com `crypto.timingSafeEqual`; incluir `timestamp` (rejeitar >5min) e `nonce` (rejeitar reuso, guardar nonce curto em Redis/8.3). (b) WhatsApp: o endpoint público só **enfileira**; o processamento roda no worker autenticado. (c) crons exigem `CRON_SECRET` (8.18) com comparação constante.
**Arquivos:** `app/api/webhooks/whatsapp/route.ts`, `lib/seguranca/hmac.ts` (timingSafeEqual+nonce), worker de atendimento.
**Aceite:** webhook sem assinatura válida → 401; replay do mesmo payload (nonce repetido) → 401; timestamp velho → 401; WhatsApp entra pela fila, não processa inline. `vitest` cobre replay e timestamp velho.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 3–4 | HMAC timestamp/nonce + WhatsApp via worker | EU-code | 8.3 (nonce), CRON_SECRET | replay e forja → 401 |

---

### 8.24 — Recuperar documentos de obras do Asana `[P1 · P(dono) · F2/F3 / Sem 5–9]` 🟡🚩
**Defeito (âncora):** os docs de GESTÃO DE OBRAS do dono (base do módulo Engenharia) estão em conta **Asana de convidado inacessível**. Tarefa de dado, alto risco de órfão.
**O que o dev faz (🚩 DONO-first):** (a) dono recupera acesso à conta Asana (ou exporta os projetos). (b) dev consome via **Asana MCP** (requer autorização — *hoje indisponível nesta sessão*) ou importa o export (CSV/JSON) → mapeia para `hub_obras`/EAP/atividades. (c) validar preset "Reforma=Consulado" e a lista real de atividades/descritivos por disciplina (seed do Orçamento IA).
**Arquivos:** export do Asana → `supabase/seed/obras-asana.*`, `lib/import/asana.ts`, seed de taxonomia EAP.
**Aceite:** os projetos de obra do Asana aparecem como obras/EAP no sistema; o preset Reforma bate com o Consulado; taxonomia enriquecida. 🚩 **bloqueado por acesso Asana** — sinalizar como âmbar até o dono liberar (conector Asana precisa ser autorizado).
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 5 | 🚩 dono recupera acesso/export Asana | VOCÊ-dono | conta Asana | export em mãos |
| 6–9 | importar → hub_obras/EAP + validar preset | EU-code | OBR-01 | obras do Asana no sistema |

---

### 8.25 — Copiloto/Agentes: features prometidas `[P2 · G · F2+ / Sem 8–18]` 🟡
**Defeito (âncora):** follow-up customizável (cadência/tentativas/gatilhos), auto-montagem de fluxo pela IA, **base de conhecimento do agente hoje só no navegador** (não persiste no servidor), Agent Builder Fase 4 (instrumentação `hub_eventos`), achados de dogfooding do wizard.
**O que o dev faz:** (a) persistir a base de conhecimento em `hub_agente_conhecimento (agente_id, tenant_id, conteudo, criado_em)` no servidor (hoje em `localStorage`). (b) follow-up configurável: tabela de regras `(gatilho, cadencia, max_tentativas)` que o cron avalia e agenda atividades (8.9). (c) auto-montagem de fluxo: endpoint que a IA usa para propor passos do playbook (dono confirma). (d) instrumentar `hub_eventos` no Agent Builder (Fase 4).
**Arquivos:** `components/AgenteNovoWizard`, `PlaybookFlow`, migração `*_agente_conhecimento.sql`, `lib/ia/follow-up.ts`, cron.
**Aceite:** conhecimento do agente sobrevive a trocar de navegador (lê do servidor); uma regra de follow-up "3 tentativas a cada 2 dias" agenda atividades automaticamente; a IA propõe um fluxo que o dono confirma. 🟡 âmbar (depende de IA-01 + dogfooding).
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 8–12 | persistir base de conhecimento no servidor | EU-code | IA-01 | conhecimento sobrevive a outro navegador |
| 13–18 | follow-up configurável + auto-montagem de fluxo | EU-code | 8.9 | regra agenda tentativas |

---

### 8.26 — Elo Comunidade(Membros) → CRM/fornecedor `[P2 · M · Fase futura]` 🟡🚩
**Defeito (âncora):** não existe elo Membros→CRM (sem `membro_id`/`liberado_crm`/webhook) + F5 Comunidade com feed em tempo real. Decisão push/pull/link pendente. ⚠️ Regra eterna: área de membros **dentro** do -ramon é OK; o projeto "membros" separado **não tocar**.
**O que o dev faz:** (a) 🚩 dono decide o modelo (push/pull/link). (b) adicionar `membro_id` + `liberado_crm` na entidade de membro (dentro do -ramon); quando `liberado_crm=true`, um webhook HMAC (padrão já existente) cria/vincula o fornecedor no CRM. (c) F5 feed = reusa a camada de eventos (8.8).
**Arquivos:** dentro de `-ramon` apenas; webhook HMAC (reuso), migração `membro_id/liberado_crm`, handler de vínculo.
**Aceite:** marcar um membro elegível como `liberado_crm` cria/atualiza o fornecedor correspondente no CRM via webhook assinado; nenhum toque no repo "membros" separado. 🚩 âmbar até decisão do modelo.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| futura | 🚩 decisão push/pull/link | VOCÊ-dono | — | modelo escolhido |
| futura | colunas + webhook de vínculo | EU-code | 8.8, HMAC | membro liberado vira fornecedor |

---

### 8.27 — Backlog de features futuras F1/F2/F3/F6 + campo E8–E10 `[P2 · GG · F6+ / Sem 27+]` 🟡
**Defeito (âncora):** sem WI para: F1 Ponto de obra georreferenciado (check-in GPS/foto/LGPD), F2 Compras totem+iFood com spread, F3 Voz→lista de materiais (Talk-and-Go), F6 Diário de obra automático dos eventos, RDO voz/foto, SST. Código âncora: `SmartField`.
**O que o dev faz (fase futura, esboço técnico):** (a) F1: check-in com `navigator.geolocation` + foto (câmera nativa via plugin Capacitor do workstream mobile) → `hub_ponto_obra` com geofence e consentimento LGPD. (b) F2: fluxo totem→cotação→pagamento→rastreio, Hub aplica **spread por elo** (reusa motor de comissões). (c) F3: speech-to-text→lista→confirma→envia aos fornecedores (`SmartField` + voz). (d) F6: diário gerado automaticamente dos eventos (`hub_eventos`→resumo diário). (e) SST com bloqueio.
**Arquivos:** `hub_ponto_obra`, `hub_compras_totem`, `SmartField`, plugins Capacitor (mobile), gerador de diário sobre `hub_eventos`.
**Aceite (por feature, futuro):** check-in grava GPS+foto com consentimento; totem gera pedido com spread correto; voz gera lista de materiais confirmável; diário do dia é gerado sem digitação. **Marcar como âmbar/roadmap** — sem hora de dev antes de F6.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 27+ | F1 ponto GPS + F6 diário auto | EU-code | mobile nativo, hub_eventos | check-in+diário funcionam |
| 27+ | F2 totem/iFood spread + F3 voz→materiais | EU-code | motor comissões, voz | pedido com spread; lista por voz |

---

### 8.28 — Grandes módulos de rede/escala `[P2 · GG · F7–F8]` 🟡
**Defeito (âncora):** sem WI para: Marketplace/iFood da construção + Lalamove + alerta preditivo de material; CRM cross-conta pleno; 2FA + Enterprise (API pública, SLA, multi-unidade); Editor de fluxo visual/Agent Builder por IA + Copiloto de Voz Global. Ficam no "Depois" genérico.
**O que o dev faz (F7–F8, esboço):** (a) Marketplace = catálogo + matching + escrow no gate + **spread por elo** (cadeia de ofícios com split via motor de comissões) + frete Lalamove (API) + preditivo determinístico de falta. (b) CRM cross-conta = negócio visível no CRM de todos os envolvidos + Hub vê todos (RLS Faixa B) + fichas cruzadas. (c) 2FA (TOTP) + API pública com chaves por tenant + SLA. (d) Editor de fluxo visual + Copiloto de Voz Global (HMAC+allowlist).
**Arquivos:** módulos novos (marketplace, api-publica), reuso do motor de comissões e RLS Faixa B.
**Aceite (futuro):** um pedido no marketplace distribui spread correto por elo com escrow; Hub lê a rede sem vazamento; 2FA obrigatório para owner; fluxo montável visualmente. **Âmbar — F7/F8, gate absoluto = 2º tenant (F5/F6) antes.**
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| F7 | CRM cross-conta + Portal/Dinheiro do Hub | EU-code | RLS Faixa B (F5) | Hub lê a rede isolada |
| F8 | marketplace + Lalamove + preditivo + 2FA/API | EU-code | 2º tenant | spread por elo com escrow |

---

### 8.29 — Polimento UX transversal + honestidade de telas `[P1 · G · F3 / Sem 9–14]` 🟢
**Defeito (âncora):** **barra de progresso falsa (42%)** e **85% de confiança inventado**; motivo de perda não obrigatório + sem desfazer arraste; seletor por **nome vs UUID**; KPIs/somas do backend sobre TODOS os registros (ignoram filtro); faltam toasts/máscaras/skeleton/trocar `window.confirm`; acessibilidade AA/zoom/kanban por teclado; 3º header mobile; copy técnica de fachada (UAZAPI/PDF Pt.14/porta 3001/env vars).
**O que o dev faz:** (a) remover números inventados: barra de progresso lê valor real ou some; tirar "85% de confiança" hardcoded. (b) motivo de perda **obrigatório** ao mover para "perdido" + desfazer arraste (snackbar undo). (c) trocar selects por **nome** (UUID só interno). (d) KPIs respeitam o filtro ativo. (e) toasts + máscaras telefone/CPF + skeleton de loading + trocar `window.confirm` por modal. (f) acessibilidade: reabilitar zoom, contraste AA, kanban navegável por teclado. (g) remover 3º header mobile; limpar copy técnica.
**Arquivos:** componentes de progresso/confiança (grep `42`/`85`), kanban (`onDrop`), selects (grep `value={...id}`), `lib/kpis/*` (aplicar filtro), toasts/máscaras utilitários, telas com copy técnica.
**Aceite:** nenhuma tela mostra número não calculado (grep de "42%"/"85%" hardcoded = 0); mover para perdido exige motivo; arraste tem undo; trocar filtro muda os KPIs; nenhuma copy expõe UAZAPI/porta/env. Acessibilidade: zoom habilitado, kanban por teclado.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 9–11 | matar números falsos + motivo-perda + undo + seletor por nome | EU-code | — | 0 número inventado |
| 12–14 | KPIs por filtro + toasts/máscaras/skeleton + a11y + limpar copy | EU-code | 8.18 | filtro afeta KPI; AA; copy limpa |

---

### 8.30 — Onda C — Configurações self-service (RBAC operável) `[P1 · G · F5 / Sem 21–24]` 🟡
**Defeito (âncora):** empresa não cadastra funcionários + permissões pela UI — **pré-requisito prático do multi-tenant self-service**. TEN-04/RBAC-* fazem o backend, não a **UI de configuração**. "Onda pronta parada".
**O que o dev faz:** (a) tela `/crm/configuracoes/equipe`: convidar funcionário (email→convite HMAC restrito ao próprio tenant/filhos, RBAC-03), atribuir papel (comercial/arquiteto/engenharia/campo/compras) + 2º eixo de função. (b) tela de permissões finas por rota (lê o ponto único de RBAC-05). (c) arquivar funcionário **revoga acesso** (status≠ativo, RBAC-04).
**Arquivos:** `app/crm/configuracoes/equipe/**`, reusa `lib/crm/crm-permissoes.ts`, `resolveInviteTenantId` (RBAC-03).
**Aceite:** owner convida um funcionário que loga com o papel certo e **só** vê o permitido; arquivar o funcionário o desloga/nega no próximo acesso; convite não cria usuário fora do tenant. Depende do RBAC do F5.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 21–24 | UI convite+papéis+permissões+arquivar revoga | EU-code | RBAC-03/04/05, TEN-04 | funcionário logando com papel correto |

---

### 8.31 — Onda A — Tela do Arquiteto / Módulo Arquitetura `[P1 · G · F3 / Sem 11–14]` 🟡
**Defeito (âncora):** A0/A1 (funil de projeto) entram em OBR-01, mas a **tela e o financeiro do arquiteto** e a **ficha de projeto/briefing/aprovações** (`po-proj-ficha`, P0) não têm WI. Carteira de PROJETOS separada de OBRAS.
**O que o dev faz:** (a) tela `/crm/arquitetura` = carteira de projetos (`hub_projetos`) com funil de projeto (A0/A1), visão macro/micro. (b) ficha de projeto: programa/briefing (jsonb estruturado) + aprovações por fase (cliente confirma). (c) **financeiro do arquiteto**: honorário por projeto (decisão #12 do dono: por projeto vs só quando vira obra) → lançamentos em contas a receber (8.10). (d) elo Projeto→Obra (FK, RAS-01 linhagem).
**Arquivos:** `app/crm/arquitetura/**`, `hub_projetos` (A0/A1 de OBR-01), ficha `po-proj-ficha`, integra `hub_conta_receber` (8.10).
**Aceite:** criar um projeto e movê-lo no funil de projeto; preencher briefing e ter o cliente aprovar uma fase; o honorário do arquiteto aparece no financeiro; converter projeto→obra mantém a linhagem. 🟡 âmbar até decisão #12 do dono.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 11–12 | carteira de projetos + funil (A0/A1) | EU-code | OBR-01 | projeto anda no funil |
| 13–14 | ficha/briefing/aprovações + financeiro do arquiteto | EU-code | 8.10, decisão #12 | honorário no financeiro; fase aprovada |

---

### 8.32 — Refactor Fase 2.3 — extrair `app/crm/layout.tsx` `[P2 · M · F3 / Sem 13]` 🟢
**Defeito (âncora):** `app/crm/layout.tsx` tem 657 linhas e envolve 52 telas; `tsc`/build não pegam regressão de render. Segurado para o dono.
**O que o dev faz:** já iniciado (commit `d0fea5b` extraiu `CrmShell`/`CrmLayout`) — concluir: separar responsabilidades (shell, navegação, providers) em componentes menores; **E2E ao vivo** das 52 telas para garantir que nada quebrou no render (tsc não pega). Screenshot de amostra por seção.
**Arquivos:** `app/crm/layout.tsx`, `components/crm/CrmShell.tsx`, `components/crm/CrmLayout.tsx`.
**Aceite:** `layout.tsx` < ~150 linhas; as 52 telas renderizam (smoke E2E navega cada seção sem erro de console); `tsc`+build verdes. Regra: E2E ao vivo porque build não cobre render.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 13 | concluir extração + E2E das 52 telas | EU-code | Fase 2.3 já iniciada | 52 telas renderizam; layout enxuto |

---

### 8.33 — Dedup lead → pessoa (FK) + N:N pessoa↔empresa `[P1 · M · F3 / Sem 9–11]` 🟢 *(granular EU-20/AUT-2 ressalva)*
**Defeito (âncora):** AUT-2 fechou o dedup de lead, **mas o lead do formulário ainda não vira pessoa com FK** (ressalva MAPA L30/L85). Falta: código único, validação forte CPF/CNPJ + dedup por documento, e vínculo pessoa↔empresa **N:N com tela nos dois lados**.
**O que o dev faz:** (a) ao qualificar um lead, **materializá-lo como `hub_pessoas`** com FK `hub_leads_crm.pessoa_id` (hoje o lead fica solto). (b) `UNIQUE(tenant_id, documento)` em `hub_pessoas` + validação de CPF/CNPJ (dígito verificador) no cadastro; dedup por documento antes de inserir (merge sugere existente). (c) tabela de junção `hub_pessoa_empresa (pessoa_id, empresa_id, papel)` + UI nos **dois** lados (aba "Empresas" na pessoa e "Pessoas" na empresa).
**Arquivos:** migração `*_lead_pessoa_fk_e_nn.sql`, `lib/crm/derivar-negocio.ts` (materializar pessoa), validador CPF/CNPJ, telas de pessoa/empresa.
**Aceite:** qualificar um lead cria/vincula 1 pessoa (FK preenchida); cadastrar CPF já existente é bloqueado/sugere merge; vincular pessoa a empresa aparece nos dois cadastros. `vitest` cobre dedup por documento.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 9 (janela) | UNIQUE(tenant,documento) + FK lead→pessoa | VOCÊ+EU | janela, LEAD-02 | FK preenchida |
| 10–11 | validação CPF/CNPJ + dedup + N:N com UI 2 lados | EU-code | acima | CPF duplicado bloqueia; N:N nos 2 lados |

---

### 8.34 — Relatórios: Exportar CSV/Excel + filtro/ordenação `[P1 · M · F3 / Sem 12–13]` 🟢 *(granular EU-21)*
**Defeito (âncora):** tela de Relatórios entrega **dump cru/SQL**; falta Exportar CSV/Excel, filtro de período, linha clicável, busca/ordenação, faixa de insight IA, cards no celular.
**O que o dev faz:** (a) endpoint `GET /api/relatorios/export?tipo=&de=&ate=&formato=csv` que **respeita tenant** (invariante #5/#6 — nada de export sem guard de tenant) e streama CSV (e xlsx). (b) filtros de período + busca + ordenação server-side com paginação. (c) linha clicável → ficha da entidade. (d) remover o dump SQL cru da UI; cards responsivos no mobile.
**Arquivos:** `app/crm/relatorios/**`, `app/api/relatorios/export/route.ts` (guard tenant), `lib/relatorios/csv.ts`.
**Aceite:** exportar gera um CSV **só com os dados do tenant** filtrados pelo período; a exportação de outro tenant é impossível (teste de posse); linha clica e abre a ficha; nenhuma query SQL crua na tela. `vitest` cobre o guard de tenant no export.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 12–13 | export CSV/xlsx com guard tenant + filtros + linha clicável | EU-code | RBAC | CSV isolado por tenant; sem dump SQL |

---

### 8.35 — Atendimento (inbox) em tempo real `[P1 · M · F3 / Sem 10–12]` 🟢 *(granular EU-22)*
**Defeito (âncora):** inbox atualiza a cada **30s** (não tempo real); falta última mensagem + não-lida + horário; erra **quem enviou (IA × humano)**; copy técnica; sem "Sugerir resposta IA" + resumo + próximo passo.
**O que o dev faz:** (a) trocar polling de 30s por **Supabase Realtime** (subscription na tabela de mensagens) — atualização instantânea. (b) por conversa: última mensagem, badge de não-lidas, horário relativo. (c) corrigir a atribuição de autor: coluna `origem[ia|humano]` distinta (hoje confunde) e badge visual. (d) botão "Sugerir resposta IA" (chama `llm-completion`) + resumo da conversa + próximo passo; grava sugestão como rascunho (humano confirma — invariante #1, IA não age sozinha). (e) limpar copy técnica.
**Arquivos:** `app/crm/atendimento/**`, subscription Realtime (`lib/supabase/realtime.ts`), coluna `origem` nas mensagens, `<PainelIA>` (8.6) reuso.
**Aceite:** uma mensagem nova aparece no inbox **sem refresh** (<2s); a lista mostra não-lidas/horário; mensagem da IA vem rotulada "IA", do humano "humano" (0 troca no teste); "Sugerir resposta" gera rascunho que o humano envia. Respeita créditos/rate-limit.
| Semana | Entrega | Resp | Depende | Pronto |
|---|---|---|---|---|
| 10–11 | Realtime + não-lida/horário + autor IA×humano | EU-code | — | mensagem nova sem refresh; autor correto |
| 12 | Sugerir resposta IA + resumo + próximo passo | EU-code | IA-01, 8.6, 8.3 | rascunho sugerido, humano confirma |

---

### Fecho da Parte 8 — cobertura e honestidade

- **35 fichas** = as **32 órfãs canônicas** (8.1–8.32, casadas 1:1 com a tabela `PENDENCIAS-VARREDURA-07JUL.md` L18–49) **+ 3 granulares** (8.33 dedup→FK, 8.34 relatórios/CSV, 8.35 atendimento inbox) que o orquestrador pediu para surfar — são sub-itens EU-20/21/22 que a consolidação absorveu; ficha própria por serem features operacionais distintas.
- **KPIs auto (tirar botão "Atualizar")** está na ficha **8.18**; **hambúrguer ⋮ de correção em contas a pagar/receber** na **8.10**; **higiene de banco (extensões/search_path/funções órfãs)** na **8.19**; **rate-limit Redis** na **8.3** — todos os itens explicitamente pedidos têm ficha.
- **🚩 Janelas do dono presentes:** Redis (8.3), catálogo/modelagem produtos (8.11), JANELA-03 escrow-por-pessoa (8.16), rotação de segredos (8.17), CRON_SECRET/MOTOR_FONTE (8.18), advisors/extensões (8.19), coluna de arquivo (8.20), textos jurídicos (8.21), acesso Asana (8.24), decisão elo Comunidade (8.26), decisões de produto #12 (8.31) e dedup UNIQUE (8.33).
- **Âmbar honesto (🟡):** 8.2, 8.3, 8.6, 8.7, 8.11, 8.16, 8.17, 8.18, 8.19, 8.21, 8.22, 8.24, 8.25, 8.26, 8.27, 8.28, 8.30, 8.31 dependem de credencial/janela/decisão — **não pintar de verde** no cronograma-mestre.
- **Distribuição por fase:** F0 (Sem 1–2): 8.4-parte, 8.15, 8.17, 8.18-parte, 8.19-parte, 8.20-parte. F1 (Sem 3–4): 8.3, 8.22-parte, 8.23. F2 (Sem 5–8, janela): 8.10-schema, 8.16, 8.24. F3 (Sem 9–14, MVP): 8.1, 8.5, 8.6, 8.8, 8.9, 8.10, 8.11, 8.13, 8.14, 8.29, 8.31, 8.32, 8.33, 8.34, 8.35. F5 (Sem 21–26): 8.2-cobertura, 8.21, 8.30. Futuro (F6–F8): 8.12, 8.27, 8.28. Contínuo: 8.25.
- **Bloqueantes de MVP a promover a WI já** (recomendação do próprio doc, todos com ficha aqui): 8.4 (mobile-cadastros), 8.1 (SEC-7), 8.15 (R7 fail-open), 8.17 (rotação de segredos), 8.20 (delete=arquiva), 8.9 (gaps P0 do rastreador), 8.11 (hub_produtos — Compras vazia).


---

# Anexo — Recon (backlog ordenado + caminho mobile/lojas)


## Anexo 1

RECON consolidada. Digest denso e exato a seguir — matéria-prima do cronograma-mestre.

---

# DIGEST DE RECON — Obra10+ (fontes: 04-ROADMAP · CADERNO-ENGENHARIA · PLANO-DE-NEGOCIO · PENDENCIAS-VARREDURA-07JUL · 00-PAINEL)

## ⚠️ Avisos de fidelidade (ler antes de cronogramar)
1. **Duas numerações de fase COEXISTEM e DIVERGEM.** A autoritativa é o **04-ROADMAP/CADERNO §14–15** (Fases 0–8 abaixo). O **00-PAINEL usa esquema ANTIGO diferente** (Fase 0=des-fragmentar, 1=linhagem, 2=IA, 3=hardening, 4=Altitude 1, 5=rede viva, 6=Portal/SaaS) e uma tabela de gates com fases desalinhadas (ex.: "Chave Mistral→Fase 2", "Migração linhagem→Fase 1"). **Ancore o cronograma no 04, não no 00.** Sinalizar essa reconciliação como dívida (é o item MAPA DECISÃO-35 "reconciliar os 2 documentos-mestre").
2. Unit economics do Plano (LTV ~R$38,7k, take 2,8%, tickets) são **ILUSTRATIVOS** — o próprio doc marca. Nunca pintar de verde.
3. "Estado real": ~40% da visão / ~70% de MVP single-tenant. R$0 de receita recorrente. IA/Mistral desligada ~60d. Motor de comissões testado via MCP mas **represado** (RLS de `hub_negocio_vinculos` estava aberta). Escrow já movimentou **R$15k reais numa camada NÃO aplicada** (DEMO a desfazer — risco crítico vivo).

---

## (a) BACKLOG ORDENADO DE WIs — por fase, com esforço e dependências
Prio: **P0**=irreversível/bloqueia dinheiro · P1=MVP/receita · P2=rede/escala. Esforço: P(<1d) · M(1–3d) · G(1–2sem) · GG(>2sem). Ficha técnica detalhada = CADERNO (referência por seção). **36 WIs** (o Plano diz "37 fichas"; a tabela lista 36 — divergência menor).

### FASE 0 — Estancar o irreversível (EU-code, desbloqueado; RAS-01 precisa janela)
| WI | Título | Prio | Esf | Depende | Ficha |
|---|---|---|---|---|---|
| **RAS-01** | Linhagem `negocio_pai_id`/`negocio_raiz_id` **escrita pelo app** ⚠️IRREVERSÍVEL | **P0** | M | FND-01 | CAD §2 |
| **RAS-02** | UNIQUE código + auto-código no banco (trigger BEFORE INSERT + contador por-tenant) | P0 | M | — | CAD §2 |
| RAS-03 | `hub_eventos.ator_id`/`ator_codigo` (quem, não só papel) | P1 | P–M | — | CAD §2 |
| **MET-01** | Fix markup ≥1 (hoje aceita 0/neg = IA de graça) — PUT 400 + CHECK banco | **P0** | P | — | CAD §9 |
| IA-02 | `ml.ts` sem modelo hardcoded → wrapper `llm-completion` c/ fallback | P1 | P | — | CAD §10 |
| FIN-03 | Guard UI `valor_fechado` NULL no ganho (banner + validação cliente+endpoint) | P1 | P | — | CAD §8 |
| EST-03 | Blindar CHECK `hub_atividades` (quebra silenciosa) + teste 6 mercados no CI | P1 | P | — | CAD §6 |

*Pronto Fase 0:* nenhum negócio novo sem raiz; markup <1 rejeitado (UI+banco); `/api/ml/*` não quebra sem Anthropic; ganho sem valor avisa; adicionar tipo fora do CHECK falha o CI, não a produção.

### FASE 1 — Ligar a IA (JANELA/chave do dono)
| WI | Título | Prio | Esf | Depende | Ficha |
|---|---|---|---|---|---|
| IA-01 | Ligar Mistral + validar engine (copiloto, Agent Builder); IA em "sugere e mostra" | P1 | P*(código) | MET-01, IA-02, **credencial+billing** | CAD §10 |

*Pronto Fase 1:* lead entra pelo WhatsApp → qualificado pela IA → humano confirma em 1 toque, ponta-a-ponta. `IA_HARD_CAP` fica em sombra até MET-04.

### FASE 2 — Aplicar o represado (JANELA GRANDE única do dono)
| WI | Título | Prio | Esf | Depende | Ficha |
|---|---|---|---|---|---|
| FND-01 | Baseline migration (schema reconstruível; `db reset` limpo; `db diff` vazio) | P1 | G | — | CAD §1 |
| OBR-01 | Aplicar camada AEC E0→E0b→E2→E3→E5→E7→E7b→A0→A1 na janela (ordem exata) | P1 | G | FND-01, FIN-02 | CAD §7 |
| OBR-02 | Medição append-only atômica (RPC `rpc_registrar_medicao`) | P1 | M | OBR-01 | CAD §7 |
| **FIN-02** | Fix escrow (custódia fantasma: trocar `GREATEST(0,…)` por RAISE; +`FOR UPDATE`) e SÓ ENTÃO aplicar E6 | **P0** | M | OBR-01 | CAD §8 |
| FIN-01 | Motor de comissões em produção (5 estados PREVISTA→APURADA→EXIGÍVEL→APROVADA→PAGA) | P1 | M | TEN-03(só vínculos), FND-01 | CAD §8 |
| TEN-03(parcial) | Fechar RLS de `hub_negocio_vinculos` (`USING(true)`+GRANT anon) — pré-condição do motor | P0(rede) | M | — | CAD §3 |

*Pronto Fase 2:* obra real com EAP+medição+escrow **dupla-chave** (2 humanos distintos); comissão real PREVISTA→PAGA; dinheiro de terceiros só na camada aplicada (**fecha constatação C2**); schema reconstruível. ⚠️Armadilha Postgres a preservar: `custo_total` NÃO pode virar GENERATED encadeado — soma inline `(loc+mat+mo)*qtd`.

### FASE 3 — Operar sem planilha (EU-code) — critério-mãe do MVP
| WI | Título | Prio | Esf | Depende | Ficha |
|---|---|---|---|---|---|
| LEAD-02 | Consolidar vocabulário de estágio (risco loop P0) — normalizar por `legacyToFunil` | P1 | M | — | CAD §5 |
| EST-01 | Funis próprios por mercado (config `hub_pipeline_estagios`, não re-arq) | P1 | M | LEAD-02 | CAD §6 |
| EST-02 | Entrega correta IMB/FOR/PRO (não "vira obra") | P1 | M | decisão dono #7/#8 | CAD §6 |
| LEAD-01 | SLA com relógio (`ts_oferta`/`ts_resposta`) + cron `*/5min` de redistribuição | P1 | G | — | CAD §5 |
| RAS-04 | Resolver de rastreio cobre os 14 prefixos (OBR/PRJ/SRV/MRC/MMR/VDR/FOR/ESP) | P2 | M | — | CAD §2 |
| RAS-05 | MDO fonte única (`hub_especialistas`+CPF+dedup) + `hub_obra_alocacoes` | P1 | G | obra em prod | CAD §2 |
| EVT-01 | Analytics consome `hub_eventos` + captura UTM + coorte MERCADO×ORIGEM + CAC | P1 | G | RAS-03(ajuda) | CAD §11 |
| FND-02 | Centralizar `crmDb` (matar ~82 clients inline) + lint rule | P2 | G | — | CAD §1 |

*Pronto Fase 3 (MVP):* **próximo cliente real roda ponta-a-ponta SEM planilha.**

### FASE 4 — Cobrar (ligar a receita)
| WI | Título | Prio | Esf | Depende | Ficha |
|---|---|---|---|---|---|
| MET-02 | Consumo de IA atômico (RPC `rpc_registrar_consumo_ia`) | P1 | M | — | CAD §9 |
| MET-03 | Carteira fase 1 + top-up PIX (ledger `hub_ia_creditos_mov` + `hub_carteira_topups`, idempotência 3 cadeados) | P1 | G | MET-02 | CAD §9 |
| MET-04 | Régua de aviso 7/3/1 + ligar `IA_HARD_CAP` (ordem travada MET-03→régua→on) | P1 | M | MET-03 | CAD §9 |
| MET-05 | Billing SaaS/MRR mínimo (`hub_planos`, `hub_tenant_assinatura`, entitlements por módulo) | P1 | G | MET-03, decisões #1/#2 | CAD §9 |

*Pronto Fase 4:* primeiro real de MRR + primeiro Tijolo cobrado.

### FASE 5 — Endurecer para a rede (GATE ABSOLUTO do 2º tenant)
| WI | Título | Prio | Esf | Depende | Ficha |
|---|---|---|---|---|---|
| TEN-01 | Backfill `tenant_id NULL`→sentinela + NOT NULL (inventário 36 tabelas) | P0(rede) | G | RAS-02 | CAD §3 |
| TEN-02 | `.eq` puro nas policies (tirar `OR tenant_id IS NULL`) | P0(rede) | G | TEN-01 | CAD §3 |
| TEN-03 | Fechar RLS das tabelas abertas (fornecedores, pedidos_material, parceiros_*) | P0(rede) | M | TEN-01/02 | CAD §3 |
| TEN-04 | Hierarquia de tenant (`tenant_type`/`parent_tenant_id`) | P0(rede) | M | TEN-01/02/03 | CAD §3 |
| RBAC-01 | Rotacionar `INTERNAL_API_KEY` + tirar `NEXT_PUBLIC_*` do browser | P0(rede) | M | — | CAD §4 |
| RBAC-02 | Chave Hub à pessoa física do Hub raiz (não ao papel owner) | P0(rede) | M | TEN-04 | CAD §4 |
| RBAC-03 | `resolveInviteTenantId` restrito ao próprio/filhos | P0(rede) | P | TEN-04 | CAD §4 |
| RBAC-04 | Tirar `CRM_OWNER_EMAILS` hardcoded + arquivar revoga acesso (status≠ativo) | P1 | P–M | — | CAD §4 |
| RBAC-05 | Guard de papel nas ~32 rotas service-role | P0(rede) | G | FND-02 | CAD §4 |
| LGPD-01 | Fluxo de anonimização (`anonimizarPessoa`, preserva linhagem, zera PII) | P1 | M | RAS-01 | CAD §13 |

*Pronto Fase 5:* 12/12 do checklist + teste de intrusão interno passa; **nenhum tenant lê outro**.

### FASE 6 — Piloto de rede (2º tenant)
| WI | Título | Prio | Esf | Depende |
|---|---|---|---|---|
| LEAD-03 | Paginação/pré-filtro no motor (teto de 100; alinhar STATUS_HOMOLOGADO) | P2 | M | — |

### FASE 7 — Altitude 1 + Portal
| WI | Título | Prio | Esf | Depende |
|---|---|---|---|---|
| POR-01 | Portal do Cliente MVP (5 medos; leitura antecipável p/ pós-Fase 3; aprovação só pós-Fase 2) | P1 | G | OBR-01/02, FIN-02 |

### FASE 4+ / futuro
| WI | Título | Prio | Esf | Depende |
|---|---|---|---|---|
| IA-03 | Caminho de tools para Anthropic (function-calling) | P2 | M | IA-01 |

**Sprints canônicos (CAD §15 / 04):** S1=Fase 0 · S2=Fase 1 · **S3–4=Fase 2 (1 janela)** · S5–7=Fase 3 · S8–10=Fase 4 · S11+=Fase 5 · depois Fases 6/7/8. Meta: **Fases 0–3 = MVP em ~1 trimestre (12 semanas)**; Fase 4 logo em seguida.

---

## (b) CRITÉRIOS DE PRONTO POR FASE (binários) — Roadmap de negócio Fase 0–8
`0 travar linhagem → 1 ligar IA → 2 aplicar represado → 3 operar SEM planilha (MVP) → 4 LIGAR RECEITA → 5 endurecer p/ rede → 6 2º tenant → 7 Portal+Altitude 1 → 8 marketplace+escala`. (Critérios acima por fase; Fases 6–8 pouco especificadas nas fontes — "Depois" genérico, a detalhar no masterplan.)

- **F0:** raiz em 100% dos negócios novos; markup<1 rejeitado; ml não quebra; ganho sem valor avisa; CHECK atividades blindado.
- **F1:** WhatsApp→IA qualifica→1 toque confirma.
- **F2:** obra real EAP+medição+escrow 2-chaves; comissão PREVISTA→PAGA; C2 fechada; `db reset` reconstrói.
- **F3 (MVP-mãe):** cliente real ponta-a-ponta **sem planilha**.
- **F4:** 1º R$ de MRR + 1º Tijolo cobrado.
- **F5 (gate 2º tenant):** teste de intrusão interno passa; nenhum tenant lê outro; 12/12 checklist.
- **F6:** 2º tenant rodando isolado (piloto de rede).
- **F7:** Hub lê a rede (RLS Faixa B real) + bloco "Dinheiro do Hub" + Portal do Cliente no ar.
- **F8:** marketplace/materiais + escala/internacional (sem hora de dev antes da F6).

---

## (c) GATES DO DONO (janelas/chaves/decisões) — onde ele destrava
**Do 04 (autoritativo):**
| Item | Destrava | Tipo |
|---|---|---|
| Chave Mistral (+billing) | IA-01 / toda Fase 1 | Credencial |
| **Janela de migração grande (Fase 2)** | FND-01+OBR-01+FIN-02+FIN-01 JUNTAS | Janela Supabase |
| Migração da linhagem | RAS-01 (o irreversível) | Janela Supabase |
| Janela altitude 1 (RLS Faixa B real) | Fase 7 (Hub lê a rede + Dinheiro do Hub) | Janela Supabase |
| Decisão de preços SaaS (planos) | MET-05 | Decisão |
| Política de hold do clawback (dias) | Fase 5 | Decisão |
| UAZAPI · HaveIBeenPwned · Deploy Hook | WhatsApp · segurança · deploy | Config |

**Gates adicionais órfãos (do PENDENCIAS §"DEPENDE DE VOCÊ" — 24 itens; NÃO estão nas tabelas do 04/00, INCORPORAR):**
- **Rotação de segredos (P0/Fase 0):** `SUPABASE_SERVICE_ROLE_KEY` + PAT `sbp_` (chave do dev demitido vale até 2036) + chaves Render + trocar senha exposta no chat.
- **Push GitHub de backup próprio** (repo atual é do dev demitido).
- **Config Render/cron:** `CRON_SECRET`, `MOTOR_FONTE=fornecedores`, `COPILOTO_HMAC_SECRET`, mover cron dos KPIs pro Render.
- **Tirar `NEXT_PUBLIC_INTERNAL_API_KEY`/`TENANT_ID`** do bundle + retestar login.
- **Aplicar migração AUT-7** (`20260819120000` DROP idx redundante) — pronta, só aplicar.
- **JANELA-03** `engenheiro_responsavel_id` (amarra `escrow:chave_tecnica` à pessoa, não ao papel).
- **Desfazer DEMO escrow (R$15k)** — risco crítico vivo.
- **Rebalancear owners:** Ramon owner→admin, Ariane owner→comercial, promover obradezmais→owner, remover `e2e-arq@obra10.app`.
- **Parceiro BaaS/KYC p/ escrow** + abrir contas-escrow por obra (Fase 2 real).
- **Seed de dinheiro real** (recebíveis/medições Consulado) + recuperar docs de GESTÃO DE OBRAS do **Asana** (base do módulo Engenharia).
- **Credenciais Meta (Lead Ads/Direct) + Windsor** (tráfego pago).
- **Textos jurídicos** (termos de uso + privacidade).
- **Decisões de produto travantes:** valor lead faixa/exato · escrow 2-chaves papéis · planos SaaS + markup Tijolos · fornecedor×parceiro×empresa · captação pública (quais forms sem login) · modelo multi-tenant A/B · `hub_produtos` modelar agora ou deferir · catálogo ~20 itens materiais (BLOQUEANTE — Compras abre vazia).

---

## 32 PENDÊNCIAS ÓRFÃS — a INCORPORAR no cronograma (nenhuma pode ficar de fora)
Cada uma precisa de FICHA COMPLETA no masterplan (não estão no CADERNO). Agrupadas por zona + fase sugerida:

**INFRA de plataforma:**
1. **SEC-7 / `hub_acoes_ia`** — IA gravar auditoria de TUDO que escreve (ponto de injeção `executar-ferramenta-ia.ts:593` + `agente-ferramentas-registry.ts:1172`). P1·Fase 3 (junto Central de Aprovações).
2. **Logs/observabilidade unificado** (`hub_error_logs`, request_id/trace_id, logger nas ~187 rotas, PII redigida, retenção) = "Onda D". P1·Fase 3/5.
3. **Rate-limit distribuído (Redis)** anti-abuso/DoS em tudo que toca IA. P1·Fase 1/3.
4. **Rotação/higiene de segredos** (service_role+PAT+Render+GitHub backup). P0·Fase 0.
5. **Config Render/cron** (CRON_SECRET, MOTOR_FONTE, cron KPIs, alertas duplicados). P1·Fase 0/3.
6. **Higiene de banco** (advisors: mover pg_net/vector do public, search_path `_norm_tel`, apagar RPCs hard-delete dormentes, restringir buckets públicos, criar buckets Passo D). P1·Fase 0/3.
7. **IA security hardening** (prompt-injection via nome WhatsApp, RAG cross-tenant, memory-poisoning). P1·Fase 1/3.
8. **Cron/webhook forjável** (HMAC real timestamp/nonce; WhatsApp só via worker). P1·Fase 1/3.
9. **Recuperar docs de obras do Asana** (base Engenharia; conta convidado inacessível). P1·Fase 2/3.

**UX/design/mobile:**
10. **Mobile-cadastros** (não cria PF/empresa; hidden md:block; redesign nav) — **PRIORIDADE ALTA do dono**. P1·Fase 0/3.
11. **Design overhaul** (~97 azuis-roxos off-brand em 29 arquivos → verde+dourado; `CadastroPremiumSideover` herda azul Shadcn). P1·Fase 3.
12. **Polimento UX + honestidade de telas** (barra 42% falsa, 85% confiança inventado, motivo de perda obrigatório, seletor por nome não-UUID, KPIs do backend sobre TODOS os registros, toasts/máscaras/skeleton, acessibilidade AA, remover 3º header mobile, limpar copy técnica de fachada). P1·Fase 3.

**Features CRM/atividade + financeiro operacional:**
13. **Registros/atividades por entidade** (próxima-ação OBRIGATÓRIA c/ bloqueio global na API, follow-up automático por prazo, alerta de oportunidade parada, timeline nos 4 cadastros, agendar reunião/registrar ligação/visita) — **gaps P0 do próprio rastreador do código**. P0·Fase 3.
14. **Financeiro OPERACIONAL** (lançamentos automáticos por evento ganho→receber/medição→pagar, contas a pagar/receber, menu ⋮ por linha corrigir pago/recebido, consolidação 4 fontes elimina #REF!). P1·Fase 2/3.
15. **Injetar IA nas telas-âncora** (negócio/lead/atendimento hoje 100% manuais: sugerir próxima ação, preview encaminhamento, card "A IA entendeu assim", barra "Perguntar à IA", motivo ao rejeitar→aprendizado). P1·Fase 3+.
16. **Camada eventos/Notificações (F4 in-app/push)** como fundação de F1/F5/F6. P1·Fase 3.

**Módulos sem ficha:**
17. **`hub_produtos` NÃO existe** — Tela Produtos + ficha + modelar PRODUTO/SERVIÇO-de-obra no schema + catálogo materiais (~20 itens BLOQUEANTE) + importar ~500 reais. P1·Fase 3.
18. **Módulo Serviços/ofícios** (marcenaria/marmoraria/vidraçaria/serralheria/pintura/elétrica + prestadoras + motor modelo-por-ofício). P2·futura.
19. **Portal do FORNECEDOR** (hoje protótipo/403; cotações direcionadas + pedidos + link expirável) — POR-01 só cobre o do cliente. P1·Fase 3/7.
20. **Onda A — Tela do Arquiteto / Módulo Arquitetura** (carteira de PROJETOS: financeiro do arquiteto, ficha de projeto/briefing/aprovações `po-proj-ficha` P0). A0/A1 entram em OBR-01 mas a tela não. P1·Fase 3.
21. **Onda C — Configurações self-service** (empresa cadastra funcionários+permissões = RBAC operável) — pré-req prático do multi-tenant self-service. P1·Fase 5.
22. **Gestor de Tarefas universal + Tela Hoje por perfil** + resolver stubs de menu (/crm/conteudo, Tarefas, Ferramentas IA, agentes-reais, tráfego). P2·Fase 3.

**Dívidas/limpeza:**
23. **R7 fail-OPEN** (papel desconhecido cai em 'comercial'; precisa fail-closed) — bug de segurança. P1·Fase 0/5.
24. **`escrow:chave_tecnica` amarrada ao responsável** (`hub_obras.engenheiro_responsavel_id`, JANELA-03; hoje valida por papel). P1·Fase 2/5.
25. **delete=arquiva pendente em 5 endpoints** (falta coluna de arquivo) — invariante #4 não cumprida em prod. P1·Fase 0/3.
26. **Deleção do código morto** do Escritório Virtual legado (~50 arquivos: `components/office/*`, `useOfficeLife`/`useLiveLeads`, `lib/data/*` mocks, `api/agents/[id]`). ⚠️NÃO remover `lib/data/office-map.ts` nem `/api/hub/agentes`. P2·Fase 3.
27. **Refactor Fase 2.3** — extrair `app/crm/layout.tsx` (657 linhas, 52 telas). P2·Fase 3.
28. **Textos jurídicos** (termos + privacidade + doc usuário final). P2·Fase 5/6.

**Decisões/futuro:**
29. **Elo Comunidade(Membros)→CRM/fornecedor** não existe (sem membro_id/liberado_crm/webhook) + F5 feed tempo real. P2·futura.
30. **Copiloto/Agentes features prometidas** (follow-up customizável, auto-montagem de fluxo, base de conhecimento hoje SÓ no navegador, Agent Builder Fase 4, dogfooding do wizard). P2·Fase 2+.
31. **Backlog F1/F2/F3/F6 + campo E8-E10** (ponto de obra GPS, compras totem+iFood c/ spread, voz→materiais, diário automático, RDO voz/foto, SST). P2·Fase 6+.
32. **Grandes módulos rede/escala** (Marketplace/iFood da construção + Lalamove + alerta preditivo; CRM cross-conta pleno; 2FA+Enterprise/API pública; Editor de fluxo visual/Agent Builder por IA + Copiloto de Voz Global). P2·Fase 7-8.

**Mais urgentes a promover a WI JÁ (recomendação do próprio doc):** mobile-cadastros (10), SEC-7/auditoria-IA (1), R7 fail-open (23), rotação de segredos (4), delete=arquiva (25), gaps P0 do rastreador (13: follow-up/alerta-parado/próxima-ação).

---

## Invariantes (CAD §16) — critério de rejeição de PR, valem em toda WI
1. Dinheiro só com 2 humanos distintos (`chave_hub`≠`chave_tecnica`; IA/worker/voz nunca aprovam). 2. Duas moedas nunca somam na UI (Tijolo≠BRL; ledgers separados; `moeda CHECK='BRL'`). 3. Append-only onde há dinheiro/prova (correção=linha negativa). 4. Delete só arquiva. 5. `tenant_id` sempre da sessão, nunca do body; posse por 404 não 403. 6. Defesa na query (preço fechado não seleciona `valor_unitario`). 7. Estender CHECK junto com vocabulário. 8. Migração aditiva/reversível, na janela do dono; nada aplicado à mão sem virar arquivo.

**Gates de qualidade (toda WI):** `tsc` limpo + `vitest` verde antes de merge; migração aditiva+reversível; migração em prod só na janela; screenshot antes/depois em UI. Loop curto: 1 WI → build → E2E ao vivo → dono reage → ajusta → backup.

**Arquivos-âncora chave (para as fichas):** `lib/tenant-default.ts` (`tenantScopeOrFilter:68`, `tenantScopeExact:55`, `tenantIdFromRequest:87`) · `lib/crm/crm-api-auth.ts` · `lib/crm/crm-permissoes.ts:46` · `lib/ia/aprovacoes.ts:320/327/377-387` · `lib/obras/escopo.ts:98-112` (soma inline) · `lib/crm/estagio-map.ts` · `lib/crm/derivar-negocio.ts:32-38` · `lib/ia/metering.ts` · `lib/ia/ml.ts` · migrações E6 `20260730120000` (⚠️não aplicar até FIN-02) · motor comissões `20260706170000`+171/172/173000.


## Anexo 2

# RECON — MOBILE & LOJAS (Obra10+) — caminho concreto para App Store + Play Store

Tudo abaixo está ancorado no que o repo **realmente** tem hoje. Arquivos-chave lidos: `package.json`, `next.config.ts`, `proxy.ts`, `render.yaml`, `app/layout.tsx`, `app/icon.tsx`, `app/apple-icon.tsx`, `public/manifest.json`, `public/sw.js`, `components/IOSInstallBanner.tsx`, `vercel.json`.

---

## 1. STACK REAL (o ponto de partida)

| Fato | Evidência no repo | Implicação para lojas |
|---|---|---|
| **Next.js 16.2.4 App Router, React 19.2.4, SSR** | `package.json:38,40-41` | É um app **server-rendered hospedado**, não estático. Não dá para "gerar um APK do site" — precisa de wrapper apontando para a URL hospedada, ou app-shell nativo. Descarta export estático embutido. |
| **Hospedado no Render** (`escritorio-virtual-1.onrender.com`), plano `starter` | `render.yaml:50-54`; obs. 13247 | A URL de produção é a origem que o app das lojas vai carregar. Precisa de domínio próprio HTTPS estável (hoje é `*.onrender.com`) para Digital Asset Links (TWA) e para não "cheirar a site" na revisão Apple. |
| **PWA já tem manifest** (standalone, theme `#003b26`, shortcuts Leads/Atendimento/Aprovações) | `public/manifest.json` | Base de PWA existe. `prefer_related_applications:false`, `display:standalone` — bom para TWA. |
| **Metadados PWA/iOS ligados no layout** | `app/layout.tsx:19-52` (`manifest`, `appleWebApp.capable`, `apple-mobile-web-app-*`, `viewport-fit:cover`, `themeColor`) | Instalável como PWA hoje. Falta só o lado nativo/loja. |
| **Ícones são GERADOS dinamicamente** (edge `ImageResponse`, texto "O+" em gradiente) | `app/icon.tsx`, `app/apple-icon.tsx` | ⚠️ **Não existem PNGs de marca em disco.** Lojas exigem assets estáticos: Play 512×512, Apple 1024×1024, além de splash/feature graphic/screenshots. Placeholder "O+" reprova em qualidade de loja. |
| **Service Worker é um KILL-SWITCH** (`sw.js v7`: no `activate` deleta TODAS as caches; **sem `fetch` handler**) | `public/sw.js:1-8` | ⚠️ **Zero offline / zero cache.** Foi feito para *limpar* SW antigo, não para servir offline. TWA/PWA de qualidade e a heurística de instalabilidade querem SW com `fetch`. Precisa reescrever para um SW real (ou aceitar TWA sem offline). Também **não há `navigator.serviceWorker.register`** no código (grep só achou `layout.tsx` e uma route não relacionada) — então o SW nem está registrado. |
| **Estratégia mobile atual = A2HS (Add to Home Screen)** | `components/IOSInstallBanner.tsx` (banner que ensina "Compartilhar → Adicionar à Tela de Início" no Safari) | Hoje o "app iOS" é PWA manual. Isso **não é** publicação em loja — é o degrau anterior. |
| **Auth é cookie de sessão** (`CRM_ACCESS_COOKIE`, Supabase) | `proxy.ts:3,27-37` | O wrapper (WKWebView/TWA) **tem que persistir cookies** entre sessões, senão o usuário desloga a cada abertura. Ponto de teste obrigatório. |
| **`proxy.ts` está MORTO** (Next espera `middleware.ts`; export é `proxy`, não `middleware`) | obs. 10850, 12887, 12888 | Não bloqueia lojas, mas o gate de auth roda hoje só nas route handlers. Relevante para QA do fluxo logado dentro do webview. |
| **Layout mobile dedicado existe** (`MobileDetector`/`MobileShell`, kanban→carrossel, bottom-sheet) | `app/layout.tsx:6,70`; `AUDITORIA-MOBILE-2026-06-26.md` | Base de UX mobile sólida — bom, porque a Apple reprova webview que é só "o site desktop encolhido". |
| **NÃO há packaging nativo hoje** | `package.json` sem Capacitor/Bubblewrap/Expo/TWA; sem pastas `android/` ou `ios/` | Ponto de partida = **zero**. Todo o workstream de lojas é greenfield. |

**Resumo do estado:** PWA ~70% pronta (manifest + metadados OK), **SW inútil**, **ícones placeholder**, **zero wrapper nativo**, **domínio ainda em `onrender.com`**. Nada publicável em loja hoje.

---

## 2. ESTRATÉGIA DE PACKAGING — prós/contras e recomendação

Para um app **SSR hospedado** (não SPA estático), as opções reais:

### Android

**Opção A — TWA (Trusted Web Activity) via Bubblewrap ou PWABuilder** ✅ RECOMENDADA
- **Como:** o app Android é uma casca que abre a URL hospedada (`https://app.obra10.com.br`) em Chrome full-screen, sem barra de URL, validada por **Digital Asset Links** (`/.well-known/assetlinks.json` no servidor ↔ fingerprint SHA-256 da assinatura do app).
- **Prós:** usa o SSR **ao vivo** (deploy no Render = update instantâneo, sem re-submeter à loja para mudanças de conteúdo/lógica); build trivial; mantém a base única; sem re-escrita.
- **Contras:** exige manifest instalável + (idealmente) SW com `fetch`; requer `assetlinks.json` publicado; push notification precisa de plugin extra; sem código nativo real.
- **Ajuste no repo:** publicar `assetlinks.json`, reescrever `sw.js`, gerar ícones/splash reais.

**Opção B — Capacitor (WKWebView/Chrome wrapper) com plugins nativos**
- **Prós:** mesma base de código para iOS e Android; adiciona câmera/push/geolocalização nativas (útil para foto/vídeo de medição em campo).
- **Contras:** build mais pesado que TWA; mantém projeto Android nativo.

### iOS

A Apple **reprova webview fino** sob **Guideline 4.2 (Minimum Functionality)** — "seu app é só um site empacotado". Um wrapper que só carrega a URL é rejeição quase certa.

**Opção recomendada — Capacitor + WKWebString apontando para a URL hospedada, MAS com valor nativo real** ✅
- **Como:** projeto Capacitor iOS que carrega o app SSR, e **adiciona capacidades nativas que justificam ser app:** push notifications (APNs) para aprovações/SLA/medição, câmera nativa para foto/vídeo de medição em campo (já é requisito do `campo-tablet-totem-entrega.md`), geolocalização do RDO/diário, compartilhamento nativo, biometria para login.
- **Prós:** mesma base; as capacidades nativas (que o produto já quer) são exatamente o que faz passar no 4.2.
- **Contras:** **build iOS exige macOS + Xcode** (ou CI em Mac: EAS Build, Codemagic, MacinCloud, ou GitHub Actions `macos-latest`). Revisão Apple mais rigorosa e mais lenta.

### RECOMENDAÇÃO FINAL para este app SSR
- **Android = TWA (Bubblewrap/PWABuilder).** Mais barato, usa o SSR ao vivo, quase sem manutenção. Publicar `assetlinks.json`.
- **iOS = Capacitor WKWebView shell + plugins nativos (push APNs + câmera + geo)** para sobreviver ao Guideline 4.2. Aceitar a exigência de macOS/Xcode.
- **Pré-requisito comum aos dois:** domínio próprio HTTPS estável (sair de `*.onrender.com`), ícones/splash reais, SW funcional, e política de privacidade + LGPD publicada.

*(Alternativa de simplificação: usar Capacitor para os DOIS para ter uma só toolchain e plugins compartilhados — custa um pouco mais no Android que a TWA, mas unifica push/câmera. Decisão do dono.)*

---

## 3. REQUISITOS DE SUBMISSÃO (checklist duro)

**Contas e custo (JANELA DO DONO — cadastro + verificação):**
- **Apple Developer Program** — **US$ 99/ano**. Verificação de identidade (D-U-N-S se PJ) pode levar **1–2 semanas**. ⚠️ agendar cedo.
- **Google Play Console** — **US$ 25 (taxa única)**. Contas novas de dev individual às vezes exigem período de teste fechado com **12 testers por 14 dias** antes de produção — verificar no cadastro.

**Legal / LGPD (bloqueante nas duas lojas):**
- **Política de Privacidade** pública (URL) — obrigatória em ambas. Deve cobrir LGPD (base legal, dados coletados, retenção, direitos do titular, contato do DPO). Hoje **não existe** rota pública `/privacidade` — criar.
- **Apple Privacy "Nutrition Labels"** (App Privacy) + Data Safety form da Play — declarar cada dado coletado (nome, telefone, CPF de especialistas, localização de campo, fotos de medição). Como o app lida com **CPF e dados de terceiros (especialistas/MDO)**, isso é sensível — declarar com cuidado.
- **Conta de exclusão de dados** (Google exige URL/fluxo de "delete account" desde 2024; Apple exige delete-in-app).

**Assets visuais (hoje só placeholder "O+" gerado):**
- Ícone Play **512×512 PNG**; ícone Apple **1024×1024 PNG** (sem alpha).
- **Splash screens** (Capacitor gera por densidade).
- **Screenshots**: Play ≥2 por form-factor (phone, e tablet se declarar tablet); Apple exige 6.7" e 6.5"/6.9" iPhone (e iPad se suportar). Precisa de capturas reais das telas mobile já existentes.
- **Feature graphic 1024×500** (Play).

**Revisão Apple — armadilhas que reprovam webview:**
- **4.2 Minimum Functionality** — webview fino reprova; mitigar com push/câmera/geo nativos (acima).
- **5.1.1** — se tem login, precisa permitir **conta de teste** para o revisor (usuário demo do tenant zero).
- **3.1.1 / In-App Purchase** — ⚠️ se o billing (assinatura) for vendido *dentro* do app iOS, a Apple exige IAP (comissão 15–30%). Recomendação: **billing fora do app** (web) para B2B, e no app só "gerenciar pela web" — evita IAP. Decisão do dono / risco de rejeição a mapear.
- **Sign in with Apple** — obrigatório se oferecer login social de terceiros; se login for só e-mail/senha próprio, dispensável.

**Técnico:**
- **Build iOS SÓ em macOS + Xcode** (ou CI Mac). Sem Mac na equipe → contratar EAS/Codemagic/MacinCloud. **JANELA DO DONO / custo.**
- **Versionamento**: `versionCode`/`versionName` (Android), `CFBundleVersion`/`CFBundleShortVersionString` (iOS) — bump a cada submissão.
- **Assinatura**: Android keystore (guardar em segredo; Play App Signing); iOS certificados + provisioning profiles (Apple Developer).
- **Push notifications** (se ligado): APNs key (iOS) + FCM (Android) — mais um segredo de infra e backend de envio (o app já tem cron/webhook infra no Render para disparar).

---

## 4. PASSO-A-PASSO DE SUBMISSÃO

### Preparo comum (antes de qualquer loja)
1. **Domínio próprio HTTPS** (ex. `app.obra10.com.br`) apontando para o serviço Render; atualizar `NEXT_PUBLIC_APP_URL` (`render.yaml:65`).
2. **Reescrever `public/sw.js`** para um SW real com `fetch` handler (cache de shell + network-first para dados). Registrar via `navigator.serviceWorker.register('/sw.js')` (não existe hoje).
3. **Gerar ícones/splash reais** de marca (substituir placeholder "O+" de `app/icon.tsx`); manter também os endpoints dinâmicos como fallback.
4. **Publicar `/privacidade` (LGPD)** e fluxo de exclusão de conta.
5. **Criar usuário demo do tenant zero** para revisores.

### Android (TWA)
6. `npx @bubblewrap/cli init --manifest https://app.obra10.com.br/manifest.json` (ou PWABuilder web).
7. Configurar `applicationId`, versão, cor de status bar (`#003b26`).
8. Gerar keystore; extrair **SHA-256 fingerprint**.
9. Publicar `/.well-known/assetlinks.json` no Render com o fingerprint (remove a barra de URL / valida TWA).
10. `bubblewrap build` → gera **AAB** assinado.
11. Play Console → criar app → subir AAB → preencher Data Safety, política de privacidade, content rating, screenshots → **teste interno** → (teste fechado 12/14d se exigido) → **produção**.

### iOS (Capacitor)
12. `npm i @capacitor/core @capacitor/ios`; `npx cap init`; `server.url = https://app.obra10.com.br` no `capacitor.config`.
13. Adicionar plugins nativos que justificam o app: `@capacitor/push-notifications` (APNs), `@capacitor/camera`, `@capacitor/geolocation`, `@capacitor/share`.
14. `npx cap add ios` → abrir no **Xcode (macOS)** → configurar bundle id, certificados, provisioning, ícone 1024, splash.
15. Testar persistência de **cookie de sessão** no WKWebView (login Supabase mantém sessão ao reabrir).
16. Archive → upload via Xcode/Transporter → **App Store Connect**.
17. Preencher App Privacy labels, screenshots 6.7"/6.9", conta demo, descrição → **TestFlight** → submeter revisão.

---

## 5. TIMELINE REALISTA (semanas — para o workstream MOBILE-LOJAS do cronograma)

Ancorado no estado zero de packaging + o que já existe (PWA base pronta):

| Fase | Duração | Conteúdo |
|---|---|---|
| **Preparo PWA/infra** | **Sem. 1–2** | Domínio próprio HTTPS; reescrever+registrar SW; ícones/splash reais; `/privacidade` LGPD + delete-account; usuário demo. Em paralelo: **abrir conta Apple Developer (verificação 1–2 sem — JANELA DO DONO)** e Play Console. |
| **Android TWA** | **Sem. 3–4** | Bubblewrap/PWABuilder → AAB assinado → `assetlinks.json` → teste interno Play. |
| **Publicação Play** | **Sem. 4–6** | Data Safety, screenshots, content rating; se conta nova exigir teste fechado (12 testers/14 dias), **+2 semanas**. Revisão Play: horas a ~3 dias. |
| **iOS Capacitor + nativo** | **Sem. 4–7** | Projeto Capacitor, plugins push/câmera/geo, build Xcode (exige Mac/CI), teste cookie/sessão, TestFlight. |
| **Publicação App Store** | **Sem. 7–9** | App Privacy, screenshots, conta demo, submissão. **Revisão Apple: ~1–3 dias por ciclo**, mas **contar 1–2 rejeições** por Guideline 4.2 → prever 1–2 semanas de idas-e-voltas. |

**Estimativa total:** **Play ~4–6 semanas**; **App Store ~7–9 semanas** (Apple é o gargalo: verificação de conta + risco 4.2). Cabe no V1, **fora** do MVP de 1 trimestre (o MVP single-tenant é web/PWA — publicação em loja é escopo V1, como o objetivo já define).

---

## 6. RISCOS / FLAGS (JANELA DO DONO)

- 🚩 **Conta Apple Developer** — abrir JÁ (verificação demora). Bloqueia toda a trilha iOS.
- 🚩 **Mac/Xcode** — equipe é Windows (`env win32`). Sem Mac → contratar CI Mac (EAS/Codemagic) — custo + decisão.
- 🚩 **Guideline 4.2 (Apple)** — sem valor nativo, reprova. Por isso iOS = Capacitor + push/câmera/geo, não webview puro.
- 🚩 **IAP (Apple 3.1.1)** — manter billing/assinatura **na web** para evitar comissão 15–30% e rejeição. Decisão do dono.
- 🚩 **Domínio `onrender.com`** — trocar por domínio próprio antes de TWA (assetlinks) e para credibilidade na revisão.
- 🚩 **LGPD/CPF** — app coleta CPF de especialistas e fotos de terceiros; App Privacy/Data Safety têm que declarar isso corretamente ou reprova.
- ⚠️ **SW kill-switch + sem registro** (`public/sw.js`) e **ícones placeholder** (`app/icon.tsx`) — dois blockers de qualidade que hoje passam despercebidos porque ninguém instala em loja.

**Nada publicável hoje; a base PWA é boa, mas o workstream de lojas é greenfield e o caminho-crítico é a trilha iOS (conta Apple + Mac + 4.2).**

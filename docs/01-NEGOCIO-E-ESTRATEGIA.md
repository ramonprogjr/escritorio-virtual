# Negócio & Estratégia

> **Documento VIVO — um dos 5 que o time SEMPRE segue.** Derivado dos 115+ docs originais (arquivados, não seguidos) + do CADERNO-ENGENHARIA-AUDITORIA.md. Atualizado 07/jul/2026. Quando um doc antigo conflitar, este ganha.
> Companheiros: [00-Painel](00-PAINEL-DE-CONTROLE.md) · [01-Negócio](01-NEGOCIO-E-ESTRATEGIA.md) · [02-Produto/UX](02-PRODUTO-TELAS-E-UX.md) · [03-Arquitetura](03-ARQUITETURA-DADOS-E-SEGURANCA.md) · [04-Roadmap](04-ROADMAP-E-PLANO.md).


> Documento vivo, derivado dos 115+ docs originais; atualizado 07/jul/2026. É um dos 5 masters que o time SEMPRE segue. Onde um doc antigo conflitar, este e os 4 companheiros (Produto & UX · Arquitetura, Dados & Segurança · Financeiro & Motor · Painel de Controle) ganham. Fonte da verdade acima deste: `MODELO-DE-NEGOCIO-E-FLUXOS-COMPLETO.md`, `ANALISE-CEO-E-PLANO-DE-UNIFICACAO.md`, `00-PAINEL-DE-CONTROLE.md` e a memória do CEO. **Honesto por design:** tudo aqui é marcado **[construído]**, **[construído-mas-gated]**, **[desenhado]** ou **[desligado]**. Não maquiamos número ruim — isso é a arquitetura, não um detalhe.

---

## 1. A Tese

**Obra10+ é o sistema operacional do ciclo AEC (Arquitetura–Engenharia–Construção), operado por um Hub que distribui demanda e arbitra confiança.**

Um **Hub central** capta e distribui leads para **empresas fornecedoras homologadas** (os tenants), que **vendem no CRM e executam a obra dentro do mesmo sistema** — sobre uma estrutura unificada onde **orçamento = cronograma = contrato = medição = escrow** derivam de um único dado (o item de escopo). O Hub cobra por isso: assinatura (SaaS), comissão sobre a rede (split) e créditos de IA (Tijolos). Um Portal do Cliente cura os medos de quem paga a obra. O moat é preditivo: quem tem o cérebro da obra ganha.

**"Jesus Cristo em primeiro lugar"** é o valor declarado do dono (Wendel — eng. civil + corretor).

### Como a tese evoluiu (honestidade de direção)

| | Origem (08/mai — SUPERADO) | Hoje (ATUAL) |
|---|---|---|
| **O que é** | "Agência de marketing/growth por IA" com plataforma de intermediação acoplada; produto-âncora = "Escritório Virtual" (canvas isométrico, 28 agentes-funcionários) | Plataforma multi-tenant tipo Hub para todo o ciclo AEC |
| **Público** | PMEs de construção/arquitetura/imobiliário sem budget de equipe | Mesmo público, mas como **tenants operadores**, não clientes de agência |
| **Prazo** | MVP "100% funcional" em 27/05/2026 | Passou; hoje o eixo é MVP→V1→V2→V3 (ver §8) |

**A alma que sobreviveu intacta** (vale hoje, os 3 pilares originais):
1. **Parâmetros pré-fixados por agente** (cargo/área/nível/modelo) → prompt cacheável.
2. **IA observa, sugere, prepara — humano aprova.** A IA nunca executa dinheiro/contrato/irreversível sozinha (Central de Aprovações).
3. **CEO Humano Único** — não existe agente com cargo de CEO. Regra absoluta.

**Princípios de negócio acrescentados depois (LEI, não aspiração):**
- **Honestidade é a arquitetura** — nunca maquiar número ruim; distinguir "sem dado ainda" de "zero real".
- **O Hub é JUIZ** — no escrow/custódia, o Hub arbitra; só dá o OK para pagar/reter.
- **NADA SE PERDE** — append-only + Hub recupera o apagado (delete = arquiva, nunca destrói).
- **Asset-light** — orquestra, não possui.
- **Preditivo é o moat** — o cérebro da obra é o ativo estratégico.
- **Click-and-Go / Talk-and-Go / IA-first** — escolher e confirmar, quase nunca digitar.
- **Visão curada por papel** — cada persona vê só o seu escopo (anti-poluição, recorte no dado).

> **Diagnóstico de scope creep (honesto):** o item nº1 do próprio MVP — IA respondendo leads em produção — segue **bloqueado há ~60 dias** por falta de chave de API, enquanto uma camada AEC inteira foi construída à frente. É creep de **visão**, não de execução destrutiva: a disciplina "aditivo / reversível / nada quebra" salvou o projeto (nenhuma migração AEC ativada quebrou o núcleo). Progresso honesto: **núcleo comercial ~90%; visão completa ~30–40%.**

---

## 2. O Modelo de Marketplace / Rail

### 2.1 Estrutura Hub ↔ Tenant

- **Hub** = Obra10 central. Distribui leads, homologa fornecedores, é o **escrow/juiz**, cobra spread/comissão. Tenant sentinela: `00000000-0000-4000-8000-000000000001`.
- **Tenant** = empresa fornecedora homologada. Vende no CRM e executa a obra. Multi-tenant, IA-first, API-first.
- **Cliente final** = **GUEST**, nunca tenant nem membro (uma obra pode ter mais de um tenant executor). Acesso por vínculo (`negocio_id`), não por tenancy.

**Ordem de construção (decisão do dono):** **Tenant PRIMEIRO → Hub DEPOIS.** "A visão do Hub emerge da operação real do tenant" = construir a COLUNA antes do teto. Dentro do tenant, de baixo p/ cima: mão de obra → prestadores → serviços → engenharia (obra) → arquitetura (projeto) → cliente.

### 2.2 A espinha canônica (o rail)

```
NEGÓCIO  (CRM comercial — a espinha; hub_negocios)
  └─► PROJETO  (arquitetura; hub_projetos)      → carteira Arquitetura → central do projeto
        └─► OBRA  (engenharia; hub_obras)         → carteira Engenharia → cockpit da obra (EAP/frentes)
              └─► SERVIÇOS/frentes → mão de obra + prestadores → financeiro/escrow → CLIENTE (portal)
```

**[construído] no banco:** `hub_negocios → hub_projetos → hub_obras`. Projeto e Obra são entidades **ligadas, não a mesma**; uma obra pode nascer **sem projeto** (reforma direta). O elo projeto→obra é `hub_projetos.obra_id` (zero migração), com gate e idempotência — o molde canônico arq→eng vive em `gerar-obra/route.ts`.

### 2.3 Conceitos-mãe do rail

- **⭐ Negócio = espinha de integração entre CONTAS distintas.** O mesmo `negocio_id` costura contas com `tenant_id` diferentes (cliente/arquiteto/engenharia/fornecedor/Hub); cada uma vê sua fatia. **Fonte única, lentes por papel** — o arquiteto atualiza, todos veem; desatualização fica **visível**, não escondida. *(Cross-tenant real por ABAC é [desenhado].)*
- **⭐ Linhagem imutável.** Negócio tem pai/raiz congelados (trigger protege `negocio_pai_id`); a **raiz = a primeira oportunidade da jornada no Hub** (não hardcode "raiz = ARQ"). "Disputa entre engenharias" = 1 negócio-filho por concorrente; a vencedora → `fechado_ganho`. **[gap real, construído-mas-dormente]:** `negocio_pai_id`/`negocio_raiz_id` são **lidos na UI mas nunca escritos pelo app** (só seed SQL) — fechar a escrita da linhagem é trabalho aberto.
- **⭐ Serviço = unidade universal de execução.** Da banheira ao empreiteiro geral, todo serviço segue o mesmo ciclo: **Escopo → Contrato → Preço → Cronograma → Compras → Check-in → Diário → Medição → Aprovação → Entrega → Pagamento.** Uma OBRA = conjunto de serviços/frentes.
- **⭐ Item de escopo = o átomo.** `hub_obra_itens` projeta 7 artefatos (memorial, orçamento, contrato, compra, medição, pagamento/escrow, curva-S) por `SELECT`, sem redigitar. É a tese "orçamentária é um verbo, não planilha".
- **Código único / identidade global.** Pessoa/empresa/imóvel existe uma vez (dedup por telefone/CPF/CNPJ); chave de não-duplicação, histórico, comissão e roteamento. Código atômico e imutável por RPC. **Decisão travada 02/jul:** identidade global unique (PES/EMP/IMV/PRD/SVC); contador por-tenant só para DOCUMENTOS.
- **NADA SE PERDE** = 3 camadas: soft-delete padronizado + `hub_eventos` append-only/imutável + Hub backstop (service_role recupera apagados).

### 2.4 As 2 espinhas transversais

- **🗂️ Gestor de Tarefas universal** — todo VERBO vira tarefa; a IA controla a teia; o humano só vê o que precisa (Asana × Bitrix24, IA-orquestrado). Tela **"Hoje"** = keystone (cada módulo REGISTRA suas pendências; zero tabela nova). *(Estrutura [desenhada]; a fila IA-priorizada depende da IA ligada.)*
- **✅ Central de Aprovações** — todo gate (medição/escrow/cliente/compra/restrição) numa fila única sobre `hub_aprovacoes`, priorizada por mercado × atividade × tipo; a IA auto-aprova o trivial (autonomia 1→5), o humano decide o crítico, e a decisão **ensina o agente**. **Trava absoluta: nunca passa de nível 2 em dinheiro/escrow/contrato/SST.**

---

## 3. As Verticais e o Value-Chain

### 3.1 Os atores (6)

CEO humano único (Wendel) · Empresas clientes/tenants · **Parceiros** (imobiliárias/corretores — trazem leads, comissão) · **Fornecedores** (por área: arquitetura, engenharia, empreiteiras, marcenaria, elétrica, hidráulica, pintura, materiais…) · **Operários / mão de obra** (PF, CPF, só WhatsApp — sem login) · **Clientes finais** (GUEST).

### 3.2 Os 4 tipos de fornecedor/tenant sobre a espinha

| Tipo | Opera | Unidade de carteira | Padrão de tela |
|---|---|---|---|
| **Arquitetura** | gestão de **projetos** | Projeto → central do projeto | CARTEIRA → CENTRAL |
| **Engenharia** | gestão de **obras** | Obra → cockpit da obra | CARTEIRA → CENTRAL |
| **Serviços** | execução de serviços (banheira → empreiteiro → serralheiro) | Serviço → ciclo universal | CARTEIRA → CENTRAL |
| **Produtos** | catálogo / pedidos / estoque | Produto/Pedido ("iFood da construção") | CATÁLOGO → PEDIDO |

Um fornecedor pode ser **mais de um tipo** (carteiras cross-linkadas). Transversal a todos: CRM comercial + Dashboard + Central de Aprovações. **Padrão = CARTEIRA → CENTRAL, não funil de lead.**

> **Decisão-diretriz travada:** tela por **OBJETO**, persona = **LENTE** (não duplicar telas por papel; o RBAC prova o recorte). **Engenharia = "unidade de execução universal"**: Serviço/Marcenaria/Vidraçaria etc. são instâncias LEVES do mesmo átomo, **não módulos paralelos**. As tabelas-fantasma por ofício (`hub_marcenaria`, `hub_vidracaria`) devem ser **aposentadas** — o refinamento do dono (02/jul) é claro: **fornecedor = CONTA multi-tenant** com login próprio e serviço atrelado cross-conta por linhagem. Isso **supera** a ideia antiga de "uma tabela por área".

### 3.3 O value-chain (como o valor flui entre contas)

O mesmo negócio atravessa contas distintas e cada elo agrega valor e captura spread:

```
Parceiro (indica) → Hub (distribui, arbitra) → Arquiteto (projeta) → Engenharia (executa)
      → Serviços/Fornecedores (entregam) → Cliente (paga, via escrow)
```

Cada elo é remunerável por **código único** e por **papel** (`hub_negocio_vinculos`): quem indicou cliente, indicou comprador/vendedor, executou, captou. O Hub é o único que vê a margem consolidada.

### 3.4 Sequência macro do dono

1. Núcleo comercial PERFEITO → 2. Marketing (IA de tráfego Google/Meta) → 3. Multi-tenant go-live → 4. Gestão de usuários → 5. Arquitetura & Engenharia → 6. demais.

**Reconciliação honesta:** o item 5 (AEC) foi **antecipado e construído** (aditivo/latente) antes de fechar 2–4. Não é conflito porque nada foi ativado — mas é a dívida de direção a saldar. O núcleo comercial está ~90%; marketing IA é futuro não tocado.

---

## 4. Monetização

**Modelo de receita em 3 pernas.** Diretriz do CEO: **manual-first** — definir **1 trilha cobrável cedo e faturar 1** antes de automatizar as três. Alinha com a decisão travada **clawback = cobrar sempre**.

### 4.1 SaaS / MRR — assinatura

Assinatura mensal + por usuário + módulo/plano + créditos. **[desenhado, não existe]:** entitlements `hub_planos` não existem no schema.

Planos propostos **[a validar com o dono]**:

| Plano | Preço aprox. | Franquia mensal | Nota |
|---|---|---|---|
| FUNDAÇÃO | ~R$99 / 10 Blocos | 300 Tijolos | — |
| ESTRUTURA | ~R$249 / 25 Blocos | 1.000 Tijolos | — |
| ACABAMENTO | ~R$499 / 50 Blocos | 2.500 Tijolos | — |
| REDE | sem mensalidade | — | carteira só p/ bônus |

Fase 1: assinatura = **fatura BRL fora da carteira** + plano credita franquia mensal. Débito-da-carteira = fase 2 (só depois da régua de aviso 7/3/1, para não gerar churn silencioso). **Regra A/B do CEO:** assinatura SaaS = tenant próprio (Modelo A); só comissionamento = view no Hub (Modelo B); cliente = GUEST.

### 4.2 Comissão / Split / Código único

**[construído + testado, GATED — tabelas vazias]** — o motor saiu do papel para o código (`NegocioFinanceiroRedeSection` renderiza na ficha do negócio), mas **dorme**.

**Princípio-mãe:** *uma base, um snapshot, um trilho, duas moedas que nunca se misturam.*
- **Base do split = POTE** = `valor_fechado × percentual_comissao` (colunas já existentes em `hub_negocios`). A fatia é % do pote, **nunca** % do valor do negócio. **[decisão travada]**
- **Snapshot imutável no fechamento** — vira constraint (trigger RAISE), não convenção.
- **Cash-basis: pagar só após receber.** O Hub nunca financia a rede com caixa próprio. **[decisão travada]**
- **Comissão sacável = BRL, sempre. Tijolo nunca é comissão.**

As **4 tabelas do motor [construídas]:** `hub_split_regras` (regra, mutável, delete=arquiva) · `hub_comissoes` (SNAPSHOT append-only, `moeda CHECK('BRL')`, estorno = linha negativa) · `hub_negocio_titulos` (contas a pagar/receber por negócio, `valor_exigivel` = coração do cash-basis) · `hub_negocio_fin_movimentos` (extrato append-only). Gate de pagamento = **dupla-chave** clonada do escrow E6.

**Ciclo de vida (5 estados):** PREVISTA → **APURADA** (ganho PROPÕE, humano CONFIRMA — nunca no drag do kanban) → **EXIGÍVEL** (cliente pagou, pro-rata) → **APROVADA** (2 chaves) → **PAGA** (baixa manual + comprovante).

**Anti-pirâmide:** recompensa só sobre negócio fechado **E** recebido. Hard-stop `CHECK nivel IN (1,2)` no schema — nível 3+ não existe. Nível 2 = bônus em **Tijolos não-sacáveis** (marketing do Hub, nunca descontado do split).

**CLAWBACK — decisão travada do CEO: COBRAR SEMPRE** (título de estorno a receber). Supera o "pendente #12" dos docs de 06/jul. Precisa estar no contrato do homologado antes do 1º split real.

### 4.3 Tijolos / Blocos — créditos de IA / carteira

**[construído, roda em sombra]** — a IA está desligada, então o metering mede mas não cobra.

**Decisão-mãe: NÃO existe moeda nova.** O Tijolo já existe em prod como crédito de IA (`lib/ia/metering.ts` + `hub_ia_creditos_mov`). "Moeda ampla" = promover esse ledger a **Carteira do Tenant** (mesma tabela, migração aditiva). Criar 2ª moeda = único erro fatal.

- **Paridade:** 1 Tijolo = R$0,10 → 1 Bloco = 100 Tijolos = R$10,00. "Compra em Blocos, gasta em Tijolos", R$ sempre ao lado. Vocabulário **bancário, nunca de jogo**.
- **Fronteira regulatória (LEI):** Tijolo = crédito pré-pago de serviço próprio, **não-sacável, não-transferível**. Escrow = dinheiro real de terceiros, sacável, trilho de 2 chaves. Ponte só por referência cruzada, **nunca** transferência de valor. Tijolo sacável = e-money/BACEN = trava jurídica. Única volta Tijolo→BRL = reembolso CDC de crédito comprado não-consumido.
- **Spread da IA:** já existe (`markup` em `hub_ia_config`). Relatório "Margem de IA" (view, zero migração) dá ao dono o número para decidir spread 10x vs 3-5x.
- **Top-up fase 1 = PIX manual, baixa manual do Hub** (boleto/gateway = fase 1b). Ordem travada: **Carteira → top-up → régua de aviso → só então `IA_HARD_CAP=on`** (bloquear IA sem recarga = matar o copiloto no atendimento).

### 4.4 Escrow / Spread honesto

- **Escrow MVP = VIRTUAL/contábil** (`provedor='interno'`) — estado contábil, não dinheiro em banco real. A tela nunca promete conta bancária até a fase BaaS. "O que vende é: só paga o aprovado, dupla chave, extrato imutável — 100% entregável SEM banco."
- **Spread honesto (regra de ouro contra o medo #4):** nunca markup escondido. Dois modos transparentes — **preço-de-rede** (ganho do Hub aparece como desconto ao cliente) ou **taxa de serviço visível** (obrigatória em obra por administração). O cliente **nunca** vê `custo_fornecedor`/`spread`/**margem do Hub** — vazar a margem mata a monetização.
- **Escolher parceiro BaaS/bancarização (+KYC)** = decisão em aberto do dono.

---

## 5. As 2 Altitudes (a visão de multitenancy)

O sistema é multi-tenant **híbrido por fase** — as "altitudes" não são camadas de código, são **estágios de ativação da rede**.

| | **Altitude 1** (Hub-rede) | **Altitude 2** (Tenant/obra) |
|---|---|---|
| O que é | Hub lê acima de um tenant: MRR, comissão consolidada, ranking de fornecedores, dinheiro da rede | Um tenant opera: CRM, projeto, obra, escrow, medição, financeiro próprio |
| Estado | **[desenhada]** | **[construída]** |
| Bloqueada por | single-tenant disfarçado + comissões gated (tabelas vazias) | — |

**Estado real (não reinvente):**
- **Modelo B HOJE:** todos os papéis vivem dentro do tenant Hub sentinela; escopo por persona + ownership de linha. `current_user_tenant_id()` existe mas é estática/não versionada; policies carregam `OR tenant_id IS NULL`. É **single-tenant disfarçado de multi-tenant.**
- **Modelo A** (tenant próprio) só para quem **licencia** (SaaS), via migração local em `hub_tenants` (`tenant_type='parceiro'` + `parent_tenant_id=Hub`) — **não** re-arquitetura de RLS.
- **"Faixa B" aplicada = ENDURECIMENTO (guards anti-leak `.or→.eq`), NÃO leitura da rede.** Fechou vetores de API; o multi-tenant real (tenant dinâmico + 2º tenant + Hub-vê-tudo) **ainda não foi ligado.**

> **Implicação para o negócio:** o **cockpit do Hub-rede / "DINHEIRO DO HUB" cross-tenant é DESENHADO/ASPIRACIONAL, não construível agora.** Os dados de MRR/comissão existem em tabelas (`hub_comissao_eventos`/`_rateio`, `hub_tenant_assinatura`) mas **nenhuma tela os lê**, e ler acima de um tenant exige a rede ligada. Tratar como norte, não como pendência de UI.

**Escrow — decisão travada (03/jul), supera qualquer "chave_arquitetura" anterior:** escrow é **UNIVERSAL** (todos os pagamentos). **Duas chaves = mesma capability** (role + vínculo de linha + identidade humana distinta, nunca deduzida de rank): **Chave Hub** (pessoa física da allowlist do tenant Hub raiz) + **Chave Técnica** (responsável técnico: arquiteto em projetos, engenharia/`operation` em obras). Nunca o mesmo humano nas duas. Escrow **rejeita todo caminho não-humano** (sem worker, sem `ai_agent`). A IA nunca é chave.

---

## 6. O Cliente Final e os 5 Medos

O cliente final não é usuário do CRM — é **quem paga a obra e quer dormir tranquilo**. O **Portal do Cliente** **[desenhado, não construído]** (persona `cliente`, rota `/portal`, isolada por `negocio_id`) existe para curar 5 medos, cada bloco atacando um:

| # | Medo | Cura na tela |
|---|---|---|
| 1 | **Atrasar** | HERO prazo & avanço + Curva-S honesta (faixa, nunca promessa única) |
| 2 | **Não acabar** | veredito honesto em 1 frase + "Esta semana" (diário curado) |
| 3 | **Não saber** | timeline, selo de auditoria, "Precisa de você" (aprovações) |
| 4 | **Ser enganado** | spread honesto (nunca markup escondido); selo ⓥ auditado / ⓘ declarado / ⚠ divergência |
| 5 | **Perder dinheiro** | escrow: nunca botão [Pagar] direto, só aprovação; libera com dupla chave (cliente + Hub) |

**Regras do Portal:**
- Financeiro **bifurcado por `tipo_contrato` imutável** — administração = unitário (transparência); preço-fechado = totais (previsibilidade). Defesa **na query**: preço fechado nunca faz SELECT de unitário → não vaza composição.
- Selo de auditoria nasce **ⓘ declarado** até existir visita in loco real (honestidade — não fingir auditoria).
- "Tenho dúvidas" abre canal auditado, não rejeita.
- Acesso indevido → **404** (não vaza existência).
- MVP degrada via flags `temCronograma`/`temFinanceiro` (não inventa valor).

---

## 7. O Moat

**O moat não é o software — é o cérebro da obra.**

1. **Preditivo / dado proprietário.** Quem tem o histórico real de preço, prazo e execução de milhares de serviços prevê a obra melhor que qualquer concorrente. A planilha real do Consulado da Itália (20 abas) é o primeiro ativo de dado real; cobertura orçamentária hoje = **4,2%** (insumo honesto, não erro — é o começo da curva).
2. **Rede com efeito de trava.** Fornecedores homologados + parceiros que indicam + clientes que confiam no selo = liquidez de dois lados (marketplace "iFood da construção", **[desenhado, Fase 2/3]**).
3. **Hub como juiz de confiança.** O escrow + dupla-chave + extrato imutável vendem o produto: "só paga o aprovado". A confiança é defensável porque é auditável.
4. **Estrutura unificada.** Um item de escopo projeta 7 artefatos sem redigitar — reduz o custo marginal de operar uma obra a quase zero para o tenant. Trocar de sistema significa perder essa unificação.
5. **Rastreabilidade / linhagem.** Negócio com pai/raiz imutável = "nada se perde"; o Hub recupera, audita e prova. Nenhum concorrente de planilha faz isso.

**Anti-moat honesto (o que falta):** a IA (o motor do preditivo) está **desligada há ~60 dias**; a rede (Altitude 1) não está ligada; as comissões estão gated. O moat é real na arquitetura, **latente na operação.**

---

## 8. Fases / Versões (o esqueleto do negócio no tempo)

**Um único framework: MVP → V1 → V2 → V3.** Os demais (Sprints S1–S24, Fases 0–5, Blocos B0–B8, E0–E10/A0–A2, Ondas, Maratonas) são **sinônimos históricos** — glossário técnico, não roadmap ativo.

| Versão | Pergunta que responde | Estado real |
|---|---|---|
| **MVP** — Fundação Segura + Núcleo | 1 escritório opera sem vazar/quebrar dinheiro | Núcleo ~90–98%; segurança Fase-0 **grande parte fechada em jul**; IA nº1 ainda parada |
| **V1** — SaaS Multi-Tenant Comercial | 2..N tenants isolados + cobrança | Fundação multi-tenant flipada, mas **single-tenant de fato**; entitlements **não existem** |
| **V2** — Rede + Obra + Moat Preditivo | SO da obra + moat IA | AEC **construída em código** (Altitude 2); preditivo gated por IA off |
| **V3** — Ecossistema Enterprise | marketplace / campo / portal / billing auto | **[desenhado]**, implementação à frente |

**Caminho crítico serial (não paralelizável):** janela de infra do dono → ligar IA (MISTRAL_API_KEY) → RLS + backfill tenant → escrow correto → multi-tenant dinâmico → entitlements/gate de créditos → ativação AEC + preditivo.

**Cronograma (cenário B, 2–3 devs, recomendado):** MVP 3–4 semanas · V1 ~2 meses · V2 ~4,5–6 meses · V3 ~10–12 meses. **Maior risco de calendário = latência do dono na janela**, não horas de código.

---

## 9. Decisões Travadas (LEI — superam qualquer "pendente" em doc antigo)

- **Clawback = COBRAR SEMPRE.**
- **Base do split = POTE** (`valor_fechado × percentual_comissao`).
- **Cash-basis:** pagar só após receber; o Hub nunca financia a rede.
- **Snapshot de comissão no CONFIRMAR humano** (nunca automático no drag do kanban).
- **Anti-pirâmide:** teto 2 níveis como `CHECK`; nível 2 = bônus em Tijolos não-sacáveis.
- **Fechar linhagem:** `negocio_id` viaja negócio→projeto→obra; raiz/pai imutáveis.
- **Delete = arquiva** (o Hub nunca apaga).
- **Códigos de identidade escondidos** — chamar pelo NOME; código de ordem/documento aparece (como OS).
- **Identidade global agora** (unique PES/EMP/IMV/PRD/SVC; contador por-tenant só p/ documentos).
- **Escrow universal, 2 chaves = Chave Hub + Chave Técnica**, humanos distintos; a IA nunca é chave; voz proibida no escrow.
- **"Spawn mágico" ganho→obra = trocar por propor+confirmar** (1 clique humano) — o automático fere o pilar 2 e a decisão travada. **[verificar no Painel se já corrigido no sprint 07/jul.]**
- **Tela por OBJETO, persona = LENTE** (não duplicar telas por papel).
- **Tijolo × Escrow = moedas separadas** (trava BACEN).
- **Manual-first na monetização** (faturar 1 trilha antes de automatizar 3).

---

## 10. Decisões de Negócio em Aberto (dependem do dono)

Bloqueiam frentes de código/receita. Não inventar — perguntar:

- **Faixa × valor exato** do ticket (limiar de qualificação numérico).
- **Planos SaaS** (nomes/preços finais) + **markup de créditos** (spread 10x vs 3-5x).
- **Parceiro BaaS/bancarização (+KYC)** para escrow real.
- **Distribuição:** 1 fornecedor por lead vs 2–3 concorrentes.
- **Captação pública** (define ligar ou não o middleware em ~60 rotas).
- **Hub vê margem no preço-fechado?** (transparência vs segredo do tenant).
- **Honorário do arquiteto** (modelo de cobrança) · **NF** (anexar vs emitir) · **o que o cliente vê por modelo de contrato**.
- **Fornecedor × parceiro × empresa-cadastro** (fronteira conceitual).
- **Modelo multi-tenant A/B + quando ligar o 1º tenant real.**
- **Comodato como condição de entrada?** · **frete: repasse vs spread?** · **KPIs do fornecedor** (começar com 4: % entrega no prazo, fill rate, frescor de preço, tempo de resposta).
- **Catálogo de ~20 materiais** (bloqueante — a tela de compra abre vazia sem ele).
- **3 decisões do Consulado:** raiz nasce em ARQ ou fica em ENG (recomendação da mesa: ARQ, reancorar já) · criar `hub_produtos` agora ou deferir (recomendação: deferir) · DDL aditivo agora ou semear achatado.

---

## 11. Glossário de Superados (constam no histórico, não seguir)

- **"Agência de marketing por IA" / 28 agentes / 8 ciclos / 7 camadas / Escritório Virtual como âncora** (doc-mestre 08/mai) — a alma (3 pilares) sobreviveu; o resto é snapshot de maio. `/office` está **desativado** (redireciona `/crm`; ~8500 linhas de código morto).
- **Stack antiga:** Anthropic Claude → **Mistral-first**; Vercel → **Render** (`escritorio-virtual-1.onrender.com`, auto-deploy); Evolution API/Railway → **UAZAPI**.
- **Menu 7 gavetas** (proposta 20/mai) — o código shipou **11 gavetas** (fonte real = `lib/crm-nav-groups.ts`); nenhum doc de menu reflete navegação **por persona** (a direção atual).
- **Faseamento em "Fatias 1–6"** (DISTRIBUICAO-PLANO-CEO, 25/jun) — parcialmente executado, superado pelo sprint 07/jul (Leads rebuild · Funil do Hub · O que travou · Dashboard andares · Cadastros).
- **Specs originais** de comissões/monetização/créditos — refinadas pelos docs de 06/jul.
- **Tabelas-fantasma por ofício** (`hub_marcenaria`, `hub_vidracaria`) — a aposentar; fornecedor = conta multi-tenant.
- **`crm_commissions`** (tabela morta) — não reusar; nomes `hub_*` novos.
- **Metas/cronograma de 27/05/2026** — passaram; valor histórico.

---

*Fim do master. Companheiros vivos: Produto & UX · Arquitetura, Dados & Segurança · Financeiro & Motor · Painel de Controle (00-PAINEL-DE-CONTROLE.md).*
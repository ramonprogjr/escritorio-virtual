# Plano de Negócio — Obra10+ · o trilho da construção (Brasil / São Paulo · jul 2026)

> **Insumo do dono (07/jul/2026).** Plano de negócio completo — a camada de ESTRATÉGIA & MERCADO.
> **Incorporado aos 5 docs vivos:** é a fonte profunda do **[01-NEGOCIO-E-ESTRATEGIA](01-NEGOCIO-E-ESTRATEGIA.md)**;
> a ponte "Falhas → Possibilidades" entra no **[04-ROADMAP](04-ROADMAP-E-PLANO.md)**; o beachhead + calendário no **[00-Painel](00-PAINEL-DE-CONTROLE.md)**.
> **Ressalva:** tickets, %, e unit economics são **ILUSTRATIVOS** (o sistema ainda não mede LTV/CAC) — validar com dado real.
> Preservado aqui na íntegra (fonte/histórico).

## Tese
A construção é o **maior mercado do país sem um trilho único**. Hoje o cliente atravessa imóvel → arquitetura → obra →
marcenaria → serviços → materiais **trocando de fornecedor, de sistema e de confiança a cada elo**. O Obra10+ é o único
lugar onde esse cliente atravessa tudo **sem sair do trilho** — e onde cada travessia gera **receita e dado**. A honestidade
é a arquitetura: **o Hub é juiz, não parte.**

## 1. O negócio
Não é um CRM: é um **rail (trilho) transacional multi-vertical**. Asset-light (modelo iFood/Mercado Livre): o Hub
**orquestra**, o fornecedor **executa**, o cliente **paga por dentro do trilho**, o Hub **retém uma fatia + audita**. Nunca
compra material, nunca contrata pedreiro, nunca assume responsabilidade técnica. Possui **o trilho, a demanda, o dado e a custódia**.
- **Missão:** organizar a cadeia num único trilho confiável — do 1º clique ao último pagamento.
- **Visão:** ser a infraestrutura por onde passa a demanda da construção no Brasil → maior organizador de fornecedores/MDO/materiais da AL.

## 2. Problema & dores (4 dores reais)
| Dor | Quem sofre | Como o Hub cura |
|---|---|---|
| A demanda se perde entre elos | corretor, arquiteto, engenheiro | **código único tipo-CPF + linhagem** — o lead nunca perde origem nem comissão |
| A confiança é o gargalo | cliente final (os 5 medos) | **escrow + auditoria** — o Hub é juiz, incapaz de esconder a verdade |
| Fornecedor bom de ofício, ruim de gestão | escritórios, prestadores, lojas | dá a **COLUNA** (CRM+funil+copiloto+EAP+financeiro) sem ele montar sistema |
| Ninguém cobra a rede de forma justa | toda a cadeia | **split por código único** por cima da transação, como juiz que audita |

**Os 5 medos do cliente** (a régua de UX): 1·Atrasar · 2·Não acabar · 3·Não saber · 4·**Ser enganado** · 5·Perder dinheiro.
O **medo #4 é o wedge de maior valor** (o escrow é o argumento de venda mais forte).

## 3. Mercado — Brasil & SP (dados reais, jul/2026)
**Brasil:** PIB construção +2,3% (>3mi empregos·CBIC) · varejo material **R$ 238,9 bi** (160.627 lojas·Anamaco) · **69,5%** das lojas têm ≤4 func. · **82%** construtoras com escassez de MDO.
**SP capital:** 139.654 unidades lançadas 2025 (+34%) · ~113k vendidas · **85.200 em estoque** (+41% = mercado de comprador) · CUB-SP **R$ 2.221/m²**.
**3 ventos a favor:** (1) estoque alto = mais imóveis trocando de mãos = mais **nascentes do flywheel**; (2) **Reforma Casa Brasil (R$ 40 bi)** despeja demanda financiada que **precisa** do controle do Hub (orçamento auditado+escrow+homologado); (3) escassez de MDO torna o **cadastro qualificado de MDO** um ativo.

**Por vertical (foco SP):** Imóvel (~113k/ano · topo de funil, take fino 1–3%, ancora o cliente) · Arquitetura (honorário 8–12% · **wedge de entrada de maior confiança**) · Obra/Reforma (R$ 80k–600k · **maior pote**, escrow+auditoria é o diferencial, take 3–8%) · Serviços/MDO (take 10–20%, giro semanal, cadastro vira ativo) · Materiais (R$ 238,9 bi · organizar as 160k lojas, não competir com Leroy) · SaaS (**1ª torneira a cobrar**).

## 4. Modelo — 3 torneiras + 8 candidatas
| Torneira | Natureza | Como cobra | Estado |
|---|---|---|---|
| **T1 · Assinatura SaaS (MRR)** | aluguel de software | mensalidade + seats + módulos + franquia de Tijolos | DESENHADO |
| **T2 · Comissão da rede** | take transacional, split | POTE = valor fechado × % → 1 transação, N beneficiários por código único | **MOTOR PRONTO, REPRESADO** |
| **T3 · Créditos de IA (Tijolos)** | consumo com spread | metering com markup 10× sobre o custo do LLM | MODO SOMBRA |

**+8 candidatas:** spread de materiais · corretagem · serviços/MDO · float do escrow · analytics preditivo · destaque/publicidade · homologação · taxas acessórias.
**Regra que blinda (fronteira regulatória):** ação humana = grátis (no plano); IA = **Tijolos** (crédito pré-pago, não sacável); comissão+físico = **BRL sempre, nunca converte**. Ledgers fisicamente separados (trava no schema `moeda CHECK='BRL'`) — evita virar e-money/BACEN.

## 5. Processos & fluxos
- **2 altitudes:** Altitude 1 (Hub acima da rede — desenhado) ↔ Altitude 2 (dentro do tenant — no ar), ligadas por "read-only + auditoria".
- **Fluxo-mãe:** `1·CAPTADA(mercado+origem) → 2·ROTEADA(score top-5) → 3·ACEITA(vira negócio) → 4·ENTREGA(gate humano) → 5·PAGA(escrow 2 chaves) → 6·COMISSÃO(split)`.
- **Motor de roteamento (score):** mercado+40 · cidade+30 · carga · homologado+10 · bloqueado −40 → Top-5 → humano aprova → gate financeiro (parceiro em dia?) → handoff OU cascata.
- **Mercado → entrega:** ARQ→`hub_projetos` · ENG/RFM→`hub_obras`+EAP → medição→escrow · SRV→`hub_servicos` · MRC/MMR/VDR→ofício · IMB→fechamento (**a corrigir — hoje vai p/ obra**). **Regra dura:** ganhar **não** cria entrega sozinho — gate humano sempre.

## 6. O flywheel & as conexões
Cada fechamento é **nascente de demanda em outro mercado**: `IMÓVEL → REFORMA → ARQUITETURA → OBRA+escrow → MATERIAIS/SERVIÇOS → ASSINA+INDICA → (novo lead) → IMÓVEL`. O Hub fatura **em cada salto** (1–3% imóvel · honorário · take obra · spread material · 10–20% serviço · MRR).
**Crown jewel (leitura estratégica):** tudo converge para **DADO DE EXECUÇÃO** + **HISTÓRICO DE MDO** — deles nascem predição (marketplace), **CUB proprietário por bairro**, score de fornecedor, produto de MDO. Só quem tem o trilho inteiro coleta o dado inteiro.

### ★ Matriz Mercados × Fontes de Receita
Cada mercado alimenta **várias** torneiras; cada torneira é alimentada por **vários** mercados — a sobreposição faz o take de um cliente ser **muito maior que a soma das partes**.
**Leitura reversa (quem alimenta cada fonte):** T1 SaaS← Arq·Obra·Materiais · T2 Comissão← todos (pote maior em Obra) · T3 Tijolos← Arq·Obra · C1 Spread← Obra·Marcenaria·Materiais · C2 Corretagem← Imóvel · C4 Float← Obra·Imóvel · C5 Dados/CUB← Obra·MDO·Materiais (crown jewel) · C6 Ads← Materiais·todos · C7 Homologação← Fornecedor·MDO.
**Conclusão:** **a Obra é o nó de maior conexão** (alimenta 6 das 9 fontes) → a entrada ancora em **Reforma/Obra**. Materiais é o nó que mais **escala**, mas depende da obra p/ demanda → **Onda 2**.

## 7. Matriz de oportunidades (gap que bloqueia → alavanca SP)
T1 SaaS [D · MET-05] · T2 Comissão [R · FIN-01+RLS vínculos] · T3 Tijolos [R · MET-01/03/04] · C1 Spread materiais [D · OBR-01+marketplace] · C2 Corretagem [D · EST-02+captado_por] · C3 Serviços/MDO [D · RAS-05] · C4 Float escrow [D · banco+jurídico] · C5 Analytics/CUB [D · Altitude 1+anonimização] · C6 Ads [D · gancho existe] · C7 Homologação/selo [D · engenharia auditorial] · C8 Taxas acessórias [D · fase 1b].

## 8. Falhas → Possibilidades (o gap técnico como alavanca)
| Falha / gap | O que impede hoje | Possibilidade que destrava | Prio |
|---|---|---|---|
| **Linhagem não escrita** | não sabe de qual imóvel nasceu a obra (7 órfãos) | medir cross-sell → provar LTV multi-vertical → **métrica que vende a rede a investidor** | **P0** |
| **Receita não ligada (R$0)** | opera de graça, queima capital | ligar T1/T2/T3 → sair do zero, provar circuito de cobrança | **P0** |
| Especialista é ilha | "quem executou" irrastreável | cadastro+histórico de MDO → produto standalone (82% escassez) | P1 |
| Analytics não lê eventos / sem UTM | CAC por canal incalculável | medir CAC por bairro/mercado → marketing cirúrgico em SP | P1 |
| Sem CUB proprietário | orça como todos | benchmark custo/m² por bairro → dado vendável que ninguém tem | P2 |
| Marketplace não existe | não captura o varejo | organizar 160k lojas via SaaS+demanda | P2 |
| Portal do cliente 0% | não retém pós-obra | prova social → CAC de indicação despenca no alto padrão | P1 |
| Single-tenant frágil | não abre a rede com segurança | endurecer → 2º tenant → a rede e a Altitude 1 nascem | P0(rede) |

## 9. Drivers por vertical
Imóvel (ticket alto·ciclo longo·take 1–3%) · Arquitetura (médio·take 3–8%) · Obra (altíssimo·meses·3–8%) · Serviços/MDO (baixo·horas·**10–20%**·giro alto) · Materiais (médio·muito curto·5–15%·densidade altíssima 160k) · SaaS (MRR).
**Leitura:** obra/imóvel = volume esporádico (pagam o CAC, caixa irregular); serviços/materiais = **giro contínuo** (liquidez semanal). A combinação **suaviza o caixa**. Densidade altíssima em serviços/materiais = SP é o lugar certo (custo de servir cai com concentração).

## 10. Estratégia de entrada — beachhead SP
🎯 **O wedge:** **Reforma & Arquitetura de médio-alto padrão na Zona Oeste/Sul** (Pinheiros, Vila Madalena, Perdizes, Vila Mariana, Moema, Itaim), ancorada na **Arquitetura como nascente** e no **escrow+auditoria como wedge de confiança**.
**Por quê:** ticket alto paga o CAC (reforma R$ 150k–800k) · dor de confiança máxima (medo #4) · densidade geográfica (1 engenheiro-auditor cobre muitas obras num raio pequeno) · **é onde o dono já opera (tenant zero)**.
**Ondas:** 1) Reforma+Arq alto padrão Zona O/S · 2) +Materiais e Serviços na mesma obra (cross-sell+MDO) · 3) MCMV volume Zona L/S · 4) SaaS lojas de bairro + marketplace · 5) Grande SP → interior → capitais.
**Princípio:** dominar um raio pequeno com **profundidade total** antes de ampliar (densidade primeiro, cobertura depois — bairro a bairro, como iFood/Rappi).

## 11. Leituras não-óbvias
Estoque alto de SP = combustível (ancore no **momento da compra**) · não competir com Leroy (dar SaaS+demanda às 160k lojas) · escassez de MDO = moat mais forte · **Reforma Casa Brasil pede exatamente o controle do Hub** · **CUB proprietário = crown jewel de dados** · **escrow é wedge, não feature** ("o único jeito de reformar sem medo").

## 12. Concorrência & moat
Há concorrentes por vertical isolada; **nenhum unificado**. CRM de obra tem o dado, não a rede; portal de leads tem o lead, não o ciclo/custódia; marketplace de material tem a transação, não o dado de execução; corretagem perde o cliente no dia seguinte.
**Moat = tripé rede × dado × confiança:** o Obra10+ tem o **trilho inteiro** (lead→obra→pagamento) → tem o **dado inteiro** → defende o take-rate. Empilhar SaaS+comissão+IA sobre a mesma rede = jogada Shopify/Mercado Livre numa vertical que ninguém unificou.

## 13. Estado (honesto)
**~40%** da visão · **~70%** de um MVP single-tenant seguro · **R$ 0** de receita recorrente · **1** tenant real (a operação do dono).
Construído e no ar: CRM do tenant, roteamento, esteira, telas do dinheiro, rastreabilidade (~80%). Represado: comissões (testado), escrow E6, obra/EAP. Desenhado: Altitude 1, billing SaaS, Portal, marketplace, **linhagem escrita pelo app**. Desligado: IA (Mistral sem chave).
**Verdade dura:** a operação real ainda roda **fora do sistema** (planilha), e o sistema **já movimentou R$ 15k de escrow** por uma camada não aplicada. O plano existe para fechar essas duas coisas primeiro. Detalhe técnico: **[CADERNO-ENGENHARIA-AUDITORIA.md](CADERNO-ENGENHARIA-AUDITORIA.md)** (37 fichas).

## 14. Roadmap (Fase 0–8)
`0 travar linhagem → 1 ligar IA → 2 aplicar represado (escrow+comissões) → 3 operar SEM planilha (MVP) → 4 LIGAR RECEITA → 5 endurecer p/ rede → 6 2º tenant → 7 Portal+Altitude 1 → 8 marketplace+escala`.
Critérios de pronto (binário) por fase — ver **[04-ROADMAP](04-ROADMAP-E-PLANO.md)**. **Meta de calendário: Fases 0–3 (o MVP que tira da planilha) em UM TRIMESTRE; Fase 4 (cobrar) logo em seguida.**

## 15. Unit economics (ILUSTRATIVO — a validar)
Um cliente alto padrão em SP atravessando o flywheel: Imóvel R$900k (0,5%→R$4.500) · Arquitetura R$50k (6%→R$3.000) · Obra R$300k (5%→R$15.000) · Materiais R$90k (8%→R$7.200) · Serviços R$70k (12%→R$8.400) · IA R$600. **Total GMV ~R$1,4M · take ~2,8% · ~R$ 38.700 ao Hub** — vs. ~R$4.500 de um concorrente que só intermediou o imóvel. CAC pago **uma vez** (no imóvel); o resto é incremental; o engenheiro que executou vira **MRR + fonte de novos clientes**. Take blended = (comissão+MRR)÷GMV — **hoje zero na tela**, 1º KPI a acender com a Altitude 1.

## 16. Riscos & mitigações
Perfeccionismo queima capital (Crítica → meta binária de MVP, prazo fechado, régua "isto me aproxima de cobrar?") · **Perda irreversível da linhagem (em curso, Alta → Fase 0 esta semana)** · Bus factor (Crítica → runbook, delegar frentes) · **Dinheiro de terceiros em camada não aplicada (Crítica → corrigir escrow ANTES da janela, limitar valores)** · Vazamento cross-tenant (Crítica → gate absoluto: 2º tenant só após checklist) · Dispersão de escopo (Alta → beachhead SP) · WhatsApp/IA single-provider (Média → provider-agnóstico já existe).

## 17. Estrutura, capital & internacional
**Bootstrapped** (capital do fundador — controle total, mas queima pessoal → velocidade até receita é sobrevivência; capital externo natural na Fase 8). **Time:** fundador (operação+produto+juiz do escrow) · Ramon (chefe dos devs) · sócio italiano (Europa). **Governança:** reduzir bus factor.
**Internacional (trilha paralela, sem hora de dev antes da Fase 6):** EUA (verticais digitais viajam — projeto/serviço remoto; teste barato medido por UTM) · Europa (dever de casa do sócio: regulação de custódia UE, Fase 8+). **Providência técnica desde já:** não criar novas premissas fixas de moeda/idioma/fuso.
**A regra que rege tudo:** **você é o tenant zero.** Rede, marketplace, EUA, Europa, patente são **consequência** de um tenant zero rodando redondo — nunca pré-requisito.

---

*Fontes (jul/2026): Anamaco · Secovi-SP · Sinduscon-SP · CBIC · Gov.br (Reforma Casa Brasil). Tickets/%/unit economics ilustrativos — validar com dado real.*

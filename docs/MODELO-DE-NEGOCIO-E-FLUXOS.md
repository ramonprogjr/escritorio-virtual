# Obra10+ / Escritório Virtual — Modelo de Negócio & Fluxos (a LENTE)

> Documento-mãe. Serve a UM propósito: ser a **lente** pela qual toda tela e toda decisão passa —
> *"isso serve o modelo?"*. Se uma tela não reflete algo aqui, ela está errada, não o modelo.
> Síntese do CEO técnico (07/jul/2026), ancorada na memória do projeto, no código real e nas 2 mesas
> Fable (home em camadas + arquitetura das 2 altitudes). Honesto sobre o que está **construído** vs **desenhado**.

---

## 1. A tese (o que o Hub É), em um parágrafo

O Hub **não é um CRM**. É um **marketplace / rail multi-vertical da construção e serviços**: ele
**capta** demanda (de qualquer canal), **roteia** cada lead para o parceiro/vertical certo por um
**motor dedicado de direcionamento**, e então **gere por cima** o negócio → projeto → obra →
**pagamento**, tirando a sua parte (comissão) e cobrando assinatura (SaaS). O CRM é só a superfície
onde o tenant opera; o **negócio do Hub é ser o trilho e o juiz da rede**.

## 2. As duas altitudes (a espinha da navegação)

| Altitude | Quem | O que vê/faz | Estado |
|---|---|---|---|
| **1 — Hub (acima da rede)** | o dono da plataforma | a REDE toda: dinheiro por vertical, roteamento, saúde dos parceiros; e **desce** para dentro de qualquer tenant | **DESENHADA, não construída** (hoje single-tenant) |
| **2 — Dentro do tenant** | o dono operando OU o fornecedor | o CRM daquele tenant: leads, negócios, obras, dinheiro — pra onde o lead cai | **construída** (é o que existe hoje) |

Regra dura: **"só o dono do tenant MOVE; o Hub VÊ TUDO."** Quando o Hub entrar num tenant (altitude 2
cross-conta), é **observação read-only + trilha de auditoria** — nunca ação silenciosa.

## 3. As verticais (mercados) — uma coluna, motores diferentes

Imóvel · Arquitetura · Engenharia/Obra · Serviços · Produtos · **SaaS (a assinatura do próprio Hub)**.
Cada uma tem **motor de venda e ciclo próprios** (imóvel = ticket alto/ciclo longo; obra = ticket
altíssimo/meses/escrow; produto = volume/transacional; SaaS = MRR). **Nunca achatar num funil só** —
o "Funil comercial" genérico é OK **dentro do tenant**, e **disfuncional no Hub**. No Hub, o funil é
o **Funil do Hub** (§4). Verticais convivem sobre **uma coluna** (Hub + verticais em camadas).

## 4. O fluxo-mãe (o rail que dá dinheiro)

```
                          [2 etiquetas do lead: MERCADO (o quê) + ORIGEM (como veio)]
DEMANDA CAPTADA  →  ROTEADA  →  ACEITA  →  PROJETO/OBRA  →  PAGA  →  COMISSÃO
 (tráfego, WhatsApp,   (motor de     (virou      (execução:      (escrow    (split da rede
  indicação, manual)   direciona-    negócio      arquitetura/    libera)     por código único)
                       mento)        c/ parceiro) engenharia)
```

- **Captação**: o lead entra por qualquer canal e é **sempre direcionado ao CRM do tenant** (é por isso
  que existe um motor SÓ de direcionamento). Carrega **mercado + origem** desde a entrada.
- **Roteamento**: motor de distribuição — **MESTRE × VINCULADO**, por score / SLA / 3 modos. É o coração.
- **Aceite → Execução**: vira negócio; arquitetura/engenharia executam; obra tem cronograma = orçamento =
  gestão = **ESCOPO único** (ambiente → serviço → material + mão de obra).
- **Pagamento**: **escrow** — o Hub **determina** o pagamento; o parceiro dá só o **OK** (2ª chave técnica:
  arquiteto OU engenheiro). Cash-basis: comissão só paga **depois** que o cliente paga.

O **Funil do Hub** (já no ar) mede este rail como **coorte de leads**: Captada → Roteada → Aceita →
Execução → Ganha, cada elo subconjunto do anterior (conversão nunca >100%), fatiável por mercado/origem.

## 5. Como o Hub ganha dinheiro (3 torneiras)

1. **Assinatura SaaS (MRR)** — o tenant paga pra usar a plataforma.
2. **Comissão da rede** — split por **código único** a cada elo do negócio (o take-rate do marketplace).
3. **Créditos de IA / metering** — **Tijolos** (moeda; Tijolos/Blocos 100:1), pré-pagos, medindo o uso de IA.

> Métrica-mãe do dono-da-plataforma: **take blended da rede** = (comissão + MRR) ÷ GMV. Hoje **zero na
> tela** — depende da altitude 1 (leitura cross-tenant), que é **build faseado, não janela**.

## 6. A confiança (por que a rede fica) — o cofre e a memória

- **Escrow universal**: o Hub é **juiz**; dinheiro preso libera na dupla-chave. Protege cliente e parceiro.
- **Rastreabilidade total**: linhagem **pai/raiz**, ID imutável, grafo em Postgres — **"nada se perde"**.
  (Hoje **meio-construída**: o vínculo lead↔negócio vive em `hub_negocio_vinculos`; 7 negócios já entram
  "sem lead de origem" — a linhagem precisa fechar.)
- **Delete só arquiva** — o Hub nunca apaga.
- **Identidade esconde** (chama pelo NOME); **ordem/documento aparece** (como uma OS).

## 7. O cliente final (a alma) — os 5 medos

Portal do Cliente que cura os 5 medos: **atrasar · não acabar · não saber · ser enganado · perder dinheiro**.
Toda decisão de produto na ponta do cliente se justifica por curar um desses medos.

## 8. Os papéis (personas)

- **Dono da plataforma** (você) — altitude 1 + opera altitude 2.
- **Tenant/fornecedor** — gestor, comercial, financeiro, atendente (papéis internos da agência).
- **Parceiro** — recebe leads roteados; tenant próprio ou view; atribuição via link HMAC assinado ("quem convidou").
- **Especialista** — mão de obra, sem login, vinculado ao fornecedor.
- **Cliente final** — o Portal.

## 9. Princípios de produto (as leis)

1. **Click-and-Go** — escolher e confirmar, ≤3 cliques; não digitar o que dá pra clicar. (+ Talk-and-Go via voz.)
2. **IA-first / conversacional** — a IA resolve a complexidade e **mostra o que fez sozinha** (nunca muda).
3. **Fonte única, várias lentes** — nada de telas duplicadas; o mesmo dado, fatiado (ex.: pipelines junto/separado).
4. **O espaço vale ouro** — número puro parado é banido: ou vira **ação**, ou vira **tendência** (drill-in).
5. **Honestidade de dado** — nunca número falso; o que depende de janela aparece como "acende na janela".

## 10. Construído vs desenhado (a verdade, sem fachada)

**Construído e no ar:** CRM do tenant (leads/negócios/obras/pedidos); motor de direcionamento de leads;
ciclo do lead (posição×prontidão); Propostas com ciclo de vida; telas do dinheiro (split, Meu Dinheiro,
undo-baixa); motor de comissões (4 tabelas + RPCs) e escrow (dormente); Tijolos no metering; **Funil do Hub**
(coorte, mercado/origem); tela de Leads reestruturada (barra de comando única).

**Desenhado, NÃO construído:** **altitude 1** (Hub lê a rede toda + entra no CRM de outro tenant) — papel
de plataforma está **morto no runtime**, não há impersonação nem leitura cross-tenant, `hub_tenants` não
modela a hierarquia; **Dinheiro do Hub** na tela (depende da altitude 1); rastreabilidade completa; IA
ligada de fato (**Mistral desligada** — hoje "sem IA"); WhatsApp (UAZAPI).

> ⚠️ **Armadilha de nome:** a "Faixa B" **já aplicada** é *endurecimento de segurança*, **NÃO** a leitura
> da rede. A leitura cross-tenant continua **fechada** e é **build**, não janela de 10 minutos.

## 11. Como cada tela deve refletir o modelo (a lente em uso)

- **Dashboard (home)** = **2 altitudes em camadas**: estratégico da rede em cima (dinheiro por vertical,
  Funil do Hub, saúde) + operacional por exceção embaixo. Hoje: Funil do Hub entregue; Dinheiro do Hub
  aguarda altitude 1.
- **Funil**: **do Hub** (rail, coorte) na altitude 1; **de vendas** (estágios do mercado) dentro do tenant.
- **Pipelines**: **junto** (Hub, fatiado por mercado/origem) ↔ **separado** (por mercado, ao descer).
- **Cadastros**: fonte única, criar-e-vincular na hora, código escondido.
- **Financeiro**: cash-basis, escrow como juiz, comissão por código único.

---

*Esta lente é viva. Quando o modelo evoluir (ex.: abrir a altitude 1), este documento muda primeiro — e as
telas seguem. Se quiser, jogo esta lente numa mesa adversarial pra furar o que eu ainda não entendi.*

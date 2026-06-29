# "iFood da construção" + Pedidos compartilhado — insumo do dono (29/jun)

> Visão do dono + minha avaliação pragmática (ele pediu honestidade). Liga a [[servicos-cadeia-contratacao-monetizacao]], [[backlog-features-futuras]] (já tinha "compras totem/iFood com SPREAD"), E5 (compras→estoque).

## A visão do dono
- **Venda de produtos, materiais, eletros, ferramentas** + **aluguel de equipamentos** sob demanda.
- O **"iFood da construção"**: comprar e **receber rápido**.
- **Todos compartilham o campo/módulo PEDIDOS.**
- **Dor real que resolve:** o peão esquece de comprar material → perde tempo indo comprar, OU **mão de obra parada** por falta de material. Comprar+entregar rápido mata essa dor.

## Minha avaliação (pragmática e honesta) — resumo
**Concordo que é diferencial REAL.** A dor (stockout → mão de obra ociosa) é das mais caras e diárias da obra. MAS o ouro não é "entregar rápido" — é **"o sistema sabe que você vai precisar ANTES de você"** (preditivo), porque só nós temos o cérebro da obra (EAP, cronograma, estoque E5, bloqueio "falta material" E3). Nenhum app genérico faz isso. **Esse é o fosso.**

**Cautela honesta:** o difícil é a LOGÍSTICA, não o software. Material é pesado/volumoso/variado — entregar rápido é mais caro que pizza. Então:
- **Asset-light:** Obra10 **orquestra**, NÃO estoca nem roda frota. Os **fornecedores da rede** (que já passam pelo onboarding) cumprem/entregam; Obra10 é o trilho + a demanda + a inteligência preditiva + o escrow/pagamento + o **spread**. (iFood não cozinha; restaurante cozinha.)
- **Regional primeiro:** só funciona com densidade de fornecedor+obra. Começar em 1 praça densa, não nacional.
- **É fase 2+,** não MVP. O cérebro da obra (que estamos construindo agora) é o que GERA o sinal de demanda que torna o marketplace valioso.

## Faseamento recomendado
1. **Agora (E5):** Pedidos/SC → estoque + o elo "falta material" (E3) → pedido. É a FUNDAÇÃO (o objeto pedido + o sinal de demanda). **Pedidos já nasce compartilhado por todos** (como o dono quer).
2. **Fase 2 (marketplace asset-light):** Pedidos vira marketplace — catálogo de fornecedor com preço/disponibilidade; o pedido **roteia pro melhor fornecedor da rede**, que cumpre/entrega; Obra10 fica com spread + escrow. **Preditivo:** o sistema sugere o pedido a partir do EAP/cronograma antes do stockout. Aluguel de equipamento = categoria do catálogo (corretora de locação, asset-light).
3. **Fase 3 (se volume+densidade justificarem):** logística própria/parceira p/ "velocidade iFood" real nas praças densas.

**Veredito:** sim, construir — mas **asset-light, preditivo (o cérebro é o moat), regional, em fases.** A fundação (E5) já está no plano; o resto pluga nela.

## O FLUXO concreto (detalhado pelo dono, 29/jun)
1. **Cadastrar empresas** vendedoras (produtos/materiais/eletros) = contas fornecedor.
2. Usuário escolhe o material **por voz/IA ou input**.
3. Sistema **localiza os fornecedores mais próximos** (geolocalização).
4. Envia a solicitação **com os preços da nossa base** — que o **próprio fornecedor mantém atualizados na conta dele** (self-service). **Orçamento sob demanda = EXCEÇÃO** (fallback quando não há preço/catálogo).
5. **Todos os (próximos) notificados** da necessidade.
6. **Aprovação + pagamento** → fornecedor **entrega no prazo previsto** (se urgente, **no tempo determinado**).
7. **Acompanhamento ponta a ponta, como o iFood** (tracking do pedido).
8. Monetização: **spread por produto** → "a máquina de venda de materiais".
→ Confirma o asset-light: fornecedor = preço+estoque+entrega; Obra10 = matching geo + base de preços + tracking + escrow + **spread**.

## Pontos pragmáticos a decidir (design do marketplace)
- **Frescor de preço + confiança:** self-service é certo, mas precisa de selo "atualizado em X" + **trava do preço no momento do pedido** (evita disputa de preço velho) + incentivo p/ o fornecedor manter (ex.: sem preço fresco, não aparece no topo).
- **Modelo de matching:** broadcast aos N mais próximos e — (a) 1º a aceitar / (b) melhor preço / (c) **ranking preço+distância+score SLA**. Recomendo **(c)** com fallback: justo com o fornecedor, sem spam.
- **Transparência do SPREAD (crítico p/ a régua "sem mentiras"):** o spread tem que ser HONESTO. Em obra por **administração** o cliente vê unitário → o spread não pode ser markup escondido. Opções: **taxa de serviço transparente** OU **preço-de-rede (atacado)** onde o cliente já ganha vs comprar sozinho. Decidir p/ não colidir com o "medo de ser enganado".
- **Garantia de SLA de entrega:** o fornecedor compromete o prazo; Obra10 rastreia + **pontua (score)** + impacta ranking/escrow se furar. O **escrow é a alavanca** (só paga na entrega confirmada).
- **Cold-start:** precisa de densidade de fornecedores com catálogo fresco numa praça antes de abrir → estratégia regional.

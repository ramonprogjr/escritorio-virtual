# Portal do Cliente + os MEDOS (a alma do produto) — insumo do dono (29/jun)

> O dono é **engenheiro civil + corretor de imóveis**, lidou com clientes e arquitetos a vida inteira. O sistema foi pensado para **retirar dores REAIS**. Este doc é a diretriz-mãe do **Portal do Cliente** e do princípio de design "a tela mostra a CURA do medo". Fé do dono: **Jesus Cristo em primeiro lugar.**

## O CLIENTE tem que ter um usuário próprio
Persona nova: o **cliente final da obra** (quem contrata o arquiteto/engenheiro). Ele precisa **VER, APROVAR e ACOMPANHAR** — basicamente: **avanço, relatórios, financeiro, cronogramas**.

**NÃO é a interface de obra** (a pesada/engessada/enorme do gestor). É uma visão **curada, dashboard-first + analytics**, realista e honesta.

### Estrutura (espelha o sistema: dashboard primeiro)
- **Dashboard** (home) — a visão realista e honesta, de cara.
  - dentro dele: **Relatórios**, **Diário de obra**, **Setor de Fotos e Vídeos** (visão realista, ver com os próprios olhos), **Financeiro**, **Cronograma/avanço**.
- A **interface de ligação entre o arquiteto e a obra** — mas **SEMPRE através do Hub**, que é o **ponto de auditoria e controle**. O cliente não fala direto com a obra; o Hub media e audita.

## Os MEDOS do cliente → a tela tem que mostrar a CURA + segurança
O dono pensa nos medos; o cliente tem que **enxergar na tela a cura** deles. Os principais:
1. **Medo de atrasar** → cura: cronograma honesto (previsto × realizado), Curva S, próximos marcos, alerta de atraso sem esconder.
2. **Medo de não acabar a obra** → cura: avanço físico real + saúde da obra + marcos cumpridos, com transparência.
3. **Medo de não saber o que está acontecendo** → cura: diário de obra + fotos/vídeos (realista), avanço ao vivo, "o que aconteceu esta semana".
4. **Medo de ser enganado** → cura: **selo de auditoria do Hub** (cada número verificado), transparência, sem maquiagem.
5. **Medo de perder dinheiro** → cura: financeiro claro (pago × a pagar × saldo), sem surpresas, gate humano em tudo que é dinheiro.

**Princípio:** visão **honesta e justa para o mercado, sem mentiras, com controle.** A honestidade É o diferencial de confiança. Cada elemento de tela do cliente deve mapear a um medo → cura.

## Por que o Hub tem auditoria rigorosa (Arq + Eng)
Por isso o **módulo de Arquitetura e Engenharia do Hub** terá um **processo muito claro e rigoroso de auditoria, de conduta, de qualidade, de segurança**. O Hub é o ponto de controle que garante que o que o cliente vê é verdade.

**Time real que suporta o Hub** (estrutura da empresa do dono, hoje): **engenheiros, arquitetos, engenheiros de segurança, advogados, contadores.** Esses papéis dão lastro à auditoria/conduta/qualidade/segurança/jurídico/fiscal do Hub.

## Onde encaixa no roadmap (a definir com o dono)
- Nova trilha: **Portal do Cliente** (persona + login próprios, dashboard-first, read-mostly + aprovações). Depende de: avanço (E2/E4), financeiro (E6), diário/fotos (E8 RDO), cronograma (E4). Consome o que os módulos de obra produzem, **curado e auditado pelo Hub**.
- Camada Hub: **auditoria/conduta/qualidade/segurança** como processo (o "selo" que o cliente vê) — papéis: eng/arq/seg/advogado/contador.

## Perguntas em aberto p/ o dono (ele convidou — é especialista)
1. **Escopo de transparência:** o cliente vê TUDO (inclusive custo de fornecedor/margem) ou um subconjunto honesto (avanço, cronograma, **os pagamentos DELE**, aprovações, fotos) sem os custos internos/margem do escritório?
2. **O selo de auditoria:** automático (IA+regras) com revisão humana por amostragem, ou todo relatório ao cliente exige assinatura humana do time do Hub (eng/seg) antes de publicar?
3. **O que o cliente APROVA na obra** (≠ aprovações de projeto do arquiteto): medições? aditivos? mudanças de escopo? marcos?
4. **Comunicação:** o cliente comenta/pede ajustes pela tela (vira pendência auditada no Hub) ou só visualiza + aprova?

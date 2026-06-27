# Carteira de Tijolos  ·  IA e Agentes

**Rota:** 

## Veredito do diretor
Tela bem-construída, honesta e visualmente coesa (dark verde+dourado), com abstração excelente para o usuário final (Tijolos / Turbo / Econômico esconde LLM e BRL). Mas hoje ela é meio produto: explica e observa, não deixa AGIR. Como Tijolos é a moeda PRÉ-PAGA e pilar de monetização da plataforma, uma carteira sem botão de recarga não fecha o ciclo nem completa o JOB (decidir e recarregar) — fere as premissas #1 (3 cliques: recarregar é impossível aqui) e #5 (útil). O segundo furo é que os números não são acionáveis: saldo sem projeção/semáforo e 'Consumido nas últimas 50 ações' não respondem 'quanto dura?' nem 'gastei mais que antes?'. A oportunidade IA-first verdadeira desta tela ainda não foi explorada: a IA já DEBITA Tijolos, mas não PREVÊ esgotamento nem SUGERE recarga no momento certo. Veredito: base aprovada, não relançar do zero — adicionar a camada de AÇÃO (recarga) e a camada de DECISÃO (projeção), aditivamente.

## Cenários trazidos
- A QUEM A TELA SERVE — comercial vs hub: Cenário A (servir o gestor do escritório/fornecedor, padrão hoje): foco em 'quanto tenho, quanto dura, recarregar' — simples, autossuficiente, recarga self-service. Cenário B (servir o hub/operadora da rede): a mesma tela vira ponto de receita transacional, com pacotes precificados, upsell e telemetria de consumo por tenant. Recomendado: construir para A na superfície (UX do fornecedor) mas instrumentar para B no backend (consumo/recarga viram eventos de receita em hub_eventos). Não bifurcar a tela; uma só carteira que serve os dois.
- FORMATO DO EXTRATO — manter lista vs virar cartões: a lista enxuta atual já respeita 'tabela != tela de trabalho' e é mobile-first; NÃO virar tabela nem cartões pesados. Evolução = manter lista, mas dar contexto clicável por linha (qual obra/lead/negócio) e agrupar por origem. Cartão só para os KPIs do topo (Saldo + Consumo), não para o log.
- O QUE AUTOMATIZAR COM IA — 3 níveis: (1) baixo: projeção 'no seu ritmo, dura ~X dias' + semáforo, calculado do próprio extrato (sem custo de IA). (2) médio: alerta proativo ('seus Tijolos acabam em ~3 dias') no topbar/notificação, com 1-toque para recarregar. (3) alto (futuro): auto-recarga opcional ('recarregar automático quando saldo < N') — Click-and-Go, opt-in, nunca cobrança silenciosa. Começar pelo (1), que é o de maior valor por menor esforço e não depende de gateway.
- PROFUNDIDADE DA RECARGA v1 — gateway completo vs caminho assistido: v1 pode ser um CTA 'Recarregar' que abre pacotes precificados e finaliza via WhatsApp/cobrança manual (Click-and-Go sem integrar Stripe/Pix ainda); v2 integra pagamento real e crédito automático. O importante para o JOB é existir o caminho e o preço na tela, não o gateway perfeito no dia 1.
- SALDO GLOBAL vs só-nesta-tela: o saldo de Tijolos deveria viver no topbar global (visível em todo o sistema, já que toda ação consome), e esta tela ser o detalhe/extrato/recarga. Isso resolve o 'preciso clicar Atualizar' e reduz cliques para enxergar saldo em qualquer lugar.

## ✅ Manter
- Header sticky com título + descrição que explica o conceito 'Tijolos' (onboarding leve, premissa #5)
- Card Saldo destaque em dourado, com estado vazio honesto 'em modo de medição' (funcional, não fachada)
- Extrato em LISTA enxuta (3 infos/item, mobile-first) — NÃO virar tabela
- Abstração labelModelo (claude->Turbo, mistral->Econômico) escondendo LLM/provedor do usuário final
- Ocultar custo em BRL para o usuário final (correto)
- Estados de loading / vazio / erro com empty state que ensina o que faz aparecer dados
- Guard de gestor + tenant-scoping na leitura de hub_ia_consumo (segurança multi-tenant)

## ❌ Remover (ruído)
- Métrica 'Consumido nas últimas 50 ações' como está — janela ambígua (mistura quantidade com tempo), não comparável nem acionável; substituir por janela de tempo, não apenas apagar
- Dependência do refresh MANUAL como única forma de ver saldo atual — remover a obrigação (revalidar no foco da aba); manter o botão só como fallback discreto
- Vazamento do id cru do modelo (ex.: 'gpt-...') quando o prefixo é desconhecido — remover esse leak com fallback 'IA'

## 🤖 Promover a IA-first / 1-toque
- Projeção de duração do saldo IA-first: 'no seu ritmo, dura ~X dias' + semáforo verde/amarelo/vermelho no card Saldo — a IA/heurística antecipa o esgotamento
- Alerta proativo de saldo baixo com 1-toque para recarregar (no topbar/notificação), em vez de o usuário descobrir só quando entra na tela
- Auto-revalidação do saldo ao focar a aba (1-toque vira 0-toque) e saldo no topbar global
- Recarga Click-and-Go: escolher pacote pré-definido + confirmar (2 toques), com pacote sugerido destacado pela IA conforme o ritmo de consumo
- Tooltip/insight 'Turbo = respostas mais ricas, custa mais Tijolos' e, no futuro, sugestão da IA de quando usar Econômico para economizar

## 🎯 Ações priorizadas

- **P1** · medio · risco medio — Adicionar CTA primário 'Recarregar Tijolos' com pacotes precificados (Click-and-Go: escolher pacote + confirmar). v1 pode finalizar via fluxo simples (WhatsApp/cobrança) sem gateway completo. Fecha o ciclo da moeda pré-paga e o JOB da tela.  _(premissa: #1 (3 cliques: recarregar passa a ser possível aqui) e #5 (útil: completa o propósito da carteira))_
- **P2** · pequeno · risco baixo — Adicionar projeção de duração do saldo ('dura ~X dias') + barra/semáforo verde/amarelo/vermelho no card Saldo, calculada a partir do ritmo de consumo do próprio extrato.  _(premissa: #2 (IA-first: antecipa esgotamento) e #5 (número vira decisão, não dado solto))_
- **P3** · pequeno · risco baixo — Trocar 'Consumido nas últimas 50 ações' por 'Consumo nos últimos 7/30 dias' com mini comparação vs período anterior.  _(premissa: #5 (fácil de entender) — vira insight de ritmo comparável)_
- **P4** · medio · risco baixo — Por linha do extrato, adicionar referência clicável (ex.: 'Relatório · Obra Vila Mariana') levando ao item que gerou o gasto + filtro rápido por origem e período + agrupar por origem.  _(premissa: #5 (útil/auditável: 'por que gastei aqui?') sem virar tabela (princípio tabela!=tela))_
- **P5** · medio · risco baixo — Auto-revalidar saldo ao focar a aba e expor o saldo de Tijolos no topbar global; manter botão Atualizar só como fallback discreto.  _(premissa: #1 (mínimo de cliques) e #2 (sistema faz o trabalho, não o usuário))_
- **P6** · pequeno · risco baixo — Mapa de fallback seguro para modelo desconhecido (->'IA') centralizado para reuso em outras telas de IA, + tooltip 'Turbo = mais rico, custa mais Tijolos'.  _(premissa: #3/#5 (coeso e fácil; não vaza id técnico cru ao usuário))_
- **P7** · pequeno · risco baixo — Mensagem de erro amigável + botão 'Tentar novamente' inline no próprio bloco de erro (não depender do botão do header) e nunca exibir json.error cru.  _(premissa: #5 (funcional, não fachada; recuperação clara))_

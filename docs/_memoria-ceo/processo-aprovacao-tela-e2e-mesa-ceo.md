---
name: processo-aprovacao-tela-e2e-mesa-ceo
description: PROCESSO PERMANENTE — toda aprovação de tela passa por E2E → mesa redonda → CEO aprova; o dono ajusta no final
metadata:
  type: feedback
---

REGRA PERMANENTE de entrega (dono, 03/jul — ajustada): **toda aprovação de tela / feature passa, nesta ordem, por:**
1. **Teste E2E** ao vivo — chrome-devtools MCP (não screenshot), navegando o app real logado, e **verificando no banco (Supabase MCP) a verdade**, não só a tela (ver [[regra-eterna-analisar-todas-ferramentas]]).
2. **Mesa redonda** — multi-especialista (workflow), carregada de UI/UX/usabilidade quando a tela pede, com crítica adversarial.
3. **CEO aprova** — EU aprovo item por item.
4. **CEO ajusta E aprova** — EU faço os ajustes e dou a aprovação final. O dono NÃO ajusta nesta etapa; a autoridade é do CEO ("o ceo tem toda a visão do negócio e ele sabe o que preciso").
5. **Depois de pronto: cada usuário USA** — simular cada persona usando a tela ([[voz-do-usuario-simulador]]): o que o comercial/engenharia/arquiteto/cliente/fornecedor/parceiro faz, tap a tap.
6. **O dono traz as considerações para o CEO** — o feedback do dono entra por último, sobre o que já foi usado.

**Why:** o dono confia no CEO com visão de negócio pra levar a tela até "pronto e usável" sozinho (E2E→mesa→ajusta→aprova) e simular cada usuário; ele entra por último, só com considerações. Quer qualidade real/funcional, não fachada. Alinha com [[ceo-mandato-produto]], [[metodo-auditoria-adversarial-validacao]] e [[contrato-ceo-honesto-sem-bajulacao]].

**How to apply:** para CADA tela — E2E real (clicar CTAs + checar efeito no banco) → mesa (workflow) item por item → CEO aprova → CEO faz os ajustes e re-aprova (não devolve pro dono ajustar) → simular cada persona usando → só então trazer ao dono pras considerações. Honesto quando um item falha ou não foi verificado. Não pular E2E nem mesa em telas que o dono vai usar.

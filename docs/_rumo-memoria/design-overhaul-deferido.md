---
name: design-overhaul-deferido
description: Revisão de design/UI-UX — dimensão de COR CONCLUÍDA no CRM (telas+componentes 0 off-brand); resta shell de telas de detalhe + layout/apresentação
metadata:
  type: project
---

## ✅ ATUALIZAÇÃO 27/jun (tarde) — dimensão de COR CONCLUÍDA no CRM
Agentes ficaram 100% (Agent Builder + polish) → overhaul destravado e executado na parte de cor:
- **`app/crm/**` e `components/crm/**`: 0 ocorrências off-brand** (verificado com pattern largo de azul/roxo). Deployado.
- Telas de agentes (lista+editor+automações) + **15 componentes compartilhados** (NegocioFormDrawer, AgenteUazapiBlock, Cadastro*, Crm*Drawer/Sideover, ParticipantePicker, PlaybookFlow*, FlowCustomNodes, ParceiroLinkWizard) harmonizados.
- **Mapa cor→token aplicado:** azul-acinzentados (#0f1620/#141d29/#2c384b/rgba(44,56,75)) → card `#0f1d16` / border `#1d3a2c` / base `#0a140f`; azuis de acento (#1f6feb/#2f81f7) → teal `#2f9e8f`; roxos da entidade Pessoa (#7c3aed/#c4b5fd/139,92,246) → bronze `#b58a63`/181,138,99; variante "ai" → dourado `#c9a24a`.
- **Shell:** telas-LISTA (agentes/ciclos/ferramentas/contatos) `minHeight:100vh`→`100%` (fim do duplo-scroll). Telas de DETALHE (agentes/[slug], parceiros/[id], leads/[id]) e Aprovações (deferida) NÃO tocadas.

**Resta (backlog):** revisar shell das telas de detalhe; layout/apresentação (tabela→cards onde for tela de trabalho), botões, hierarquia (F4/F5); telas FORA do CRM (app/parceiro, onboarding, etc.) não escaneadas; resíduo "UAZAPI" em dado de ferramenta. Ver [[agent-builder-ia-fase1]].

---
## Histórico (contexto original)
O dono cobrou (27/jun) que **as telas ainda tinham azul/roxo fora da marca** e quer uma **revisão completa de design/UI-UX em TODAS as telas**: cores na identidade verde+dourado, layouts, cards, botões, e **como a informação se apresenta**. Importante: ele achava que a auditoria já tinha feito isso — esclarecido que a **auditoria foi o PLANO (F0–F6), não a execução**; F0/F1/F2/V1 feitos, mas a parte visual pesada (F4/F5 + harmonização de cor) ainda NÃO.

**DECISÃO do dono:** primeiro **terminar a tarefa dos agentes** (redesenho/inteligência — #1/#2/#2b feitos; faltam #4 RAG no engine e #3 playbook em banco); **só depois** fazer esta revisão de design.

**Escopo medido (pra quando retomar):**
- **97 ocorrências** de azul/roxo Shadcn (#3b82f6, #60a5fa, #58a6ff, #93c5fd, #a78bfa, #a855f7, #8b5cf6, #0ea5e9, #f97316) em **29 arquivos** (.tsx em app/crm + components/crm). 49 telas no total.
- **Tokens da marca JÁ existem** em `app/globals.css`: `--obra-*` (verde/dourado/dark/texto/borda/vermelho) e `--brand-*` (gold/green/cream/red/line/muted). Shell theme em `lib/crm-shell-theme.ts` (já retematizado verde antes).

**Princípio (NÃO fazer monocromático):** harmonizar numa paleta da marca — dourado (primário) + verde (positivo) + âmbar (atenção) + vermelho (perigo) + neutro. Mapear os azuis/roxos pra esses **preservando a leitura por cor** (não pintar tudo de dourado). Depois: layout (tabela→cards onde for tela de trabalho), botões, hierarquia, apresentação da informação. É F4/F5 do [[diagnostico-tela-a-tela-plano-acao]]. Reverte a minha decisão anterior de "manter azuis semânticos" — o dono quer tudo na marca.

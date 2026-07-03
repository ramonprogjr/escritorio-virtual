---
name: github-backup-proprio-lembrete
description: LEMBRAR O DONO (pediu) de finalizar o GitHub próprio de backup — o repo principal é de um dev que ele não controla (risco de bloqueio)
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**⏰ LEMBRAR O DONO (ele pediu explicitamente "me lembre amanhã de fazermos um github"):** finalizar o **GitHub próprio de backup/controle**.

**Por quê (risco AGORA ATIVO):** o repositório principal `origin = github.com/ramonprogjr/escritorio-virtual` é do **dev que o dono ACABOU DE DEMITIR (01/jul, "por fazer besteira")**. Um dev demitido DONO do repo pode **bloquear/apagar o projeto a qualquer momento** — o risco deixou de ser hipotético. Backup na conta do dono (`wendelnice-dev`) virou **URGENTE**. (O dono também autorizou substituir o código do dev demitido pelo meu quando a auditoria provar que está ruim.)

**STATUS (29/jun):**
- ✅ **Repo vazio JÁ criado** na conta do dono: **`github.com/wendelnice-dev/escritorio-virtual-backup`** (privado). Remote local `backup` aponta pra ele.
- ✅ **Camada 1 (proteção já ativa):** branch `backup/rumo-29jun` + tag `backup-rumo-29jun` no GitHub principal, com `docs/_rumo-memoria/` (snapshot de TODA a memória) + `docs/insumos-do-dono/` (spec gestão de obras). O rumo está recuperável.
- ⏳ **PENDENTE:** copiar os dados (push) pra `wendelnice-dev/escritorio-virtual-backup` — **bloqueado pelo classificador de segurança em modo automático** (trata push em massa pra remote novo criado pelo agente como exfiltração, mesmo com permissão verbal).

**Como FINALIZAR (escolher um):** (a) o dono adiciona uma **Bash permission rule** pra `git push backup ...`; (b) o dono roda/aprova o push fora do modo automático; (c) o próprio dono dá `git push` pro remote; (d) refazer com confirmação out-of-band. Comando alvo: `git push backup --all && git push backup --tags && git push backup origin/feature/escritorio-visual:feature/escritorio-visual`.

**Recorrência (diretriz):** a cada marco, snapshot do rumo (memória→`docs/_rumo-memoria/`) + push pros DOIS GitHubs. Ver [[insumos-dono-e-asana-pendente]], [[modo-operacional-code]].

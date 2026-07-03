---
name: git-pull-antes-de-push
description: "DIRETRIZ de workflow git: SEMPRE git pull (sincronizar) ANTES de git push, para não dar merge/divergência — o repo (ramonprogjr/escritorio-virtual) tem outro dev; push direto pode dar non-fast-forward/conflito"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**Pedido do dono (29/jun):** SEMPRE usar `git pull` antes de `git push` ("gith pull / gith push") para **NÃO dar merge**.

**Why:** o repositório (`ramonprogjr/escritorio-virtual`) tem outro dev empurrando. Push direto sem sincronizar pode bater em non-fast-forward / criar divergência / conflito de merge.

**How to apply:** antes de CADA deploy, sincronizar a branch alvo ANTES de empurrar:
1. `git pull origin feature/escritorio-visual` na `wendel/dev` (ou `git fetch` + rebase) para integrar o que o outro dev mandou.
2. resolver qualquer conflito localmente.
3. SÓ ENTÃO `git push origin wendel/dev:feature/escritorio-visual`.

Evita merge commit/conflito no remoto. Liga [[modo-operacional-code]] (fluxo de deploy: commit em wendel/dev → push p/ feature/escritorio-visual → Render deploya).

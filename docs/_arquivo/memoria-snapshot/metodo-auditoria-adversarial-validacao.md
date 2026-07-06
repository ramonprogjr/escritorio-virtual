---
name: metodo-auditoria-adversarial-validacao
description: DIRETRIZ PERMANENTE — antes de reformular/grande mudança, rodar a auditoria ADVERSARIAL DE VALIDAÇÃO (lentes céticas leem o código real, dão veredito + melhorias com certeza). O dono quer usar muito.
metadata:
  type: feedback
---

O dono pediu (27/jun) para GRAVAR este tipo de auditoria — "vamos fazer muito daqui para a frente". É a abordagem que mais lhe deu valor (pegou bugs reais que nenhuma mesa de design tinha visto, e derrubou 1 exagero).

**O QUÊ:** Auditoria ADVERSARIAL DE VALIDAÇÃO — uma mesa redonda (Workflow) onde lentes especialistas CÉTICAS **re-examinam decisões/código já feitos** contra o CÓDIGO REAL (não os specs, não as mesas anteriores), dão **VEREDITO** (acertou/parcial/errou/faltou) COM evidência (arquivo:linha), e propõem **melhorias com nível de CERTEZA** (alta/média/baixa) + dimensão (ui_ux/design/facilidade/recursos/funcionalidade/ia_first) + impacto×esforço. Inclui sempre um "crítico de completude" que pergunta o que TODAS as mesas/construções anteriores MISSARAM.

**Por que funciona:** não confia no que foi dito; verifica no código. Não valida por educação — é instruída a ACHAR problema e melhoria. Mede o impacto de cada frente no sistema como um todo. Entende ANTES de propor.

**QUANDO usar (sempre que o dono pedir "auditoria/validar/reformular"):** antes de qualquer reformulação grande; depois de construir um conjunto de features (validar o que ficou); quando o dono diz "quero ter certeza das melhorias".

**COMO rodar:** workflow nomeado **`auditoria-validacao`** salvo em `.claude/workflows/auditoria-validacao.js` — parametrizável via `args` (contexto + lista de frentes/lentes). Método das lentes: PASSO 1 entender (ler código real) → PASSO 2 impacto no sistema todo → PASSO 3 veredito com evidência → PASSO 4 melhorias com certeza → PASSO 5 erros que ninguém viu. Síntese do CEO prioriza por impacto×esforço, só certeza alta/média, marcando o que precisa do dono vs autônomo.

**Régua:** o CEO SEMPRE verifica pessoalmente os achados load-bearing/de integridade-segurança (não confia cego no subagente). Honestidade total: se algo anterior foi superestimado/errado, dizer. Conecta [[modo-operacional-code]], [[feedback-mesa-redonda-uiux]].

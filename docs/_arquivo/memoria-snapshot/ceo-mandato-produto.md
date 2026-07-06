---
name: ceo-mandato-produto
description: REGRA ETERNA — Code é o CEO de produto: propõe como as telas devem ser, NÃO tabelas como telas de trabalho (tabela = relatório), telas pensadas para o JOB do negócio, conversacional + IA-first; revolução com prudência
metadata:
  type: feedback
---

Mandato permanente do Wendel (25/jun/2026): **"você é o meu CEO"** de produto.

**A regra eterna:** o Wendel traz o conhecimento de **mercado, negócios, dores e processos**; o Code **transforma isso em sistema** e **PROPÕE as soluções e melhorias — como as coisas devem ser feitas**. Não esperar ele especificar UI; eu lidero a decisão de produto/UX. Não deixá-lo "estragar o sistema por falta de entendimento técnico/UX".

**Princípios de design (o que ele pediu explicitamente):**
- **NADA de tabelas como tela de trabalho.** Tabela/planilha = **Relatório** (ele puxa em `/crm/relatorios` quando quiser o dump/CSV). As telas do dia-a-dia são pensadas para a **necessidade do negócio** (o *job*): "o que eu faço agora?", não "aqui estão todos os dados".
- **Fácil de usar, resolutivo, interface ótima, conversacional, IA-first.** Cards acionáveis > linhas; triagem priorizada > listão; Kanban/fluxo visual > grid; ficha 360 rica > colunas; barra conversacional (falar/pedir/agir em linguagem natural) como espinha.
- **Click-and-Go / 3 toques** (ver [[ux-principio-click-talk-go]]): escolher e confirmar; IA pré-preenche.
- **Revolução COM prudência:** pode alterar tudo o que precisar e fazer mudanças ousadas, mas **aditivo, preservando a lógica que já está certa** (ele diz: "a lógica está no caminho certo, o sistema é que está ruim de UX/visual"), **validado** (gate tsc+vitest+_chk23), com **mesa redonda de UI/UX a cada etapa** ([[feedback-mesa-redonda-uiux]]), backups/commits reversíveis, sem push/secrets.

**Como aplicar:** a cada tela, perguntar "qual é o trabalho real aqui?" e desenhar a superfície para esse trabalho (triagem/ação/conversa), tirando tabela, ruído (R$ 0,00, "—", dados de teste), valores crus e jargão. Eu proponho o redesenho (com especialista), apresento, e executo com segurança. Ver [[crm-prioridade-codigo-unico]], [[plataforma-arquitetura-visao]], [[plano-executivo-blocos]].

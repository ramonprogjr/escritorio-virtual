---
name: modo-operacional-code
description: Diretriz permanente de COMO o Code deve trabalhar neste projeto (time mesa-redonda, ferramentas, fluxo de 7 passos, princípios, TRAVAS inegociáveis)
metadata:
  type: feedback
---

Diretriz dada pelo usuário em 2026-06-23, aplicar em TODA demanda. Trabalhar autônomo, em loop até o objetivo, acionando eu mesmo o especialista/ferramenta certa; o usuário dá o objetivo, não comando avulso. Só parar por catástrofe ou pelas TRAVAS.

**Why:** o usuário quer entrega autônoma de ponta a ponta, com qualidade revisada (técnica+segurança+UX), testada logado de verdade, e memória/doc a cada etapa — sem precisar microgerenciar.

**How to apply:**

TIME (mesa-redonda, mapeado aos agentes reais): executive-director (orquestra, aprova edições/migrações aditivas/deploy sem consultar — só para por catástrofe), chief-architect (arquitetura/impacto antes de mexer), senior-engineer (implementa), technical-reviewer=skill `code-review`, security-reviewer=skill `security-review`/`security-guidance` (prova por força bruta), ux-director=`ui-ux-pro-max`+`frontend-design`+Taste (design premium), qa-tester=Playwright+Chrome DevTools (logado, 100% dos botões), product-owner (objetivo de negócio), knowledge-manager (mapa de código + memória), documentation-specialist=`stop-slop` (docs enxutos).

FERRAMENTAS/MCP disponíveis de fato: Supabase MCP (migrações ADITIVAS, RLS, `get_logs` p/ 401/403, validar dados antes/depois), Playwright MCP, Chrome DevTools MCP, Perplexity Docs MCP, Hugging Face MCP, claude-mem (skills+MCP). Skills: code-review, security-review, frontend-design, ui-ux-pro-max, stop-slop, harness, superpowers, gstack, understand-*. Leitura de PDF/doc é nativa (Read) — cobre o papel do "MarkItDown". NÃO há tool literal "CodeGraph": usar agentes Explore + Grep + claude-mem p/ mapear dependências ANTES de editar.

FLUXO OBRIGATÓRIO por demanda: 1) ENTENDER (ler memória/`docs/STATUS_MARATONA.md`; mapear deps antes de editar — nunca editar sem entender dependências). 2) MESA-REDONDA (especialistas decidem juntos, registrar em `docs/PROPOSTA_CONJUNTA.md`; executive-director aprova). 3) IMPLEMENTAR (mudanças pequenas e isoladas; UX cuida do design). 4) LOOP DE AUTO-CORREÇÃO (qa logado com Playwright+DevTools, 100% dos botões sem botão morto; `node app/_chk23.js` OK, console limpo, cold load sem branco; se quebrou, diagnostica/pesquisa/corrige/revalida até passar). 5) REVISÃO DUPLA (code-review + security-guidance assinam antes de fechar etapa). 6) MEMÓRIA+DOC (gravar claude-mem E `docs/STATUS_MARATONA.md`; commit pequeno e descritivo por etapa). 7) PUBLICAR (só com GO do usuário, via `_publicar.ps1`, confirmar no link + smoke logado).

PRINCÍPIOS: publicável e estável em CADA etapa (nunca fechar com app quebrado/branco). Honestidade acima de tudo: se não deu certo, dizer; se faltou validar, dizer; NUNCA afirmar que testou sem ter testado logado de verdade. Disciplina de custo: quando o contexto encher, gravar tudo em disco, escrever HANDOFF e pedir reinício limpo.

MODO LOOP (2026-06-23, aplicar em toda tarefa/bug): ciclo contínuo de auto-correção, sozinho, sem parar a cada passo. (1) definir critério de aceite objetivo em 1 linha; (2) entender deps (Grep/Explore + claude-mem + STATUS_MARATONA); (3) hipótese da causa em `docs/PROPOSTA_CONJUNTA.md`; (4) menor mudança isolada que testa a hipótese; (5) **validar AO VIVO logado** (Playwright + Chrome DevTools, conta real, desktop+mobile, console+network, `node app/_chk23.js` OK, cold load sem branco); (6) passou no critério? **SIM** → code-review + security assinam, commit pequeno, gravar memória+STATUS, encerrar; **NÃO** → diagnosticar com logs reais (`get_logs` Supabase, console, network), pesquisar (Perplexity/HF) antes de chutar, ajustar hipótese, voltar ao passo 4. **ANTI-LOOP:** mesma correção falhou 2× → mudar de abordagem; se após ciclos reais o alvo não cair, PARAR, registrar no STATUS onde travou + último erro, reportar curto com fatos. Backup antes; commit a cada passo estável (ponto de retorno); nunca encerrar com build quebrado/tela branca; honestidade com números ("de 52 erros p/ 0"); só dizer "feito" com prova logada. GO humano só p/ migration em prod e deploy.

REGRA DE DECISÃO (2026-06-23): nunca apenas LISTAR opções para o usuário esperando que ele escolha — sempre **recomendar a MELHOR opção com justificativa**, e o **agente especialista pertinente VALIDA** a decisão (mesa-redonda registrada em `docs/PROPOSTA_CONJUNTA.md`; decisões substantivas/arriscadas via Agent especialista real — ex.: security-reviewer p/ RLS, chief-architect p/ arquitetura). Decidir e seguir; escalar ao usuário só nos GO sancionados (migration prod, deploy, segredo que só ele tem).

TRAVAS INEGOCIÁVEIS (parar só por isto):
- **ESCOPO: mexer SOMENTE neste projeto `c:\Users\wende\Documents\escritorio-virtual-ramon`. NUNCA tocar em membros, em `C:\Users\wende\Documents\escritorio-virtual` (sem -ramon, seu deploy onrender INTOCADO) nem em qualquer outro local/projeto.** (única exceção: a pasta de memória deste projeto em `~/.claude/projects/...-ramon/memory`, que é a memória deste projeto.)
- Sem `git push` remoto. Sem secrets no front/Git (chave Anthropic só como secret no Supabase/env do servidor, nunca commitada; `.env*` já é gitignored).
- Migrações só ADITIVAS (sem drop, sem apagar dado/coluna).
- Editar/apagar/ocultar só por AUTOR e ADMIN, em UI e RLS. Contato de lead NUNCA exposto. Mão de obra sem login.
- Não desestabilizar: sempre `_chk23` OK e cold load sem branco antes de fechar etapa.

NOTA DE ESTADO (2026-06-23): artefatos referenciados pelo fluxo que NÃO existem ainda neste repo — `docs/STATUS_MARATONA.md`, `docs/PROPOSTA_CONJUNTA.md`, `app/_chk23.js`, `_publicar.ps1` (existe `docs/STATUS.md`). Criar/alinhar quando a 1ª demanda rodar (ou pedir os do projeto). Conta de teste owner: `nice.engemp@gmail.com` (ver [[supabase-projeto-e-login-local]]). Estado do sistema: [[estado-sistema-arquitetura]]; modelo-alvo: [[spec-funcional-crm-hub-obra10]].

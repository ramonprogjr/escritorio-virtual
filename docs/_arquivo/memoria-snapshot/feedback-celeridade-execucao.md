---
name: feedback-celeridade-execucao
description: Executar com MAIS celeridade — seguro mas sem travar/perguntar a cada passo; a segurança vem de mesa redonda + docs + backups reversíveis
metadata:
  type: feedback
---

O Wendel quer **avançar com mais velocidade** (menos preciosismo de segurança). Continua tendo que ser **seguro**, mas **não pode ficar travado nem me travando** com pedidos de autorização a cada passo.

**Why:** ritmo de entrega — esperar confirmação para cada ação de risco médio mata o avanço.

**How to apply:** a segurança passa a vir de **(1) mesa redonda** (revisão por agentes antes/depois), **(2) documentação** (plano + PENDENCIAS + SQL aplicado/rollback), **(3) backups/reversibilidade** (toda migração com ROLLBACK documentado; commits locais pequenos = `git revert` fácil) e **(4) gates** `tsc`+`vitest`+`_chk23`. Com isso no lugar, **executar direto** — inclusive RLS/migrações — sem parar para perguntar "posso aplicar?". 

**Ainda assim:** (a) o harness pode barrar migração de RLS/produção ambígua — se barrar, **dar UMA frase pedindo o OK e seguir** (não virar loop); (b) parar de verdade só para o **irreversível sem rollback**, **exclusão de dados em massa**, **custo financeiro novo**, **credenciais** ou **push/deploy**. Reduzir, não eliminar, a cautela. Ver [[feedback-continuar-sem-confirmacao]], [[feedback-mesa-redonda-uiux]], [[modo-operacional-code]], [[plano-executivo-blocos]].

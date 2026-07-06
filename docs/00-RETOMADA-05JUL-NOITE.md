# 🔄 PONTO DE RETOMADA — 05/jul noite (para o chat novo, pós-reset)

> O dono vai **resetar o Claude Code** (o plugin claude-mem travou — 130+ hooks; reset recupera). **Nada se perde:** tudo abaixo está em git + memória. Comece por aqui + `CONTROLE-MESTRE.md`.

---

## ✅ O QUE FOI FEITO NESTA SESSÃO (05/jul) — tudo gated + pushed (origin+backup), NADA deployado
Destravamento (ver `docs/PLANO-DESTRAVAMENTO-05JUL.md` §7):
- **Fase 0** (`98b50b1`→`1bfd6cb`): −17.487 linhas de código morto. **0.4**: docs `_rumo-memoria` arquivados.
- **Fase 1.1** (`c75b16a`): `next build` no CI (verde no Actions). **Rede 1.3/Frente 2** (`f2332b0`,`abc11bd`,`a63ecce`): trio RBAC + render infra = **799 testes**.
- **Fase 2.1** (`0013765`): 66 clientes Supabase unificados (−613 L). **2.2** (`0923a88`): `tenantScopeExact`.
- **Fase 2.3** (`d0fea5b`): extraído `app/crm/layout.tsx` → `CrmShell` (casca) + `CrmLayout` (bootstrap). Mesa crítica Fable = "SEGURO", gate verde. **Falta o dono conferir logado.**
- **E2E** (`5c52a94`,`d1ae2bf`): tentado CI+Supabase-local → ACHOU que **o repo não reconstrói o banco do zero** (migrations fora de ordem + tabelas criadas fora do repo). Ver memória `schema-nao-reproduzivel-migrations-fora-de-ordem`. E2E pausado (só dispatch manual).

---

## 🎯 DIREÇÃO-MESTRA DO DONO (05/jul noite) — a auditoria de retenção foi valiosa MAS SUPERFICIAL

A mesa Fable só olhou **dinheiro/pagamento**. O dono corrigiu o escopo — **a próxima auditoria (e o trabalho) DEVE cobrir o sistema inteiro pela ótica de "o que FALTA e o que FACILITA a vida do profissional":**

1. **O CORAÇÃO é IA-FIRST + CONVERSACIONAL** (a mesa NÃO auditou isso). O dono vai construir TODA a IA interna: receber leads · solicitar fornecedores · levantamentos · planilhas orçamentárias · realizar compras · follow-ups · **check-in/check-out** de funcionários/colaboradores → **controle real de tudo**. Eles usam porque é **realmente útil e fácil**.
2. **Faltou auditar — OLHAR TUDO:** **CRM · VENDAS · CADASTROS** e **COMO se conectam no NEGÓCIO** (o **NEGÓCIO é a espinha** que liga tudo — ver [[integracao-contas-negocio-spine]], [[rastreabilidade-estado-real-04jul]]) · gestão de PROJETOS · ESCOPO · telas de OBRAS e ENGENHARIA · setor de COMPRAS. Auditar o sistema INTEIRO ponta a ponta, não um recorte.
3. **DIÁRIO DE OBRA** — o sistema tem que ter, num **formato que o dono já apresentou** (localizar nos insumos/docs; se não tiver, pedir). 
4. **MEDIÇÃO RICA** (após a espinha dorsal, o dono insere os documentos de engenharia): material do avanço · **foto · vídeo** · pontos que precisam de melhoria · **fichas de verificação de serviço** — tudo **por atividade, por ambiente, por fornecedor**.
5. **A auditoria certa traz:** o **BOTÃO que falta**, a **TELA que falta**, a **SEÇÃO que falta**, o que o usuário **precisa e quer olhar**. Retenção real = o sistema **facilitar a vida** deles (não "lente de dinheiro").
6. **LOG + SEGURANÇA + TUDO EM NUVEM:** fotos, contratos, propostas, datas, orçamentos, **notas fiscais**, vídeos — **todo dado gravado em nuvem** (hoje a foto da medição NÃO persiste — dívida AUT-6, bucket `medicoes` a configurar).

> **Frase do dono:** "o que acredito que fará as empresas ficarem é se realmente o sistema facilitar a vida delas."

---

## ▶️ PRÓXIMO PASSO (ao retomar)
1. **Re-rodar a auditoria com escopo COMPLETO** (IA-first/conversacional + projetos/escopo/obras/engenharia/compras + diário de obra + medição rica + cloud/log/segurança) — trazendo o **mapa do que falta por tela/persona** (botão/tela/seção). Usar Fable só no crítico.
2. Localizar o **formato do diário de obra** que o dono apresentou (insumos-do-dono / docs).
3. Dono confere a **2.3 logado** e diz se ficou redondo → fechar Fase 2.3.
4. Backlog dos 4 fechos de loop + os itens de nuvem/log/segurança (janela do dono p/ storage/E7-E6).

**Memórias-chave:** `direcao-produto-sistema-completo-ia-first-05jul` · `auditoria-retencao-usuario-05jul` (marcada como superficial) · `diretriz-trabalho-cirurgico-destravar-sistema` · `schema-nao-reproduzivel-migrations-fora-de-ordem`.

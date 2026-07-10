# ☀️ Handoff — retomar amanhã (fechado 09/jul 23:xx)

> O estado real e o próximo movimento. Fonte viva; ler primeiro ao retomar.

## ✅ O que ficou PRONTO hoje (produção)
- **5 deploys** (#25 registros×logs×permissões · #26 custo IA fora da tela · #27 idempotência entrega · #28 FASE 0
  compras 3 buracos de segurança · + migração 20260711120000 entrega gate).
- **COMPRAS**: spec única em [SPEC-COMPRAS-CORACAO.md](SPEC-COMPRAS-CORACAO.md). FASE 0 (segurança) + FASE 1 (3 decisões)
  + **FASE 2 `e7a` APLICADA** (âncoras da SC + item polimórfico editável + elo SC→financeiro + tenant_id em
  hub_alertas + índices). A QA Fable-max VETOU a 1ª e7a (2 quebras reais) — corrigido e provado que o E5 não quebrou.
- Tudo espelhado no Git backup (`wendelnice-dev`).

## 🎯 PRÓXIMO MOVIMENTO — FASE 2 `e7b` (a próxima janela)
O cofre de contas bancárias anti-golpe + a cadeia de validação. **Rascunho + QA rodando esta noite** (mesa Fable-max)
— de manhã: revisar o draft com cabeça fresca, corrigir o que a QA achar, **aplicar COM o dono via MCP** (transação
atômica + prova pós-apply, como a e7a). Blocos: cadeia `hub_sc_validacoes` + `hub_sc_politicas`; PO `hub_ordens_compra`
(+`gerar_codigo_oc`); COFRE `hub_fornecedor_contas` (append-only + trigger imutabilidade + RPC revogar/substituir + 5
travas anti-golpe); guard da cascata (serviço/diária não viram estoque); status `em_validacao`; `chk_sc_ancorada` (a
exigência de âncora que ficou fora da e7a, DEPOIS do app gravar as âncoras).

## ⏳ Depende do DONO (rápido)
- **Render**: `IA_HARD_CAP=on` + confirmar `MISTRAL_API_KEY`/`COPILOTO_HMAC_SECRET`. Depois colar a tela de
  Configurações pra eu conferir.
- **TestSprite**: chave do MCP inválida — criar nova em Settings→API Key, pôr no config do MCP, reiniciar. Aí gero o PRD.

## 🧭 Decisões ratificadas hoje (não re-litigar)
Compra=documento (não negócio) · delegação=regra+faixa, tetos por tenant · freelance PF=espelho fornecedor · medição=
unidade da planilha orçamentária (editável, IA-first) · hold clawback=7 dias · preços=adiado ao macro plan · Tijolo=só
medida (Hub paga em dinheiro) · **mercados têm PIRÂMIDE**: Arquitetura+Engenharia no topo, Serviços guarda-chuva,
Produtos vertical próprio.

## 🗂️ Frentes futuras anotadas
Catálogo codificado de materiais/insumos/ferramentas/equipamentos · levantamentos+orçamentos (fonte da unidade da SC)
· cronograma único (PRONTO, guardado) · flip do remote pro repo do dono · alinhar navegação/verticais à pirâmide.

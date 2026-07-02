# 🏗️ AEC — Ativação: resultado + backlog de polimento (02/jul/2026)

> **Maratona 1 (Ativar AEC) — CONCLUÍDA no lado schema/código.** Verificação por workflow (7 domínios, 0 erros) + query no banco (9/9 dependências verdes).
> **Veredito:** os 7 domínios AEC **auto-ativam** com o schema no ar (`autoActivates=true`, **zero gate duro**). O front tenta o caminho completo primeiro e só degradava quando a tabela/coluna não existia — agora existe, então liga sozinho. **Nenhuma mudança de código foi necessária.**
> **Escrow: DORMENTE/seguro** — nenhum código invoca `rpc_liberar_escrow`/`rpc_aprovar_orcamento_frente` automaticamente; só a cascata de aprovação DUPLA humana (`lib/ia/aprovacoes.ts`). ⚠️ O bug do `GREATEST` fica *latente* atrás do gate humano: a dormência depende de **ninguém aprovar em dobro um `pagamento_obra_*` na fila** (fix #5 antes de usar escrow).

## ✅ Verificação de schema (query MCP, read-only)
6 views · 6 functions · hub_obras{bdi_fator,tipo_contrato,segmento} · frentes_eap{atualizado_em,tipo_no} · pagamentos(7 cols) · orcamentos(3) · itens(7) · curva-S(5) · CHECK hub_aprovacoes.tipo com os 3 tipos novos. **Tudo presente.**

## 🟡 Backlog de polimento (gaps REAIS achados, não-bloqueantes)
Prioridade sugerida em [P].

1. **[P1] Medição sem foto — bucket `medicoes` não existe.** `DrawerMedir` sempre envia `foto_url` vazio (sem bucket configurado). A "medição honesta" perde a evidência (foto) até criar o bucket no Supabase Storage + wiring de upload. *(medicao)*
2. **[P2] Card "Previsto" sempre R$ 0.** `montarResumo` (financeiro/route.ts ~L224-247) nunca calcula `previsto` (o comentário diz "soma valor_contrato dos itens-pai" mas não há código). O card exibe R$0 sempre. Bug de exibição, não crash. *(financeiro)*
3. **[P2] Medição não-transacional.** `route.ts` atualiza `pct_avanco` do item ANTES do insert da medição. Um erro REAL de insert (overflow/CHECK) deixa avanço gravado sem trilha — inconsistência. Envolver em transação/RPC. *(medicao)*
4. **[P3] Autor da medição = UUID/papel, não nome.** `DrawerMedir` não envia `responsavel_nome`; POST grava `criado_por=userId`. O histórico mostra "por &lt;uuid&gt;". *(medicao)*
5. **[P3] Sync E2 fire-and-forget nas restrições.** Os UPDATE de `falta_*` em `hub_obra_itens` (criar/resolver restrição) usam `await` sem checar erro — dessincroniza em silêncio se falhar. *(restricoes)*
6. **[P3] Cronograma: "avanço financeiro" espelha o físico até haver snapshots.** Por design (modo avanço-só), mas sem baseline/snapshot a curva planejada é linear e o financeiro = físico, sem aviso — pode induzir a achar que já há rastreio financeiro separado. Considerar um selo "sem baseline ainda". *(cronograma)*

## ▶️ Falta em Maratona 1
- **Teste E2E visual** dos fluxos da obra — **rodar LOCAL** (`npm run dev` na pasta `-ramon`, escopo travado), com o dono. Roteiros por domínio no journal do workflow `wf_a127264b-fa2`.

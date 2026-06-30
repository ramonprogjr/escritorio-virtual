# Dívidas técnicas (ATENÇÃO/MENOR deferidos das auditorias) — para não perder

> Itens não-bloqueantes que as auditorias adversariais acharam e eu deferi (com justificativa). Nenhum é crítico; resolver no momento certo (geralmente "antes de X" indicado). Atualizado a cada bloco.

## Multi-tenant / segurança (resolver antes do multi-tenant real / go-live)
- **`lib/ia/aprovacoes.ts` + `/api/hub/aprovacoes` sem `.eq('tenant_id')`** — vazamento cross-tenant LIVE; o escrow leva dinheiro pro gate. **Sendo corrigido no E6 (F0).**
- **`tenantScopeOrFilter` inclui o tenant legado** (tenant-default.ts) — `carregarTaxonomia`/`/catalogo` leem o tenant atual + NULL + DEFAULT_OBRA10. Inócuo p/ seed global; resolver antes da taxonomia/catálogo terem registros de **tenant real** `origem='tenant'`.
- **RLS `anon` ausente** nas tabelas novas de E5 (`hub_pedido_itens`/`hub_estoque_mov`) e do módulo obra — é o padrão consolidado (E0/E3 idem); padronizar quando o módulo for endurecido (service-role + `.eq` já protege).

## EAP / Orçamento (E0.5)
- **Taxonomia cobre 5/15 disciplinas** (elétrica/civil/hidráulica/revestimentos/pintura) — semear as outras 10 antes do Orçamento IA depender delas. Flag p/ o dono.
- **Presets por segmento assimétricos** (residencial/corporativo robustos; comercial/PDV esqueléticos) — enriquecer com o dono.
- `idx_taxonomia_tenant` redundante com o prefixo do UNIQUE — remover (custo de escrita à toa).
- Wizard não expõe ambiente-first no passo 3 (só na aba Itens) — melhoria de UX.

## Elo / idempotência (A2)
- **`hub_obras.projeto_id` + UNIQUE** (FK reversa) — mata de vez o R2 (janela criar-obra→PATCH do elo) e a race residual. Requer migração (sai do escopo zero-migração de A2).
- Mapa `tipologia→tipo_obra` (comercial→servico, corporativo→construcao) — **validar com o dono** (mitigado: chip editável).

## Compras/estoque (E5)
- Idempotência da cascata: avaliar UNIQUE em `hub_estoque_mov` (hoje LLEAST(qtd_pedida) protege o item).
- Saída/Devolução compartilham handler (abre sempre 'saida') — prop trivial.

## Aprovações (E3) / sistêmico
- **Tools de escrita não gravam auditoria** em `hub_acoes_ia`/`hub_memorias_agente` — lacuna sistêmica (E0/E2/E3 idem); o loop de aprendizado da Central de Aprovações depende disso (resolver junto da Central).

## Decisões de NEGÓCIO p/ o dono (não são dívida técnica — precisam dele)
Comodato (condição de entrada?) · frete Lalamove (repasse vs spread) · KPIs iniciais do fornecedor · spread por modelo de contrato · qtd_padrão da taxonomia (adotei NULL/humano confirma) · política entregue-vs-aprovado no "Gerar Obra".

## Fase 3a — ressalvas da auditoria (backlog)
> Não-bloqueantes (veredito GO-com-ressalvas). Os 4 itens de higiene/honestidade JÁ foram corrigidos; estes ficam para o momento certo.
- **(a) Foto da medição é `type=url` — falta upload nativo.** O `DrawerMedir` só aceita um link colado. A evidência fotográfica de CAMPO precisa de captura nativa: `<input type="file" accept="image/*" capture="environment">` + upload para o Supabase Storage (bucket de medições) → grava a URL pública/assinada em `foto_url`. Sem isso, na obra não há como tirar a foto na hora.
- **(b) Histórico append-only sem UI.** O `GET /api/crm/obras/[id]/medicoes` (com `?item_id=`) já existe e devolve o histórico, mas NENHUMA tela consome. Falta uma seção "Medições do item" read-only (lista append-only: data, autor `criado_por`, qtd, pct resultante, foto, observação) — a prova visível do "nada-se-perde".
- **(c) Snapshot de custo falha em silêncio (`console.warn`).** Em `app/api/aprovacoes/[id]/route.ts` e `lib/ia/aprovacoes.ts`, o `rpc_snapshot_custo_frente` é best-effort e, quando falha (ex.: E7b pendente), só loga no console. Registrar a falha em `hub_decision_logs` (ou tabela de reconciliação) para que o custo não-materializado seja conciliado depois — hoje some do radar se ninguém olhar o log do servidor.
- **(d) `GET /medicoes` com `.limit(500)` sem paginação.** Obras longas com muitas medições truncam em 500 silenciosamente. Adicionar paginação (cursor por `criado_em`/`id`) quando a tela de histórico (b) for construída.
- **(e) `CadastroPremiumSideover` herda cor azul Shadcn (#2d394b / #121a26).** O sideover usado pelo `DrawerMedir` (e outros) está fora da paleta da marca (verde + dourado Obra10+). Tokenizar para `--obra-*` / `--brand-*` no overhaul de design deferido.

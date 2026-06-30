# Dívidas técnicas (ATENÇÃO/MENOR deferidos das auditorias) — para não perder

> Itens não-bloqueantes que as auditorias adversariais acharam e eu deferi (com justificativa). Nenhum é crítico; resolver no momento certo (geralmente "antes de X" indicado). Atualizado a cada bloco.

## Multi-tenant / segurança (resolver antes do multi-tenant real / go-live)
- **`lib/ia/aprovacoes.ts` + `/api/hub/aprovacoes` sem `.eq('tenant_id')`** — vazamento cross-tenant LIVE; o escrow leva dinheiro pro gate. **Sendo corrigido no E6 (F0).**
- **`tenantScopeOrFilter` inclui o tenant legado** (tenant-default.ts) — `carregarTaxonomia`/`/catalogo` leem o tenant atual + NULL + DEFAULT_OBRA10. Inócuo p/ seed global; resolver antes da taxonomia/catálogo terem registros de **tenant real** `origem='tenant'`.
- **RLS `anon` ausente** nas tabelas novas de E5 (`hub_pedido_itens`/`hub_estoque_mov`) e do módulo obra — é o padrão consolidado (E0/E3 idem); padronizar quando o módulo for endurecido (service-role + `.eq` já protege).

## EAP / Orçamento (E0.5)
- **Taxonomia cobre 5/15 disciplinas** (elétrica/civil/hidráulica/revestimentos/pintura) — semear as outras 10 antes do Orçamento IA depender delas. Flag p/ o dono.
- **Presets por segmento assimétricos** (residencial/corporativo robustos; comercial/PDV esqueléticos) — enriquecer com o dono.
- ~~`idx_taxonomia_tenant` redundante com o prefixo do UNIQUE — remover (custo de escrita à toa).~~ **RESOLVIDO (AUT-7):** migração SÓ-ARQUIVO `20260819120000_aut7_drop_idx_taxonomia_tenant_redundante.sql` (DROP INDEX IF EXISTS + rollback que recria). ⚠️ NÃO aplicada — janela do dono.
- Wizard não expõe ambiente-first no passo 3 (só na aba Itens) — melhoria de UX.

## Elo / idempotência (A2)
- **`hub_obras.projeto_id` + UNIQUE** (FK reversa) — mata de vez o R2 (janela criar-obra→PATCH do elo) e a race residual. Requer migração (sai do escopo zero-migração de A2).
- Mapa `tipologia→tipo_obra` (comercial→servico, corporativo→construcao) — **validar com o dono** (mitigado: chip editável).

## Compras/estoque (E5)
- Idempotência da cascata: avaliar UNIQUE em `hub_estoque_mov` (hoje LLEAST(qtd_pedida) protege o item).
- ~~Saída/Devolução compartilham handler (abre sempre 'saida') — prop trivial.~~ **RESOLVIDO (AUT-12):** o backend (`/api/crm/obras/[id]/estoque`) já é um handler único correto; o problema era no front (`ObraComprasEstoqueSecao.tsx`) — os dois botões do card chamavam `setMovItem(r)` idêntico e o drawer abria sempre em `tipo="saida"`. Unificado via `abrirMov(item, tipo)` + prop `tipoInicial` no `DrawerMovimentacao`. Comportamento preservado (o toggle dentro do drawer continua).

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

## Código morto — Escritório virtual legado (AUT-16)
> Rotas-raiz legadas que rodavam sobre o "escritório virtual" (mock + componentes `components/office/*`), fora do menu, substituídas pelo CRM. `/office` já redireciona p/ `/crm` (opção A, decisão do dono — **mantido**).
- **FEITO (parcial, baixo risco):** removidas as 2 rotas-raiz órfãs `app/comando/page.tsx` e `app/agentes/page.tsx`. Confirmado por grafo de imports + grep: **zero links vivos** apontam para elas (`href="/comando"`/`push("/comando")`/`href="/agentes"` raiz não existem no app vivo); o menu (`lib/crm-nav-groups.ts`) só usa `/crm/agentes` e `/crm/agentes-reais`. A **colisão `/agentes` × `/crm/agentes`** fica resolvida: sobra só a rota viva `/crm/agentes`. Gates após remoção: tsc 0 + vitest 632 verde.
- **FLAG p/ follow-up (deleção em massa — commit próprio):** com as 2 rotas fora, tornam-se órfãos (confirmado por grafo de dependências, sem consumidor vivo):
  - **Componentes:** TODOS os ~44 de `components/office/*` (ex.: `DecisionPanel`, `OfficeCanvas`, `AgentsDrawer`, `MobileOfficeMap`, `Lead360Drawer`, `Partner360Drawer`, painéis, mobile…).
  - **Hooks:** `hooks/useOfficeLife.ts`, `hooks/useLiveLeads.ts` (importam `OfficeCanvas`; sem consumidor vivo).
  - **Mocks `lib/data/`:** `agents-mock.json`, `decisions-mock.ts`, `leads-mock.ts`, `live-leads.ts`, `office-mobile-map.ts`, `partners-mock.ts`.
  - **API protótipo:** `app/api/agents/[id]/route.ts` (lê/grava `agents-mock.json` via `fs`; consumido só por `AgentLogPanel`, morto).
  - ⚠️ **NÃO REMOVER `lib/data/office-map.ts`:** está **VIVO** — `components/crm/CrmSessionFooter.tsx:9` importa `getInitials()`. Se for limpar, extrair `getInitials` para `lib/utils/` antes.
  - ⚠️ **NÃO REMOVER `/api/hub/agentes`:** crítico p/ o CRM vivo (13+ consumidores: `/crm/agentes`, ciclos, ferramentas, wizards, playbook…).
  - **Por que NÃO removi agora:** é deleção de ~50 arquivos — ultrapassa o escopo "P" do item e merece seu próprio commit/revisão. As 2 rotas (acima) já matam a confusão de rota e o ponto de entrada; o resto é higiene de bundle sem urgência. Régua: só removi o comprovadamente morto, isolado e de baixo risco; o restante fica flagado.
- **`app/office/` (layout.tsx + page.tsx) MANTIDO de propósito:** `page.tsx` faz `redirect('/crm')` (decisão do dono); remover mudaria o comportamento de uma rota possivelmente em bookmarks/links externos.

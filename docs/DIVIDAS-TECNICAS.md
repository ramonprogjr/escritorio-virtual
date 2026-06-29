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

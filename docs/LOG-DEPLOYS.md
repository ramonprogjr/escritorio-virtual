# 📋 LOG DE DEPLOYS / AVANÇO

> Log cronológico dos marcos e deploys. Todos com `tsc 0 + vitest verde + build 0 + git pull --rebase` antes do push, salvo nota. Branch: `wendel/dev` → `feature/escritorio-visual` (Render auto-deploy). Detalhe de cada rodada nos relatórios linkados.

## 🔙 Pontos de retorno (tags)
- `estado-01jul-pos-auditoria` → `43e8177` — pós-auditoria + Batch 1/2/UX de segurança. **Estado bom conhecido.**

---

## 01/jul/2026 — Auditoria enterprise + remediação de segurança
| Commit | O quê | Gate |
|---|---|---|
| (auditoria) | **Auditoria enterprise** (17 agentes adversariais) → REPROVADO 3.5/10. Achado-raiz: **middleware morto** (verificado no build manifest). Docs: AUDITORIA-ENTERPRISE, REMEDIACAO-AUDITORIA. | — |
| `9e5c7b9` | **Batch 1 segurança:** guards (requireCrm*) + tenant em ~13 rotas privilegiadas abertas de `hub/agentes/**` + `hub/cargos/**` (uazapi apagava WhatsApp sem login; sugerir-conhecimento = DoS de IA). | tsc0 vitest666 |
| (Batch 2) | **Batch 2 segurança:** IDOR imóveis (tenant+posse), PATCH /api/leads (whitelist+posse), rag-documentos (guard), injeção PostgREST na `busca` (novo lib/crm/sanitizar-busca-postgrest.ts em 6 rotas). | tsc0 vitest666 |
| `43e8177` | **UX críticos:** reabilita zoom (WCAG 1.4.4) + fim do loading infinito no Atendimento. Push dos 3 juntos (rede tinha caído). | tsc0 vitest666 build0 |
| — | **Organização:** docs/00-LEIA-PRIMEIRO-ESTADO, LOG-DEPLOYS, tag de retorno, memória compactada. Mapa: MACRO-PLAN-ATUALIZADO. | — |

## 01/jul/2026 (tarde) — Blindagem anti-regressão + funil KPI (janela autônoma)
| Commit | O quê | Gate |
|---|---|---|
| (já no ar) | **Batch 3/4 + gate de créditos + /api/atividades** — varredura das 152 rotas → críticas fechadas + fail-closed em 19 arqs; `assertSaldoAntesDoLLM` (modo sombra). | tsc0 vitest679 |
| `7aae1f2` | **Batch 5** — fecha as 4 últimas rotas service-role SEM guard nenhum (`/api/agentes` GET→sessao/POST+PATCH→gestor, `/agentes/mobile`, `/agentes/[slug]/detalhes`, `/ml/aprovar`→gestor). `/api/agentes` GET **vazava `uazapi_instance_token`** (credencial WhatsApp) → `sanitizarAgenteHubParaCliente`. **`lib/crm/guard-coverage.test.ts`** = gate que QUEBRA O BUILD se rota nova usar service-role sem guard/allowlist. **`.github/workflows/ci.yml`** (tsc+vitest). Verificado por auditoria adversarial (4 lentes); `ml/aprovar` "cross-tenant" = falso-positivo (ML é Hub-global). | tsc0 vitest682 build0 |
| `ee35216` | Reforça o gate (passa a detectar `crmHandoffDb`) + **`lib/http/erro-publico.ts`** redige o erro cru nas 4 rotas PÚBLICAS (não vaza tabela/coluna do Postgres). | tsc0 vitest682 build0 |
| `3d4b59c` | **Funil KPI (hub_eventos)** — instrumenta `negocio_criado` (POST) + `negocio_ganho/perdido/etapa_mudou` (PATCH) best-effort. Funil capta→fecha completo (`lead_criado`+`estagio_alterado` já existiam). | tsc0 vitest682 build0 |

**🔴 Parado para a JANELA DO DONO (fazer juntos):** 17 migrações (docs/PLANO-APLICAR-MIGRACOES) + escrow `GREATEST`/`FOR UPDATE` + rotate `service_role` + del `backup-auto.yml` + `.env` fora do OneDrive + Mistral key + **ligar middleware** (proxy.ts tem `export function proxy`+config do Next 16, mas o manifest sai vazio no 16.2.4 → provável flag no next.config OU rename; auditar `isPublicApiPath` + testar login juntos).

## 30/jun/2026 (tarde) — Maratona mobile + decisões do dono
| Deploy | O quê |
|---|---|
| #28 | **H-SEC-1** (chave interna fora do browser — refactor de auth) + G-D1 (health owner-only) + G-D2 (esconder stub). *Auditada GO na época — depois a auditoria enterprise mostrou que o middleware nunca rodou.* |
| #29 | **F-D2 escrow** — 2 autoridades (chave Hub=owner, chave Arq=gestor≠owner), fail-closed. Auditada GO. |
| #30–#33 | **Mobile lotes B1/B2C/A/D:** zoom-iOS, tipografia ≥12px, toque 44px, cores da marca, −80px de chrome, grids responsivos. |
| #34–#37 | Relatório + cleanup + CC-12 (tabelas→cards) + Lote F (polish seguro). Doc: MARATONA-2H-RELATORIO. |
| #38 | **Cabeçalho ÚNICO no mobile** — mata o chrome triplo + o buraco da safe-area (env do 2º header no iPhone real) + scroll do dono. −122px. |
| #39 | Verificação tela-a-tela (9 títulos + bug "Escritórios"→"Empresa") + fim das redundâncias (cabeçalho duplo/voltar/H1). |

## 30/jun/2026 (madrugada) — GRANDE FINALE E2E
- **9/9 domínios** (H,B,A,C,D,E,F,G,I) auditados adversarialmente → corrigidos → deployados (~26 deploys). Tema: **segurança multi-tenant** (guards server-side + `.eq(tenant_id)` + escrow blindado + segredos fora do browser). Doc: RESUMO-NOITE-E2E-FINALE + E2E-DOMINIO-*-ACHADOS.

## ≤ 28/jun/2026 — núcleo comercial
- CRM completo (cadastros código único, funil/Kanban, atendimento IA+humano WhatsApp, distribuição de leads, agentes IA/copiloto, financeiro, metering de créditos). Handoffs históricos em docs/ (superados pelos acima).

---
*Regra: cada deploy é aditivo, com gates verdes. Migração em prod só na janela do dono.*

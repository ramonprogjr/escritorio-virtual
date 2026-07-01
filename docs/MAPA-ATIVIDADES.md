# 🗺️ MAPA DE ATIVIDADES — por fase

> Atividades para concluir o projeto, por macrofase. Status: ⬜ não-iniciado · 🟨 parcial · 🟩 pronto · 🔒 bloqueado-dono. Esforço: P/M/G/GG. Detalhe de sprint em [ROADMAP-EXECUCAO.md](ROADMAP-EXECUCAO.md); versões em [ESCOPO-MVP-V1-V2.md](ESCOPO-MVP-V1-V2.md).

## FASE 0 — Fundação segura (caminho crítico; bloqueia tudo)
| Atividade | Status | Dep. | Esf. | Prio |
|---|---|---|---|---|
| Rotate service_role + deletar backup-auto.yml + .env fora do OneDrive | 🔒 dono | — | P | 🔴 |
| Setar Mistral/HMAC + CRON_SECRET + tirar NEXT_PUBLIC_* | 🔒 dono | — | P | 🔴 |
| Aplicar as ~19 migrações (janela do dono) | 🔒 dono | plano pronto | M | 🔴 |
| Ligar o middleware (rename + verificar allowlist + testar) | 🟨 | allowlist | M | 🔴 |
| Guards nas rotas privilegiadas abertas | 🟩 Batch1/2 no ar; 🟨 resto (cotações/atividades/encaminhamentos) | middleware | M | 🔴 |
| RLS: matar USING(true), ligar RLS fornecedores, corrigir policy financeiro | 🔒 migração | migrações | G | 🔴 |
| Backfill tenant_id + trocar tenantScopeOrFilter por .eq puro | 🟨 | RLS | M | 🔴 |
| Escrow: remover GREATEST + FOR UPDATE + UNIQUE liberação | 🔒 migração | E6 aplicada | M | 🔴 |
| Webhook/cron HMAC real + timing-safe | 🟨 | — | M | 🔴 |

## FASE 1 — Núcleo perfeito (sem depender do dono)
| Atividade | Status | Esf. | Prio |
|---|---|---|---|
| hub_eventos de verdade (registros/próxima-ação/timeline/KPIs reais) | 🟨 (tabela existe, não usada) | G | 🟠 |
| Funções que faltam (agendar reunião, registrar interação, SLA real) | ⬜ | M | 🟠 |
| Dedup do intake por código único | 🟩 (garantir-pessoa-lead no ar) | — | ✅ |
| Higiene de dados de teste (com backup) | ⬜ | P | 🟠 |
| tabela→cards restantes | 🟨 | M | 🟢 |

## FASE 2 — Multi-tenant real + monetização-base
| Atividade | Status | Esf. | Prio |
|---|---|---|---|
| current_user_tenant_id() dinâmica + fornecedor_id + ≥2 tenants | 🟨 (fundação aplicada) | G | 🟠 |
| Gate atômico de créditos ANTES do LLM + recarga | 🟨 (modo sombra) | G | 🟠 |
| Entitlements SaaS (planos/assinatura/requireModulo) | ⬜ não-existe | GG | 🟠 |
| Integridade do split de comissão (imutável + snapshot) | ⬜ | G | 🟠 |
| Dashboard do Hub + distribuição persistida dedicada | 🟨 | G | 🟠 |

## FASE 3 — IA-first pleno + rede
| Atividade | Status | Esf. |
|---|---|---|
| Prompt-injection/RAG cross-tenant/memory-poisoning (blindar) | ⬜ | G |
| Wrapper único de LLM sempre com metering (fim do cego) | 🟨 | M |
| Marketing/tráfego (IA Google+Meta) | ⬜ (dono toca) | G |
| Rate-limit distribuído (Redis) + worker-only WhatsApp | ⬜ | M |

## FASE 4 — AEC (código pronto, latente)
| Atividade | Status | Esf. |
|---|---|---|
| Ativar E0–E7/A0–A2 (após migrações) | 🟨 código-pronto | M |
| Estrutura Unificada fases 1–4 | 🟨 | G |
| **Orçamento IA (PDF→planilha)** — a capability-mãe | ⬜ design-pronto | GG |
| Central de Aprovações unificada | 🟨 | G |
| Gestor de Tarefas universal | ⬜ design-pronto | GG |
| Portal do Cliente | ⬜ design-pronto | GG |

## FASE 5 — Moat / longo prazo
Marketplace/iFood, operação de campo (tablet/totem), CRM cross-conta pleno, verticais restantes — ⬜ visão.

## FASE 6-7 — Enterprise + Escala
LGPD/governança/API pública/SLA/multi-unidade (⬜); CI/CD, healthcheck, observabilidade, DR (🟨 fraco → prioridade média-alta pré-produção).

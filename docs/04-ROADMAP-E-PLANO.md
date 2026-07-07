# Roadmap & Plano

> **Documento VIVO — um dos 5 que o time SEMPRE segue.** Consolida a Análise CEO (plano faseado) + o
> **CADERNO-ENGENHARIA-AUDITORIA.md** (backlog de Work Items ancorado no código). Atualizado 07/jul/2026.
> Companheiros: [00-Painel](00-PAINEL-DE-CONTROLE.md) · [01-Negócio](01-NEGOCIO-E-ESTRATEGIA.md) · [02-Produto/UX](02-PRODUTO-TELAS-E-UX.md) · [03-Arquitetura](03-ARQUITETURA-DADOS-E-SEGURANCA.md).
> **Detalhe técnico de cada WI (como implementar, arquivo:linha, aceite):** [CADERNO-ENGENHARIA-AUDITORIA.md](CADERNO-ENGENHARIA-AUDITORIA.md).

---

## Princípio de ordenação (não pule)

**Irreversível primeiro** (linhagem) → **ligar o represado** (AEC/comissões/escrow na janela) → **operar sem
planilha** (funis/SLA/CAC) → **cobrar** (carteira/billing) → **endurecer para a rede** (multitenant/RBAC). Cada
fase tem critério de pronto binário. Gates de qualidade em toda entrega: `tsc` + `vitest` verdes; migração aditiva
e reversível; migração em prod só na **janela do dono**; screenshot antes/depois em UI.

---

## Onde estamos

**Núcleo comercial ~90% · visão completa ~30–40%.** Altitude 2 (dentro do tenant) construída; Altitude 1 (Hub
acima da rede) desenhada. IA/Mistral desligada ~60 dias. Motor de comissões construído+testado, mas **gated**
(tabelas vazias). Escrow/AEC file-only. **Sprint 07/jul shipado:** Leads rebuild · Funil do Hub · O que travou ·
Dashboard andares · Cadastros (filtros + Ver).

**Decisões travadas 07/jul:** ✅ clawback = **cobrar sempre** + mitigações (hold + estorno + régua) · ✅ **fechar
a linhagem** (`negocio_pai_id`/`raiz_id`) antes de dado de rede.

---

## Backlog Mestre de Work Items (do CADERNO §14)

Prioridade: **P0** = irreversível/bloqueia dinheiro · **P1** = MVP/receita · **P2** = rede/escala. Esforço: P (<1d) · M (1–3d) · G (1–2 sem).

| WI | Título | Fase | Prio | Esf. | Depende de |
|---|---|---|---|---|---|
| **RAS-01** | Linhagem pai/raiz **escrita pelo app** ⚠️ irreversível | 0 | **P0** | M | FND-01 |
| RAS-02 | UNIQUE código + auto-código no banco | 0 | P0 | M | — |
| RAS-03 | `hub_eventos.ator_id` (quem, não só o papel) | 0 | P1 | P–M | — |
| **MET-01** | Fix markup ≥1 (hoje aceita 0/neg = IA de graça) | 0 | **P0** | P | — |
| IA-02 | `ml.ts` sem modelo hardcoded (fallback) | 0 | P1 | P | — |
| FIN-03 | Guard UI `valor_fechado` NULL no ganho | 0 | P1 | P | — |
| EST-03 | Blindar CHECK `hub_atividades` (quebra silenciosa) | 0 | P1 | P | — |
| IA-01 | Ligar Mistral + validar engine | 1 | P1 | P* | MET-01, IA-02, **credencial** |
| FND-01 | Baseline migration (schema reconstruível) | 2 | P1 | G | — |
| OBR-01 | Aplicar camada AEC (E0–E7/A0–A1) na janela | 2 | P1 | G | FND-01 |
| OBR-02 | Medição append-only atômica (RPC) | 2 | P1 | M | OBR-01 |
| **FIN-02** | **Fix escrow** (custódia fantasma) + aplicar E6 | 2 | **P0** | M | OBR-01 |
| FIN-01 | Motor de comissões em produção | 2 | P1 | M | TEN-03(vínculos), FND-01 |
| LEAD-02 | Consolidar vocabulário de estágio (risco loop P0) | 3 | P1 | M | — |
| EST-01 | Funis próprios por mercado (config, não re-arq) | 3 | P1 | M | LEAD-02 |
| EST-02 | Entrega correta IMB/FOR/PRO (não "vira obra") | 3 | P1 | M | decisão dono |
| LEAD-01 | SLA com relógio + cron de redistribuição | 3 | P1 | G | — |
| RAS-04 | Resolver de rastreio cobre os 14 prefixos | 3 | P2 | M | — |
| RAS-05 | MDO fonte única + alocação obra↔especialista | 3 | P1 | G | obra em prod |
| EVT-01 | Analytics consome `hub_eventos` + UTM + CAC | 3 | P1 | G | — |
| FND-02 | Centralizar `crmDb` (matar 82 clients inline) | 3 | P2 | G | — |
| MET-02 | Consumo de IA atômico (RPC) | 4 | P1 | M | — |
| MET-03 | Carteira fase 1 + top-up PIX | 4 | P1 | G | MET-02 |
| MET-04 | Régua de aviso 7/3/1 + ligar `IA_HARD_CAP` | 4 | P1 | M | MET-03 |
| MET-05 | Billing SaaS/MRR mínimo | 4 | P1 | G | MET-03, decisões |
| TEN-01 | Backfill `tenant_id` NULL → sentinela + NOT NULL | 5 | **P0(rede)** | G | RAS-02 |
| TEN-02 | `.eq` puro nas policies (tira `OR IS NULL`) | 5 | P0(rede) | G | TEN-01 |
| TEN-03 | Fechar RLS das tabelas abertas (vínculos→Fase 2) | 5/2 | P0(rede) | M | TEN-01/02 |
| TEN-04 | Hierarquia de tenant (`tenant_type`/`parent`) | 5 | P0(rede) | M | TEN-01/02/03 |
| RBAC-01 | Rotacionar `INTERNAL_API_KEY` + tirar do browser | 5 | P0(rede) | M | — |
| RBAC-02 | Chave Hub à pessoa física (não ao papel owner) | 5 | P0(rede) | M | TEN-04 |
| RBAC-03 | `resolveInviteTenantId` restrito ao próprio/filhos | 5 | P0(rede) | P | TEN-04 |
| RBAC-04 | Tirar owners hardcoded + arquivar revoga acesso | 5 | P1 | P–M | — |
| RBAC-05 | Guard de papel nas ~32 rotas service-role | 5 | P0(rede) | G | FND-02 |
| LGPD-01 | Fluxo de anonimização (direito ao esquecimento) | 5 | P1 | M | RAS-01 |
| POR-01 | Portal do Cliente MVP | 7 | P1 | G | OBR-01, FIN-02 |
| LEAD-03 | Paginação/pré-filtro no motor (>100) | 6 | P2 | M | — |
| IA-03 | Caminho de tools p/ Anthropic | 4+ | P2 | M | IA-01 |

\* IA-01 = esforço de código baixo, mas **gated por credencial + billing** (dependência do dono).

---

## Sprints (do CADERNO §15)

**Sprint 1 — Fase 0 (estancar o irreversível):** RAS-01 · RAS-02 · MET-01 · IA-02 · FIN-03 · RAS-03 · EST-03.
*Pronto:* nenhum negócio novo sem raiz; markup <1 rejeitado; `/api/ml/*` não quebra; ganho sem valor avisa.

**Sprint 2 — Fase 1 (IA):** IA-01 (assim que Mistral + billing forem liberados pelo dono).
*Pronto:* lead WhatsApp → qualificado por IA → confirmado em 1 toque.

**Sprint 3–4 — Fase 2 (janela grande):** FND-01 · OBR-01 · OBR-02 · FIN-02 · FIN-01 · TEN-03(só `hub_negocio_vinculos`).
*Pronto:* obra real com EAP+medição+escrow dupla-chave; comissão PREVISTA→PAGA; schema reconstruível.

**Sprint 5–7 — Fase 3 (operar sem planilha):** LEAD-02 · EST-01 · EST-02 · LEAD-01 · RAS-04 · RAS-05 · EVT-01 · FND-02.
*Pronto (critério-mãe do MVP):* próximo cliente real roda ponta-a-ponta **sem planilha**.

**Sprint 8–10 — Fase 4 (cobrar):** MET-02 · MET-03 · MET-04 · MET-05.
*Pronto:* primeiro real de MRR + primeiro Tijolo cobrado.

**Sprint 11+ — Fase 5 (endurecer p/ rede):** TEN-01/02/03/04 · RBAC-01..05 · LGPD-01.
*Pronto (gate do 2º tenant):* teste de intrusão interno passa; nenhum tenant lê outro.

**Depois:** Fase 6 (piloto de rede) · Fase 7 (Altitude 1 + Portal) · Fase 8 (escala/internacional).

---

## O que só o DONO destrava

| Item | Destrava | Tipo |
|---|---|---|
| **Chave Mistral** (+ billing) | IA-01 / toda a Fase 1 | Credencial |
| **Janela de migração** (Fase 2) | FND-01, OBR-01, FIN-02, FIN-01 — juntas | Janela Supabase |
| **Migração da linhagem** | RAS-01 (o irreversível) | Janela Supabase |
| **Janela altitude 1** (RLS Faixa B *real*) | Fase 7 (Hub lê a rede + Dinheiro do Hub) | Janela Supabase |
| **Decisão de preços SaaS** (planos) | MET-05 (billing) | Decisão |
| **Política de hold do clawback** (dias) | Fase 5 (liberação segura) | Decisão |
| UAZAPI · HaveIBeenPwned · Deploy Hook | WhatsApp · segurança · deploy | Config |

---

## Nota de execução (loop)

Trabalhamos em **loop curto**: uma WI de cada vez → build → mostrar (E2E ao vivo) → dono reage → ajusta →
backup. Ao concluir uma WI, atualizar o estado aqui e no [00-Painel](00-PAINEL-DE-CONTROLE.md) (âmbar→verde só
quando verde de verdade). **Nunca marcar verde o que está âmbar.**

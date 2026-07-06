# 🧭 DIAGNÓSTICO DE DIREÇÃO DO PROJETO — Obra10+ (01/jul/2026)

> **Pergunta central do dono:** *"Depois de tantas mudanças, ainda estamos no caminho certo? O que já foi feito, o que falta, e qual o plano real com cronograma?"*
>
> Este é o **relatório-mãe**. Síntese de 3 frentes de auditoria (status por módulo, proposta-inicial vs hoje, plano de execução) + a auditoria enterprise + o macro-plan. Sem implementar nada — só diagnosticar, organizar e planejar.
>
> **Documentos-satélite:** [STATUS-MODULOS.md](STATUS-MODULOS.md) · [PROPOSTA-INICIAL-E-EVOLUCAO.md](PROPOSTA-INICIAL-E-EVOLUCAO.md) · [ESCOPO-MVP-V1-V2.md](ESCOPO-MVP-V1-V2.md) · [CRONOGRAMA-PROJETO.md](CRONOGRAMA-PROJETO.md) · [ROADMAP-EXECUCAO.md](ROADMAP-EXECUCAO.md) · [PLANO-90-180-365-DIAS.md](PLANO-90-180-365-DIAS.md) · [AUDITORIA-ENTERPRISE.md](AUDITORIA-ENTERPRISE.md) · [MACRO-PLAN-ATUALIZADO.md](MACRO-PLAN-ATUALIZADO.md)

---

## 1. Sumário Executivo

**Estamos no caminho certo? → PARCIALMENTE — e é corrigível.**

O produto tem **alma clara e um núcleo comercial que funciona** (CRM, atendimento, distribuição, agentes — ~90% apresentável). O crescimento foi, na maior parte, **saudável e aditivo**: a disciplina "nada quebra, migração latente, reversível" impediu que a ambição corrompesse o que roda. Isso é raro e valioso.

**Mas há dois desvios reais que precisam de correção de rumo:**

1. **Sequência de valor invertida.** Construiu-se **profundidade** (a camada de obra/AEC inteira, em código) **antes de fechar a largura vendável**. O **item nº1 do MVP original — a IA respondendo leads em produção — está bloqueado há ~60 dias só por falta da chave de API** (era a "tarefa de 5 min" da Fase 0). Enquanto isso, uma camada AEC de ~19 migrações foi construída à frente, mas está **dormente** (não aplicada em prod).

2. **A fundação de segurança não acompanhou.** A auditoria enterprise (REPROVADO 3.5/10) achou — e eu confirmei no build — que **o middleware de auth é código morto**, que a RLS multi-tenant tem furos `USING(true)`, que o escrow libera de custódia fantasma, e que a `service_role` está exposta. **Não é multi-tenant de verdade ainda — é single-tenant disfarçado.**

**Tradução:** o projeto não está perdido nem inchado sem controle — está com **ordem de execução trocada**. A correção é conhecida: **fechar a fundação segura + ligar a IA + ativar o que já está construído**, antes de abrir novas frentes (portal, marketplace).

**Barômetro honesto:**
- **Núcleo comercial apresentável:** ~90%.
- **MVP seguro + operável (1 tenant real):** ~70% — falta a Fase 0.
- **Visão completa (multi-tenant + AEC + monetização + portal + marketplace):** ~40%.

---

## 2. Proposta Inicial × Produto Atual (resumo — detalhe em [PROPOSTA-INICIAL-E-EVOLUCAO.md](PROPOSTA-INICIAL-E-EVOLUCAO.md))

- **Era (03–08/mai):** uma *agência de marketing/growth por IA* com intermediação de parceiros; produto-âncora = "Escritório Virtual" (agentes IA como funcionários) + CRM + WhatsApp. MVP datado **27/05** "100% funcional para parceiros/fornecedores". Schema: 11 tabelas `public.*` sem tenant.
- **Virou (jun–jul):** uma **plataforma Hub multi-tenant do ciclo AEC completo** (vender + executar obra no mesmo sistema). 97 migrações `hub_*`, CRM de 6→40 telas, + 3 camadas novas (estrutura unificada, Portal do Cliente, monetização 3 pernas).
- **Veredito:** crescimento **saudável na maior parte** (a alma se manteve, o núcleo melhorou), mas com **scope creep de visão** — profundidade antes da largura + o prazo original estourado.

---

## 3. Estado por Módulo (resumo — tabela completa em [STATUS-MODULOS.md](STATUS-MODULOS.md))
- **Funcional no ar:** CRM, Atendimento, Distribuição, Parceiros, RBAC, Membros (mas IA desligada + tenant frágil).
- **Construído mas DORMENTE (só falta migrar):** Obras (E0–E7), Arquitetura (A0–A1), Compras (E5), Escrow (E6).
- **Inseguro até a Fase 0:** Multi-tenant, Financeiro, Escrow.
- **Só design/visão:** Portal do Cliente, Marketplace, Billing SaaS.
- **A capability-mãe que falta:** Orçamento IA (memorial PDF → planilha).

---

## 4. MVP / V1 / V2 / V3 (detalhe em [ESCOPO-MVP-V1-V2.md](ESCOPO-MVP-V1-V2.md))
- **MVP — Fundação Segura + Núcleo:** segurança fechada (middleware, RLS, escrow, secrets) + IA ligada + 1 tenant real usando CRM/atendimento/distribuição de verdade. *Critério: uma empresa real opera com segurança mínima e a IA responde leads.*
- **V1 — SaaS Multi-Tenant Comercial:** multi-tenant real (≥2 tenants isolados) + entitlements/planos + gate de créditos + dashboard do Hub. *Critério: vendável com confiança aos primeiros clientes.*
- **V2 — Rede + Obra + Moat:** ativar AEC + Estrutura Unificada + **Orçamento IA** + Central de Aprovações/Tarefas + Portal do Cliente. *Critério: o diferencial (cérebro da obra) no ar.*
- **V3 — Enterprise:** governança/LGPD/auditoria/API pública/escala + marketplace + operação de campo.

---

## 5. Cronograma realista (detalhe em [CRONOGRAMA-PROJETO.md](CRONOGRAMA-PROJETO.md))

| Cenário | MVP | V1 comercial | V2 (moat) | V3 enterprise | Risco |
|---|---|---|---|---|---|
| **A — 1 dev** | 6–8 sem | ~16–20 sem | +12–16 sem | +6 meses | alto (serial) |
| **B — 2–3 devs** ⭐ | **3–4 sem** | **~7–9 sem (~2 meses)** | +6–8 sem | +3–4 meses | médio |
| **C — equipe ideal** | 2–3 sem | ~5–6 sem | +4–6 sem | +2–3 meses | baixo |

> Premissa que atravessa tudo: a **Fase 0 (segurança) é o caminho crítico bloqueante e serial** — a maior parte da latência de calendário está nas **ações do dono** (infra/migração/chave), não em linhas de código.

---

## 6. Caminho crítico (detalhe em [ROADMAP-EXECUCAO.md](ROADMAP-EXECUCAO.md))
`Janela de infra do dono` → `ligar middleware + guards` → `RLS + backfill tenant + escrow correto` → `multi-tenant real + entitlements + gate de créditos` → `ativar AEC + Orçamento IA`.
Se qualquer elo dessa cadeia atrasar, o projeto inteiro atrasa. **Tudo o mais corre em paralelo a isto.**

---

## 7. Riscos principais
1. **Dependência do dono na Fase 0** (cadeia serial) — se as ações pingarem em vez de uma sessão concentrada, o MVP escorrega sem 1 linha a mais de código.
2. **Migração em prod às cegas** (divergência file×prod, `hub_alertas` drift) — aplicar sem checagem/backup pode quebrar prod.
3. **Ligar o middleware quebrando fluxo público** (ex.: intake) + **chave Mistral não configurada** (trava todo o IA-first).
4. **Segurança:** enquanto a Fase 0 não fecha, um 2º tenant = vazamento no 1º dia (LGPD) + custo de IA descontrolado.

---

## 8. O que CORTAR / ADIAR / SIMPLIFICAR
- **NÃO pode sair do MVP:** segurança (middleware/RLS/escrow/secrets), IA ligada, 1 tenant real, dedup de código único.
- **Adiar (pós-V1):** Marketplace, operação de campo/totem, Portal do Cliente completo, verticais imobiliário.
- **Simplificar agora:** Orçamento IA em v1 (humano confirma quantidades) antes de 100% automático; Central de Aprovações começar pela obra antes de unificar tudo.
- **Parece pequeno mas BLOQUEIA:** a chave Mistral (5 min, trava o MVP há 60 dias) e o rename do middleware (2h, mas app-wide).

---

## 9. Decisões pendentes do dono → [DECISOES-PENDENTES.md](DECISOES-PENDENTES.md)

---

## 10. PARECER FINAL (objetivo)

- **Estamos no caminho certo?** **Parcialmente.** A direção do produto é boa; a **ordem de execução** desviou.
- **O projeto está maior do que deveria?** A *visão* sim; a *execução* não — porque o excesso ficou **latente** (não custou estabilidade). Basta não ativar V2/V3 antes da fundação.
- **O MVP está bem definido?** Agora sim (§4). Antes estava difuso.
- **O cronograma é realista?** Sim, com a ressalva de que o gargalo é a **disponibilidade do dono para a Fase 0**, não a engenharia.
- **O que fazer IMEDIATAMENTE?** A **janela de infra concentrada** (rotate service_role + deletar backup-auto.yml + tirar .env do OneDrive + aplicar migrações + ligar Mistral) — resolve o maior risco (credencial/PII) E destrava o maior valor construído (AEC + IA) de uma vez.
- **O que NÃO fazer agora?** Não abrir Portal do Cliente, Marketplace ou Billing enquanto a Fase 0 não fechar — seria construir no ar.
- **Previsão realista de conclusão:** **MVP seguro em 3–4 semanas** e **V1 comercial vendável em ~2 meses** (cenário 2–3 devs), sendo a Fase 0 a primeira semana.

### Próximos 10 passos (ordem de valor × risco)
1. 🔴 **DONO:** rotate `service_role` + deletar `backup-auto.yml` + tirar `.env`/repo do OneDrive (vazamento ATIVO de credencial/PII).
2. 🔴 **DONO:** setar `MISTRAL_API_KEY` + `COPILOTO_HMAC_SECRET` (liga a IA — destrava o nº1 do MVP).
3. 🔴 **DONO+CEO:** janela de migração — aplicar as ~19 migrações (destrava a AEC inteira) com o plano de segurança.
4. 🔴 **CEO+DONO:** ligar o middleware (renomear + verificar allowlist fluxo a fluxo + testar login/intake).
5. 🔴 **CEO:** migração de RLS — matar `USING(true)`, ligar RLS em fornecedores, backfill tenant + `.eq` puro.
6. 🔴 **CEO:** escrow — remover `GREATEST` + `FOR UPDATE` + UNIQUE de liberação.
7. 🟠 **CEO:** terminar os batches de guard (cotações/atividades/encaminhamentos) + gate atômico de créditos.
8. 🟠 **CEO:** `hub_eventos` de verdade (KPIs reais) + validar os 3 testes de IA ao vivo com o dono.
9. 🟠 **CEO:** multi-tenant real (`current_user_tenant_id` dinâmica + ≥2 tenants) + entitlements SaaS.
10. 🟢 **CEO:** ativar a Estrutura Unificada + Orçamento IA (v1 humano-confirma) — o moat.

**Ordem-mãe: dinheiro → dados/segurança → largura vendável (IA+tenant) → profundidade já construída (AEC) → moat (Orçamento IA) → novas frentes.**

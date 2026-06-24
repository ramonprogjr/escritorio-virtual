# Pendências — Plataforma Obra10+

> Registro único do que ficou **em aberto**, para não se perder nada. Atualizar sempre que algo for concluído ou surgir. Complementa o roadmap em [PLANO-EXECUTIVO-BLOCOS.md](PLANO-EXECUTIVO-BLOCOS.md).
>
> **Legenda dono:** 🧑 Wendel (decisão/config) · 🤖 dev/IA (executável) · 🔒 trava (precisa Wendel presente).
> **Status:** 2026-06-24.

---

## 🔧 Configuração (Supabase / dashboard — 🧑 Wendel)
Sem isso, o "Esqueci minha senha" **não envia e-mail** de verdade:
- [ ] **Auth → URL Configuration → Redirect URLs:** incluir `http://localhost:3001/redefinir-senha` (+ URL de produção). **Sem curinga** (`*`).
- [ ] **Auth → SMTP:** configurar SMTP próprio (o padrão do Supabase quase não envia).
- [ ] **Auth → Rate limits / expiração** do link de recuperação (curto).
- [ ] **Auth → Password policy:** mínimo ≥8 + *leaked password protection* (alinhar ao client).
- [ ] **Trocar a senha** `A12345679` (foi enviada no chat → exposta) por uma forte.

## 👁 Validação (🤖)
- [x] **Validação visual via browser (24/jun):** login OK (senha A12345679), menu §8 renderiza, **QuickAdd FAB** visível, deep-link `?novo=1` abre o criador, **chips do lead confirmados** (Tipo de interesse + campo dinâmico viraram chips; Cidade segue texto). Login mostra "Esqueci minha senha".
- [ ] **Spot-check restante (opcional):** negócio/empresa/imóvel usam o MESMO `SmartField` (alta confiança), mas validar em **mobile** e o fluxo **/redefinir-senha** (depende de SMTP configurado) quando der.

## 🎨 UX / produto (decisão futura — 🧑 + 🤖)
- [ ] **`valor_estimado` do lead como faixa:** hoje é numérico (faixa exigiria guardar faixa vs número). Decidir.
- [ ] **SmartField modo "faixa"** com visual *ordinal* (segmented control) — hoje renderiza igual a chips.
- [ ] **ConfidenceBadge.onCorrigir** não ligado — depende da IA pré-preencher (Bloco 8).
- [ ] **Voz (Talk-and-Go)** — "no fim" do roadmap (decidir on-device vs serviço, custo/privacidade).
- [ ] **Mapear `error.message` do Supabase** para mensagens PT amigáveis no login (UX).

## 🔐 Segurança (consideração — 🤖 quando o fluxo existir)
- [ ] **/redefinir-senha** aceita sessão ativa comum (usuário logado troca senha sem reautenticar — padrão Supabase). Ao criar "trocar senha **dentro do app**", exigir a **senha atual** antes.

## 🔒 Segurança multi-tenant — ALTA prioridade (🔒 Wendel)
- [x] **RLS `hub_pipeline_estagios` tenant-aware — APLICADO (24/jun, autorização explícita).** Migração Supabase `rls_pipeline_estagios_tenant_aware` (escopo via pipeline-pai). Verificado: policies tenant-aware; Kanban segue OK (service role bypassa). Arquivo `docs/sql/20260624-rls-pipeline-estagios-tenant-APPLIED.sql`. → UI de config de etapas (B3) liberada.
- [ ] **Backfill `pipeline_id`** em leads/negócios antigos (migração aditiva) — agrupar com o trabalho de RLS de pipelines.

## 🗺 Cronograma (próximos blocos)
- [~] **Bloco 3 — CRM do fornecedor** — decisão do diretor: fatia segura. **Feito:** cartão acionável (próxima-ação no negócio + frescor reutilizável testado). **Próximo (Passos 3–5 do diretor):** ligar `PipelineConfigSideover` à API de pipelines (criar/renomear/ordenar/ativar etapa) + guard não-destrutivo. ⚠️ **Depende de tratar o RLS de pipelines acima** (escrita em tabela anon-open) — fazer com Wendel.
- [ ] **Bloco 4 — Visibilidade & Governança Hub** (RLS `fornecedor_id`, dashboard) — 🔒 só com Wendel.
- [ ] **B5 distribuição · B5.5 monetização · B6 obra · B7 membros · B8 IA** — futuros (ver plano).

## ✅ Concluído recente (24/jun — referência)
Bloco 1 (menu §8), Bloco 1.5 (auditoria + Escritórios), Bloco 2/U2 (QuickAdd + SmartField/ConfidenceBadge + chips em lead/negócio/empresa/imóvel + sideover edição + `disabled` uniforme), "Esqueci minha senha" + `/redefinir-senha` + hardening, **fix login intermitente** (retry no `crm-session` — 401 transitório), validação visual do lead via browser. Suíte 178/178.

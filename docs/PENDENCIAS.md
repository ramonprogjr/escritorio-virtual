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

## 👁 Validação (🤖 em andamento)
- [ ] **Validação visual** desktop + mobile das telas com chips (lead, negócio, empresa, imóvel), do **QuickAdd (FAB)**, e do fluxo **login → esqueci senha → /redefinir-senha**. *(em execução via browser nesta sessão)*

## 🎨 UX / produto (decisão futura — 🧑 + 🤖)
- [ ] **`valor_estimado` do lead como faixa:** hoje é numérico (faixa exigiria guardar faixa vs número). Decidir.
- [ ] **SmartField modo "faixa"** com visual *ordinal* (segmented control) — hoje renderiza igual a chips.
- [ ] **ConfidenceBadge.onCorrigir** não ligado — depende da IA pré-preencher (Bloco 8).
- [ ] **Voz (Talk-and-Go)** — "no fim" do roadmap (decidir on-device vs serviço, custo/privacidade).
- [ ] **Mapear `error.message` do Supabase** para mensagens PT amigáveis no login (UX).

## 🔐 Segurança (consideração — 🤖 quando o fluxo existir)
- [ ] **/redefinir-senha** aceita sessão ativa comum (usuário logado troca senha sem reautenticar — padrão Supabase). Ao criar "trocar senha **dentro do app**", exigir a **senha atual** antes.

## 🗺 Cronograma (próximos blocos)
- [ ] **Bloco 3 — CRM do fornecedor** (pipelines/kanban customizáveis por tenant) — 🤖 próximo.
- [ ] **Bloco 4 — Visibilidade & Governança Hub** (RLS `fornecedor_id`, dashboard) — 🔒 só com Wendel.
- [ ] **B5 distribuição · B5.5 monetização · B6 obra · B7 membros · B8 IA** — futuros (ver plano).

## ✅ Concluído recente (24/jun — referência)
Bloco 1 (menu §8), Bloco 1.5 (auditoria + Escritórios), Bloco 2/U2 (QuickAdd + SmartField/ConfidenceBadge + chips em lead/negócio/empresa/imóvel + sideover edição + `disabled` uniforme), "Esqueci minha senha" + `/redefinir-senha` + hardening. Suíte 178/178.

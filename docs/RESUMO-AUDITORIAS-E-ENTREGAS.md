# Obra10+ · Painel de Auditorias & Entregas

> Ponto da maratona — **07 de julho de 2026**. Produção no novo Render.
> **13 entregas no ar** · **4 auditorias Fable** (1 rodando) · **E2E ao vivo validado ✓**
> Cada leva: gate verde (tipos · 808 testes · build) + backup no GitHub de segurança.

---

## ✅ No ar agora (deployado + com backup)

| Área | O que subiu | Marca |
|------|-------------|-------|
| **Dinheiro** | Faixa de split · *Meu Dinheiro* (extrato) · Indicar em 1 toque · undo de baixa (menu ⋮) · confirmação pós-ganho “o que nasceu” | motor de comissões |
| **Lead** | Bug do **Direcionar** morto · barra/badge no funil · chip de prontidão · Dados editável inline | P0 · P1 |
| **Lead · IA** | A IA move sozinha e avisa · caminho manual deixa de ser mudo · ação da IA visível na Conversa · logs só p/ admin | F1 · F3 · F7 |
| **Lead** | **Propostas com ciclo de vida completo** (enviar → aceita/recusar → reenviar, carimbos, “expira em”) + Gerar rascunho IA | P2.1 |
| **Cadastros** | Hierarquia dos botões · criação determinística Pessoa/Empresa · **código de identidade escondido** | ProMax P0 |
| **Vínculos** | **Criar-e-vincular na hora**: digita o nome que não existe → cria rascunho + vincula, sem sair da sessão | nada se perde |
| **Negócios** | Label “novo_negocio” humanizada · backlink lead→negócio de volta · kanban com estágios de negócio | P2 |
| **Dashboard** | Removida a “Visão comercial” — Pipeline **duplicado** + 6 cards de vaidade | P0 |

---

## 🔎 As auditorias (mesa Fable + E2E ao vivo)

### 1. Dashboard — veredito: **REFAZER**
“O CEO pergunta, o Fable responde.” Home nobre, mas ~80% vitrine.
- ⛔ O Hub é um **negócio** e a tela não mostra **um centavo dele** (MRR, comissão da rede) — **buraco #1**
- ⛔ “IA-first” é falso: o próprio código diz “sem IA/Mistral”
- ⛔ Pipeline R$ 250k aparece **2×** · parede de “0%” · dado de TESTE na home
- ✅ Fica só o herói: **“O que precisa de você”** (fila com botão)
- **Alvo:** Dinheiro do Hub + Operação por exceção + faixa IA que fala o dia
- Laudo: `docs/AUDITORIA-DASHBOARD-CEO.md`

### 2. Cadastros — **P0 no ar**
Queixa: “botões feios, disfuncionais, mal aproveitados”. 6 lentes ProMax.
- 4 formas de criar competindo → 1 primário claro + menu Pessoa/Empresa **(feito)**
- Código de identidade exposto → escondido **(feito)**
- 3 buscas + 5 filtros apertados → unificar *(plano)*
- IA-first: cadastrar por voz/colar, dedup proativa *(plano — precisa Mistral)*
- Laudo: `docs/AUDITORIA-CADASTROS-UIUX-PROMAX.md`

### 3. Ciclo do lead — **validado E2E ao vivo**
Raiz: confundia **posição no funil** com **prontidão**. P0/P1/P2 no ar.
- Direcionar exige prontidão (interesse+valor) — sem loop
- Editar na mão → a IA move + sugere parceiro + registra
- Propostas com ciclo de vida + carimbos
- **Testado ao vivo no lead real “Fabio” — tudo passou**
- Laudo: `docs/AUDITORIA-CICLO-LEAD-v1.md`

### 4. Design/Mobile do Dashboard · 5. Pipeline de Leads
🔄 **Rodando agora** (mesas Fable) — trago o veredito + plano assim que fecharem.

---

## 🟡 Precisa de você

**Sua decisão (aprovar o desenho):**
- Redesign do Dashboard (Dinheiro do Hub, faixa IA)
- Cadastros IA-first (voz/colar, busca conversacional)
- Modo Caixa dos Negócios · unificar ficha mobile

**Janela do dono (fazemos juntos no Supabase):**
- RLS Faixa B — libera o “Dinheiro do Hub” a agregar a rede toda
- Ativar HaveIBeenPwned (1 toggle no painel Auth)

**Infra / chaves (só você tem acesso):**
- Chave **Mistral** — liga a IA (briefing, voz, conversacional)
- **UAZAPI** — liga o WhatsApp
- Deploy Hook do Render (opcional — já auto-deploya)

---

## 🎯 E2E ao vivo na produção validou tudo
No lead real “Fabio”: Direcionar com prontidão · Interesse/Valor editável → chip “✓ Pronto” → **a IA sugeriu o parceiro sozinha** · a Proposta rodou o ciclo inteiro (rascunho → enviada → aceita, com carimbos). **Nenhuma falha.**

---

*Ordem combinada: auditar → implementar o 1º plano (dashboard: conteúdo/negócio) → depois o 2º (design/mobile). A parte grande do “Dinheiro do Hub” depende da sua janela RLS + chave Mistral.*

---
name: ux-principio-click-talk-go
description: "DIRETRIZ UX da plataforma — preencher tudo é ESCOLHER e CONFIRMAR, não digitar. Click-and-Go (múltipla escolha) + Talk-and-Go (voz) + IA pré-preenche com confiança visível. Facilidade acima de tudo"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 635246fa-0a11-4787-bf12-7900cf1c8059
---

Princípio de usabilidade que o Wendel definiu para toda a plataforma (Jun/2026). Detalhe em **docs/UIUX-AUDITORIA-E-PLANO.md**.

**A regra:** o usuário **escolhe e confirma — quase nunca digita.** Todo campo suporta 3 modos: (a) **múltipla escolha/chips** (default p/ categóricos), (b) **voz** (Talk-and-Go: fala → IA preenche), (c) digitação (fallback). A **IA pré-preenche com origem + confiança (alta/média/baixa)**; humano confirma em 1 toque.

**Calibração do Wendel (25/jun/2026):** "3 cliques/toques" = **menor número de cliques POSSÍVEL**, não uma prisão em 3 — se precisar de um pouco mais, tudo bem; o que não pode é excesso/labirinto. E **IA-first + conversacional são o PARÂMETRO** de toda decisão de tela (a IA puxa/preenche; a pessoa só confirma). Padrão aplicado: **essencial visível, resto em "Mais opções" colapsado com defaults** (1º caso entregue: `LeadRapidoSideover` = só Nome+Telefone visíveis). Exemplo-alvo que ele citou: **PJ → digita CNPJ → puxa os dados sozinho** (Receita/BrasilAPI) = IA-first de verdade no cadastro.

**Why:** o cliente quer facilidade real ("click and go, talk and go"); formulário-labirinto mata adoção. Cadastro pobre/errado vem de campo livre demais.

**How to apply:**
- Faixas em vez de número exato quando der (ticket: <50k/50–120k/...); autocomplete agressivo com criar-no-lugar; "completar depois" no que não trava salvar (rascunho contínuo).
- Componentes-base a criar sobre o design system Obra10+ (ver [[design-system-obra10]]): **SmartField** (chip+voz+texto+confiança), **CommandBar** (talk/type-and-go global), **ConfidenceBadge**, **QuickAdd FAB**, **RecommendationCard** (fila de distribuição), **EvidenceCapture** (obra).
- **Mobile = campo** (voz/foto/evidência, alvos grandes); **desktop = gestão/aprovação**.
- Voz entra INCREMENTAL: botão de microfone já em U2, mas preenchimento por voz "de verdade" amadurece com a IA (futuro/Bloco H). Até lá, **Click-and-Go carrega a usabilidade.**

Ordem de implementação de UI (U1→U6) mapeada à ordem de dev: U1 menu+CommandBar → U2 SmartField nos cadastros → U3 Kanban/Inbox → U4 fila distribuição + Dashboard do Hub → U5 wizard de obra → U6 Talk-and-Go pleno + relatórios generativos. Ver [[plataforma-arquitetura-visao]], [[distribuicao-leads-motor]].

---
name: design-system-obra10
description: Design Obra10+ — inspiração que o usuário gosta e AUTORIZA melhorar para melhor (sem estragar); manter identidade dark verde+dourado de globals.css, ignorar o CLAUDE.md global azul/Shadcn
metadata:
  type: feedback
---

O usuário **gosta do design (é uma inspiração)** e em 2026-06-23 **autorizou MELHORAR para melhor** — não é mais congelado. Regra: pode evoluir/aprimorar, **desde que NÃO estrague o que já funciona nem degrade a identidade**.

**Why:** o design é uma identidade própria, premium e tokenizada; melhorias são bem-vindas, mas drift para "cara de IA genérica" ou para o design system azul/claro do CLAUDE.md global, ou regressão do que já está bonito/funcional, é proibido.

**How to apply:**
- **Fonte da verdade = [app/globals.css](C:/Users/wende/Documents/escritorio-virtual-ramon/app/globals.css)** (Tailwind v4 + CSS custom properties em `:root`). **IGNORAR o design system azul/Shadcn/claro do `CLAUDE.md` global.**
- **Paleta-base a manter (reutilizar variáveis, não hex solto):** fundo `--obra-dark #0d1117` / `--obra-dark-2 #161b22` / `--obra-dark-3 #21262d`; bordas `--obra-borda #30363d`; verde `--obra-verde #003b26` / `#005c3d`; dourado `--obra-dourado #c9a24a` / `#e0b86a`; texto `--obra-texto #e6edf3` / `#8b949e`; erro `#b3261e`. Marca `--brand-*`. Foco/seleção dourados. Fonte Poppins.
- **Reusar componentes/classes existentes:** cards, drawers/sideovers, Kanban, `Obra10Brand`, scrollbars finas, animações nomeadas (`fadeInUp`, `pulse-gold`, `task-card`, FFT). Cores por agente (sdr azul, atendente dourado, gerente prata, diretor roxo).
- **Pode evoluir o idioma para MELHOR** (espaçamento, hierarquia, estados, microinteração, componentes novos) mantendo a base de identidade. NUNCA trocar a paleta/fonte por outra família nem degradar telas que já estão boas.
- **Garantia anti-regressão:** screenshot ANTES/DEPOIS em toda mudança de UI (Playwright, desktop+mobile); melhoria deve ser visivelmente melhor ou neutra, nunca pior. Stubs novos (Tarefas/Copiloto/Conteúdo/Produto) nascem nativos no mesmo idioma.

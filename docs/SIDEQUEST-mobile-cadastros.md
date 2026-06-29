# SIDE QUEST (pós-maratona) — Mobile: cadastros não aparecem + filtros/tela ruins

> Pedido do dono (urgente para ELE, mas a fazer DEPOIS da maratona atual). Ele precisa começar os cadastros REAIS e no **mobile não consegue criar nem PF nem empresa** — "não aparece no mobile"; os **filtros e a tela estão muito ruins**.

## O que corrigir
1. **Criar cadastro PF + empresa no MOBILE não aparece/não funciona** (provável: o CTA "Novo cadastro"/FAB ou o sideover escondido no mobile, ou responsividade quebrada).
2. **Filtros + tela dos cadastros "muito ruins"** — melhorar UX (Click-and-Go, mobile-first, marca dark).

## Onde investigar (já mapeado)
- Telas: `app/crm/pessoas/page.tsx`, `app/crm/empresas/page.tsx`, `app/crm/cadastro/page.tsx`, `app/crm/contatos/page.tsx`.
- Fluxo de criação (sideovers/wizard): `components/crm/cadastro/CadastroWizard.tsx`, `CadastroPremiumSideover.tsx`, `CadastroEmpresaSideover.tsx`, `CadastroContactoSideover.tsx`; `components/crm/EmpresaFormDrawer.tsx`.
- Suspeitas: classes `hidden md:block` / breakpoints escondendo o botão ou o sideover no mobile; o header/QuickAdd/FAB não renderiza no mobile; filtros em linha que estouram no mobile.

## Como fazer (quando chegar a vez)
- Reproduzir no mobile (Playwright/Chrome emulando, ou no site live), achar o motivo do "não aparece", corrigir o CTA + o sideover/wizard pra abrir no mobile, refazer os filtros mobile-first, validar visualmente (desktop+mobile), deploy.
- **Prioridade alta dentro das side quests** (o dono quer usar de verdade).

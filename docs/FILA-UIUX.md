# 🐞 Fila UI/UX — falhas de design e funcionalidade (corrigir no sistema todo)

> **Lista viva** de problemas de design/usabilidade/**funcionalidade** encontrados, para corrigir **sistematicamente**. Princípio: *não é fachada — eles vão USAR*; nada de botão quebrado ou feio. Parte da **Onda UX-R** do [PLANO-EXECUTIVO-BLOCOS.md](PLANO-EXECUTIVO-BLOCOS.md). Adicionar conforme achar; remover quando corrigido. **Verificar cada correção clicando no navegador.**

---

## ✅ Corrigidos
- **#1 FAB sobrepunha o botão dos sideovers** → FAB some quando há `[aria-modal]`/`[role=dialog]` aberto (commit `0162aa1`, verificado no navegador).
- **#2 Parede de toggles de mercado** → trocada por **chips** no `MercadoLeadPicker` (commit `f9f913c`) e reusada no cadastro PF/PJ `CadastroComercialSecao` (commit acima). Toggles de mercado eliminados do sistema.

## 🔴 Funcional (botão não funciona / atrapalha o uso) — histórico

1. ✅ **FAB QuickAdd ("+") sobrepõe o botão de ação dos sideovers** (Criar lead / Guardar alterações) no canto inferior direito → o clique cai no FAB, não no botão. **Confirmado no QA** (`overlapped: true`; o lead só foi criado clicando via JS). **Fix:** esconder/ocultar o FAB enquanto houver sideover/modal aberto (ou elevar o footer do sideover acima do FAB / dar `z-index`/offset). Afeta **todos os sideovers** (CadastroPremiumSideover, LeadRapidoSideover, NegocioFormDrawer, etc.). **Severidade: alta** (bloqueia ação principal).

## 🎨 Feio + disfuncional (padrões a substituir no sistema todo)

2. **"Parede de toggles de mercado" (MercadoLeadPicker)** — cards com switch on/off "Imobiliário ACTIVO / Arquitetura INATIVO…" + subtexto técnico *"Pipeline IMB — visível no funil deste mercado"*. **Feio, cansativo e cheio de jargão.** **Fix:** trocar por **chips** (Click-and-Go, múltipla seleção, sem jargão). Aparece em: `components/crm/leads/MercadoLeadPicker.tsx` (usado em `LeadRapidoSideover` → "Mais opções") e `components/crm/cadastro/CadastroComercialSecao.tsx` (criação PF/PJ). Corrigir o **componente-base** → propaga.

3. **Padrão geral "toggle-card com subtexto técnico/jargão"** — varrer o sistema e simplificar (chips/seleção limpa). Eliminar termos internos vazando pro usuário ("pipeline", "funil", "visível", siglas cruas).

## 🧹 Higiene de dados (atrapalha a demo/real)

4. **Leads de teste antigos** ("…Lead 11", "28d parado", `LD2026006` do QA) poluem a Caixa — limpar e deixar poucos **mocks realistas** (com backup). *(Faixa A do plano.)*

---

## Como atacar
Mesa redonda UX + `ui-ux-pro-max`; corrigir o **componente-base** (reuso) para propagar ao sistema todo; **validar clicando no navegador**. Princípios: ceo-mandato-produto (telas para o job), funcional-não-fachada, Click-and-Go.

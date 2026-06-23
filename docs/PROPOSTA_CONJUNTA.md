# Propostas conjuntas (mesa-redonda) — Obra10+

> Registro das decisões da mesa-redonda. Formato: data · decisão · porquê · quem assina.

## 2026-06-23 — D1: Plano da Maratona + modo de trabalho
- **Decisão:** executar em 12 blocos (A–L), etapas pequenas e isoladas, **modo loop autônomo** até o critério de aceite ser provado logado ao vivo. `executive-director` aprova; **GO humano só p/ migration em prod e deploy.**
- **Design:** é inspiração aprovada — **pode melhorar para melhor**, sem estragar o que funciona nem degradar a identidade (dark verde+dourado, `globals.css`). Screenshot antes/depois em toda mudança de UI.
- **Escopo:** só `hub_*` (+ `crm_*` legado para deprecar com trava). **Membros intocado** (mesmo Supabase).
- **Migrações:** só aditivas, uma por vez, backup antes, GO humano.
- **Assinam:** chief-architect (impacto/deps), product-owner (valor), security-guidance (escopo/Membros/segredos).

### D1.1 — Bloco A (fundação)
- **Hipótese/necessidade:** o fluxo exige artefatos que não existiam (`STATUS_MARATONA.md`, `PROPOSTA_CONJUNTA.md`, `app/_chk23.js`, `_publicar.ps1`).
- **Decisão:** criar os 4 (arquivos novos, zero risco, sem tocar código/banco/design). `_chk23` é o gate de saúde de todas as etapas seguintes; `_publicar.ps1` é pré-voo sem push.
- **Critério de aceite:** os 4 existem e `node app/_chk23.js` retorna OK no estado atual. — **ATENDIDO.**

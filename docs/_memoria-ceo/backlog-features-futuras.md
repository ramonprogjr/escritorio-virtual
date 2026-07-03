---
name: backlog-features-futuras
description: Backlog de features de produto futuras do Obra10+ (check-in obra, compras totem/iFood com spread, voz→materiais, notificações, comunidade feed, diário de obra auto)
metadata:
  type: project
---

Backlog de features futuras descrito pelo Wendel (24/jun/2026) — detalhe em **`docs/BACKLOG-FEATURES.md`**. Não perder; "tem muita coisa para o futuro".

- **F1 Ponto de obra georreferenciado** (B6): check-in/out da mão de obra → registra horário+foto+GPS, notifica relacionados. (LGPD: foto+GPS.)
- **F2 Compras "totem + iFood" com spread** (B6 Compras — DETALHA o módulo antes em aberto): operário pede material num totem → sinaliza empresa/arquiteto/fornecedor → vira orçamento → aprovado+pago → rastreio estilo iFood até a obra → **Hub ganha spread** (NOVA fonte de receita, atualizar monetização §5.5). Evita falta por esquecimento.
- **F3 Voz→lista de materiais** (B8 IA + F2): fala os materiais por áudio → IA reconhece/confirma/monta lista → envia aos fornecedores. (Reusa decisão de voz pendente.)
- **F4 Notificações do sistema p/ follow-ups/lembretes** (CRM, perto de B2/B3): camada de notificação in-app/push — infra COMPARTILHADA de F1/F2/F5/F6; candidato a antecipar (baixo risco, alto valor).
- **F5 Comunidade integrada com feed em tempo real** (B7): tudo que acontece atualiza a Comunidade automaticamente (event bus + realtime). Privacidade/escopo por tenant.
- **F6 Diário de obra automático** (B6): gerado dos eventos (F1/F2/medição).

Transversal: **camada de eventos/notificação** (F4) é fundação de F1/F2/F5/F6 — desenhar cedo. Spread (F2) → monetização. Privacidade/LGPD em F1+F5. Ver [[plano-executivo-blocos]], [[monetizacao-licenciamento-rede]], [[modulo-engenharia-obra]].

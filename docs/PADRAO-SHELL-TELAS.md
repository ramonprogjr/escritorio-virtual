# 🧱 Padrão de Shell das Telas — consistência do sistema todo

> Norma única de layout pra TODAS as telas do CRM. Toda tela nova e toda migração segue isto. 27/jun/2026. Parte do B (design/UI-UX). Ver [[design-overhaul-deferido]].

## Por que
O dono notou que telas têm layout divergente (ex.: Aprovações). Causa: 3 padrões coexistindo (CrmStickyPageHeader × setSlot × shells inline com `minHeight:100vh` que brigam com o scroll do layout). Esta norma elimina a divergência.

## ⚠️ CORREÇÃO (27/jun) — o header já vem do layout
Verificação no navegador mostrou: o **header universal** do layout (`CrmUniversalHeader` + `crm-header-defaults`) **já renderiza o título/descrição** de quase toda tela. Ele só é escondido em **telas de detalhe** (`leads/[id]`, `parceiros/[id]`, `agentes/[slug]`) via `shouldHideCrmUniversalHeader`. Logo:
- **NÃO adicionar `CrmStickyPageHeader`** em telas que já recebem o header universal → senão **duplica o título** (erro que cometi no piloto de `contatos`, revertido).
- **Canônico real (maioria, ~16 telas):** header universal + `setSlot` para as AÇÕES da tela; corpo rolável no padrão abaixo.
- `CrmStickyPageHeader` fica só para telas standalone/detalhe que escondem o universal.
- **A divergência que o dono viu (Aprovações) é de CORPO** (empty-state gigante, cards, `minHeight:100vh`), não de header.

## Padrão de CORPO (o que normalizar)
- Container raiz: `min-h-full` + padding (`px-3 py-4 sm:px-6` ou equivalente). **NUNCA** `minHeight:100vh`/`min-h-screen` (o layout já dá frame+scroll; repetir gera espaço/scroll redundante).
- Ações da tela via `setSlot` (não recriar barra de título).
- Card: `rounded-2xl border border-[#1d3a2c] bg-[#0f1d16] p-5` (lista: `rounded-xl … p-4`).
- Empty-state: card compacto centrado (ícone + título + 1 linha + CTA), não bloco gigante.

## ~~A NORMA antiga (CrmStickyPageHeader)~~ — substituída pela correção acima

```tsx
<div className="flex min-h-full flex-col bg-[#0a140f]">
  <CrmStickyPageHeader
    title="…"
    description="…"
    actions={/* botões da tela, opcional */}
  />
  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
    {/* conteúdo */}
  </div>
</div>
```

### Regras fixas
- **Container raiz:** `flex min-h-full flex-col bg-[#0a140f]`. **NUNCA** `minHeight:100vh`/`min-h-screen` (o layout `app/crm/layout.tsx` já fornece o frame + scroll; repetir causa duplo-scroll e framing inconsistente).
- **Header:** sempre `CrmStickyPageHeader` (title + description + actions). Aposentar o `useCrmHeaderSlot/setSlot` para título (manter slot só onde a ação precisa viver no header global).
- **Corpo:** `min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6`.
- **Card:** `rounded-2xl border border-[#1d3a2c] bg-[#0f1d16] p-5` (ou `rounded-xl … p-4` para itens de lista). Borda `#1d3a2c`, fundo `#0f1d16`.
- **Cores:** só tokens/paleta da marca (verde+dourado+âmbar+vermelho+teal/bronze p/ categorias). Zero azul/roxo Shadcn (já varrido).
- **Empty state:** card centralizado com ícone + título + 1 linha + (opcional) CTA — não um bloco gigante destoante.
- **Botões:** primário dourado `#c9a24a`; secundário borda `#1d3a2c`; destrutivo vermelho só no hover (padrão já aplicado no botão Sair).

## Inventário / PENDÊNCIAS de migração

### ✅ Conformes (CrmStickyPageHeader) — 7
configuracoes · creditos · empresas · precificacao · relatorios · tarefas · usuarios

### ⬜ Divergentes prioritárias (`minHeight:100vh` inline) — 7
- [ ] agentes
- [ ] agentes/[slug]
- [ ] **aprovacoes** *(vira parte da reconstrução da Central — spec `2026-06-27-central-aprovacoes-agentes-setor`)*
- [ ] ciclos
- [ ] contatos
- [ ] ferramentas
- [ ] parceiros/[id]

### ⬜ Parcialmente conformes (usam `setSlot`; header ok, corpo a revisar) — demais ~16
dashboard (`/crm`), leads, negocios, distribuicao, cadastro, atendimento, canais, projetos, obras, imoveis, pedidos, parceiros, fornecedores, especialistas, financeiro/*, trafego, analytics, integracoes, contatos-de-notificacao, escritorios… → revisar corpo/cards conforme a norma (sem urgência; header já consistente).

## Ordem de execução
1. Migrar as **7 divergentes** ao padrão canônico (uma a uma, verificando no navegador) — exceto `aprovacoes`, que entra na **reconstrução da Central** (fase 2).
2. Reconstruir a **Central de Aprovações** já no padrão (spec próprio).
3. Revisar o **corpo** das parcialmente-conformes (cards/empty-states) conforme surgir.

## Régua
Toda tela = mesmo esqueleto (header sticky + corpo rolável + cards da marca). Diferença é só o conteúdo, nunca o frame.

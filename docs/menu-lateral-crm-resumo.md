# Menu lateral CRM — resumo

**Fonte de verdade no código:** [`lib/crm-nav-groups.ts`](../lib/crm-nav-groups.ts) (`CRM_NAV_GROUPS`)  
**Última atualização:** 2026-06-17

---

## Chrome da sidebar

| Zona | Conteúdo |
|------|----------|
| Topo | Marca Obra10+ (logo + "ESCRITÓRIO VIRTUAL") |
| Meio | 10 gavetas (acordeão) |
| Rodapé | Utilizador · **Escritório** → `/office` · **Sair** |
| Desktop | Toggle expandir/recolher (`localStorage`: `crm-sidebar-expanded`) |
| Mobile (&lt;768px) | Menu lateral oculto; navegação pela barra inferior (`lib/mobile/nav.ts`) |

**Filtro:** **Onboarding** só para papéis `owner` / `admin`.

---

## Gavetas e itens (28 rotas no menu)

### 1. Visão Geral
- Dashboard → `/crm`
- Analytics → `/crm/analytics`
- Relatórios → `/crm/relatorios`

### 2. Vendas
- Leads → `/crm/leads`
- Negócios → `/crm/negocios`
- Tarefas → `/crm/tarefas`

### 3. Atendimento
- Inbox → `/crm/atendimento`
- Canais → `/crm/canais`
- Aprovações → `/crm/aprovacoes`

### 4. Arquitetura
- Projeto → `/crm/projetos`
- Design de Interiores → `/crm/design-interiores` *(badge Em breve)*

### 5. Engenharia
- Construção → `/crm/obras`
- Reforma → `/crm/pedidos`

### 6. Produto
- Imóveis → `/crm/imoveis`

### 7. Marketing
- Campanhas → `/crm/trafego`

### 8. IA e Automação
- Agentes IA → `/crm/agentes` (+ atalho **Novo agente** → `/crm/agentes/novo`)
- Automações → `/crm/ciclos`
- Ferramentas → `/crm/ferramentas`
- Copiloto → `/crm/agentes-reais` *(badge Em breve)*

### 9. Sistema
- Configurações → `/crm/configuracoes`
- Integrações → `/crm/integracoes`
- Contatos de notificação → `/crm/contatos`
- Usuários & Permissões → `/crm/usuarios`
- Onboarding → `/crm/onboarding-tenant` *(admin)*

### 10. Financeiro
- Visão financeira → `/crm/financeiro`
- Contas a pagar → `/crm/financeiro/pagar`
- Contas a receber → `/crm/financeiro/receber`

---

## Grupos removidos (histórico)

| Grupo antigo | Destino |
|---|---|
| Cadastros (`/crm/cadastro`, `/crm/parceiros`) | Removido do menu |
| Obras (`/crm/obras`, `/crm/pedidos`) | Absorvido por **Engenharia** |
| Projetos (`/crm/projetos`) | Absorvido por **Arquitetura** |

---

## Fora do menu (rotas existentes)

| Rota | Nota |
|------|------|
| `/crm/conteudo` | Oculto até estar funcional |
| `/crm/kpis` | Redireciona para `/crm/analytics` |
| `/crm/leads/[id]`, `/crm/lead/[id]` | Detalhe de lead |
| `/crm/negocios/[id]` | Detalhe de negócio |
| `/crm/parceiros/[id]`, `/crm/parceiros/novo` | Parceiro |
| `/crm/obras/[id]` | Obra |
| `/crm/agentes/[slug]` | Agente |

---

## Plano de implementação

Ver **[`plano-telas-crm.md`](plano-telas-crm.md)** — fases 0–5, sprints S1–S7, critérios de aceite e matriz menu → fase.

**Implementado (2026-06-17):** Reestruturação do menu — grupos Cadastros/Obras/Projetos removidos; novos grupos Arquitetura, Engenharia, Produto; Financeiro movido para o fim; ordem canônica aplicada.

---

## Referências

- [`crm-sidebar-navigation.md`](crm-sidebar-navigation.md) — comportamento desktop/mobile
- [`menu-navegacao-consolidado.md`](menu-navegacao-consolidado.md) — decisões de produto

# 📑 Índice dos Documentos — Plataforma Obra10+

> **Ponto de entrada único.** Comece por aqui para achar qualquer coisa. São muitas informações — este índice mantém a consistência. Atualizar quando criar/mudar um doc importante.

---

## 🎯 Visão & Spec (o "o quê" e o "porquê")
- [INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md](INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md) — **spec-mestra** da plataforma (Hub + Distribuição + CRM Fornecedor + Obra; domínios A–J; faseamento; travas).
- [UIUX-AUDITORIA-E-PLANO.md](UIUX-AUDITORIA-E-PLANO.md) — princípio **Click-and-Go / Talk-and-Go**, riscos de usabilidade, componentes-base (SmartField etc.), ondas U1–U6.

## 🗺 Plano & Execução (o "como" e o "quando")
- [PLANO-EXECUTIVO-BLOCOS.md](PLANO-EXECUTIVO-BLOCOS.md) — **roteiro ativo** em blocos (B0→B8, +B3.9 Fundação Multi-Tenant, +B5.5 Monetização). Fonte da sequência.
- [PENDENCIAS.md](PENDENCIAS.md) — **tracker vivo** do que está em aberto, por dono (🧑 Wendel · 🤖 dev · 🔒 trava). Conferir antes de fechar etapas.

## 🧱 Backlog & Referências de produto
- [BACKLOG-FEATURES.md](BACKLOG-FEATURES.md) — features futuras (ponto de obra georreferenciado, compras totem/iFood com **spread**, voz→materiais, notificações, comunidade feed, diário de obra auto).
- [CENTRAL-PERFORMANCE-METRICAS.md](CENTRAL-PERFORMANCE-METRICAS.md) — **blueprint-mestre de métricas/eventos/SLA/dashboards/alertas** do CRM de vendas (14 blocos de métricas, taxonomia de eventos, dashboards por perfil, faseamento). Guia B4/B5/B5.5/F4.

## 🧭 Navegação & Design
- [menu-navegacao-consolidado.md](menu-navegacao-consolidado.md) — racional do menu lateral (consolidação das propostas).
- Design system: tokens `--obra-*`/`--brand-*` em `app/globals.css` (dark verde+dourado). **Não** usar o azul/Shadcn genérico.

## 🗄 Migrações SQL aplicadas/propostas
- `docs/sql/*-APPLIED.sql` — migrações **aplicadas** (aditivas/reversíveis), ex.: `20260624-rls-pipeline-estagios-tenant-APPLIED.sql`.
- `docs/sql/*-AUTORIZADA-pendente-apply.sql` — autorizadas mas com apply pendente (ex.: `rls-crm-core-close-holes`).

---

## 🧠 Memória durável (cross-sessão)
Fora do repo, em `~/.claude/.../memory/MEMORY.md` (índice) + arquivos: plano-executivo-blocos, monetizacao-licenciamento-rede, central-performance-metricas, backlog-features-futuras, distribuicao-leads-motor, modulo-engenharia-obra, design-system-obra10, e as **diretrizes** (modo-operacional-code, mesa-redonda-uiux, celeridade-execucao, continuar-sem-confirmacao).

## ✅ Regras de ouro (de todos os blocos)
Aditivo · preservar > reescrever · gate `tsc`+`vitest`+`_chk23` · sem push/secrets · migrações reversíveis (com rollback) · mesa redonda + docs + backups · parar só para irreversível-sem-rollback/exclusão-massa/credenciais/produção-sensível.

# QA AO VIVO — achados (chrome-devtools MCP, prod, 03/jul) — pareia com a QA de código

Sessão logada (Hub) em https://escritorio-virtual-1.onrender.com. Dado real do Consulado no banco.
Confirma a dor do dono: **o sistema tem o esqueleto mas os números vêm ZERADOS/genéricos, e é tudo comercial/Hub — sem recorte por persona.**

## 1. Dashboard (/crm) — visão Hub
- 🔴 **Parede de zeros:** PIPELINE R$0 · GANHOS 0 · CONVERSÃO 0% · RECEITA POTENCIAL R$0 · TAXA ENCAMINHAMENTO 0% · ENCAMINHAMENTOS HOJE 0 · OBRAS EM ANDAMENTO 0. Há 11 negócios abertos e 5 obras no banco — os agregados não refletem.
- 🔴 **Vazamento de código:** busca com placeholder "PES, LED, NEG…" (esquema interno que deve ficar escondido). Arquivo: cabeçalho do CRM.
- 🟢 Útil e acionável: bloco "O QUE PRECISA DE VOCÊ" (19 pendências reais) + funil clicável.
- 🔴 **Sem persona:** é um dashboard comercial único. Nada de Arquitetura/Engenharia/Serviços/Fornecedor/Cliente.

## 2. Analytics (/crm/analytics) — foco #1
- 🔴 **14 KPIs comerciais TODOS em 0 / 0.0%** (tempo resposta, qualificação, aprovação 1ª entrega, retrabalho, conversão, fechamento, CPL, ROAS, tokens, NPS, leads sem resposta…). Framework existe, **não é alimentado**.
- 🔴 OBRAS EM ANDAMENTO 0 (mesmo bug). MARKETING "Windsor.ai não configurado". IA: KPIs críticos 0, leads hoje 0.
- 🟡 FUNIL DE NEGÓCIOS abre na aba **IMB** por padrão — o Consulado (ARQ/ENG) não aparece sem trocar de aba.
- 🟡 ALERTAS duplicados ("Novo interesse de parceiro via WhatsApp" ×3, "Verificação de campanhas" ×2).

## 3. Obras (/crm/obras) — inconsistência de dado real
- 🔴 A "Obra Consulado da Itália" aparece como **Planejamento**, mas o banco tem **`status='ativa'`**. Causa: a UI/aba usa `estagio_slug` (ficou 'planejamento' no default do seed), enquanto `status='ativa'`. **Dois campos de estado divergentes** → dashboard conta o errado → "0 em andamento".
- Ação: (a) alinhar seed (setar estagio_slug junto do status) e (b) decidir a fonte-única de "andamento" (status vs estagio_slug) — hoje confunde a UI e as métricas.

## 4. Negócio raiz Consulado (/crm/negocios/[NGARQ]) — O QUE CONSTRUÍMOS: FUNCIONA ✅
- **Relacionados 100% por NOME (zero código):** Pessoas (Wendel, Marcos, Rep. Consulado) · Empresas (Nice, Takiguthi, Consulado, Rival) · ORIGEM/DERIVADOS (Proposta Eng. não vencedora, Serviço Impermeabilização, Fornecimento Materiais, Reforma). A linhagem inteira navegável por nome. É o rastreio automático que o dono pediu — está no ar e correto.
- Botão **"Arquivar"** (não "Excluir") — coerente com o princípio delete=arquiva.
- 🟡 **VALOR ESTIMADO vazio** → alimenta o "PIPELINE R$0" do dashboard. Os negócios do seed (e talvez os reais) não têm valor_estimado. Fix: popular valor nos negócios (ou o agregado deveria somar valor_fechado/contrato quando estimado é nulo).

## Padrões sistêmicos (hipótese a confirmar com a QA de código)
1. **KPI/analytics construído mas não populado** — agregados retornam 0 mesmo com dado real (queries genéricas/quebradas ou eventos não instrumentados).
2. **Dashboard único, comercial** — falta o recorte por persona (o pedido central do dono: "o que a Arquitetura/Engenharia/Serviços/Cliente precisa ver?").
3. **Inconsistências de dado real** (status×estagio_slug) que fazem métrica mostrar 0/errado.
4. **Vazamento de código** residual (placeholder de busca).

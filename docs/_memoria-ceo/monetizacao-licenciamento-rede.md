---
name: monetizacao-licenciamento-rede
description: Modelo de monetização Obra10+ — 3 camadas (cadastro/parte → tenant → licença de módulos), comissão marketplace (b), funil/KPI/SLA em 2 níveis
metadata:
  type: project
---

**Modelo de monetização da plataforma (confirmado com Wendel, 24/jun/2026).** Detalhe no Bloco 5.5 de `docs/PLANO-EXECUTIVO-BLOCOS.md`.

**3 camadas (separar — hoje estão coladas):**
1. **Cadastro / Parte** — toda pessoa (PF) e empresa (PJ) vira cadastro com **código único tipo-CPF**. É só identidade; participa de negócios (venda imóvel/produto/serviço) **sem login, sem módulo**. A MAIORIA fica só aqui.
2. **Conta SaaS / Tenant** — uma empresa-cadastro **promovida** a conta paga (o "fornecedor"/escritório). Tem usuários (login, RBAC). **Amarrar tenant ↔ cadastro PJ** (hoje `/crm/empresas`=`/api/crm/tenants` cria tenant SOLTO — é admin de ESCRITÓRIOS, não cadastro de cliente; recomendado renomear p/ "Escritórios").
3. **Licença de módulos (entitlements)** — **GAP, a construir.** Por tenant: quais módulos pagos liberados. **O Hub libera.**

**Assinatura SaaS (NÃO é comissão, sem rateio):** cobrança recorrente tenant→Hub = **mensalidade + por usuário (seat) + por módulo + por plano/pacote + créditos/tokens** (algumas features de consumo: IA tokens, msgs WhatsApp; futuro storage/assinaturas). Dados: `hub_planos`, `hub_tenant_assinatura` (mensalidade+seats+plano), `hub_tenant_modulos`, `hub_tenant_creditos`.

**Catálogo de módulos (OK):** CRM · Atendimento(WhatsApp) · Projetos · Obras · Serviços · Compras · Financeiro · Marketing · IA/Copiloto · Integrações (+Produtos futuro). Base não-cobrada: Cadastros+códigos, Dashboard, Usuários/RBAC, Administração.

**Comissionamento TRANSACIONAL multi-fonte com RATEIO (split) — peça central (≠ assinatura SaaS, que não entra aqui):** fontes pelo MESMO motor de rateio: comissão venda imóvel/serviço/produto, aluguel de equipamentos (marketplace % E locação própria), treinamentos (venda direta + comissão de indicação). 1 transação → 1 evento → **N beneficiários**, cada um pelo **código único** (é PARA ISSO que o código tipo-CPF existe: rastreabilidade + divisão correta). Cada linha: papel (Hub/indicador/vendedor/executor/parceiro), % **fixo ou variável**, **direção** (Hub recebe=a receber / repasse=a pagar). Percentuais em camadas, **editáveis (owner)**: prefixado por tipo×mercado×produto → override **negócio a negócio / membro a membro**. Base=valor do negócio; fatura no **ganho** (decidido). Defaults sugeridos (validar): IMB 1–3%, SRV 10–20%, Produto 5–15%, Obra/ENG/ARQ 3–8%. Dados aditivos: `hub_receita_regras`, `hub_comissao_eventos`, `hub_comissao_rateio` (generaliza o antigo hub_comissoes).

**Esteira/funil + KPIs + SLA em 2 níveis:** funil do **escritório** (tenant, no CRM do fornecedor — B3) e funil do **Hub** (rede/governança — B4); KPIs (conversão, tempo 1º contato, ticket, receita, comissão, leads ociosos); **SLA engine** (relógio por lead, marcos 15min/24h/48h, estouro→alerta+redistribui — B5).

Dados aditivos: `hub_planos`, `hub_tenant_modulos` (→ disclosure por plano no menu + guard por módulo), `hub_tenant_creditos`, `hub_comissoes`. Faseamento: manual primeiro (Hub liga módulo / lança comissão na mão), billing automático depois. Ver [[plano-executivo-blocos]], [[distribuicao-leads-motor]], [[plataforma-arquitetura-visao]].

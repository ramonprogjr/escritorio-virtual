---
name: macro-sequencia-nucleo-primeiro
description: "A sequência do MACRO definida pelo dono em 28/jun — núcleo PERFEITO primeiro (vendas+marketing dependem), depois multi-tenant, usuários, Arq&Eng, demais"
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

Em 28/jun/2026, ao "voltar pro macro", o dono definiu a SEQUÊNCIA (e o porquê):

**1. NÚCLEO rodando PERFEITAMENTE (foco atual):** revisão completa + hardening de — cadastros (pessoa, empresa, lead, parceiro, mão-de-obra), o fluxo cadastro→venda→funil, a **esteira de vendas / produtos**, o **atendimento**, e o **fluxo de IA**. **Why:** o dono vai construir VENDAS e MARKETING em cima disso e DEPENDE que rode liso.

**2. MARKETING / tráfego:** conexão das **IAs de gestão de tráfego — Google e Meta** (o dono toca essa parte; o núcleo precisa estar perfeito antes). Hoje existe Windsor (leitura de anúncios, agora owner-only) e tools Meta via MCP; "IA de gestão de tráfego" é provável feature nova downstream.

**3. Multi-tenant** (go-live): aplicar a janela de migrações (constraint global→tenant, contador por tenant, backfill `tenant_id` legado) — ver [[sessao-handoff-28jun2026]]. O dono deixou pra "depois".

**4. Nossa versão de GESTÃO DE USUÁRIOS** (sub-usuários / funcionários dos usuários da plataforma).

**5. ARQUITETURA & ENGENHARIA** — os usuários que desenvolvem os projetos e as obras (o lado de execução: gestão de obra/projeto). Ver [[modulo-engenharia-obra]].

**6. Os demais principais** (mercado imobiliário/portal, venda de materiais iFood, cliente final, etc. — ver [[plataforma-arquitetura-visao]]).

**How to apply:** Não pular etapa. Tudo o que não depende do dono, o CEO aprova e executa (revisão→fix→verificação→deploy), parando só nas travas (irreversível/credencial/produção/decisão de produto). Mistral + token = adiados ([[token-supabase-rotacao-adiada]]).

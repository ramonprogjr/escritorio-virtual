---
name: modelo-tenant-pragmatico
description: "O modelo CANÔNICO de tenancy (clareza de CEO p/ o dono) — a aparente complexidade de N \"tipos\" colapsa em 2 tenants + papéis + registros"
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

O dono (28/jun) ficou preocupado com a complexidade (arquitetos, engenheiros, prestadores, mão de obra, clientes, vendedores, produtos, imóveis, corretores, imobiliárias) e pediu CEO **realista e pragmático**, com modelo CLARO p/ os dois. Resposta canônica:

**"Tenant" é estrutural/caro → reservado p/ 2 coisas. Todo o resto é PAPEL (role) ou REGISTRO (dado):**
- **TENANT** = (1) o **HUB** (1, camada meta) + (N) os **FORNECEDORES** (cada escritório: arquiteto/engenheiro/prestador/corretor/imobiliária). MESMA estrutura de tenant — o que muda é o **MÓDULO/vertical** que cada um usa (sobre a mesma COLUNA).
- **USUÁRIO** (role DENTRO de um tenant) = vendedores, equipe (→ gestão de usuários).
- **REGISTRO** (dado DENTRO de um tenant, não-ator) = mão de obra/especialistas (vinculado, **sem login**), clientes (lead/pessoa; portal é futuro), produtos (catálogo), imóveis (anúncio).

**Logo: 2 tipos de tenant + alguns papéis + o resto é dado. NÃO são 10 sistemas — é 1 esqueleto de tenant + módulos.**

**FUTURO (não agora) — HUB-FRANQUIA:** o dono quer, no futuro, FRANQUIAS do Hub (cada franquia = um Hub completo, com todas as camadas). É só MAIS UM NÍVEL acima, recursivo: `Franqueador → Franquias-do-Hub → Fornecedores → usuários+dados` (mesma estrutura de tenant, aninhada). O isolamento limpo da Fase 1 é o que TORNA isso possível sem retrabalho. **Cuidado de arquitetura desde já:** NÃO chumbar "existe um Hub só" / não assumir Hub único hardcoded — manter o tenant do Hub como um tenant entre outros. Construir só quando for o momento.

**Controle de complexidade (pragmatismo):** 1 esqueleto de tenant (não N) — é a Fase 1 (isolamento). O DIFÍCIL não é a qtde de tipos, é o ISOLAMENTO (não vazar) + o HANDOFF (Hub→tenant do fornecedor); acertar 1x. Construir a COLUNA 1x; **1 vertical por vez, v1 enxuto** (não construir clientes+produtos+imóveis+mão-de-obra de uma vez). Sem over-engineering.

**Compromisso:** modelo CLARO e ESTÁVEL p/ os dois; ajustar DETALHES no percurso, não o esqueleto; decisões de negócio = checkpoint com o dono. Ver [[arquitetura-camadas-negocio]], [[modelo-negocio-camadas]], [[multitenant-golive-plano]], [[fluxo-core-captacao-direcionamento]], [[feedback-mesa-redonda-e-checkpoint-negocio]].

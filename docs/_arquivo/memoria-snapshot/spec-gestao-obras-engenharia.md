---
name: spec-gestao-obras-engenharia
description: "Spec CANÔNICA da gestão de obras (Engenharia) — doc do dono persistido em docs/; Obra=central, EAP=espinha, IA-first, humano aprova crítico"
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

O dono enviou (29/jun) a **"Especificação Única — Plataforma IA-first multi-tenant para gestão de obras"** (doc dele, 24/06). É o BLUEPRINT canônico da **Engenharia (gestão de obras)**. **PERSISTIDO em `docs/insumos-do-dono/especificacao-plataforma-gestao-obras.md`** (ler de lá). A "startup proprietária sem nome" = o nosso **Hub**; "empresas clientes" = **fornecedores/escritórios (tenants)**. É a Parte 1 (dono envia mais).

**Conceitos-chave:** (1) **Obra = objeto central** (container de tudo). (2) **EAP/Frentes = a ESPINHA** — a mesma árvore amarra orçamento/cronograma/compras/RDO/medição/qualidade/financeiro (conceito que faltava no nosso modelo). (3) Multi-tenant 8 níveis: Startup(Hub)→Tenant→Filial→Departamento→Usuário→Obra→Frente/EAP→Registros. (4) **NÃO é clone de Asana** — é "sistema operacional de obra com IA embutida no fluxo"; a **IA entra ANTES da tela** (voz/foto/PDF/NF → estrutura) com card "A IA entendeu assim". (5) **Regra de ouro:** dinheiro/prazo/cliente/contrato/medição/pagamento/liberação técnica/terceiro **exigem aprovação humana** (IA prepara, não aprova). (6) **RBAC+ABAC** validado no backend. (7) Não tudo é tarefa: 15 núcleos (Obra/Contrato/EAP/RDO/Tarefa/Pendência/Compra/Cotação/Estoque/Medição/Documento/Evidência/Fornecedor/RNC/Pagamento). (8) **Agentes IA por nível de autonomia (1 sugere → 5 automatiza rotina segura)**. (9) Roadmap: Fase0 Fundação → Fase1 MVP IA-first (largar Asana/WhatsApp) → Fase2 Engenharia&dinheiro (Medição/Curva S/financeiro por frente) → Fase3 plataforma inteligente.

**Mapa pro que temos:** VALIDA nossas decisões (multi-tenant tenant-próprio, IA-first, copiloto com gate dourado, a coluna). ADICIONA o que falta: **EAP (fronts_eap)**, RDO estruturado, Curva S com baseline, medição com gate (medido≤contratado), compras com cotação comparável, fornecedor com score, SST com bloqueio, ai_events + audit_logs, autonomia por nível. Parcial no banco hoje: hub_obras + sub-tabelas (cronograma/diario/fotos/ocorrencias/pedidos_material), hub_aprovacoes, RBAC, multi-tenant real (`current_user_tenant_id()`). Régua de design (dono 29/jun): **Click-and-Go, IA-first, Fácil, UI/UX utilidade**. Ver [[modulo-engenharia-obra]], [[modulo-arquitetura-requisitos]], [[arquitetura-camadas-negocio]], [[modelo-tenant-pragmatico]], [[insumos-dono-e-asana-pendente]].

---
name: crm-cliente-final-foco
description: Rumo do -ramon — CRM de captação de negócios/clientes finais (distinto do CRM de homologação/Membros); foco atual = cadastros com códigos corretos + negócios multi-mercado
metadata: 
  node_type: memory
  type: project
  originSessionId: 635246fa-0a11-4787-bf12-7900cf1c8059
---

**⚠️ SUPERADO em parte (Jun/2026, blocos 2–4 do Wendel):** ver [[plataforma-arquitetura-visao]]. `-ramon` É a **plataforma principal** — comercial (CRM) **E** execução (Gestão de Obra) moram **aqui**, por membro logado. NÃO são "dois CRMs operacionais distintos". O que segue abaixo continua válido como FOCO de curto prazo (cadastros + negócios manuais), mas a visão de produto agora é a plataforma única (Hub + distribuição + CRM fornecedor + obra).

**Membros** = homologação + onboarding → comunidade + academy (sistema à parte, ver [[membros-cadastro-formato]], intocável). Mas o **operacional** (vender + executar) do membro é FEITO no `-ramon`. O Hub distribui leads ao fornecedor que trabalha aqui (ver [[distribuicao-leads-motor]]).

**How to apply / FOCO ATUAL (prioridade):**
1. **Cadastros com codificações CORRETAS** — empresas, pessoas, **parceiros** (aqui parceiro = ator de captação/cadastro, NÃO a jornada de homologação). Códigos no formato do doc mestre (ver [[schema-rls-alinhamento-mestre]] — havia divergência PREFIXO-AAAA-#### vs formato do doc; risco de corrida COUNT+1 → usar sequence/trigger).
2. **Negócios = "o coração de tudo"**, intercalando **todos os mercados** (IMB/ARQ/RFM/MRC/ENG/SRV/PRO/FOR), com pipelines por mercado, conforme [[spec-funcional-crm-hub-obra10]] e docs/01_documento_mestre.md.

**MODELO ALVO DO CADASTRO (2026-06-24, usuário):** estilo **Pipedrive** — Pessoa ↔ Empresa ↔ Negócio ↔ Produto **cruzados e navegáveis em 1 clique** (fichas de detalhe correlacionadas), com **campos ricos do Membros** e **IA-first** (IA sugere vínculos/dedup/próxima-ação/resumo). Códigos tipo-CPF já feitos (PS2026001/NGIMB2026001). Achado: `hub_negocios.pessoa_id` é NOT NULL (rígido) → relaxar p/ pessoa E/OU empresa. Plano faseado completo em **docs/design-cadastro-pipedrive-ia.md** (F1 modelo relacional → F2 fichas → F3 campos+serviços → F4 IA-first+conversacional). Aguardando GO (sugerido F1+F2).

**REFINO (2026-06-24):** o "produto" agora = **os mercados** (não catálogo físico): **IMB/ARQ/ENG/SRV** + cadeia **projeto→obra→execução** (RFM reforma/obra, MRC marcenaria, marmoraria, serviços); ~80% da entrada inicial é projeto+obra. **Produto físico (PRO)/fornecedor (FOR) = futuro.** Tudo **IA-first + conversacional**. **Relatórios/Analytics = GENERATIVOS sob demanda, em tempo real pela Anthropic/Claude** (não dashboards estáticos) — depende do **Bloco H** (chave Anthropic + GO de custo); arquitetura provider-agnóstica pronta antes, Claude pluga depois. Ver [[agentes-ia-llm-anthropic]].

**URGÊNCIA (2026-06-24):** entregar o **CRM comercial rodando MANUALMENTE**, fácil/intuitivo, **UI/UX ANTES de ligar a IA**. Arquitetura **pronta para IA-first**, mas **Anthropic/Bloco H = FUTURO (não ativar agora)**. Escopo manual: cadastros (pessoas, empresas, negócios, **especialistas**, arquitetos homologados, fornecedores, clientes de projeto/obra/marcenaria) + **pipelines/kanban/listas EDITÁVEIS e CUSTOMIZÁVEIS** + **direcionamento automático de leads** + **canais de entrada** (Meta/Google/WhatsApp). Tudo manual primeiro; IA pluga depois (camada provider-agnóstica pronta). Foco: usabilidade.

**DIRETRIZ:** "reavaliar antes de seguir" — antes de codar grande, investigar o estado atual (cadastros/códigos/negócios/mercados) vs os documentos e trazer plano. As tabelas hub_fornecedores/hub_especialistas (criadas nesta sessão) são da "Rede" e podem ser secundárias frente a esse foco — não expandir sem pedido.

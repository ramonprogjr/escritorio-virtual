---
name: spec-funcional-crm-hub-obra10
description: Modelo funcional/dados canônico do CRM Hub Obra10+ (entidades, regras, pipelines, permissões, IA, rastreabilidade) conforme documento mestre
metadata:
  type: project
---

**HIERARQUIA DOS DOCUMENTOS (governança definida pelo usuário em 2026-06-23):** o **Documento 1 "Funcional Consolidado do CRM e Cadastros" é a FONTE DA VERDADE / master.** Os outros (doc 2 funil operacional, doc 3 agente imobiliário, doc 4 agente arquitetura) são **mais antigos e subordinados** — válidos como referência operacional onde não conflitam, mas **em qualquer divergência o doc 1 prevalece**. Divergências de taxonomia resolvem a favor do doc 1: faixas de metragem `Até 50/50–100/100–300/300–500/>500`; prazos `Imediato/Até 30d/1–3m/3–6m/...`; etapas do funil de lead `Novo/Em atendimento/Aguardando resposta/Qualificando/Encaminhado/Convertido/Perdido/Spam`; lead × negócio separados. **"Mari/Maria" é só nome de um agente-modelo configurável (vive em `hub_agente_identidade`), NÃO faz parte da spec** — o que importa é o papel/comportamento (captar→organizar→encaminhar), não o nome. O projeto tem um tracker interno de alinhamento ao mestre em `lib/crm/progresso-sistema-data.ts`. Estado atual do schema vs mestre: ver [[schema-rls-alinhamento-mestre]].

Documento mestre recebido em 2026-06-23: "Documento Funcional Consolidado do CRM e Cadastros do Hub Obra10+" (34 páginas, 20 partes). Define o modelo-alvo do CRM. Tese central: **não é CRM de contatos, é sistema de rastreabilidade da cadeia de valor** (lead → atendimento → encaminhamento → negócio → venda → projeto/obra → produto/serviço/fornecedor → comissão/recompra/indicação). Lema: "simples na tela, forte no banco"; poucos campos no início, campos dinâmicos por tipo/segmento, IA preenche o máximo, humano valida, mínimo de cliques, nada de informação solta.

**Modelo de entidades (decisão estrutural mais importante):**
- Lead = entrada comercial (NÃO é pessoa/empresa/negócio). Código `LEAD` auto.
- Pessoa = PF permanente. Código `PS2026001` único, sequencial, **imutável** (não muda ao ganhar papéis).
- Empresa = PJ/organização. Código base `EMP2026001` + código de segmento (`EMP-ARQ-2026-001`, `-ENG-`, `-IMO-`, `-MAR-`, `-MRM-`, `-VID-`, `-OBR-`, `-PRD-`, `-SER-`); base sempre permanece, sufixo é p/ filtro/homologação.
- **Fornecedor = classificação** (não cadastro). **Homologado = status** (não cadastro). **Parceiro = relação comercial/status/classificação, NÃO entidade principal separada** (sobretudo imobiliário).
- Negócio = centro comercial/financeiro/rastreabilidade (a parte mais importante).
- Projeto e Obra = módulos de gestão próprios, criados A PARTIR de negócios.
- Produto/Serviço/Imóvel = ativos vinculáveis; separados de quem fornece/executa ("Marcenaria planejada"=produto vendido; "Marcenaria Silva"=empresa fornecedora).

**Convenção de campos:** [OBR] obrigatório, [opc] opcional, [auto] sistema, [IA] preenchido/sugerido por IA com nível de confiança (alta/média/baixa + campo/valor/fonte/confiança).

**Menus:** Vendas (Leads, Negócios, Atendimento, Pipeline, Tarefas comerciais); Cadastros (Pessoas, Empresas — SEM tela separada de "vínculos": vínculos aparecem dentro de pessoa/empresa/negócio); Fornecedores em Homologação e Homologados = apenas FILTROS por status (não criam cadastro); Produtos e Ativos; Projetos e Obras; Financeiro (geral + por negócio/projeto/obra).

**Regras transversais que mantêm o sistema "honesto":**
- Pipeline de Lead ≠ Pipeline de Negócio. Negócio tem funil ESPECÍFICO POR MERCADO (Imobiliário, Arquitetura, Obra/Reforma, Engenharia, Marcenaria/Móveis, Serviços, Produtos/Materiais, Homologação).
- Próxima ação OBRIGATÓRIA em todo lead/negócio (sem ela "vira depósito de cadastro"); atrasada vira alerta/destaque.
- Encaminhamento + antifraude: registra para quem o lead foi enviado, quem autorizou, se aceitou/respondeu/converteu. AI-first: IA sugere e explica critério, gestor valida antes do envio.
- Controle de duplicidade antes de criar pessoa/empresa/lead/negócio; mesclar só com permissão.
- "Fechado perdido" exige motivo; "Fechado ganho" permite criar projeto/obra/pedido/financeiro conforme mercado; toda mudança de etapa gera log.
- Regra dos três cliques. Relações entre negócios em linguagem simples (proibido "desdobramento" na UI).
- Logs obrigatórios (geral: data/hora/usuário/ação/valor anterior/novo/origem) + por entidade.

**Permissões:** comum, atendente, comercial, gestor, financeiro, administrador, usuário mestre (exclui/audita/mescla), agente IA. Campos sensíveis (só gestor/financeiro): origem do negócio, participantes, empresas vinculadas, comissões, valor fechado, responsável comercial, status ganho/perdido, exclusões, mudanças de homologação. IA não decide sozinha ações sensíveis. Comentários: autor edita o próprio, outros não editam/excluem, só mestre exclui, tudo gera histórico.

**Tensão com o código atual (a verificar antes de qualquer mudança):** o sistema rodando hoje tem `/crm/parceiros` + portal `/parceiro` como entidade de 1ª classe, e o spec diz que parceiro NÃO deve ser entidade separada; idem "sem tela de vínculos". Pessoa/Empresa unificadas com fornecedor/homologado/parceiro como classificação/status é a reestruturação mais profunda (toca banco, telas, permissões). Códigos imutáveis PS/EMP implicam numeração própria além do UUID Supabase. Projeto Supabase: ver [[supabase-projeto-e-login-local]].

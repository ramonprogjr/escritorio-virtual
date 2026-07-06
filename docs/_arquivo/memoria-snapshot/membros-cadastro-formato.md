---
name: membros-cadastro-formato
description: Sistema Membros = homologação+onboarding→comunidade+academy (CRM próprio, distinto do -ramon); + formato de cadastro de parceiros/fornecedores/especialistas
metadata: 
  node_type: memory
  type: reference
  originSessionId: 635246fa-0a11-4787-bf12-7900cf1c8059
---

**RUMO (2026-06-24):** Membros NÃO é só "formato de cadastro" — é o **sistema de homologação + onboarding** que vira **comunidade + academy**, com **CRM PRÓPRIO** (jornada do MEMBRO: cadastro→`status_acesso`→`parceiro_etapas`/`parceiro_modulos` (5 etapas = onboarding/academy)→`parceiro_conquistas` (badges)→`recebe_leads`/`elegivel_leads` após etapa 5→comunidade/perfis públicos). O **`-ramon` é CRM DISTINTO** (captação de negócios/clientes finais). Comunicam-se no **FUTURO** (workflow a desenhar, não agora). NÃO reimplantar homologação/onboarding no -ramon. Ver [[crm-cliente-final-foco]].

Projeto **Membros** (`C:\Users\wende\Documents\Projetos-Claude\projeto-atual`, SPA `app/obra10-membros.html` + Supabase schema `membros`) — **INTOCÁVEL**, acessar só com autorização. Formato de cadastro dos 3 atores, para replicar no CRM `-ramon` (grupo "Rede"):

**Parceiros e Fornecedores** — mesma tabela `membros.parceiros` (fornecedor = `tipo` PJ; sem tabela separada). Campos: PF/PJ, `nome`(razão), `cpf_cnpj`, `email`, `telefone`, `tipo`(FK `tipos_parceiro` com `pessoa`=PF/PJ/ambos), `papel`(owner/admin/parceiro), `status_acesso`(**pendente/aprovado/recusado/bloqueado** = homologação), `aprovado_em/por`, `recebe_leads`, `acesso_crm`, `elegivel_leads`, `especialidade`, `bio`, `regiao`(UF), `mercados`(jsonb multi, 1º=principal), `mercado_principal`, `indicado_por`, `permissoes`. **Com login** (auth.users). Classificação: `tipos_parceiro`, `especialidades`(FK mercado_id), `mercados`(slug/cor/ordem/ativo). Homologação por 5 etapas + `status_acesso`. Form: PF/PJ toggle, nome, CPF/CNPJ, email, tel, senha, tipo, UF, mercados(chips), especialidade, indicado_por, termos.

**Especialistas / Mão de obra** — tabela `membros.profissionais`. **SEM login** (anônimo; `login_id`=só dígitos do telefone; `auth_user_id`=null). Campos: `nome`, `telefone`, `email`(opt), `cidade`, `uf`, `especialidades`(jsonb multi de `profissoes`), `especialidade_principal`, `bio`, `disponibilidade`(integral/meio_periodo/fins_semana/sob_demanda), `raio_km`, `atende_regioes`, `faixa_preco`($/$$/$$$), `instagram`, `portfolio_urls`(até 6), `aceita_urgencia`, `tem_equipe`, `tamanho_equipe`, `experiencia`(faixas), `origem`(cadastro/indicado_membro/indicado_admin), `cadastrado_por`(FK parceiro), `foto_url`(bucket especialistas), **`verificado`** (sem homologação formal — só badge), `destaque`, `servicos_concluidos`. Classificação: `profissoes`(Pedreiro/Eletricista/...). Form: nome, tel, cidade, UF(opt), email(opt), especialidades(chips), equipe toggle+tamanho, experiência, observações.

IDs são UUID puro (sem código prefixo-ano-seq). Ver [[spec-funcional-crm-hub-obra10]] (mestre: parceiro/fornecedor = classificação, homologado = status). No `-ramon` só existe `/crm/parceiros`; fornecedores/especialistas precisam de tela+schema novos seguindo este formato.

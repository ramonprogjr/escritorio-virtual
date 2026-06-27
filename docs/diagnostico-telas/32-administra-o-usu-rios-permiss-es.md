# Usuários & Permissões  ·  Administração

**Rota:** 

## Veredito do diretor
Tela madura e honesta — uma das mais sólidas do sistema. O job central (convidar + gerir permissão/acesso) fecha em ≤3 cliques, com edição inline de papel e toggle ativar/desativar (Click-and-Go real), RBAC seguro (owners fixos, papéis atribuíveis filtrados pelo ator, bloqueio claro p/ não-gestor). É a EXCEÇÃO legítima ao princípio "tabela ≠ tela de trabalho": conta de acesso é entidade técnica, não jornada — aqui a tabela é o formato certo e não deve virar cartão no desktop. O que falta é tudo polimento de feedback e segurança de gesto, não arquitetura: (1) sem confirmação de sucesso (toast) ao convidar/alterar e o erro aparece longe da ação; (2) ações sensíveis (cortar acesso, rebaixar papel) disparam sem micro-confirmação — risco real de clique acidental que tira alguém do sistema; (3) coluna Empresa é ruído para gestor de tenant único; (4) mobile com scroll horizontal destoa do resto; (5) IA é o eixo zero aqui — nada sugere papel ou reconhece membro homologado migrando como fornecedor, que é exatamente o elo desta tela com o TODO (Hub→fornecedor). Prioridade do diretor: blindar gestos sensíveis e dar feedback ANTES de qualquer enfeite visual — porque "vão usar de verdade" e cortar acesso por engano é o pior erro possível nesta tela.

## Cenários trazidos
- SERVIR O COMERCIAL (gestor de 1 fornecedor) vs O HUB (owner multi-tenant): são dois públicos com necessidades opostas na MESMA tela. Gestor quer simplicidade — 3-5 colaboradores, sem busca, sem coluna Empresa. Owner quer escala — vê N tenants, precisa de busca/filtro/coluna Empresa. Decisão do diretor: NÃO bifurcar em duas telas; adaptar a UI ao papel via isOwner (mostrar Empresa + busca/filtro só p/ owner; esconder p/ gestor). Uma tela, dois comportamentos — coeso e econômico.
- TABELA vs CARTÕES: no DESKTOP a tabela vence (entidade técnica, comparação coluna-a-coluna de papel/status é o job). No MOBILE o scroll horizontal perde — cartões empilhados por colaborador ganham. Decisão: tabela no desktop, cards no mobile (mesmo dado, layout responsivo), sem inventar uma 'tela de trabalho conversacional' que aqui seria over-engineering.
- IA-FIRST nesta tela — onde aplicar sem virar gadget: (a) ao colar e-mail de membro homologado, reconhecer e pré-sugerir nome + papel 'comercial' (elo direto com o TODO Hub→fornecedor); (b) sugerir papel pelo histórico/cargo. NÃO automatizar a DECISÃO de permissão (segurança), só a SUGESTÃO — usuário confirma. Cenário alternativo: deixar IA fora desta tela por ora (é admin, baixo volume) e investir IA nas telas de funil. Recomendação: fazer só o reconhecimento de membro migrando (alto valor, baixo esforço, conecta ao negócio), adiar o resto.
- GESTO SENSÍVEL — confirmação vs undo: cortar acesso pode usar (a) modal de confirmação ('Desativar acesso de Fulano?') ou (b) ação imediata + toast com 'Desfazer' por 5s. Undo é mais Click-and-Go (menos fricção) mas exige infra de toast. Recomendação: confirmação leve agora (barato, seguro) e evoluir p/ undo quando houver sistema de toast global.

## ✅ Manter
- Header sticky com título + nota de desambiguação ('Colaboradores com login — não confundir com Cadastros de clientes') — previne o erro conceitual mais provável; é orientação, não ruído
- CTA único 'Convidar colaborador' em dourado — hierarquia visual correta, job central a 1 clique
- Edição inline de Permissão (CrmPermissaoSelect) — coração da tela, Click-and-Go puro (escolher e confirmar, não digitar)
- Toggle Desativar/Reativar em 1 clique como modelo de gestão de acesso
- RBAC: owners fixos intocáveis, papéis atribuíveis filtrados pelo ator, default 'comercial' sensato
- Card de bloqueio para não-gestor (explica o porquê em vez de erro seco)
- Formato TABELA no desktop — exceção legítima ao 'tabela ≠ tela de trabalho'; NÃO converter em cartões no desktop
- Modal enxuto: e-mail obrigatório + nome opcional + papel com descrição — mínimo de campos, fecha em ≤3 cliques
- Seletor de permissão COM descrição no modal — melhor padrão da tela, deve ser a referência

## ❌ Remover (ruído)
- Coluna 'Empresa' para gestor de tenant único — valor idêntico em toda linha = ruído puro; exibir só quando isOwner (multi-tenant), e para gestor mostrar o nome da empresa uma vez no header
- Fallback silencioso empresaNome que mascara dado ausente — não 'remover a info', mas parar de inventar valor quando não há
- Aparência de 'input desabilitado' no campo Empresa fixo do modal (gestor) — remover a moldura de input e tratar como rótulo/contexto
- Confiança no texto cru do status (status.trim()) para o badge — remover dependência do texto bruto do backend; normalizar o rótulo exibido

## 🤖 Promover a IA-first / 1-toque
- Reconhecimento de membro homologado migrando como fornecedor: ao colar e-mail conhecido, IA pré-preenche nome + sugere papel 'comercial' (1-toque) — é o elo desta tela admin com o TODO Hub→fornecedor
- Pré-preencher nome a partir do e-mail/diretório quando disponível (usuário só confirma)
- Sugestão de papel pelo cargo/histórico no convite — IA sugere, usuário escolhe e confirma (nunca a IA decide permissão sozinha)
- Validação inteligente inline no e-mail: avisar antes do submit se já é colaborador (em vez de descobrir no erro da API)

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Micro-confirmação ('Desativar acesso de Fulano?') antes de cortar acesso e ao rebaixar/elevar papel — gesto sensível não pode disparar por clique acidental; deixar explícito que NÃO se exclui, apenas desativa (preserva histórico)  _(premissa: Funcional não-fachada + útil: clientes vão USAR de verdade; cortar acesso por engano é o pior erro desta tela)_
- **P2** · medio · risco baixo — Toast de sucesso/erro próximo da ação: 'Convite enviado para X' ao fechar o modal, e confirmação inline na linha ao alterar papel/status; mover o erro de PATCH do topo da página para perto da linha + auto-dismiss  _(premissa: Funcional não-fachada: feedback real fecha o loop; erro longe da ação em lista longa pode passar despercebido)_
- **P3** · medio · risco baixo — Adaptar a tela ao papel: coluna 'Empresa' e busca/filtro (papel/status/empresa) só quando isOwner ou lista > N linhas; gestor vê tela limpa com a empresa no header  _(premissa: Acima de tudo ÚTIL e sem ruído: remover repetição p/ gestor e dar escala ao owner sem poluir o caso comum)_
- **P4** · pequeno · risco baixo — Tooltip com a descrição do papel (CRM_PERMISSAO_DESCRICAO, já existe) na coluna Permissão da tabela — paridade com o modal, que já mostra a descrição  _(premissa: Fácil de entender: usuário não precisa saber de cor o que 'Atendente' pode fazer)_
- **P5** · medio · risco baixo — Mobile: cards empilhados por colaborador em vez de scroll horizontal (mesmo dado, layout responsivo); manter tabela no desktop  _(premissa: Mobile importa + coeso e bonito: scroll horizontal destoa das telas polidas (ref. onboarding))_
- **P6** · grande · risco medio — IA-first: ao colar e-mail de membro homologado, reconhecer e pré-preencher nome + sugerir papel 'comercial' (usuário confirma) — conecta a tela admin ao fluxo Hub→fornecedor do TODO  _(premissa: IA-first (Click-and-Go): a IA sugere, o usuário escolhe e confirma; alinha a tela ao objetivo do produto)_
- **P7** · pequeno · risco baixo — Polimento de estados: skeleton de 3-4 linhas no loading (em vez de 'Carregando…') + CTA 'Convidar colaborador' embutido no empty state para fechar o loop em 1 clique no contexto; normalizar rótulo do badge de status  _(premissa: Coeso e bonito + fácil: coerência visual com o resto e ação no contexto)_

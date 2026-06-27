# Escritórios (Tenants / Administração)  ·  Administração

**Rota:** 

## Veredito do diretor
Tela honesta e funcional para o JOB de hoje (owner cria tenant + convida 1º admin numa passada, ativa/desativa com confirmação, loading e toasts reais). Mas é o ponto mais FRACO do sistema em duas premissas inegociáveis: IA-first (zero sugestão/autocomplete, tudo digitado) e bonito-e-coeso (window.confirm e <select> nativos quebram o dark verde+dourado). Acima disso, há uma falha de PRODUTO mais grave que a de UX: esta é o painel de comando da rede multi-tenant — o lugar onde mora a monetização (SaaS por usuário + comissão transacional) — e hoje é uma planilha cega. O owner não enxerga daqui quantos usuários/leads/obras/receita cada escritório tem, não gerencia admins de um tenant existente, não vê status de assinatura nem créditos (Tijolos). A coluna 'Slug' ocupa espaço nobre com dado técnico que ninguém edita. Veredito: NÃO é uma tela comercial e não deve virar uma — é administração de rede; logo a régua 'tabela≠tela de trabalho' se relaxa, mas a tabela atual precisa virar a porta de entrada (linha clicável → painel do escritório), não um fim em si. Prioridade do sistema: primeiro tornar a linha clicável e trocar Slug por métrica útil (entrega visão de gestão = sustenta monetização), depois polir confirm/select/empty-state, e por último injetar IA no modal. Cuidado de coerência: o painel do escritório (/crm/empresas/[id] já existe) deve reusar os mesmos cartões e tokens do onboarding de Membros para não criar um terceiro dialeto visual.

## Cenários trazidos
- CENÁRIO A — Admin enxuto (low effort): manter tabela, mas tornar a LINHA clicável para um painel lateral/drawer do tenant e trocar 'Slug' por métricas (usuários, criado em). Serve o owner operacional sem virar produto novo. Recomendado como passo 1.
- CENÁRIO B — Hub de gestão da rede (high effort, alinhado à visão de monetização): cada escritório vira um CARTÃO com nome, plano/assinatura, nº usuários, nº leads/obras, créditos (Tijolos), status; clicar abre painel completo (admins, métricas, billing). É o destino correto dado o modelo SaaS+comissão, mas é um épico — deferir até existirem dados de assinatura/uso. NÃO construir cartões vazios (fachada).
- CENÁRIO C — Comercial vs Hub: NÃO confundir esta tela com cadastro comercial de empresas-cliente. Empresa-cliente é entidade do CRM (Cadastros); Escritório/Tenant é controle da REDE (Administração, owner-only). Manter a separação — fundir as duas seria erro de produto.
- CENÁRIO D — IA no modal: pré-preencher/validar o admin a partir de usuários já existentes (Click-and-Go em vez de digitar e-mail), preview do slug gerado, validação inline. Baixo risco, alto fit com premissa 2 — mas só depois que a visão de gestão (A) estiver de pé, pois é refinamento.

## ✅ Manter
- Gate owner-only com fail-fast (trata sessão ausente sem loading eterno) — controle de rede correto
- Botão 'Novo escritório' dourado no header — ação primária, 1 clique, Click-and-Go
- Modal cria tenant + convida 1º admin numa só passada, só 1 campo obrigatório — excelente economia de cliques no JOB
- Bottom-sheet no mobile / modal centralizado no desktop — 'mobile importa' respeitado
- Cobertura dos 3 estados reais (loading/vazio/erro) — funcional, não fachada
- CrmPermissaoSelect mostrando só papéis atribuíveis + descrição do papel
- Separação conceitual Tenant (Administração) vs Empresa-cliente (Cadastros)

## ❌ Remover (ruído)
- Coluna 'Slug' da visão principal — dado técnico (URL/identificador) que o owner nunca edita aqui; é ruído de planilha. Mover para tooltip/detalhe e dar o espaço a uma métrica útil
- window.confirm nativo — quebra a premissa bonito-e-coeso; substituir por dialog do design dark
- Empty-state apenas textual — adicionar CTA embutido
- Beco-sem-saída no card de bloqueio do não-owner — idealmente esconder o item 'Escritórios' do menu para não-owner; se aparecer, dar CTA 'Voltar ao painel'

## 🤖 Promover a IA-first / 1-toque
- Modal: autocomplete/seleção do 1º admin a partir de usuários já existentes (escolher em vez de digitar e-mail) — Click-and-Go
- Modal: preview do slug gerado abaixo do campo Nome (transparência), editável
- Modal: validação inline de e-mail com feedback, e colapsar o seletor de Permissão até o e-mail ser preenchido
- Painel do escritório: IA resume saúde do tenant (ex.: 'X usuários, Y leads ativos, assinatura em dia') em linguagem natural — 1 toque para entender o estado

## 🎯 Ações priorizadas

- **P1** · medio · risco baixo — Tornar a LINHA/nome do escritório clicável, abrindo o painel do tenant (/crm/empresas/[id] já existe) com admins, métricas e status — converte a planilha cega em porta de entrada de gestão  _(premissa: Útil e fácil de entender + sustenta o modelo de monetização (owner precisa enxergar uso/receita por escritório))_
- **P2** · pequeno · risco baixo — Trocar a coluna 'Slug' por uma métrica útil (nº de usuários e/ou data de criação); mover slug para tooltip/detalhe  _(premissa: Acima de tudo ÚTIL — eliminar ruído técnico e dar informação de negócio)_
- **P3** · pequeno · risco baixo — Substituir window.confirm por dialog estilizado do design dark e o empty-state textual por um com CTA 'Criar primeiro escritório'  _(premissa: Bonito e coeso (#003b26/#c9a24a) + funcional não-fachada)_
- **P4** · pequeno · risco medio — Esconder o item 'Escritórios' do menu para não-owner (e, se exibido, dar CTA 'Voltar ao painel' no card de bloqueio)  _(premissa: Prático e fácil — não oferecer caminho que termina em beco)_
- **P5** · medio · risco baixo — IA/Click-and-Go no modal: autocomplete do admin a partir de usuários existentes, preview do slug e validação inline de e-mail; colapsar Permissão até haver e-mail  _(premissa: IA-first (sugere/pré-preenche, usuário confirma) + mínimo de cliques)_
- **P6** · pequeno · risco baixo — Transformar o chip 'Ativa/Inativa' em pill com fundo suave (hierarquia visual) e agrupar futuras ações de linha (Gerenciar admins/Editar/Métricas/Ativar) num menu '⋯' — só após o painel do tenant existir  _(premissa: Bonito e coeso + consolidar ações sem poluir a linha)_

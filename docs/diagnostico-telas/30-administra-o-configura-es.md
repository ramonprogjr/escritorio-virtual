# Configurações  ·  Administração

**Rota:** 

## Veredito do diretor
Tela real e funcional (lê /api/health, followup-config e tenant-settings; persiste com guarda de admin), mas com PROBLEMA ESTRUTURAL DE PÚBLICO: ela mistura um painel de DevOps da PLATAFORMA (13 env vars/secrets crus, read-only, sem ação) com 3 regras de NEGÓCIO do tenant (horário, distribuição, follow-up). Para o usuário-alvo — gestor do escritório fornecedor — metade da tela é ruído técnico assustador (ver 'Anthropic API key: Falta', 'CRON_SECRET', 'Supabase service role') sem nada a fazer, ferindo de frente '≤3 cliques para um job' (não há job possível no health-check) e 'útil/fácil de entender'. O bloco mais valioso e mais aderente à visão Hub — Distribuição de leads, IA-first, coração do motor de distribuição — está enterrado no meio, usa checkbox nativo cru (quebra a coesão dark verde+dourado) e carrega um BUG DE UX REAL e confirmado no código: os botões 'Guardar horário' e 'Guardar distribuição' chamam a MESMA função e compartilham o MESMO estado salvandoHorario, então ambos piscam 'Salvando…' juntos e o usuário não sabe o que salvou — agravado por NÃO existir confirmação de sucesso em lugar nenhum (só estado de erro). A promessa IA-first existe só em texto; nenhuma sugestão da IA é renderizada na UI, sendo a maior oportunidade desperdiçada da tela. Veredito: MANTER e elevar o bloco de distribuição; CORRIGIR os bugs P0; EXPULSAR o painel técnico para uma área de super-admin; e injetar IA-first de verdade (régua de follow-up e prazo sugeridos).

## Cenários trazidos
- PÚBLICO — Servir o COMERCIAL (recomendado): Configurações = só as 3 regras do motor do tenant (horário, distribuição, follow-up), em linguagem humana, zero secrets. O health-check de plataforma migra para uma área super-admin Obra10+ (fora do tenant). Coerente com a visão multi-tenant: o fornecedor não administra a infra da plataforma.
- PÚBLICO — Servir o HUB/plataforma (rejeitado para esta tela): manter o diagnóstico técnico aqui assume que o usuário é operador da Obra10+. Conflita com a visão de que o tenant é o escritório fornecedor; exporia secrets a clientes finais. Só faz sentido se houver um perfil 'super-admin' logado, e mesmo assim em rota separada.
- HEALTH-CHECK — se PRECISAR aparecer ao tenant: NÃO mostrar 13 nomes crus. Usar o campo 'area' (já existe no tipo HealthCheck e hoje é IGNORADO no render) para colapsar em 3-4 selos de domínio: 'WhatsApp ativo', 'IA ativa', 'Distribuição ativa' — verde discreto, sem nomes de secret, e só destacar o que falta COM caminho de correção. Caso contrário, remover por completo.
- SALVAR — Um botão vs três: como horário e distribuição gravam no MESMO objeto settings/mesmo endpoint, o ideal é UM 'Salvar alterações' fixo no rodapé com dirty-state (só habilita se algo mudou) para esses dois cards; follow-up mantém salvar próprio por ser outra fonte (hub_followup_config). Resolve a fragmentação e elimina a raiz do bug de loading compartilhado.
- FOLLOW-UP — tabela/planilha plana vs cadência visual: hoje é uma lista só-editar-horas, sem adicionar/remover, com estado vazio que MANDA o usuário ao Supabase. Alternativa aderente ao 'tabela ≠ tela de trabalho': timeline visual da cadência (passo 1 = 2h → passo 2 = 24h…) com CRUD real e estado-vazio que oferece 'Criar cadência sugerida pela IA'.
- IA — automatizar o quê: a IA pré-sugere (a) régua de follow-up padrão por mercado no estado vazio, (b) prazo de validação humana com base no tempo médio de aceite do time ('seu time aceita em ~6h, sugerimos 12h'), (c) defaults de horário 08:00–18:00. Sempre Click-and-Go: a IA propõe, o gestor confirma.

## ✅ Manter
- Os 3 cards de regra de negócio do tenant: Horário comercial, Distribuição de leads e Cadência de follow-up — são regras reais do motor comercial e legítimos nesta tela.
- Card 'Distribuição de leads' como bloco-estrela: é o coração do Hub→fornecedor e o mais aderente à visão IA-first. Deve subir para o topo, logo após o header.
- Header sticky com título/subtítulo (padrão coeso com o resto do CRM) e os time-pickers de início/fim (já são Click-and-Go, escolha e não digitação).
- Banner de erro condicional (feedback real de falha, funcional não-fachada) — manter, mas complementar com estado de sucesso.
- Guarda de admin no backend (requireCrmGestor / só admin edita) — correto e deve permanecer.
- Defaults sensatos já presentes: 08:00–18:00, America/Sao_Paulo, distribuicao_auto=true, 24h.

## ❌ Remover (ruído)
- Painel 'Ambiente e integrações' com a grade de 13 env vars cruas (Supabase service role, CRON_SECRET, WEBHOOK_SECRET, Anthropic API key, UAZAPI, Windsor.ai etc.) da tela do TENANT — é diagnóstico de plataforma, read-only, sem ação possível (beco sem saída) e expõe secrets/infra ao cliente final. Mover para área super-admin Obra10+.
- Toda a linguagem técnica visível: 'Persistido em hub_tenants.settings (admin)', 'Flag global: CRM_DISTRIBUICAO_AUTO no ambiente', 'hub_followup_config — horas entre passos', e 'Configure no Supabase ou ciclos'. Vaza implementação e não significa nada para o gestor.
- Estado vazio do follow-up que aponta para o Supabase — substituir por CTA de criação assistida por IA, nunca mandar o usuário a um console externo.
- Checkbox HTML nativo cru de distribuição — substituir por toggle estilizado (switch dourado) coeso com a identidade.
- A duplicidade/fragmentação dos botões 'Guardar' para horário+distribuição (mesmo objeto settings) — consolidar.

## 🤖 Promover a IA-first / 1-toque
- Estado vazio do follow-up vira 'Criar cadência sugerida pela IA': a IA pré-preenche uma régua padrão por mercado; o gestor revisa e confirma (Click-and-Go), em vez de planilha em branco.
- Prazo de validação humana com sugestão da IA baseada no tempo médio de aceite do time ('seu time costuma aceitar em ~6h — sugerimos 12h'), oferecido como chips rápidos (4h/24h/48h/72h) + custom, em vez de digitar um número cru até 168.
- Selo de saúde das integrações resumido (1 toque para detalhe), derivado do /api/health, em linguagem de domínio ('WhatsApp ativo', 'IA ativa') — não a planilha de secrets.
- Sugestão de horário comercial padrão pela IA (08:00–18:00 já é default; tornar explícito como sugestão aceitável em 1 toque).
- Timeline visual da cadência de follow-up que a IA monta e o gestor ajusta — transforma a tabela plana em tela de trabalho.

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Corrigir o bug de loading compartilhado: criar estado salvandoDistribuicao separado de salvandoHorario E desacoplar o onClick de 'Guardar distribuição' de salvarHorario() (hoje ambos os botões, linhas 206 e 248, chamam a mesma função e usam salvandoHorario na linha 247, fazendo os dois piscarem 'Salvando…' juntos).  _(premissa: Prático/fácil + feedback claro: o usuário precisa saber exatamente o que está salvando.)_
- **P1** · pequeno · risco baixo — Adicionar confirmação de sucesso ao salvar (chip 'Salvo ✓' efêmero ~2s ou toast) nos três fluxos de gravação — hoje só existe estado de erro; ao salvar, o botão volta ao label normal sem nenhuma confirmação.  _(premissa: Útil/fácil de entender: sem confirmação o usuário duvida se a ação funcionou.)_
- **P1** · medio · risco medio — Separar config-de-tenant de admin-de-plataforma: remover o painel 'Ambiente e integrações' (grade de 13 env vars) da tela do tenant e movê-lo para uma rota super-admin Obra10+. No tenant, no máximo um selo verde discreto 'Integrações ativas'.  _(premissa: Útil/fácil e ≤3 cliques: remover ruído técnico sem ação possível que assusta o cliente final e expõe secrets.)_
- **P2** · pequeno · risco baixo — Remover toda linguagem técnica visível (hub_tenants.settings, CRM_DISTRIBUICAO_AUTO, hub_followup_config, 'Configure no Supabase') e reescrever em linguagem humana; explicar precedência da automação em texto simples ou unificar numa única fonte de verdade.  _(premissa: Fácil de entender: não vazar implementação ao usuário.)_
- **P2** · pequeno · risco baixo — Trocar o checkbox nativo de distribuição por toggle estilizado (switch dourado) e elevar o card 'Distribuição de leads' para o topo da tela, logo após o header, por ser o bloco mais estratégico.  _(premissa: Bonito e coeso (dark verde+dourado) + priorizar o que mais serve à visão Hub.)_
- **P2** · medio · risco medio — Tornar o follow-up um CRUD real (adicionar/remover passos pela UI, não só editar horas) com estado-vazio que oferece 'Criar cadência sugerida pela IA' e uma timeline visual da sequência; eliminar o ponteiro para o Supabase.  _(premissa: ≤3 cliques + IA-first + tabela ≠ tela de trabalho: dar caminho de ação onde hoje é beco sem saída.)_
- **P3** · pequeno · risco baixo — Trocar o 'Fuso' de input texto-livre por <select> de timezones comuns do Brasil (evita digitação errada que quebra cálculos de SLA) e oferecer o prazo de validação como chips rápidos (4h/24h/48h/72h) + custom, com sugestão da IA.  _(premissa: Click-and-Go: escolher e confirmar, não digitar.)_
- **P3** · medio · risco baixo — Consolidar horário+distribuição num único 'Salvar alterações' com dirty-state (mesmo objeto settings/mesmo endpoint), mantendo o salvar próprio do follow-up por ser fonte distinta; e atualizar o subtítulo do header para cobrir os 4 blocos (ex.: 'Regras do motor comercial e saúde do ambiente').  _(premissa: Mínimo de cliques + coesão: uma ação para o que é um só objeto.)_

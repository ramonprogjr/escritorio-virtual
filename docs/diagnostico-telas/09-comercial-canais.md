# Canais  ·  Comercial

**Rota:** 

## Veredito do diretor
Aprovo o JOB, reprovo a EXECUÇÃO. A tela acerta no propósito estreito e honesto — monitorar se o WhatsApp dos agentes está no ar, assumindo-se read-only e empurrando config para a ficha do agente. Isso é maduro e deve ser preservado. Mas hoje ela é um PAINEL DE TI disfarçado de tela de negócio, e fere 3 das 5 premissas inegociáveis: (1) vaza jargão de infra (UAZAPI, instância, token, UUID, slug) a um fornecedor que não fala essa língua — quebra 'útil e fácil de entender'; (2) é tabela densa de 6 colunas com 720px de minWidth (scroll horizontal no mobile) onde deveria ser cards — quebra 'tabela ≠ tela de trabalho' e 'mobile importa'; (3) usa azuis Shadcn (#93c5fd no KPI, paleta azulada do sideover) que quebram a identidade verde+dourado, sendo o azul uma TRAVA explícita a ignorar. O pecado de produto mais grave: o caso de uso #1 — 'caiu, quero religar' — custa 3 cliques (olho → sideover → link) e ainda joga numa ficha genérica; deveria ser 1 toque 'Reconectar' direto no card. E falta totalmente o lado IA-first: nada de 'O atendente caiu há 2h — religue agora'. Em uma plataforma cuja moeda é confiança no atendimento automático, um WhatsApp caído sem ninguém perceber é perda de lead — esta tela existe justamente para evitar isso, então o atalho de religar e o alerta proativo NÃO são luxo, são o core do valor. Sem-fachada confirmado (consome /api/hub/canais real, sideover funciona). Veredito: REFINAR para cards IA-first, não reconstruir a lógica.

## Cenários trazidos
- CENÁRIO A — Servir o COMERCIAL (fornecedor que atende): é o usuário real desta rota (grupo Comercial). Ele só quer saber 'meu WhatsApp tá no ar?' e religar em 1 toque. Esconder TODO diagnóstico de TI atrás de 'Detalhes técnicos' colapsável. RECOMENDO como direção principal — alinha com o todo (telas para o JOB do negócio).
- CENÁRIO B — Servir o HUB/suporte (operador da plataforma): aí UUID, token, snapshot_at e logs de conexão SÃO o trabalho. Mas esse é outro perfil e outra tela (futuro /admin ou painel de saúde da plataforma). NÃO contaminar a tela do fornecedor com necessidades de suporte. Resolver via colapsável 'Detalhes técnicos' por enquanto; promover a tela de saúde própria só quando houver demanda real de suporte.
- CENÁRIO C — Tabela vs Cards: tabela só se justifica com muitos itens e colunas comparáveis. Aqui o fornecedor típico tem 3-4 agentes (atendente/sdr/gerente) e a única coluna acionável é Conexão. Cards (nome grande + badge + 1 CTA contextual) vencem em mobile e em clareza. RECOMENDO cards. Coerência com o todo: as demais telas de trabalho do CRM já caminham para cards/conversacional — manter tabela aqui seria a exceção dissonante.
- CENÁRIO D — Nível de IA: (D1) passivo, só badge colorido (estado atual); (D2) alerta reativo — banner 'Atendente caiu há 2h, X leads podem ter ficado sem resposta — Religar'; (D3) preditivo — IA detecta padrão de quedas e sugere trocar instância/proxy. RECOMENDO começar em D2 (alto valor, esforço médio) e deixar D3 no backlog. D2 é o que transforma 'tabela read-only' em 'assistente que protege seu atendimento'.
- CENÁRIO E — Auto-refresh vs manual: manual defasa silenciosamente (risco de ver 'conectado' num canal já caído). Polling leve enquanto a tela está aberta + 'atualizado há X' resolve. RECOMENDO híbrido: polling suave + botão manual preservado.

## ✅ Manter
- Propósito read-only assumido: monitora estado, config fica na ficha do agente — decisão de produto correta, preservar
- Badge de conexão colorido (verde/âmbar/cinza) — é o coração da tela, comunica em 0 clique
- FilterPills Conectados/Sem instância — recortes operacionais certos, Click-and-Go real de 1 clique
- snapshot_at (última sincronização) no sideover — dá confiança no dado; só precisa ganhar destaque
- Botão Atualizar manual no header — coerente; status muda fora do app
- KPI 'Conectados' — o único número que realmente importa (está no ar?), resolve o job em 0 clique

## ❌ Remover (ruído)
- KPI 'Com instância UAZAPI' (#93c5fd, linha 172) — vaza nome do provedor de infra e usa azul fora do design system; substituir por 'Configurados' em verde/dourado
- KPI 'Canais ativos' (linha 170) — redundante com o nº de linhas da tabela logo abaixo; ruído read-only
- Coluna 'Slug' (<code>gerente_atendimento</code>, linha 248) — identificador técnico interno, zero decisão de negócio, ocupa espaço nobre; mover para detalhe
- Coluna 'Modo' na lista — metadado de TI; vai para 'Detalhes técnicos' do card
- Segundo link 'Prompt, conhecimento e ferramentas…' no sideover — aponta para a MESMA URL /crm/agentes/{slug} do primeiro; redundância que confunde, unificar em 1 botão
- Todos os azuis (#93c5fd, #58a6ff, #1f6feb22, fundos #0f1620/bordas #2d394b do sideover) — quebram a TRAVA verde+dourado
- Parágrafo técnico citando 'proxy, token UAZAPI' (linhas 189-193) — texto denso de TI no topo; encurtar para 1 linha amigável
- Termo 'slug' do placeholder da busca (linha 196) — jargão; manter slug pesquisável invisível
- InfoRows técnicos expostos por padrão no sideover (ID instância UUID, Token UAZAPI) — esconder atrás de 'Detalhes técnicos' colapsável

## 🤖 Promover a IA-first / 1-toque
- Alerta proativo IA-first: 'O Atendente caiu há 2h — possíveis leads sem resposta. Religar agora' como banner no topo quando houver canal desconectado (transforma painel passivo em assistente que protege o atendimento — o core do valor desta tela)
- CTA contextual 1-toque 'Reconectar / Ver QR' direto no card quando status = Desconectado (corta de 3 cliques para 1; é o caso de uso mais urgente e hoje o mais penoso)
- IA preditiva (backlog): detectar padrão de quedas recorrentes num canal e sugerir ação ('Este número cai todo dia ~18h — verifique a estabilidade do telefone')
- Renomear filtro 'Sem instância' → 'Falta configurar' e ADICIONAR pílula 'Desconectados' (instância existe mas caiu) — é o recorte que pede ação imediata e hoje não tem pílula própria

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Repintar TODA a tela nos tokens verde/dourado: trocar #93c5fd e azuis do sideover (#0f1620/#2d394b/#58a6ff/#1f6feb22) por dourado #c9a24a em acentos/links e verde --obra-* em superfícies. É TRAVA explícita e quebra de identidade no sistema já no ar.  _(premissa: Premissa 3 (bonito e coeso — dark verde+dourado); TRAVA azul a ignorar)_
- **P1** · medio · risco medio — Adicionar CTA contextual 'Reconectar / Ver QR' por canal quando Desconectado, na própria linha/card, levando direto ao passo de pareamento (não à ficha genérica). Reduz o job crítico de 3 cliques para 1.  _(premissa: Premissa 1 (máx 3 cliques) e 5 (útil); 'funcional não-fachada')_
- **P2** · medio · risco baixo — Traduzir todo o vocabulário de TI para linguagem de negócio: KPI 'Com instância UAZAPI'→'Configurados'; remover 'Canais ativos'; encurtar o parágrafo para 1 linha amigável; tirar 'slug' do placeholder. Esconder UUID/token/modo atrás de 'Detalhes técnicos' colapsável (serve o suporte sem poluir o fornecedor).  _(premissa: Premissa 5 (útil e fácil de entender); 'a info é mesmo necessária aqui?')_
- **P2** · medio · risco medio — Banner IA-first de alerta no topo quando houver canal desconectado: 'O [Agente] caiu há X — religue para não perder leads', com botão de ação. Eleva a tela de painel passivo a assistente que protege o atendimento.  _(premissa: Premissa 2 (IA-first — IA sugere, usuário confirma); core de valor da tela)_
- **P2** · medio · risco medio — Trocar a tabela (minWidth 720, scroll horizontal no mobile) por cards: 1 card por canal = nome grande + badge de status + 1 CTA. Esconder slug/instância/modo no detalhe. Mobile-first, empilha sem scroll lateral.  _(premissa: 'tabela ≠ tela de trabalho'; 'mobile importa')_
- **P3** · pequeno · risco baixo — Renomear pílula 'Sem instância'→'Falta configurar' e adicionar pílula 'Desconectados' (instância existe mas status != connected) — recorte mais urgente, hoje sem filtro próprio.  _(premissa: Premissa 5 (útil); Click-and-Go)_
- **P3** · pequeno · risco baixo — Unificar os dois links redundantes do sideover em 1 botão primário 'Abrir ficha do agente' (ambos apontam para /crm/agentes/{slug}). Se houver seções distintas, usar #hash real.  _(premissa: Premissa 4 (prático/fácil); remover ambiguidade)_
- **P3** · pequeno · risco baixo — Mostrar 'atualizado há X' ao lado do botão Atualizar + polling leve enquanto a tela está aberta, mantendo o refresh manual. Evita estado defasado silencioso.  _(premissa: Premissa 5 (útil — dado confiável); 'funcional não-fachada')_
- **P4** · pequeno · risco baixo — Tornar o KPI 'Conectados' clicável para aplicar o filtro correspondente (1 clique → ver desconectados). Transforma número morto em atalho acionável.  _(premissa: Premissa 1 (mínimo de cliques); Click-and-Go)_

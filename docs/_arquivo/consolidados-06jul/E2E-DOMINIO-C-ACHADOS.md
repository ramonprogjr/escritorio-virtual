# Auditoria E2E — DOMÍNIO C (Operações / Obras)

> Régua-mãe: o melhor para o sistema — crítico, seguro, cuidadoso, CERTEZA.
> Olhar cético sobre o build recente (a maior parte deste domínio nasceu nesta sessão).
> READ-ONLY. Data: 2026-06-30. Branch: `wendel/dev`.

## Telas/arquivos auditados (reais)

- `app/crm/projetos/page.tsx` — **STUB** (lista + modal). 211 linhas.
- `app/crm/arquitetura/page.tsx` + `[id]/page.tsx` — módulo RICO (kanban funil, KPIs, fila "Em aprovação", ficha com 5 abas).
- `app/crm/obras/page.tsx` (cockpit Carteira/Hoje) + `[id]/page.tsx` (6 abas).
- Componentes da obra: `ArvoreEscopo`, `ObraItensSecao`, `ObraComprasEstoqueSecao`, `ObraFinanceiroSecao`, `ObraCronogramaSecao`, `DrawerMedir`, `SecaoHistoricoMedicoes`, `NovaObraSideover`, `gerar-obra-sideover`.
- `app/crm/imoveis/page.tsx` (725 linhas — o mais maduro do domínio).
- `app/crm/pedidos/page.tsx` — STUB (lista + modal).
- Rotas API: `obras/[id]` (+ escopo, itens, medicoes, financeiro, cronograma), `projetos`, `projetos/[id]/gerar-obra`.
- `lib/crm/crm-api-auth.ts`, `lib/tenant-default.ts`, `lib/crm-nav-groups.ts`.

---

## 🔴 BLOQUEADORES

### B1 — O menu "Arquitetura" aponta para o STUB, não para o módulo real (fachada/rota morta)
- **Arquivo:** `lib/crm-nav-groups.ts:106` → `{ href: "/crm/projetos", label: "Arquitetura" }`.
- **Problema:** existe um módulo Arquitetura COMPLETO em `app/crm/arquitetura/**` (kanban com funil editável, 4 KPIs vivos, fila "Em aprovação", deep-link de aba, ficha com Conversar/Programa/Funil/Entregáveis/Engenharia, handoff "Gerar obra"). Mas o item de menu rotulado "Arquitetura" leva o usuário para `/crm/projetos`, que é um STUB: só lista cartões simples + um modal "Novo projeto" (sem funil, sem KPIs, sem aprovação, sem geração de obra). O trabalho recente todo (A0/A1/A2) está **inacessível pela navegação**. O `/crm/projetos` ainda cria projeto com `negocio_id` opcional, mas não dá acesso à esteira nem ao "Gerar obra".
- **Evidência cruzada:** `app/crm/arquitetura/[id]/page.tsx` é quem instancia `GerarObraSideover`; `app/crm/projetos/page.tsx` não tem nada disso. Os dois consomem o mesmo `GET /api/crm/projetos`.
- **Ajuste:** trocar o `href` do item "Arquitetura" para `/crm/arquitetura`. Em seguida decidir o destino de `/crm/projetos` (DECISÃO D1 abaixo): redirect 308 para `/crm/arquitetura` ou remover. Verificar também `components/crm/CrmAnalyticsDashboard.tsx` e `CrmOperacaoResumo.tsx` (links para `/crm/obras` e `/crm/pedidos` estão certos; conferir se algum aponta `/crm/projetos`).

### B2 — Detalhe da obra (`obras/[id]/page.tsx`) está fora do design-system e fora do padrão mobile das abas
- **Arquivo:** `app/crm/obras/[id]/page.tsx:62-71, 126-163`.
- **Problema:** a página da obra é o ÚNICO ponto do domínio escrito com `style={{...}}` inline cru e `maxWidth: 960` fixo, com `<h1>` sem classe, botão "← Obras" sem `min-height`/área de toque, e a aba "Painel" renderizando `gridTemplateColumns: "repeat(3, 1fr)"` FIXO — no celular as 3 colunas (Pedidos/Check-ins/Diário) espremem e o texto sobrepõe. A barra de abas (`display:flex; gap:4`) **não tem scroll horizontal**: são 6 abas (Escopo, Itens & Avanço, Cronograma, Compras & Estoque, Financeiro, Painel) que estouram a largura no mobile e quebram/cortam. Contraste forte com os componentes-filhos, que são Tailwind mobile-first e na marca.
- **Ajuste:** (a) trocar a faixa de abas por um container com `overflow-x-auto` + `flex-shrink:0` em cada aba (mesmo padrão de `ObraFinanceiroSecao`/`ObraComprasEstoqueSecao`); (b) a aba "Painel" deve usar `grid-cols-1 sm:grid-cols-3`; (c) o botão voltar precisa de alvo ≥44px. Idealmente migrar o casco para Tailwind/tokens como o resto.

### B3 — Foto de evidência da medição NÃO é persistida (DrawerMedir) — funcionalidade prometida e não entregue
- **Arquivo:** `components/crm/obras/DrawerMedir.tsx:271-392` (input file) + `salvar()` em `97-154`; servidor `app/api/crm/obras/[id]/medicoes/route.ts:226, 262-275`.
- **Problema:** o input vira `type="file" capture="environment"` (ótimo no campo), mostra preview, mas `setFotoUrl("")` é sempre vazio porque não há bucket de Storage configurado. O `body.foto_url` enviado é vazio → a coluna `foto_url` grava `null`. O histórico (`SecaoHistoricoMedicoes`) então mostra "Sem foto" para toda medição. O engenheiro tira a foto, vê o preview, sente que registrou a evidência — e ela some. A "alma da medição honesta" (evidência) não funciona de ponta a ponta. Está documentado como dívida (AUT-6, comentário no arquivo), mas para o usuário é uma promessa quebrada na própria tela que diz "Foto da evidência".
- **Ajuste:** decisão do dono é necessária (criar bucket `medicoes` no Supabase Storage — DECISÃO D2). Enquanto não houver bucket, a UI deve ser honesta: ou esconder o campo de foto, ou rotular claramente "foto fica só neste aparelho até configurarmos o armazenamento" e NÃO mostrar preview que sugere persistência. Hoje o aviso de `migracao_pendente` cobre o caso E7c, mas com E7c aplicada + sem bucket a foto ainda some sem aviso (o `okMsg` de sucesso diz "Medição registrada" mesmo sem a foto).

---

## 🟢 AJUSTES AUTÔNOMOS (ordenados por valor)

### A1 — `/crm/pedidos` e `/crm/projetos` são tabelas-lista cruas (violam "tabela ≠ tela de trabalho")
- **Arquivo:** `app/crm/pedidos/page.tsx` (todo), `app/crm/projetos/page.tsx` (todo).
- **Problema:** ambos são "lista + modal", sem KPIs, sem agrupamento, sem estados ricos. A regra eterna do CEO é "tela para o JOB, não tabela". `Pedidos` ainda usa um `<select>` de status inline cru (linha 144) e não filtra por status nem mostra valor. Como Compras & Estoque já vive DENTRO da obra (`ObraComprasEstoqueSecao`), o `/crm/pedidos` global é redundante e pobre.
- **Ajuste:** no curto prazo, dar a `/crm/pedidos` um cockpit mínimo (contadores por status + filtro). No médio, decidir se `/crm/pedidos` global sobrevive ou vira só um atalho para os pedidos da obra (ligado à DECISÃO D1). `/crm/projetos` resolve-se em B1.

### A2 — `ResumoCards` do Financeiro usa AZUL (`#3B82F6`) e ROXO (`#8B5CF6`) — fora da marca Obra10+
- **Arquivo:** `components/crm/obras/ObraFinanceiroSecao.tsx:351` (`Orçado` = `#3B82F6`), `356, 712` (`Em custódia` = `#8B5CF6`).
- **Problema:** o domínio é verde+dourado dark (sem azul Shadcn). O card "Orçado" pinta o número de azul-500 e "Em custódia" de violet-500. Destoa de todo o resto (que usa `#c9a24a`, `#3fb950`, `#e3b341`). O `imoveis/page.tsx` já teve esse exato problema corrigido antes (azul→teal); aqui voltou.
- **Ajuste:** trocar `#3B82F6` por um tom da marca (ex.: `#2f9e8f` teal ou dourado `#c9a24a`) e `#8B5CF6` por um neutro/dourado (custódia poderia ser dourado-escuro). Manter vermelho/verde/âmbar semânticos.

### A3 — Botão "Evidência" da ficha de item está permanentemente `disabled` ("Em breve")
- **Arquivo:** `components/crm/obras/ObraItensSecao.tsx:467-475`.
- **Problema:** placeholder morto vivo na UI — botão cinza "Em breve" dentro da ficha do item. É exatamente o tipo de fachada que a régua proíbe. (A evidência real existe pelo DrawerMedir/medições, então este botão é duplicado e morto.)
- **Ajuste:** remover o botão "Evidência" daqui (a evidência mora na medição) OU ligá-lo ao fluxo do DrawerMedir. Não deixar botão desabilitado permanente.

### A4 — Cockpit "Hoje" da obra: contador "A vencer" é fixo "—" e §4 Pagamentos diz "chega em breve"
- **Arquivo:** `app/crm/obras/page.tsx:744-750` (contador esmaecido) e `908-914` (banner cinza "o módulo financeiro chega em breve").
- **Problema:** o módulo Financeiro JÁ existe (`ObraFinanceiroSecao`, deploy #9). O cockpit ainda diz que "chega em breve" e mostra "A vencer" como `—` esmaecido. Mensagem desatualizada que subestima o produto (o financeiro por obra existe; falta só o agregado de pagamentos a vencer no cockpit cross-obra).
- **Ajuste:** ou ligar o contador "A vencer" ao agregado real de `hub_obra_pagamentos` (balde vencendo_7d/atrasado), ou ao menos trocar a copy de "o módulo financeiro chega em breve" para "agregado de pagamentos a vencer chega em breve" (honesto: o módulo existe por obra).

### A5 — `EditorInline` do escopo salva no `onBlur` do container mas o stepper/Salvar reusa estado possivelmente "limpo"
- **Arquivo:** `components/crm/obras/ArvoreEscopo.tsx:862-918`.
- **Problema (menor, verificar):** a gravação por `onBlur` do container inteiro é elegante, mas o botão "Salvar" força `sujo.current = true` e grava mesmo sem mudança — o que é intencional. Ponto de atenção: ao salvar com sucesso o componente chama `onSalvo()` → `setEditando(false)` no pai e `carregar()` re-busca a árvore inteira; se o usuário tinha o editor aberto e continuava digitando custo, a re-renderização pode perder foco. Não é bug confirmado, mas o fluxo "editar 3 campos de custo em sequência → blur fora → salva → re-fetch → fecha editor" merece um teste de uso real no celular.
- **Ajuste:** validar via simulação de uso mobile (Voz do Usuário); se houver perda de foco/estado, debouncar o `carregar()` pós-save ou atualizar só a linha em vez de re-buscar tudo.

### A6 — Acessibilidade: vários botões-card e steppers sem rótulo, e contraste de texto fraco em cinzas
- **Arquivos:** `ObraItensSecao.tsx` cards-botão (CardItem é um `<button>` com conteúdo visual, sem `aria-label` resumindo o item); `ArvoreEscopo.tsx` linhas-item idem; cores `#5c6b62`/`#6e7681` sobre `#0a140f` ficam abaixo de 4.5:1 em textos pequenos (status/microcopy).
- **Ajuste:** adicionar `aria-label` descritivo aos cards-botão e às linhas colapsáveis (já há `aria-expanded` em vários, bom); subir os cinzas mais escuros usados em TEXTO (não em bordas) para ≥`#8aa99a`. As barras de progresso do histórico já têm `role="progressbar"` correto (bom).

### A7 — `ObraCronogramaSecao` SVG da Curva-S sem `<title>`/descrição textual dos valores (só `aria-label` genérico)
- **Arquivo:** `components/crm/obras/ObraCronogramaSecao.tsx:324-393`.
- **Problema:** o SVG tem `role="img" aria-label="Curva-S: planejado versus executado"` (bom), mas leitor de tela não acessa os números. Os 4 KPIs acima compensam parcialmente.
- **Ajuste (opcional):** adicionar um resumo textual sr-only com físico/financeiro/desvio atuais ao lado do gráfico. Baixa prioridade (KPIs já cobrem).

---

## 🟡 DECISÕES PARA O DONO

### D1 — Destino do `/crm/projetos` (stub) e do `/crm/pedidos` (stub global)
Existem dois módulos "lista crua" que duplicam/competem com telas ricas:
- `/crm/projetos` ↔ `/crm/arquitetura` (kanban completo). **Recomendo:** redirect 308 `/crm/projetos → /crm/arquitetura` e apontar o menu para `/crm/arquitetura` (resolve B1). Confirmar que nada interno dependa do stub.
- `/crm/pedidos` (global) ↔ `ObraComprasEstoqueSecao` (pedidos por obra, mais rico). **Pergunta:** o pedido global cross-obra tem job próprio (ex.: comprador olhando todas as obras) ou deve virar só um agregado/atalho? Decide se investimos no cockpit (A1) ou aposentamos.

### D2 — Bucket de Storage para fotos de evidência (medição/itens)
B3 depende disso. Hoje a foto da medição NÃO persiste (sem bucket). **Decisão:** criar bucket `medicoes` no Supabase Storage (privado, com URL assinada) — habilita a evidência fim-a-fim, que é a "alma da medição honesta". Custo: configuração + política de acesso por tenant. Enquanto não, a UI será ajustada para não prometer o que não guarda (B3).

### D3 — Divergência de isolamento de tenant entre a rota-mãe da obra e as sub-rotas (consistência de segurança)
- **Achado (não é vazamento ativo, é inconsistência de política):**
  - `app/api/crm/obras/[id]/route.ts:22-29` (GET) e os blocos relacionados usam `tenantScopeOrFilter(tenantId)` — que inclui `tenant_id.is.null` e o tenant default Obra10. Ou seja, a rota-mãe da obra AINDA enxerga linhas legadas com `tenant_id` NULL.
  - As sub-rotas novas (`escopo`, `itens`, `medicoes`, `cronograma`, `financeiro`) usam `.eq("tenant_id", tenantId)` PURO + guard `data.tenant_id !== tenantId → 404`. Ou seja, REJEITAM `tenant_id` NULL.
- **Por que importa:** o padrão sistêmico registrado na memória ([[tenant-null-leak-pattern]]) manda usar `.eq` puro e nunca `.or(...is.null)` nas rotas novas — e as sub-rotas seguem isso (correto). A rota-mãe segue o padrão LEGADO tolerante (preserva dados antigos sem tenant). Não é um vazamento cross-tenant (o `.or` inclui null + default, não outro tenant), mas cria uma **assimetria**: uma obra com `tenant_id` NULL é VISÍVEL na tela da obra (rota-mãe) porém suas abas Escopo/Itens/Medições/Financeiro retornariam vazio/404 (sub-rotas puras) — UX confusa e política de segurança inconsistente.
- **Decisão:** confirmar que o backfill de `tenant_id` em `hub_obras` foi aplicado (não há mais obra com NULL em produção). Se sim, migrar a rota-mãe para `.eq` puro também (alinha tudo ao padrão novo, fecha a assimetria). Se ainda há legado NULL, manter a tolerância MAS então as sub-rotas precisam tolerar o mesmo (ou a obra legada fica meio-acessível). Recomendo: backfill + `.eq` puro em todo lado. **O CEO sempre verifica achados de integridade/segurança** — este é um deles.

---

## Veredito por lente (resumo)

1. **Funcionalidade E2E:** o núcleo da obra é REAL e encadeia bem — `NovaObra` (preset EAP) → obra; `gerar-obra` (projeto→obra) tem gate server-side + idempotência sólidos; escopo edita+gera orçamentária (memorial HTML + CSV via Blob, respeitando persona); item avança (slider) e mede (DrawerMedir grava avanço); compras→estoque com gate de aprovação; financeiro bifurca por tipo_contrato; curva-S degrada honestamente. **Furos:** B1 (módulo Arquitetura inacessível pelo menu), B3 (foto não persiste). Tolerância a migração pendente é exemplar e honesta em todos os componentes.
2. **UX/Mobile:** componentes-filhos são mobile-first e Click-and-Go (bom). **Furos:** B2 (casco da obra/[id] com abas sem scroll-x e grid fixo no Painel), A3 (botão morto "Evidência"), A4 (copy desatualizada).
3. **Design/Marca:** consistente em quase tudo (verde+dourado dark, tokens). **Furos:** A2 (azul/roxo no ResumoCards financeiro), B2 (casco fora do design-system).
4. **Segurança (tenant):** as sub-rotas novas estão BEM (`.eq` puro + guard de posse 404, tenant da sessão nunca do body, persona derivada server-side com sanitização defense-in-depth no escopo/cronograma, gate de custo por papel no PATCH de itens). **Atenção:** D3 (assimetria rota-mãe `tenantScopeOrFilter` vs sub-rotas `.eq` puro). Auth bem desenhado (cookie httpOnly autoritativo, `x-caller-auth-id` só fallback interno).
5. **Acessibilidade:** parcial — bom uso de `role=tab/tablist/dialog/progressbar/log` e `aria-expanded`/`aria-label` em muitos lugares; A6/A7 são lacunas (cards-botão sem rótulo resumido, cinzas escuros em texto, SVG sem resumo textual).
6. **Voz do usuário (eng/arq no campo):** consegue operar a obra no celular (steppers ≥44px, voz, Click-and-Go). **Confunde/trava:** abas da obra estourando no mobile (B2); tirar foto de evidência e ela sumir sem aviso (B3); chegar em "Arquitetura" pelo menu e cair num stub sem funil (B1). A5 merece teste de uso real (edição de custo em sequência).

**Saldo:** domínio funcionalmente forte e seguro no miolo novo; os 3 bloqueadores são de ACESSO/ENTREGA (menu errado, casco mobile, evidência que some), não de lógica de negócio. Corrigir B1 é de altíssimo valor e baixo risco (1 linha de href + decisão de redirect).

---

## ✅ STATUS DE APLICAÇÃO (2026-06-30 — senior-engineer)

Aplicado no tree principal (`wendel/dev`), aditivo, marca Obra10+, sem commit/push. Gates rodados ao final.

### APLICADOS
- **B1 — FEITO.** `lib/crm-nav-groups.ts:~108` href `/crm/projetos`→`/crm/arquitetura`. `app/crm/projetos/page.tsx` reescrito como REDIRECT (client, preserva query → `?negocio_id=` abre o criador em Arquitetura). `app/crm/negocios/[id]/page.tsx:548` link "Projetos"→"Arquitetura" apontando `/crm/arquitetura`. Permissão: `/crm/arquitetura` cai no default `comercial` de `crmMinNivelParaRota` (mesmo nível que era `/crm/projetos`) — sem mudança de RBAC.
- **B2 — FEITO.** `app/crm/obras/[id]/page.tsx` migrado p/ Tailwind/tokens mobile-first: `max-w-5xl` + padding responsivo (era `maxWidth:960` fixo); abas em `overflow-x-auto` + `flex-shrink-0`/`whitespace-nowrap`/`min-h-[44px]` (scroll horizontal, não estoura no mobile); Painel `grid-cols-1 md:grid-cols-3` (era `repeat(3,1fr)` fixo); botão voltar `min-h-[44px]`; cinzas de texto `#8b949e`→`#8aa99a`. 6 abas e conteúdo preservados.
- **B3 — FEITO (sem criar bucket).** `components/crm/obras/DrawerMedir.tsx`: derivado `fotoNaoPersiste` (há preview mas `fotoUrl` vazio = sem armazenamento). Aviso âmbar visível sob o campo de foto + sufixo honesto na `okMsg` de sucesso ("A FOTO não foi salva — armazenamento de evidências ainda não configurado"). Criar o bucket continua decisão do dono (D2).
- **A2 — FEITO.** `components/crm/obras/ObraFinanceiroSecao.tsx`: azul `#3B82F6` (Orçado)→`TEAL #2f9e8f`; roxo `#8B5CF6` (Em custódia, 2 lugares)→`DOURADO_ESCURO #b8862f`. Constantes nomeadas adicionadas.
- **A3 — FEITO.** `components/crm/obras/ObraItensSecao.tsx`: botão "Evidência" `disabled "Em breve"` removido da ficha do item (evidência mora na MEDIÇÃO/DrawerMedir). Import `Camera` órfão removido. Botão "Salvar" agora ocupa a linha (alvo maior).
- **A4 — FEITO.** `app/crm/obras/page.tsx`: banner §4 trocado de "o módulo financeiro chega em breve" para copy honesta (o Financeiro por obra existe; falta o AGREGADO cross-obra). Cinza do banner e do `Contador` subidos p/ `#8aa99a`.
- **A6 — FEITO (parcial, alto valor).** `aria-label` resumido no `CardItem` (`<button>` só-visual) de `ObraItensSecao.tsx` (nome+situação+%+bloqueios+subitens). Cinzas de TEXTO `#8b949e`→`#8aa99a` em `obras/page.tsx` e `obras/[id]/page.tsx`.
- **A7 — FEITO.** Resumo `sr-only` ao lado da Curva-S (`ObraCronogramaSecao.tsx`) com físico/financeiro/desvio/previsão para leitor de tela.

### FLAGS — NÃO aplicados (decisão/risco — para o CEO/dono)
- **A1 (pedidos/projetos tabela→cards):** NÃO feito — escopo de redesign (cockpit com KPIs/filtros), ligado à DECISÃO D1 (destino do `/crm/pedidos` global). Aguardar definição do dono. `/crm/projetos` já resolvido por B1 (vira redirect).
- **A5 (EditorInline do escopo, possível perda de foco no re-fetch pós-save):** NÃO feito — não é bug confirmado; requer simulação de uso real no mobile (Voz do Usuário) antes de mexer. Risco de regressão sem evidência. FLAG p/ teste de uso.
- **A6 (restante):** cinzas em OUTROS componentes (ex.: `ArvoreEscopo` linhas-item, microcopy `#5c6b62`/`#6e7681` em vários) e `aria-label` nas linhas colapsáveis do escopo NÃO foram varridos exaustivamente — só os de maior valor (cards de item, cockpit, obra/[id]). Varredura completa fica como melhoria incremental.
- **D1/D2/D3 (DECISÕES DO DONO):** intocados — D1 (aposentar/cockpit do `/crm/pedidos`), D2 (criar bucket `medicoes` no Storage — habilita evidência fim-a-fim), D3 (assimetria de tenant: rota-mãe `tenantScopeOrFilter` tolera `tenant_id` NULL vs sub-rotas `.eq` puro — SEGURANÇA/integridade, **o CEO sempre verifica**: confirmar backfill de `hub_obras.tenant_id` e então migrar a rota-mãe para `.eq` puro). NÃO mexido em backend de tenant nesta rodada.

# Portal do Cliente — Design ideal (mesa redonda)

## Portal do Cliente — design ideal

O cliente quer DORMIR TRANQUILO. O Portal é uma **lente curada e auditada** sobre o engine de obra já existente — não reconstrói nada. Rota nova `/portal`, persona `cliente` própria, isolada por `negocio_id` (a espinha). Cada bloco da tela cura um dos 5 medos. **A honestidade é a arquitetura, não uma feature** — o sistema é estruturalmente mais difícil de mentir do que de dizer a verdade.

### Dashboard (blocos) + ASCII

Dark cinema (verde+dourado da marca). Ordem dos blocos = ansiedade decrescente. O dourado só no que importa (selo, CTA de aprovação, marcos). Vermelho APENAS em atraso real, nunca decorativo.

```
+--------------------------------------------------------------------+
|  OBRA10+   Reforma Consulado Itália · SP        [Minha obra ▾]      |
|                                  [ⓥ AUDITADO PELO HUB · há 3 dias]  |  <- SELO (medo 4)
+--------------------------------------------------------------------+
|  VEREDITO HONESTO (1 frase, do agregado, sem maquiar):             |
|  "47% concluída, 2 dias atrasada na concretagem; time com plano.   |
|   Nenhuma surpresa financeira."          saúde: 🟡 ATENÇÃO          |
+--------------------------------------------------------------------+
|  +-- HERO: PRAZO & AVANÇO (medo 1+2) -----------------------------+ |
|  |  62% ████████████░░░░░░    no prazo · entrega 15/OUT (87 d)    | |
|  |  previsto 60% · realizado 62% (+2%)      próx. marco: Laje 9d  | |
|  +---------------------------------------------------------------+ |
|                                                                    |
|  +-- CRONOGRAMA/CURVA S --+ +-- FINANCEIRO -----+ +-- SELO ------+ |
|  |  (medo 1)              | |  (medo 5)         | |  (medo 4)    | |
|  |   /``  prev           | |  [render p/ tipo  | |  [escudo]    | |
|  |  / o   <- voce        | |   de contrato]    | |  12 números  | |
|  | /      real           | |  pago 248k        | |  auditados   | |
|  | Próx: Laje · 9 dias   | |  a pagar 152k     | |  visita 26/6 | |
|  +-----------------------+ +-------------------+ +-------------+ |
|                                                                    |
|  +-- ESTA SEMANA (Diário · medo 3) ----+ +-- PRECISA DE VOCÊ ---+ |
|  | [foto] Concretagem laje 2º · ter    | | 💳 Medição #4         | |
|  | [foto] Chegada aço CA-50  · seg     | |    R$ 38.000          | |
|  | [foto] Alvenaria 3º 80%   · sáb     | |    auditada pelo Hub  | |
|  | [Ver diário]  [Ver fotos e vídeos]  | |    [Revisar e aprovar]| |
|  +-------------------------------------+ +---------------------+ |
+--------------------------------------------------------------------+
```

**Mobile (1ª dobra primeiro)**: HERO → 1 aprovação pendente (só se existir) → Financeiro → Esta semana → Selo. Tabbar: Início · Diário · Fotos · Financeiro · Aprovar. HERO + avanço + 1ª aprovação carregam primeiro; fotos/vídeo lazy-load — a resposta "minha obra vai bem?" nunca espera a galeria.

Fonte do dashboard: `aggregateCockpit(supabase, tenantId, {negocioId})` (E1 deployado, já aceita `opts.negocioId`) → `avancoMedio`, `proximoMarco`, `derivarSaude`, `ehAtrasada`, `COR_SAUDE`. O Portal só LÊ o payload curado por `negocio_id`, sem custos internos/margem.

### TABELA medo → elemento de tela que cura

| Medo | Bloco/elemento | Cura (fonte real) |
|---|---|---|
| **1 — atrasar** | HERO previsto×realizado + Cronograma/Curva S + próximo marco em contagem regressiva | `avancoMedio`/`proximoMarco`/`hub_obras_cronograma`. Atraso vira banner âmbar "-2 dias na fase X — plano registrado", **nunca escondido** |
| **2 — não acabar** | HERO avanço físico real + previsão de entrega (dias) + saúde + marcos cumpridos N de M + ritmo | `derivarSaude` + `data_previsao_fim`. Projeção de término em **faixa honesta** (12–19/dez), não promessa falsa |
| **3 — não saber** | Bloco "Esta semana" (Diário curado) + tela Fotos/Vídeos com slider antes×agora | `hub_obras_ocorrencias` curado hoje; E8/RDO depois. Mostra a causa do atraso (chuva), não esconde |
| **4 — ser enganado** | SELO em 3 níveis (global + inline por número + painel "Por que confiar") | visita in loco + IA de risco + escrow + time auditor. Estados honestos ⓥ/ⓘ/⚠ |
| **5 — perder dinheiro** | Financeiro BIFURCADO por contrato + escrow + gate de aprovação | bifurca por `tipo_contrato`; **nunca botão [Pagar] direto** — só aprovação |

### Financeiro por tipo de contrato (unitário × totais)

`tipo_contrato` é atributo **imutável** da obra (travado no fechamento). Um componente, dois modos — o modo é derivado do contrato, **nunca há toggle**.

**MODO A — ADMINISTRAÇÃO (gestão aberta → valor UNITÁRIO):**
```
Financeiro · Administração (gestão aberta)          [ⓥ cada linha conferida]
Item                     Qtd    Unit.      Total      Status
Cimento CP-II 50kg       120   R$ 32,00   R$ 3.840    pago
Aço CA-50 12,5mm (kg)    850   R$  7,40   R$ 6.290    a pagar
M.O. pedreiro (diária)    22   R$180,00   R$ 3.960    pago
-------------------------------------------------------------
Pago R$ 248.300 · A pagar R$ 152.100 (em custódia até aprovação)
```
Cura medo 5 pela **transparência**: cada centavo rastreável.

**MODO B — PREÇO FECHADO (turn-key → só TOTAIS):**
```
Financeiro · Preço fechado (turn-key)
Contrato R$ 600.000 · ██████████░░░░ 62% executado
Etapa            % etapa   Valor        Status
1. Fundação        100%   R$  90.000    pago
2. Estrutura        75%   R$ 150.000    parcial (medição #4)
3. Alvenaria         0%   R$ 120.000    não iniciada
-------------------------------------------------------------
Pago R$ 248.000 · A pagar R$ 152.000 (libera por medição aprovada)
```
Cura medo 5 pela **previsibilidade**: valor fixo, paga só o concluído.

**REGRA DE OURO (defesa na query, não na UI):** no preço fechado o endpoint **nunca seleciona** `valor_unitario`/`quantidade` — impossível vazar a composição interna por inspeção de rede. Na administração sempre mostra unitário (é gestão aberta combinada). Bifurcação no backend:
```
tipo_contrato='administracao' → SELECT itens (qtd × unit = total)  → { modo:'unitario' }
tipo_contrato='preco_fechado' → SELECT etapas (só total)           → { modo:'totais' }
```

### Diário + Fotos/Vídeos

**Diário** = timeline curada, cronológica, do mais novo ao mais velho. Cura medo 3 (narrativa honesta, datada, com prova visual) e **inclui o ruim**: "Chuva interrompeu a concretagem — remarcada 30/jun" (a causa do atraso explícita). CURADO: o cliente vê o relevante (marcos, entregas, avanços), **não o ruído operacional** (tarefas internas, broncas, retrabalho) — anti-poluição via flag `visivel_cliente=true` (decisão explícita de quem publica, nunca automática).

**Fotos/Vídeos** = galeria realista agrupada por data/etapa, lightbox swipe, vídeo inline. **Sem filtro de embelezamento.** Slider **antes×agora** prova o avanço físico real (anti-maquiagem). Cada mídia carimbada com data/hora (e GPS quando houver) = camada de veracidade. Fotos de visita do Hub marcadas como fonte mais confiável.

Edge: sem registro na semana → "Nenhum registro novo esta semana — próxima visita em DD/MM" (honesto), **não some silenciosamente** (medo 3 exige saber até o silêncio).

### Aprovações do cliente (ponte do Hub)

4 tipos (do dono): **MEDIÇÃO · ADITIVO · MUDANÇA DE ESCOPO · MARCO**. Cada um chega no seu momento, simples. O Hub faz a **ponte e audita ANTES** — nenhuma aprovação chega ao cliente sem ser **selada pelo Hub**. A aprovação do cliente é UM lado do gate; o escrow só libera com **aprovação dupla** (cliente + Hub).

```
APROVAR · Medição #4 — Estrutura 75%               R$ 38.000
ⓥ Auditada pelo Hub: visita in loco 26/jun, bate com o avanço
   IA de risco: dentro do contrato.    📷 evidências (3)
+-- O que sua aprovação faz ---------------------------------+
| Libera R$ 38.000 do escrow para a executante.              |
| Só sai com a SUA aprovação E a do Hub.                     |
+------------------------------------------------------------+
[ Tenho dúvidas · falar com o Hub ]        [ Aprovar ✓ ]
```

- Efeito **explícito** em texto (cura medo 5 — aprovar é consciente).
- **"Tenho dúvidas" não rejeita**: abre canal auditado com o Hub (log append-only, nada se perde). O cliente **nunca fala direto com a obra** — o Hub media.
- Rejeitar exige motivo (obrigatório).
- **Voz**: o copiloto LÊ e explica a aprovação, mas **nunca confirma dinheiro por voz** — clique humano com papel, sempre.
- Lista some quando vazia (anti-poluição). Histórico append-only, sem reverter.
- **Reuso**: mesma máquina de aprovações já existente; o Portal é só uma VISÃO filtrada por `aprovador=cliente` do negócio.

### Selo de auditoria (como o cliente vê a verdade)

O selo é o coração do medo 4 e o diferencial do produto ("o Hub é juiz, não parte"). **Não é badge decorativo — é prova por número**, em 3 níveis:

1. **Global (header):** "ⓥ Auditado pelo Hub · última visita há 3 dias · próxima 02/jul" → abre o dossiê.
2. **Inline (em cada número/medição/foto):** escudo tocável → "Este 47% foi conferido em visita in loco 26/jun pelo eng. responsável; fotos carimbadas; bate com o cronograma."
3. **Dossiê de confiança:**
```
POR QUE VOCÊ PODE CONFIAR
✓ Fornecedor homologado no onboarding
✓ Visitas in loco (timeline: 12/jun · 18/jun · 26/jun)
✓ IA de risco: 0 críticos · 1 atenção (clima)
✓ Escrow ativo: dinheiro libera só com aprovação dupla
Equipe que assina: eng., arq., eng. de segurança, advogados, contadores.
```

**Estados honestos (a credibilidade é a ausência de maquiagem):**
- **ⓥ auditado** — conferido in loco (nome + data do verificador)
- **ⓘ declarado** — informado pela obra, auditoria pendente (nunca um ⓥ falso)
- **⚠ divergência** — o Hub detectou diferença; mostra o número **verificado**, não o declarado

Se a última visita venceu (ex. >30 dias), o selo global vira **âmbar "visita pendente"** — nunca afirma verificação que não ocorreu. **Pré-condição dura:** o selo só nasce ⓥ quando existe o processo real de visita in loco do Hub; sem isso, nasce ⓘ. Selo fake violaria o princípio do dono.

### Persona/login/RBAC + visão curada (anti-poluição)

- **Persona:** novo papel `cliente`, login próprio (Supabase Auth + linha em `hub_portal_clientes` ligando `auth_id ↔ negocio_id/obra_id`). Read-mostly + aprovações. **Não é tenant** — é vínculo a negócio(s).
- **Convite:** Hub gera o acesso (token de uso único, expira em ~7 dias, invalida no 1º uso) → magic-link/senha → cai direto no dashboard da obra. Reusa a infra de sessão (cookie httpOnly, JWT sub autoritativo).
- **Barreira de acesso (ABAC):** `requirePortalSessao` deriva `negocio_id`+`tenant_id` **sempre da sessão, nunca do body**. Toda query filtra ambos. Service-role bypassa RLS → o filtro no código é a barreira. Sem vínculo = **404** (não vaza existência cross-negócio).
- **VÊ (curado):** avanço, cronograma/curva S, previsão de entrega, diário curado, fotos/vídeos, financeiro dele (por tipo de contrato), aprovações dele, selo/dossiê, mensagens com escopo Hub.
- **NÃO VÊ (anti-poluição — invariante do dono):** EAP/itens internos, restrições/bloqueios operacionais, pedidos de material/compras, custo de fornecedor/margem (no preço fechado), kanban comercial/CRM/leads, outros negócios/obras, ocorrências brutas, copiloto de escrita, qualquer aprovação que não a dele. Lista negra de colunas (`responsavel_id`, `margem`, `custo_interno`, `falta_*`, `bloqueio_obs`) nunca entra na projeção.
- **Papéis dentro do portal:** `cliente_principal` (aprova), `cliente_observador` (cônjuge/sócio/banco — lê tudo, botão Aprovar **some**, não fica disabled).
- **Menu enxuto:** Início · Diário · Fotos · Financeiro · Aprovações. Sem o menu pesado do gestor.

### MVP vs fase 2

**MVP** (não depende de E6/E8; degrada honestamente via flags `temCronograma`/`temFinanceiro` já existentes):
- Papel `cliente` + login + `requirePortalSessao` + vínculo cliente↔negócio
- Shell `/portal` dashboard-first read-mostly
- HERO + Cronograma/avanço (dado real hoje via E1) + Saúde (derivada)
- Financeiro render condicional (bifurca por `tipo_contrato`; "chega em breve" até E6 — **nunca inventa valor**)
- Selo em estado honesto (ⓥ/ⓘ) — nasce ⓘ até existir visita real
- Aprovações via máquina existente (campos aditivos `aprovado_por_cliente_*`, `motivo_recusa_cliente`)
- Diário simples (ocorrências + upload manual) + fotos publicadas (flag `visivel_cliente`)
- Conversacional de leitura ("como está minha obra?")

Tabelas novas MVP (pequenas, aditivas, zero alteração nas existentes): `hub_portal_clientes`, `hub_portal_aprovacoes` (ou campos aditivos em `hub_aprovacoes`), `hub_portal_mensagens`.

**Fase 2:**
- Financeiro E6 completo (unitário + escrow real + gate de pagamento duplo)
- Curva S calculada (hoje só percentual por fase)
- RDO/E8 estruturado como fonte do diário/fotos + signed URLs
- IA de risco real alimentando o selo + dossiê rico
- Projeção de término por IA + resumo semanal IA ("o que aconteceu esta semana")
- Mensageria robusta + notificações push (PWA) + relatório mensal PDF assinado
- Multi-obra (cliente com 2+ contratos) + observadores com perfis

### Reuso dos módulos × novo

| Reusa (consome, não reconstrói) | Novo (mínimo) |
|---|---|
| `cockpit-aggregate.ts` (`aggregateCockpit`, `opts.negocioId`) — avanço/saúde/marcos | App `/portal` (shell dashboard-first) |
| `cockpit-classificar.ts` (`derivarSaude`, `COR_SAUDE`, `avancoMedio`, `proximoMarco`) | Papel `cliente` + `requirePortalSessao` + vínculo↔negócio |
| `hub_obras` · `hub_obras_cronograma` · `hub_obras_ocorrencias` · `hub_pedidos_material` | Agregador `portal-aggregate` que **cura** o cockpit por papel cliente |
| Padrão endpoint tenant-safe `/api/crm/obras/cockpit` → espelhar em `/api/portal/*` | Camada de SELO (estado ⓥ/ⓘ/⚠ por número) — depende do processo de visita do Hub |
| Máquina de aprovações existente + `executarAcaoAprovada` | Curadoria do diário (publicado × bruto) + bifurcação financeira por contrato |
| `verify-public-user.ts` + `users.role` + `LOGIN_ALLOWED_APP_ROLES` (add `cliente` só p/ `/portal`) | Convite por token de uso único |
| Tokens da marca em `globals.css` (`--obra-dark/-2/-3`, `--obra-dourado`, `--obra-verde`, `--obra-vermelho`) + scrollbar dourada | — |
| CopilotoVoz FAB (só leitura no portal) · `audit-log.ts` (log append-only) | — |

### Edge cases

- **Sem cronograma** (`temCronograma=false`): "Cronograma em preparação", barra oculta — **nunca 0% fake** que parece obra parada.
- **Financeiro ausente** (`temFinanceiro=false`, E6 futuro): pill "Financeiro chega em breve" — **nunca inventa valor nem spinner infinito**.
- **Obra ATRASADA:** HERO vira âmbar/vermelho, "-3 dias na fase X + plano registrado". Esconder atraso quebra a confiança (medo 4) — a UI não maquia.
- **`tipo_contrato` nulo/legado:** bloqueia render financeiro detalhado → "Modelo de contrato sendo confirmado pelo Hub" (não assume modo errado; campo imutável só após fechamento).
- **Número não auditado:** ⓘ "declarado, auditoria pendente" — **nunca ⓥ falso**. Divergência: ⚠ + mostra o verificado.
- **Selo com visita vencida (>30d):** vira âmbar "visita pendente".
- **Cliente com múltiplos negócios:** seletor "Minha obra ▾"; default = obra mais ativa/com pendência; cada uma isolada por `negocio_id`.
- **Aprovação expirada/já decidida:** drawer read-only com data+autor; sem dupla aprovação (idempotência). CRON marca `aguardando` vencidas como `expirado` — **nunca auto-aprova por timeout**.
- **Aprovação sem selo do Hub:** criada como `rascunho`; só vira `aguardando` via rota de selagem (papel Hub). O cliente nunca vê não-selada.
- **Observador tenta aprovar:** botão some (não disabled); só `cliente_principal` aprova.
- **IA tenta aprovar por voz:** redireciona "para aprovações, precisa ser na tela — vou abrir".
- **Sem fotos/diário na semana:** "Nenhum registro novo — próxima visita DD/MM" (não some).
- **Acesso indevido** (`/crm` ou negócio alheio / `obra_id` forjado): bloqueio por role≠cliente e por `negocio_id` não vinculado → **404** (não 403, não vaza existência).
- **Token de convite comprometido:** uso único + expiração; após ativar, não serve mais.
- **Obra encerrada:** acesso pode virar "modo entrega" (resumo final, termo de recebimento do marco final, galeria completa) em vez de fila de pendências; ou `status=encerrado` → 403 após exportar relatório final.
- **Soft-delete/correção:** nada some sem rastro; registro corrigido mostra "corrigido pelo Hub em DD/MM" (trilha imutável).
- **Sem chave Mistral:** copiloto/veredito degradam para texto calculado determinístico; o Portal funciona 100% sem IA.

**Arquivos-âncora reais:** `lib/crm/cockpit-aggregate.ts`, `lib/crm/cockpit-classificar.ts`, `app/api/crm/obras/cockpit/route.ts`, `lib/auth/verify-public-user.ts`, `app/globals.css`, `app/crm/aprovacoes/`. Tabelas: `hub_obras`, `hub_obras_cronograma`, `hub_obras_ocorrencias`, `hub_negocios` (espinha). Nada testado em navegador (escopo = desenho, sem editar código).
# A1 (programa de necessidades + aprovacoes do cliente) — Design + Auditoria (mesa redonda)

Verifiquei tudo o que importa. Os 4 desenhos batem com o código real. Pontos-chave confirmados: aba Entregáveis (linha 320-328) já lê `aprovacao_status` mas é read-only; `arq_programa_item`/`arq_mover_estagio` existem; o evento `copiloto:abrir` é disparado sem contexto de fase. Tenho material para o design final + auditoria.

## Design final de A1

A1 fecha os dois buracos que A0 deixou: a aba **Programa** vira editável (hoje só POST de chip) e a aba **Entregáveis** ganha o **loop de aprovação** (hoje read-only, linha 320 da ficha). **Zero tabela nova.** Reusa `hub_projetos_fases` (`tipo`, `categoria`, `metragem_m2`, `observacao`, `aprovacao_status`, `entregavel_url`), o endpoint `/programa` (GET/POST já com lote `itens[]` + fallback `SELECT_LEGADO`), o `PATCH /projetos/[id]` (já aceita `aprovacao_status`), as tools `arq_*` e o evento `copiloto:abrir`.

### Programa de necessidades (chips) + reuso de hub_projetos_fases

Adicionar = **escolher do catálogo** (bottom-sheet mobile / popover desktop), nunca digitar. Agrupado pelas 4 `CATEGORIAS_COMODO` que já existem. Cada chip é editável inline; remoção com Desfazer.

```
┌──────────────────────────────────────────┐
│ Programa de necessidades       12 ambientes│
│ Total 248m²  ·  contratada 300m²  [====· ]│  barra: verde ≤contratada, âmbar se estoura
├──────────────────────────────────────────┤
│ 🎙️ "adiciona suíte, closet e varanda…" ▸ │  faixa conversacional → copiloto:abrir
│ + Adicionar ambiente                    ⌄ │  abre CATÁLOGO (não é input livre)
├──────────────────────────────────────────┤
│ AMBIENTE · 5                              │
│ ┌──────────────────────────────────────┐ │
│ │ Suíte master           24m²    ⋯    │ │  chip-card; "vista p/ jardim" (obs)
│ └──────────────────────────────────────┘ │
│ │ Quarto 1 · Quarto 2     12m²·12m²  ⋯│ │  repetido → auto-numera
│ SERVIÇO · 2   LAZER · 1   TÉCNICO · 1     │
└──────────────────────────────────────────┘
⋯ = [Metragem][Observação][Mudar categoria][Duplicar][Remover(↶ undo 5s)]
```

Catálogo: `COMODOS_SUGERIDOS` (11 chips, já existe) como sugestões rápidas + acordeões por categoria + escape "Criar X" (nasce em `ambiente`). Cada confirmação = **POST lote** `{tipo:'comodo', itens:[...]}` (o endpoint já soma `ordem` e tolera coluna ausente). **Gap real a fechar:** o endpoint não tem PATCH nem DELETE de cômodo — A1 adiciona em `programa/[faseId]/route.ts`.

### Entregáveis + fluxo de APROVAÇÃO do cliente (estados, reenvio, agregado)

```
┌──────────────────────────────────────────┐
│ Entregáveis & aprovação                    │
│ ┌ Status geral ─────────────────────────┐ │
│ │ ◷1 aguardando ·✓2 aprovados ·1 a fazer│ │ AGREGADO → chip do projeto
│ │ Aguardando há 4d · Carlos (cliente)   │ │ SLA vermelho se >7d
│ └───────────────────────────────────────┘ │
│ + Novo entregável  ⌄                       │
│ ┌──────────────────────────────────────┐  │
│ │ ● Executivo - Pav 1                  │  │ âmbar
│ │   ◷ Aguardando Carlos · há 4d        │  │
│ │   📎 executivo-pav1.pdf · Abrir →    │  │
│ │   [Reenviar c/ revisão][Registrar resp▾]│
│ │   Histórico (3) ⌄                    │  │
│ ├──────────────────────────────────────┤  │
│ │ ● Anteprojeto          ✓ Aprovado    │  │ verde, recolhido
│ │ ● Estudo prelim.       ✗ Reprovado   │  │ vermelho
│ │   "mudar a fachada" — Carlos, 08/jun │  │ MOTIVO citado
│ │   [Reenviar com revisão]             │  │
│ │ ○ Detalhamento          A fazer      │  │ cinza, sem arquivo
│ │   [📎 Anexar entregável]             │  │
│ └──────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

**Máquina de estados** (coluna `aprovacao_status`, CHECK já existe: `pendente/enviado/aprovado/rejeitado`):

```
pendente(s/url) ─[Anexar]→ pendente(c/url) ─[Enviar]→ enviado
   enviado ─[responder:aprovado]→ aprovado (terminal; reabrir audita)
   enviado ─[responder:rejeitado+MOTIVO]→ rejeitado
   rejeitado ─[Reenviar c/ revisão]→ enviado  (nova versão, append no histórico)
   PROIBIDO: pendente→aprovado · aprovado→enviado
```

Decidi **uma rota de ação só** (não 4 endpoints): `POST /programa/[faseId]/aprovacao` com `body.acao = enviar|reenviar|responder|anexar`. Mais coeso e fácil de cobrir com tenant-guard único. Cada ação valida pré-condição (enviar exige `entregavel_url` não-nulo → 422; responder=rejeitado exige `motivo` → 400) e, ao final, **recalcula o agregado** e faz `PATCH hub_projetos.aprovacao_status`.

**Agregado** (deriva das fases `tipo='fase'`, escreve no chip do projeto que o card kanban já mostra):
```
0 entregáveis            → sem_aprovacao (#94a3b8)
algum rejeitado          → reprovado (#ef4444)
nenhum rejeitado, algum enviado → aguardando (#c9a24a)
todos aprovados          → aprovado (#22c55e)
```
A ordem importa: **rejeitado domina** (o arquiteto precisa ver o vermelho mesmo com outros em voo). Diverge da lente UX (que punha "aguardando" acima de "reprovado") — escolhi reprovado-primeiro porque é o estado **acionável** do gargalo.

### O gargalo no cockpit do arquiteto

O board já tem KPI "Em aprovação" contando `estagio==='aprovacao'`. A1 **re-define** para o agregado real (`aprovacao_status='aguardando'`) e torna o KPI **clicável** → fila ordenada por tempo de espera (pior no topo):

```
┌──────────┬──────────┬──────────┬──────────┐
│Entregas  │EM APROV. │Atrasados │Entregues │
│hoje    2 │   3 ◷    │   1 🔴   │ /mês   5 │  ← tap em "EM APROV." abre a fila
└──────────┴──────────┴──────────┴──────────┘

◷ Em aprovação · 3
  Casa Ipê › Executivo Pav1 · Carlos · há 4d 🔴(SLA3d) [Cobrar →]
  Loft Centro › Anteprojeto · Marina · há 1d        [Abrir →]
```

Card do kanban ganha **selo âmbar `◷ AGUARD.`** (molde do selo `ATRASOU` que já existe) e o chip de aprovação vira atalho clicável → abre a aba Entregáveis. Endpoint: `GET /arquitetura/fila` (`tipo='fase'` AND `aprovacao_status='enviado'`, `.eq tenant_id` + inner join projetos, ordenado por `aprovacao_enviado_em ASC`).

### Conversacional/IA (com gate)

Reusa `arq_programa_item` (já existe). **2 tools novas** no mesmo padrão (`executar-ferramenta-arq.ts` + allowlists `ESCRITA_FASE3`/`ESCRITA_SEM_LEAD` + `FERRAMENTAS_ARQ_DOC`):
- **`arq_enviar_aprovacao`** `{projeto_id, fase_id, entregavel_url?, observacao?}` — valida `tipo='fase'` e `status≠'aprovado'`; seta `enviado`; recalcula agregado.
- **`arq_registrar_aprovacao`** `{projeto_id, fase_id, decisao, motivo_rejeicao?}` — rejeitado exige motivo; se tudo aprovado, **sugere** mover p/ 'entregue' (não move sozinho).

```
"adiciona suíte master + closet + varanda gourmet"
  → card "A IA entendeu assim" (3 chips) → Confirmar → POST lote
"envia o executivo pro Carlos aprovar"
  → monta proposta → GATE humano [Confirmar envio] → arq_enviar_aprovacao
  → se entregavel_url null: "precisamos do arquivo primeiro"
"o que está parado esperando cliente?"  → lê a fila (read, sem gate)
```
Leitura sem gate; **toda escrita passa pelo HMAC + Confirmar** (regra de ouro). Aprovar/reprovar por voz = confirmação obrigatória (decisão de cliente). **Dependência real:** o `copiloto:abrir` hoje dispara **sem contexto** — para inferir `fase_id` por nome, a ficha precisa passar a lista de fases no `contexto_adicional` do `/interpretar`. Sem isso, o copiloto pergunta "qual entregável?" (degradação aceitável).

### Edge cases

- **Cômodo repetido:** permitido (programa real tem N quartos); auto-numera "Quarto 1/2". Nome **nunca** é chave.
- **Aprovação parcial:** status é por-entregável; agregado vira `reprovado` se há rejeição, senão `aguardando`. Reenviar só o rejeitado não mexe nos aprovados.
- **Rejeição sem motivo:** motivo **obrigatório** (400) — botão desabilitado até preencher; aparece citado no card + timeline.
- **Reenvio:** append-only, cria v(n+1), preserva v anterior; não apaga histórico.
- **Quem aprova ausente:** sheet de envio pede "Quem aprova?" antes de habilitar Confirmar.
- **Sem entregável (url null):** só `[Anexar]`; "Enviar" oculto até existir arquivo.
- **Legado (colunas ausentes):** GET cai no `SELECT_LEGADO` → Entregáveis read-only com aviso discreto; nunca quebra (route já faz isso).
- **DELETE de fase `enviado`:** 409 (em voo). DELETE de cômodo é livre. DELETE de fase aprovada recalcula agregado.
- **Concorrência:** PATCH otimista + rollback (padrão `moverEtapa`); timeline registra ambos.
- **Reabrir aprovado:** raro e auditado (entrada na timeline), nunca silencioso.
- **Mobile:** ações por chip em `⋯`/bottom-sheet; selos `ATRASOU`+`AGUARD.` empilham, não sobrepõem; drag→botões ↑↓.

### Reuso de A0 x novo (idealmente SEM tabela nova)

| Reusa (não duplica) | Novo (aditivo) |
|---|---|
| `hub_projetos_fases` (todas as colunas) | `programa/[faseId]/route.ts`: **PATCH + DELETE** de cômodo/fase |
| `/programa` GET/POST (lote, fallback legado) | `programa/[faseId]/aprovacao/route.ts`: 1 rota, `acao=enviar/reenviar/responder/anexar` |
| `PATCH /projetos/[id]` (aceita `aprovacao_status`) | `GET /arquitetura/fila` (cockpit) |
| `projetoDoTenant()` (`.eq tenant_id` puro) | 2 tools copiloto + wiring nas 3 allowlists |
| `APROVACAO_PROJETO`, `CATEGORIAS_COMODO`, `COMODOS_SUGERIDOS` | helper `calcularAprovacaoProjeto()` (JS, não trigger) |
| `arq_programa_item`, `copiloto:abrir`, HMAC, `requireCrmComercial` | ficha: ações por estado nas abas Programa/Entregáveis |
| `isMissingPgColumn` fallback | **tabela aditiva opcional** `hub_projetos_aprovacoes` (append-only) p/ histórico rico |

**MVP sem tabela nova é viável.** O histórico mínimo cabe em 3 colunas aditivas (`aprovacao_enviado_em`, `aprovacao_respondido_em`, `aprovacao_motivo`) — recomendado para o SLA do cockpit. A timeline rica (`hub_projetos_aprovacoes`) fica como fase 2; sem ela A1 funciona, mas só guarda o último motivo, não o versionamento.

## AUDITORIA das decisões

**CONFLITO REAL entre as lentes (resolvido):** o backend-architect propôs categoria `'ambiente'` em `hub_catalogo` + seed de 20 ambientes + ampliar CHECK. As outras 3 lentes usam `COMODOS_SUGERIDOS` in-code. **Veredito CEO: NÃO mexer no `hub_catalogo` no MVP.** Motivo: (1) ampliar CHECK de tabela compartilhada (E0) é mudança de maior raio com risco de quebra cross-módulo; (2) `COMODOS_SUGERIDOS` já entrega o Click-and-Go. Catálogo no banco vira fase 2 quando o dono quiser ambientes editáveis por tenant. Isso simplifica a migração para **só 3 colunas aditivas + 1 índice parcial**.

**Risco — chave do agregado divergente entre lentes:** UX pôs `aguardando` antes de `reprovado`; PO/backend puseram `reprovado` dominante. Adotei **reprovado-primeiro** (acionável). Precisa de 1 decisão do dono sobre "entregável-chave" (default: todos `tipo='fase'` contam).

**Tenant (.eq puro) — OK:** confirmei `projetoDoTenant()` usa `.eq("tenant_id", tenantId)` puro (sem `OR IS NULL`), o PATCH do projeto escopa o UPDATE por `id+tenant_id`, e a migração A0 fez backfill dos órfãos + RLS via `current_user_tenant_id()`. **Mandato para A1:** todo endpoint novo chama `projetoDoTenant()` ANTES, e o helper `faseDoProjetoTenant()` deve filtrar `.eq('id',faseId).eq('projeto_id',id).eq('tenant_id',tenantId)` — fecha IDOR de `fase_id` de outro tenant. Vetor checado: não há `tenant_id.is.null` em fases.

**Conflito com A0 — nenhum estrutural:** A0 deixou as abas como esqueleto e o POST sem gravar `aprovacao_status` (vem do default `'pendente'`). A1 é puramente aditivo: novos arquivos de rota + edição da ficha + 2 tools. Não refatora A0. **Atenção:** a UX assumiu "portal-cliente §21" para envio externo — **isso não existe**. Resolvido: MVP usa "Registrar resposta" manual (arquiteto lança a decisão do cliente). Link público assinado fica fase 2, sem bloquear.

**Regra de ouro (humano aprova) — respeitada:** nenhuma ação de envio/decisão é automática; toda escrita do copiloto passa por HMAC+Confirmar; rejeição exige motivo (histórico). **Risco de honestidade:** upload de arquivo não tem endpoint em A0 — no MVP aceita-se **URL colada** (Drive/Notion); upload direto ao Supabase Storage é dependência nova não verificada, fica fora do MVP.

## Critério de PRONTO

1. Programa: adicionar (catálogo), editar metragem/obs/categoria inline, remover com undo, repetir cômodo — tudo persistindo via POST/PATCH/DELETE, com fallback legado intacto.
2. Entregáveis: anexar→enviar→responder(aprovar/rejeitar+motivo)→reenviar, cada um com pré-condição validada (422/400/409).
3. Agregado escreve em `hub_projetos.aprovacao_status` e o chip do card kanban reflete sem ação manual.
4. KPI "Em aprovação" clicável abre a fila ordenada por espera; selo `◷ AGUARD.` no card.
5. Copiloto: programa por voz (gate leve) + envio/decisão por voz (gate forte+confirmar); degrada com pergunta se `fase_id` ambíguo.
6. Tenant: `projetoDoTenant()`+`faseDoProjetoTenant()` em 100% das rotas novas; nenhuma rota nova com `.is.null`.
7. Mobile: alvos ≥44px, sheets de baixo, sem hover-only; estados sempre **ícone+texto** (daltônico).
8. Gate de build: `tsc` + `vitest` + `_chk23` verdes; migração só-aditiva com bloco de rollback.

## O que precisa da janela do dono

1. **"Entregável-chave" para o agregado** — confirma o default (todos `tipo='fase'` contam para "aprovado")?
2. **Envio externo ao cliente** — MVP só "Registrar resposta" manual (arquiteto lança a decisão), portal/link público fica fase 2. OK?
3. **Anexar entregável** — MVP por **URL colada** (sem upload de arquivo ao Storage). OK ou upload é obrigatório já no A1?
4. **Aplicar a migração A1** (3 colunas + 1 índice aditivos) — precisa do OK porque o MCP de migração caiu na sessão anterior e A0 ainda aguardava aplicação do `negocio_id`.
5. **Catálogo de ambientes** — confirmo que fica in-code (`COMODOS_SUGERIDOS`) no A1, e ambientes editáveis por tenant em `hub_catalogo` ficam para depois?

Arquivos reais inspecionados: `app/api/crm/projetos/[id]/programa/route.ts`, `app/api/crm/projetos/[id]/route.ts`, `lib/crm/projeto-funil-defaults.ts`, `app/crm/arquitetura/[id]/page.tsx`, `lib/copiloto/copiloto-core.ts`, `lib/hub/executar-ferramenta-arq.ts`, `supabase/migrations/20260705140000_a0_arquitetura_projeto.sql`.
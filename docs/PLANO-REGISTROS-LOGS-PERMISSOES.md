# 📒 Plano — Registros × Logs × Permissões (spec do dono, endurecido)

> Fonte: laudo Fable-max 09/jul (map de 25 write-sites → 2 designs → 3 ataques → síntese) + **F0 read-only**
> verificado no banco real. Espinha da concatenação da IA (ver [00-PAINEL — A ESPINHA](00-PAINEL-DE-CONTROLE.md)).

## Spec do dono
- **Aparecem** nos registros: **comentários do usuário** + **atividades principais da IA/sistema** (mudou o lead no fluxo, agendou reunião, encaminhou…).
- **Logs da IA**: **ocultos** (não poluem) + **imutáveis** (ninguém apaga) + **relatório só do owner**.
- **Permissões**: autor edita/arquiva **o próprio comentário**; **só owner** altera/arquiva **atividade principal**; **log = ninguém** (nem owner — só extrai).

## A sacada de segurança
`crmDb()` é **service_role** → bypassa RLS e REVOKE. Logo **a trava real são TRIGGERS no banco**, não checagem em TS:
1. **Classificação congelada no INSERT** (trigger `hub_atividades_stamp` grava `categoria` uma vez).
2. **Guard BEFORE UPDATE/DELETE** (`hub_atividades_guard`): proíbe DELETE (apagar=arquivar), congela núcleo (id/tipo/autor/criado_em/tenant/entidade/categoria), proíbe editar/arquivar **log** — vale até para service_role.
3. **Logs append-only**: trigger BEFORE UPDATE/DELETE + BEFORE TRUNCATE em `hub_acoes_ia`, `hub_eventos`, `hub_prompt_logs`, `hub_conversas_log` (verificados insert-only).
4. **Tamper-evidence**: `editado_em` carimbado por trigger + espelho imutável `registro_alterado` em `hub_eventos`.

## Classificação (corrigida por F0)
Função SQL `IMMUTABLE` única + espelho TS `classificar-atividade.ts` (fallback de NULL; a permissão lê a coluna congelada). Fail-closed: humano desconhecido → principal (ação humana nunca some); IA/sistema/desconhecido → log (ruído nunca polui).
- **CHECK real** (o repo não reproduzia): `feito_por_tipo ∈ {humano, ia}` (NÃO existe `sistema`); `tipo ∈ {mensagem, ligacao, email, reuniao, nota, proposta, follow_up, status_change, ia_acao}` — **NÃO existe `agendamento`** → "reunião" = `tipo='reuniao'`.
- **log** = origem∈{playbook_complete_summary, persistir_dados_lead_whatsapp} · metadata tem skip_ia/midia_nao_processada · `mensagem` com `primeira_mensagem≠'true'` (comparado como TEXTO, zero cast).
- **comentario** = `nota` + `humano` (único caso com edição por autor).
- **atividade_principal** = `status_change|proposta|reuniao` · `mensagem` que sobrou (primeira_mensagem='true') · `ia_acao` (handoff + auto-avanço) · `nota` de ia.
- Estado real hoje: 55 linhas (45 status_change, 3 nota, 3 proposta, 3 ia_acao, 1 status_change/ia) → 52 principal + 3 comentário + 0 log. 5 sem tenant, **todas com lead_id** (backfill cura 100%).

## Visibilidade (no servidor, nunca no cliente)
GET /api/crm/registros + as fichas legadas passam a filtrar: `tenant_id = ctx` AND `arquivado_em IS NULL` AND `categoria IS NULL OR categoria <> 'log'` (NULL = VISÍVEL, fail-safe). Cada linha ganha flags `pode_editar`/`pode_arquivar` + `autor_nome` calculados no servidor. **Chat intocado**: `/api/crm/atendimento/mensagens` continua lendo `tipo='mensagem'` sem filtro — o transcript some só dos REGISTROS, nunca para de gravar.

## Relatório do owner
GET /api/crm/relatorios/logs-ia — `requireCrmOwner`, read-only, rate-limited. Junta `hub_acoes_ia` (via lead_id→tenant; sem lead_id fica fora = fail-closed), `hub_eventos` (tenant), `hub_atividades` categoria='log' OU arquivadas. Saída json|csv em linguagem do dono. A extração é auditada (`hub_eventos: relatorio_logs_extraido`).

## Matriz de permissão (servidor, lê a coluna congelada)
| categoria | editar | arquivar |
|---|---|---|
| comentário | AUTOR real (ctx.userId truthy & feito_por===userId & fora de {humano,sistema,ia,wendel,''}) **ou** owner | idem (arquiva; DELETE físico impossível) |
| atividade_principal | **só owner** (só `descricao`; núcleo travado por trigger) | **só owner** (arquiva) |
| log | **ninguém** (403 na API + trigger no banco) | **ninguém** (owner só extrai) |

## Faseamento
- **F0 — recon read-only** ✅ FEITO (CHECK real + combos + tenant nulo). Corrigiu 'agendamento'→'reuniao', 'sistema' inexistente.
- **F1 — lógica pura** (deploy seguro, sem DB): `lib/crm/classificar-atividade.ts` + teste de paridade dos 25 write-sites.
- **F2 — migração** (`supabase/migrations/20260710120000_registros_categoria_imutabilidade.sql`): colunas + stamp + backfill + guards + imutabilidade + índice + verificação embutida (rollback atômico se sobrar NULL). **JANELA DO DONO** — trigger-guard em tabela que a Mari escreve ao vivo; INSERT-stamp é seguro, mas aplicar com o dono ciente (regra da casa).
- **F3 — leitura** (após migração, column-missing-safe): filtro de visibilidade + flags de permissão + autor_nome no GET /registros e fichas.
- **F4 — escrita** PATCH (editar) / DELETE (arquivar) em /registros com matriz no servidor.
- **F5 — relatório do owner** + UI (modal Logs, filtro segmentado Tudo/Comentários/Atividades).
- **F6 — surfacar principais faltando** (tarefa criada pela IA etc. também geram 1 linha principal) + higiene de tipos trocados.

## NÃO FAZER
- Não aplicar a migração de trigger fora da janela do dono (tabela quente + Mari ao vivo).
- Não parar de gravar `tipo='mensagem'` (o chat depende) — filtrar na LEITURA, nunca na escrita.
- Não recomputar categoria em TS para permissão (ler a coluna congelada; TS só fallback de NULL).
- Não confiar em TS para segurança de log (o trigger é a trava; TS é defesa em profundidade).
- Não retornar log de tenant sem prova (hub_acoes_ia sem lead_id fica fora do relatório).

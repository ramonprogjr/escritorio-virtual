# ☝️ DESIGN — Indicar em 1 toque (mesa Fable, 06/jul)
> Fase 1 = texto, sem migração (carimbo em lead.metadata.indicacao + hub_eventos). Voz = fase 2. Amarra com o motor de comissões e a distribuição exclusiva. Aprovado pelo CEO.

# INDICAR EM 1 TOQUE — desenho único (fase 1, texto; voz = fase 2)

## 1. ONDE FICA (verbo no dedo, substantivo no menu)

- **FAB global** (`components/crm/CrmQuickAdd.tsx`, montado em `app/crm/layout.tsx`): ação **"Indicar" como PRIMEIRO item**, deep-link `/crm/indicacoes?nova=1` — mesmo padrão `?novo=...` que o FAB já usa (confirmado no código, CrmQuickAdd.tsx:11). Persona PARCEIRO ganha o FAB com **uma só ação** ("Indicar" é o job nº 1 dela); área `/parceiro/*` monta o mesmo FAB apontando para `/parceiro/indicacoes?nova=1`.
- **Página `/crm/indicacoes`** (espelho `/parceiro/indicacoes`) = **"Minhas indicações"**: lista de comprovantes com semáforo. É o alvo do deep-link, o pouso do link HMAC e o alvo da voz na fase 2. **É esta que entra no MENU**, com botão "Indicar" no header. NÃO existe item de menu para o formulário.
- **Card**: novo `IndicarSideover` clonando o esqueleto do `LeadRapidoSideover` (tokens dark verde `#16271e` + dourado `#c9a24a`, mobile full-height). O CopilotoVoz já montado ao lado (layout.tsx) preenche este MESMO card na fase 2 — backend idêntico.

## 2. O CARD (mínimo p/ Confirmar = nome + telefone; resto tem default)

1. **NOME** (obrigatório, autofocus) + botão "da agenda" via Contact Picker API (Chrome/Android) que preenche nome+telefone em 1 toque real; fallback digitar.
2. **TELEFONE** (obrigatório, inputmode=tel, mesma validação do LeadRapido).
3. **MERCADO** — chips single-select (reusa `MercadoLeadPicker`), default = mercado mais frequente das indicações anteriores do usuário (ou IMB).
4. **OBSERVAÇÃO** (opcional, 1 linha).
5. **Toggle "eu mesmo atendo"** — visível SÓ se o indicador for parceiro homologado com `recebe_leads=true`. Bypass DECLARADO do motor, carimbado (`atendimento_proprio=true`).
6. **"Quem indicou?"** — visível SÓ para staff interno (owner/gestor/comercial): lista Click-and-Go de parceiros/pessoas, default 'hub'. Parceiro logado nunca vê (é ele mesmo).
7. **Rodapé FIXO (read-only)** — a regra ESCRITA, lida na hora: "Sua regra hoje: 10% do pote de comissão — do seu cadastro de parceiro, vigente desde 12/05. Vale a regra vigente no dia do fechamento." Sem regra: "Sem % cadastrado — a indicação vale; o percentual será definido no negócio" (NÃO bloqueia).
8. Um botão só: **CONFIRMAR INDICAÇÃO**.

**RECONCILIAÇÃO "pra quem"**: NÃO há chips de destinatário (Lente 1 descartada aqui). O indicador indica o CLIENTE, não escolhe o executor — o lead entra no **motor de distribuição existente** (`lib/crm/distribuir-lead.ts`), EXCLUSIVO 1-por-vez + SLA, decisão já travada do dono. Única exceção = o toggle "eu mesmo atendo". Menos um campo = 1 toque de verdade.

## 3. ATRIBUIÇÃO — duas colunas, accountability ≠ beneficiário

- `registrado_por` = users.id da sessão (`requireCrmSessao` / CrmCallerContext.userId) — quem apertou o botão (auditoria).
- `indicador_{tipo,id,nome}` = a ENTIDADE que recebe a comissão, no vocabulário de `hub_split_regras.beneficiario_tipo` e `hub_negocio_vinculos.entidade_tipo` ('parceiro'|'pessoa'|'empresa'|'hub'). Podem diferir (secretária registra em nome do arquiteto).
- Resolução: parceiro logado → seu hub_parceiros por match `users.email = hub_parceiros.email` (INTERINO; coluna aditiva `hub_parceiros.user_id uuid` entra na próxima janela como hardening); staff → campo "quem indicou?".
- `hub_parceiros.indicado_por` (self-FK + HMAC, já shippado) continua sendo SÓ "quem trouxe o parceiro para a rede" — cadeia nível 2, fase 2, não se mistura.

## 4. O CARIMBO IMUTÁVEL (reconciliação Lente 1 × Lente 2)

**Payload único** (mesmo formato nas duas fases): `{ comprovante_codigo, indicador_tipo, indicador_id, indicador_nome, registrado_por, indicado_nome, indicado_telefone, lead_id, resultado ('lead_criado'|'duplicado'), regra_id, regra_origem ('regra_negocio'|'regra_parceiro'|'fallback_comissao_pct'|'padrao_hub'), regra_pct, regra_texto (por extenso), atendimento_proprio, criado_em (timestamp servidor) }`.

- **FASE 1 (ponte, SEM migração — buildável agora)**: o payload grava em `lead.metadata.indicacao` (objeto tipado com UUID, substituindo o `indicado_por` string solto de `lib/crm/lead-cadastro.ts:44-56`) — como faz parte do INSERT do lead, é **atomicamente fail-closed**. Adicionalmente dispara `hub_eventos` evento `indicacao_registrada` via registrarEvento (best-effort, p/ KPIs e trilha).
- **JANELA (já agendada do motor)**: tabela **`hub_indicacoes` append-only** (colunas = payload acima + tenant_id), reusa `hub_append_only_guard()` da migração 20260706170000, trigger BEFORE UPDATE OR DELETE, RLS on, REVOKE anon/authenticated — padrão fail-closed idêntico às 4 tabelas do motor. Sem status, sem atualizado_em: fato histórico puro. O upgrade é só trocar o destino do INSERT (fail-closed: falhou o carimbo → arquiva o lead recém-criado — nunca delete — e retorna erro).
- `comprovante_codigo` **IND-2026-NNNN** (código de DOCUMENTO — APARECE, regra do dono). Fase 1: derivado determinístico (ano + sufixo do lead/evento); sequence por tenant nasce com hub_indicacoes.
- **DEDUP FIRST-TOUCH IMUTÁVEL**: telefone já cadastrado (409 existente em route.ts:189-201) → NÃO cria lead, NÃO sobrescreve atribuição, mas o comprovante da TENTATIVA é carimbado (`resultado='duplicado'`, lead_id = o existente) com resposta honesta: "este contato já está no Hub desde DD/MM — indicação registrada como tentativa". Toda disputa 'eu indiquei primeiro' vira decidível por log.

## 5. CONEXÃO COM O SPLIT (a comissão nasce certa)

(a) No Confirmar, a rota resolve a regra pela precedência do design aprovado: `hub_split_regras` escopo='parceiro' casando papel_gatilho ('indicou_cliente'; 'indicou_comprador'/'indicou_vendedor' no imóvel) → fallback `hub_parceiros.comissao_pct` → padrão Hub. Congela `regra_id + regra_texto` no carimbo.
(b) Na CONVERSÃO lead→negócio (fluxo existente): INSERT em `hub_negocio_vinculos` com `papel='indicador'` (CHECK já aceita — migração 20260620180000:50-54, nunca usado; UNIQUE já impede duplicata), entidade = indicador do carimbo.
(c) No fechamento, `rpc_apurar_comissoes` já varre os vínculos, casa papel 'indicador' → papel_gatilho 'indicou_*' e grava o snapshot em `hub_comissoes`. **NÃO se cria hub_comissoes na indicação** — o carimbo é a PROVA de qual regra valia; o snapshot financeiro continua nascendo só na apuração.
**Regra que vale** (reconciliado): mantém **dia do FECHAMENTO** (design aprovado §2), e o comprovante DIZ isso por extenso — senão o carimbo vira promessa que o Hub pode não honrar. Cadeia auditável completa: carimbo → lead.metadata.indicacao → vínculo 'indicador' → hub_comissoes.regra_id.

## 6. COMPROVANTE CARIMBADO (substitui o form no mesmo sideover, recibo com borda dourada)

- Código IND-2026-0042 + "Indicação registrada — 06/07/2026 09h17" (hora do SERVIDOR);
- "Marina indicou Fernanda (11 9****-4321)";
- Destino: "Na fila do Hub — você será avisada quando alguém pegar" / "Você mesma vai atender (declarado)";
- Regra por extenso: "Indicação de cliente: 10% do pote de comissão — regra do seu cadastro, vigente em 06/07/2026; vale a regra do dia do fechamento — registro imutável nº <id>";
- Semáforo inicial: "Aguardando visto";
- Ações: **[Compartilhar]** (share sheet nativo — versão PÚBLICA SEM % : só data/hora/código/partes; a interna mostra tudo. É o que rouba o fluxo do WhatsApp), [Ver minhas indicações], [Indicar outra].

## 7. FECHAR O VÁCUO — o visto dos dois lados

- **Receptor**: lead chega com faixa "Indicado por Marina — 10% carimbado". O PRIMEIRO toque dele grava evento `lead_visto` automaticamente (sem botão) + botão opcional "Peguei, obrigado" (nudge de volta). Visto ≠ aceito: aceite = pegar dentro do SLA do motor.
- **Indicador**: em "Minhas indicações", semáforo carimbado por card: ENVIADA (cinza) → VISTA por Ricardo 06/07 14h02 (dourado) → VIROU NEGÓCIO → FECHOU/PERDEU (com motivo). SLA estourou → redistribui E o card mostra honesto "redirecionada para Beltrano 07/07 09h00".
- Notificação fase 1: **sino in-system** (decisão-mãe: lead IN-SYSTEM). Digest WhatsApp = fase 2.

## 8. BUILD FASE 1 (ordem, tudo com peças existentes)

1. Extrair helpers de `app/api/crm/leads/route.ts` (validarLeadCadastro, dedup, vincularPessoaPorTelefone, prepararRowHubLeadInsert) para lib — chamados dos dois lugares, zero duplicação.
2. Rota nova `POST /api/crm/indicacoes` (fluxo: resolve indicador → resolve regra → cria lead com origem='indicacao' + metadata.indicacao / 409 → carimbo 'duplicado' → hub_eventos + hub_atividades → responde o COMPROVANTE renderizável).
3. `IndicarSideover` (clone do LeadRapidoSideover) + página `/crm/indicacoes` (lista + `?nova=1`) + espelho `/parceiro/indicacoes`.
4. Ação "Indicar" no FAB (1º item) + gate de persona PARCEIRO + item de menu "Minhas indicações".
5. Evento `lead_visto` no primeiro toque do receptor + faixa "Indicado por" + semáforo na lista.
6. Preparado p/ janela: migração `hub_indicacoes` pronta na gaveta (aplicação = janela do dono, regra eterna).
Voz (fase 2) = CopilotoVoz preenchendo o mesmo card; backend intacto.

## Campos
- NOME (obrigatório, autofocus; botão 'da agenda' via Contact Picker API preenche nome+telefone em 1 toque)
- TELEFONE (obrigatório, inputmode=tel, DDD+número — mesma validação do LeadRapido; chave do dedup first-touch)
- MERCADO (chips single-select reusando MercadoLeadPicker; default = mercado mais frequente do usuário, fallback IMB)
- OBSERVAÇÃO (opcional, 1 linha)
- Toggle 'eu mesmo atendo' (só parceiro homologado com recebe_leads=true; bypass declarado do motor, carimbado atendimento_proprio=true)
- 'Quem indicou?' (só staff interno; lista Click-and-Go de parceiros/pessoas, default 'hub' — parceiro logado é resolvido da sessão e não vê o campo)
- Rodapé fixo read-only: a regra de split ESCRITA (hub_split_regras escopo='parceiro' → fallback comissao_pct → padrão Hub; sem regra = aviso honesto '% a definir no negócio', não bloqueia)
- Derivados no servidor (não visíveis): registrado_por (sessão), indicador_{tipo,id,nome}, comprovante_codigo IND-2026-NNNN, regra_{id,origem,pct,texto}, resultado, timestamp do servidor

## Endpoint
Rota NOVA e fina: POST /api/crm/indicacoes — não reusa a rota /api/crm/leads, reusa a LÓGICA dela (helpers validarLeadCadastro, dedup tenant-scoped por telefone, vincularPessoaPorTelefone, prepararRowHubLeadInsert extraídos de app/api/crm/leads/route.ts para lib e chamados dos dois lugares). O que grava: (1) LEAD com origem='indicacao', estagio='novo', entregue ao motor de distribuição exclusivo (ou auto-atribuído se toggle 'eu mesmo atendo'); (2) CARIMBO imutável — fase 1 (sem migração): payload tipado em lead.metadata.indicacao (atômico com o INSERT do lead = fail-closed) + evento hub_eventos 'indicacao_registrada' (best-effort, KPI); pós-janela: INSERT fail-closed em hub_indicacoes append-only (mesmo payload, só troca o destino; falhou → arquiva o lead, nunca delete); (3) caso 409 (telefone já existe): NÃO cria lead nem sobrescreve atribuição, carimba a TENTATIVA com resultado='duplicado' apontando o lead existente; (4) hub_atividades. NÃO cria hub_comissoes (snapshot financeiro nasce só em rpc_apurar_comissoes) e NÃO cria hub_negocio_vinculos (o vínculo papel='indicador' nasce na conversão lead→negócio). Resposta = o comprovante renderizável (código, data/hora do banco, partes, regra por extenso, resultado).

## Decisões do dono
- REGRA QUE VALE no fechamento: manter 'regra do dia do FECHAMENTO' (design aprovado) com o comprovante dizendo isso por extenso (recomendado — senão o carimbo vira promessa que o Hub pode não honrar), ou passar a honrar a regra CARIMBADA na indicação? Impacta rpc_apurar_comissoes e o contrato social da rede.
- 'PRA QUEM VAI': desenho reconciliado tira a escolha manual — lead sempre entra no motor exclusivo (decisão já travada), única exceção o toggle 'eu mesmo atendo'. Confirmar que o indicador NÃO pode escolher destinatário nominal (a Lente 1 propunha chips de últimos destinatários; descartei para preservar o motor e o 1 toque).
- Toggle 'EU MESMO ATENDO' (parceiro homologado se auto-atribui o lead que indicou, bypass declarado e carimbado do motor): sim ou não?
- Indicação SEM regra de split cadastrada: segue com carimbo '% a definir no negócio' (recomendado — não perder a indicação) ou bloqueia até haver regra? Impacta o valor jurídico do comprovante.
- DEDUP first-touch imutável: telefone já existente vira 'tentativa carimbada' sem atribuição (recomendado — decidível por log, sem briga) — confirmar. E a indicação tem VALIDADE (ex.: 90 dias) ou vale para sempre? Linha de negócio pura.
- Comprovante COMPARTILHÁVEL: versão pública SEM % (só data/hora/código/partes) e versão interna completa (recomendado — compartilhar não pode expor a comissão a terceiros nem ao indicado). Confirmar.
- Staff interno registrando indicação EM NOME de parceiro/pessoa: qualquer papel interno pode, ou restringir a comercial+?
- INTERINO de identidade: até a coluna aditiva hub_parceiros.user_id entrar na próxima janela, o parceiro logado é resolvido por match de email (users.email = hub_parceiros.email) com fallback de escolha explícita — aceitável como ponte?
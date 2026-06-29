# Operacao de Campo (tablet/kiosk + IA-campo + cross-check) — Design ideal (mesa redonda)

## Operacao de Campo — design ideal

A leitura das 4 lentes convergiu. Onde elas concordam, e mandato; onde divergem (nome de tabela, condicao de entrada por comodato, modelo de visao), registro como checkpoint do dono. Tudo ancorado no chao real (`hub_operarios_checkin`, `hub_obras_fotos`, `hub_obra_restricoes` E3, CopilotoVoz) — append-only, tenant via `.eq` puro.

### Fluxo de campo + hardware (comodato/kiosk/celular faseado)

O valor NAO esta no tablet. Esta no **cross-check** + **follow-up forcado**. O tablet e so a ancora de controle. Por isso a sequencia de valor e: presenca confiavel (geo) -> pergunta certa na hora certa -> divergencia vira pendencia AUDITADA -> totem de compra -> por ultimo o hardware. Construir o cerebro antes do equipamento.

```
CHEGADA → CHECK-IN no equipamento-ancora do Hub
  captura: pessoa_id · especialidade(s) · GEO(lat/lon/precisao) · device_id · ts
  geo dentro do raio? sim=valido · nao="fora do raio" (FLAG, nao bloqueia — append-only)
  check-in diz QUEM esta la e DE QUE especialidade  ← insumo do alvo da IA
        │
   [opera — a IA NAO interrompe]
        │
MOMENTO CERTO (pausa natural): pre-checkout · pre-almoco · foto-nova-na-frente
  pergunta a PESSOA CERTA (especialidade presente), frase de CONFIRMACAO:
  "Ja vi tinta na foto de ontem — confirma que ainda tem?" [Sim/Nao]
        │
CHECK-OUT = gate do minimo: 1 toque por frente presente
  registra saida + respostas → dispara CROSS-CHECK (declarado × foto/projeto)
```

**Regra de ouro (consenso das 4 lentes):** check-in que vale como controle oficial **so** via device registrado no Hub. A IA so fala em pausa natural — nunca durante o trabalho. Teto **3 perguntas/pessoa/dia** (anti-fadiga; fadiga de alerta mata ferramenta de campo).

**Hardware faseado — honesto (contraponto ao dono, registrado):** o dono quer tablet-comodato em toda obra. E a ancora certa, mas no cold-start (20 fornecedores SP) exigir comodato trava onboarding e queima capital. A **exclusividade** do check-in vale desde ja; o **equipamento** e faseado:

| Fase | Equipamento | Check-in | Geo | IA-campo |
|------|-------------|----------|-----|----------|
| **A — cold-start** | celular do operario/encarregado, PWA kiosk-mode | geofence 50m server-side; celular so checkout emergencial c/ flag+aprovacao | device | regras deterministicas (declarado × E2/EAP, sem visao) |
| **B — volume** | kiosk Android travado (~R$400–800), fixo na obra | PIN / cracha-QR (HMAC) / foto-na-lista | fixa no device | + visao (foto tirada no proprio kiosk) |
| **C — escala/premium** | tablet comodato (visao do dono): MDM, foto periodica anti-fraude, SIM proprio | biometrico (face/digital = anti-procuracao) | GPS | visao plena |

O kiosk FIXO (Fase B) elimina a classe inteira de geo-spoofing — e o argumento real a favor do equipamento-ancora do dono. `origem` do check-in (`celular`|`kiosk`|`tablet`) e so um campo; append-only protege a transicao.

> **CHECKPOINT do dono (linha de negocio):** comodato e *condicao de entrada* do fornecedor desde o teste, ou comeca celular/kiosk? · frete Lalamove repassado vs spread · PIN vs biometria vs QR para operario sem smartphone.

### IA-campo: quem/quando/minimo + cross-check anti-fraude + ASCII

**QUEM:** so a especialidade presente hoje (do check-in) E relevante ao item em andamento na EAP. Pintor responde de pintura, nao de eletrica.
**QUANDO:** gatilhos naturais (pre-checkout primario / pre-almoco / foto-nova). Nunca push aleatorio. Teto 3/pessoa/dia.
**O MINIMO:** so o que o sistema NAO infere. Filtro pre-pergunta: foto fresca (<4h) com confianca ≥0.85 → nao pergunta; EAP marca concluido → nao pergunta andamento; SC entregue <24h → nao pergunta material. Frase canonica: **"Ja vi [evidencia], confirma [delta]?"** — operario so confirma/corrige, nao descreve.

**Cross-check (declarado × evidencia) — o "somos juizes" no campo:**

```
declarado = resposta do operario      evidencia = hub_obras_fotos + EAP/E2/E3
                          │
                   IA compara
        ┌─────────────────┼──────────────────────┐
        ▼                 ▼                        ▼
     BATE            NAO BATE                 SEM EVIDENCIA
   registra,     FORCA FOLLOW-UP +         pede foto AGORA
   sobe conf.,   abre pendencia E3         antes de aceitar
   silencio      auditada                  o declarado

LIMIARES (Fase 1, deterministica — calibrar com dados reais):
  divergencia <10% ou confianca <0.60  → aceita (beneficio da duvida)
  divergencia 10–30%                   → hub_obras_ocorrencias severidade='atencao' (humano audita)
  divergencia >30% e confianca ≥0.75   → ANTI-FRAUDE: hub_obra_restricoes origem='ia_campo',
                                          checkout pede foto-agora; supervisor pode liberar c/ nota
```

**Vira pendencia AUDITADA por REUSO, nao invencao** — destino e `hub_obra_restricoes` (E3) que JA existe e JA alimenta `vw_hub_obra_bloqueios_hoje` + cockpit E1. Aditivo: estender o CHECK de `origem` para incluir `'ia_campo'`. A divergencia cai no MESMO painel de bloqueios que o gestor ja usa — **zero tela nova de gestao**. Humano e o juiz final (aprova/descarta); a decisao ENSINA o agente (loop igual Central de Aprovacoes). `hub_obra_restricao_promover` (RPC idempotente) evita duplicata.

**Anti-fraude em camadas:** (1) presenca: geo fora do raio → flag; mock-GPS Android detectavel → flag de integridade; (2) veracidade: declarado ≠ foto/projeto → pendencia E3; (3) evidencia fresca: foto de checkout com EXIF/timestamp do dia (foto so conta se `criado_em ≥ checkin do dia`); (4) padrao: divergencia recorrente derruba o **score de veracidade** do operario/fornecedor (KPI → ranking → permanencia na rede).

Tom na tela: **nunca acusatorio**. "Preciso de uma foto pra confirmar" — nao "voce fraudou". "Somos juizes" acontece no painel do gestor, nao na cara do trabalhador (evita mentira defensiva no canteiro).

```
declara "Bloco E Andar3 — 80%" │ foto 2h: IA estima 45% │ E2: falta_material
                 divergencia 35% > 30%
                          ▼
   hub_obra_restricoes  origem='ia_campo' tipo='documento' impacto='trava'
   titulo="Divergencia declarado 80% × foto 45% — E.Andar3"
                          ▼
   CHECKOUT pede foto-AGORA  ──┬──►  foto nova → IA re-analisa → resolve
   (nao trava a pessoa de ir) └──►  supervisor libera c/ nota (append-only, auditavel)
```

### Telas tablet/kiosk

Premissa de campo (muda tudo vs CRM): operario de luva, dedo de cimento, sol na tela, 10s de paciencia, talvez sem smartphone, equipamento **compartilhado**. Logo: alvos ≥72px, texto ≥20px, **voz como entrada primaria**, zero digitacao obrigatoria, 1 decisao por tela, **sem estado de sessao** (stateless, timeout ~20s volta ao repouso). Shell propria `/campo` — fora do layout `/crm` (sem menu/QuickAdd/FAB). Marca dark verde+dourado, **escala +60%** vs CRM (o CopilotoVoz hoje e 13–14px / FAB 60px — pequeno demais pro campo; reusar a LOGICA e os TOKENS, nao a shell).

```
TELA 0 — REPOUSO (o tablet "toca")        TELA 1 — IDENTIFICAR (kiosk compartilhado)
+------------------------------+          +------------------------------+
| OBRA: Consulado Italia  09:41|          |  QUEM E VOCE?                |
| PRESENTES: ●Pintura ●Eletrica|          |  ((( NFC/cracha )))  0-toque |
| +--------------------------+ |          |  ── ou toque na sua foto ──  |
| |   ▶ REGISTRAR PONTO      | |          |  [foto João][foto Maria][+]  |
| +--------------------------+ |          |  cor da etiqueta=especialid. |
| [🎤 Falar]   [📷 Foto rapida]|          |  [🎤 "sou o João da pintura"]|
+------------------------------+          +------------------------------+
 idle→IA dispara: card vira pergunta       "nao estou na lista"→cadastro express
 c/ halo dourado pulsante + som            (voz+chips+foto, sem login)

TELA 2 — CHECK DE 30s (momento certo)      TELA 3 — CHECKOUT BLOQUEADO (anti-fraude)
+------------------------------+          +------------------------------+
| ● Pintura · João   1 de 2    |          |  📷 Preciso de 1 foto pra    |
| [thumb da foto GRANDE]       |          |  confirmar o avanço.         |
| "Ja vi tinta ontem.          |          |  Voce disse 80% · foto: dif. |
|  Ainda tem?"                 |          |  +------------------------+  |
| +----------+  +-----------+  |          |  |    ABRIR CAMERA        |  |
| |  ✓ SIM   |  | ✗ ACABANDO|  |          |  +------------------------+  |
| +----------+  +-----------+  |          |  [Chamar responsavel]        |
| [🎙 responder falando][pular]|          |  tom NEUTRO, nao acusatorio  |
+------------------------------+          +------------------------------+
 NAO→encadeia TELA totem ja preenchida

TELA 4 — TOTEM DE COMPRA (1-toque)         TELA 5 — CHECK-OUT (gate do minimo)
+------------------------------+          +------------------------------+
| 🎙 "comprar tinta"           |          | Antes de sair — 1 toque:     |
| Sugerido p/ Andar 8 (contexto|          | Pintura Andar 8:             |
| do check-in): Tinta 18L      |          | [✓ tudo ok] [⚠ tem problema] |
| Qtd [- 2 +]                  |          | 📷 foto de saida (opcional)  |
| [ PEDIR (R$240) ] →E5/Lalamove|         | +-- ▶ CHECK-OUT --+          |
+------------------------------+          | flash verde "Bom trabalho!"  |
 contexto pre-carrega o item provavel     +------------------------------+
```

Confirmacao de **corpo inteiro** (flash da tela cheia + 1.5s), nao toast de canto — o operario olha de longe/de relance. Cor-por-especialidade como sistema (etiquetas/halos) evita o "tudo verde indistinto". Cockpit do gestor (web, nao kiosk) lista presentes-agora, perguntas pendentes, divergencias do dia, e veracidade 30d por operario.

### KPIs de campo

Derivados das tabelas (sem tabela de KPI nova — `hub_kpis_resultados` ja tem tenant). Por obra/frente/operario/especialidade.

- **Presenca:** % check-ins com geo valida · presentes/dia vs planejado (EAP) · check-ins fora do raio (sinal de fraude) · jornada media (saida−chegada) · % check-ins sem device Hub (controle fraco se >20%).
- **Follow-up:** % checks de 30s respondidos antes do checkout · tempo medio de resposta (meta <60s) · nº follow-ups forcados.
- **Veracidade (o moat):** taxa declarado×evidencia que BATE (% confianca) · nº divergencias por operario (**score de veracidade**) · % divergencias confirmadas pelo gestor · % confirmacoes "sim" sem foto.
- **Resolucao:** tempo divergencia→resolvida (reusa E3) · % pendencias `ia_campo` aprovadas vs descartadas (calibra o agente — alto descarte numa regra desliga a regra).
- **Material (cruza E5):** fill-rate do pedido · materiais avisados ANTES de travar o item.

Alimentam o ranking do fornecedor (permanencia na rede) — a engenharia auditorial no campo.

### Faseamento honesto · Reuso x novo · Edge cases

**Faseamento:**
- **Fase 1 (semanas, baixo esforco):** +geo+especialidade no check-in; foto→frente/item; check de 30s no pre-checkout; cross-check deterministico (declarado vs E2 boolean/EAP) → E3 `origem='ia_campo'`. Hardware: **celular+geofence**. Ja entrega presenca confiavel + follow-up forcado + anti-fraude v1.
- **Fase 2 (cross-check com VISAO):** IA le a foto (nao so metadados), compara com o declarado; KPI de veracidade por operario. Hardware: **kiosk** travado nas obras com volume.
- **Fase 3 (totem + entrega):** compra por voz → E5/marketplace + Lalamove (cotacao por porte; exige catalogo com dimensao/peso). Hardware: **tablet-comodato** premium.
- Em toda fase: append-only, tenant `.eq` puro, humano aprova o critico, **degrade gracioso** (migracao nao rodou → endpoint responde `migracao_pendente`).

**Reuso (nao recriar):**
- `hub_operarios_checkin` JA EXISTE — +3 colunas aditivas (geo lat/lon/precisao, especialidade(s), device_id) + estender CHECK `origem` p/ `'kiosk'|'celular'|'tablet'`.
- `hub_obras_fotos` JA EXISTE — +FK nullable `frente_id`/`item_id` + `tipo` + `exif_ts` (liga a foto a evidencia; hoje flutua solta).
- `hub_obra_restricoes` (E3) = **destino** das pendencias; +`'ia_campo'` no CHECK `origem`. `vw_hub_obra_bloqueios_hoje` + cockpit E1 ja consomem → **divergencia aparece sem tela nova**. `hub_obra_restricao_promover` = molde idempotente.
- `CopilotoVoz`/`useCopilotoVoz` = pipeline listen→interpret→confirm→execute, HMAC, confirma-antes-de-escrever, fallback Voxtral iOS. O totem e o check de 30s reusam ISSO (passar contexto `{rota:'/campo', obraId, pessoaId, especialidade}`). **NAO reusar a shell** (pequena) — so logica+tokens, +60%.
- `hub_pedidos_material`+E5 = destino do totem. `hub_obras_ocorrencias`/`diario` = registro append-only. `current_user_tenant_id()` = RLS canonica.
- **NOVO minimo:** `hub_devices` (registro do equipamento do Hub — o comodato precisa disso), `hub_campo_perguntas`, `hub_campo_respostas` (append-only, imutavel, sem UPDATE p/ authenticated — molde `hub_estoque_mov`), RPC `hub_campo_veredito` (SECURITY DEFINER, REVOKE anon, executada por worker — nao pelo frontend).

**Edge cases:**
- **Sem internet (comum):** offline-first IndexedDB — check-in/foto/resposta gravam local c/ ts+geo do device, sync em batch ao voltar sinal; checkout NUNCA bloqueia por conectividade; chip "salvo no aparelho ↑" (dourado, nunca erro vermelho). Geo capturada no device (independe de rede). Janela de fraude offline mitigada por sync auditado pos-fato.
- **Operario sem smartphone (regra, nao excecao):** e exatamente o caso do **kiosk fixo** — identifica por PIN/foto-na-lista/cracha-QR, sem device proprio. No cold-start so-celular, encarregado faz check-in da equipe pelo dele.
- **Multiplas especialidades:** check-in aceita N especialidades (chips multiplos→array); IA pergunta 1×por especialidade-frente relevante (nao por pessoa), respeitando o teto. Cross-check e por frente×especialidade.
- **Fraude — geo falsa/procuracao:** geo fora do raio→flag; mock-location→flag; jornada <2h→ocorrencia automatica; kiosk fixo (Fase B) elimina geo-spoofing; biometria (Fase C) elimina procuracao.
- **Fraude — foto velha:** EXIF/timestamp do dia obrigatorio; foto so conta se `criado_em ≥ checkin do dia`; (Fase 2) hash anti-duplicata.
- **Falso-positivo da IA:** toda pendencia `ia_campo` e PROPOSTA, nao veredito; humano aprova/descarta; descarte ENSINA o agente; alto descarte numa regra → desliga a regra. Protege a confianca do operario (senao para de responder).
- **Operario recusa o check de 30s:** nao bloqueia a saida (campo nao trava pessoa indo embora); registra "nao respondido" como sinal; recorrencia vira KPI baixo do fornecedor. Gate e social/contratual (KPI), nao fisico.
- **SC aprovada no E5 mas operario diz "nao chegou":** cross-check detecta divergencia status='entregue' × resposta='nao recebi' → ocorrencia severidade='critico' (risco de desvio de material).

**INCOGNITA a confirmar antes de qualquer migracao (1 lente apontou):** o nome real da tabela em producao — `hub_operarios_checkin` (visto em `crm_integral_core.sql`) vs `hub_obras_operarios_checkin` (mencionado no prompt do dono). Verificar via Supabase MCP `list_tables` antes de aplicar. O design nao muda — so o nome na migracao.

**Limite honesto:** nada testado em runtime — e desenho-alvo (Fase 2/3) sobre leitura de codigo/schema/doc reais. Confianca ALTA no reuso e no faseamento; MEDIA na viabilidade do cross-check por VISAO (depende de modelo+custo de token — Fase 2) e nos limiares 10/30/0.85 (calibrar com 2-3 semanas de uso real); decisoes de linha de negocio marcadas como CHECKPOINT do dono.
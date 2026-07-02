# 🗺️ Roadmap dos Módulos — Síntese do CEO sobre a Visão Definitiva

> Síntese de CEO a partir da mesa redonda (5 blocos: personas/lentes, áreas/conexões, IA-coordenadora/voz, segmentos, telas/rigidez/molde — `wf_f0af4e81-420`) sobre `VISAO-DEFINITIVA-SISTEMA-USUARIO-TELA-IA.md`, avaliada tópico-a-tópico contra as premissas do sistema e o código real. **Para o dono AVALIAR antes de construir.**

## 🎯 Veredito do CEO (o que a mesa toda convergiu)
A sua visão é **~85% construível a partir do que já existe** — e o **maior risco é construí-la ao pé da letra** (o próprio §20: "completo demais e difícil de usar"). A mesa foi unânime: **não fazer N telas por persona, N tabelas por ofício, N módulos por área.** O antídoto são **6 unidades reusáveis**:

| Em vez de… | Fazer… |
|---|---|
| 11 telas por persona | **1 objeto, N LENTES** (persona = lente, tela = por objeto) |
| N tabelas/módulos por ofício | **1 ÁTOMO de execução universal** (`hub_obras`/`hub_obra_itens`) reusado |
| Cada tela do seu jeito | **1 KIT DE TELA** (shell + rigidez + contexto + ficha prescritiva) |
| Cada poder novo da IA | **1 GATE** (allowlist + propõe→humano confirma) |
| Módulo de marcenaria/vidraçaria/pintura | **Segmento = DADO** (template por ofício), nunca código |
| 11 dashboards de "Início" | **1 Início componível** por capability |

## 🟢 A surpresa: o que JÁ está construído (não reconstruir)
- **O átomo de execução (Engenharia/`hub_obras`) está COMPLETO**: escopo→SC→estoque→medição→financeiro→curva-S (AEC E0–E7 no ar). É a joia — deve ser **promovido a "unidade universal"** e reusado, não copiado.
- **A IA reativa está PRONTA, só DORMENTE**: Copiloto de Voz (allowlist + HMAC + TTL + propõe→confirma + zero spawn mágico) = literalmente o "Perguntar à IA que cria ação" do §10. Só falta **ligar a chave**.
- **PROTEGE (§11.3) está codado**: Central de Aprovações (2 autoridades), escrow dual, imutabilidade, dedup, auditoria. Padrão-ouro — preservar.
- **O molde de tela existe em embrião**: `CadastroPremiumSideover` (shell reusado), `ObraItensSecao` (rigidez invisível: situação auto 🔒 × andamento manual, 5 bloqueios), criação context-aware (herda cliente/EAP).
- **O motor de template existe**: e0b (`hub_eap_presets` + `hub_obra_taxonomia`) — já entrega preset por segmento; falta só a dimensão **ofício**.
- **A lente existe**: `crm-permissoes` governa menu+rota+ação sem drift.
- **"Hoje" tem embrião**: `CrmOQuePrecisaDeVoce` (agrega por REGRA, sem depender de IA).
- **Caminho arq→eng é a referência de ouro**: gate server-side + idempotência + linhagem + tenant-guard. Os outros caminhos devem **copiar esse molde**.

## ✂️ O que CORTAR / reinterpretar (honestidade)
- **Pintura NÃO é segmento** — já é disciplina no EAP (PINT-* na taxonomia). Cortar "módulo pintura".
- **Vidraçaria/serralheria/marcenaria não são módulos** — são **templates** sobre o átomo. O esteira atual ("1 tabela por ofício": `hub_marcenaria`/`hub_vidracaria`/`hub_marmoraria`) **nem existe em migração** — roteia p/ tabelas-fantasma → quebraria no 1º ganho real. **Aposentar antes de dado real.**
- **Empreiteira NÃO é módulo** — é **papel/contrato** sobre a medição+escrow universal (E6/E7).
- **+Novo de 17 tipos → 5-6 reais + contextuais** (só adicionar quando a tela-destino existir).
- **Serralheria/pintura standalone, Documentos, Estoque-global, IA-central** → sob demanda / depois.

## 🚦 ROADMAP (fases, com o porquê da ordem)

### FASE 0 — Travas ANTES de dado real (código barato; P0)
1. **Matar o spawn mágico** ganho→obra (propor+confirmar) — fere premissa 4 + a decisão Tier 0.10; um "ganho" por engano vira obra-lixo imortal. **É o commit que pausei.**
2. **Convergir o esteira no spine universal** (aposentar as rotas p/ `hub_marcenaria`/`hub_vidracaria`/`hub_marmoraria` fantasmas) — aditivo/barato agora, irreversível depois.
3. **Travar a DIRETRIZ de arquitetura** (doc, custo zero): "tela por OBJETO, persona = LENTE; `hub_obras` = átomo de execução universal". Ataca o §20 de frente.
4. Fechar o resto do commit de comportamento (dedup global-PII-safe, anon links, app passa tenant ao gerador, dashboards MDO).

### FASE 1 — Fundação transversal (o que TODO módulo consome)
1. **Ligar a IA** (MISTRAL + COPILOTO_HMAC no Render) + **validar o copiloto ao vivo** no seu device — a reativa já existe; nada de IA proativa antes de provar a reativa. *(Janela do dono — junto das chaves.)*
2. **Lente estendida**: 2º eixo de FUNÇÃO AEC (arquitetura|engenharia|campo|compras como capability, não novo rank) + **lente de CAMPO** no servidor (cliente/prestador nunca recebem custo/margem/fornecedor).
3. **KIT DE TELA formalizado**: shell (existe) + `FichaContextoStrip` novo (§18: completude / próximo passo / risco) + kit-rigidez (extrair do ObraItensSecao) + `useContextoCriacao`/+Novo contextual.
4. **Tela "Hoje" universal**: promover `CrmOQuePrecisaDeVoce` a rota; agrega por REGRA; cada módulo REGISTRA suas pendências (diário não preenchido, compra travando obra, medição pendente) por fonte, filtrado pela lente. **Zero tabela nova.** É o keystone da UX + a casa do preditivo.

### FASE 2 — Módulos sobre a fundação (do átomo pra fora)
1. **Motor de template por ofício** (estende e0b): dimensão ofício + atributos (espessura/tipo de vidro; m²/demãos; ferragem/MDF) + **guardrails de IA como DADO** (ex.: vidraçaria — sem foto+espessura → orçamento travado). *É o único build genuinamente novo — e destrava todos os ofícios de uma vez.*
2. **SERVIÇO UNIVERSAL** (instância leve do átomo: 1 frente, checklist curto, sem curva-S) — o maior vão atual (premissa 5).
3. **Empreiteira** (quase de graça sobre E6/E7 + escrow ligado): pagamento por etapa = aprovação dupla com evidência.
4. **Marcenaria + Vidraçaria** (sub-escopos reais de reforma; produção off-site = frente com diário; guardrail de espessura).
5. **Produtos como tela + ficha** (onde usado/preço histórico/obras vinculadas/alerta) + **estoque global = LENTE** agregadora (não tabela).
6. **Início componível** por capability.

### FASE 3 — O moat (preditivo) + externos
1. **IA COBRA**: 1 ciclo "coordenador de obra" que roda o `hub_obra_hoje` e ENFILEIRA lembretes no Gestor de Tarefas + cards na Central de Aprovações (reusa o dispatcher de ciclos).
2. **Preditivo determinístico** (o moat, premissa 9): `data_inicio × falta_material × estoque × lead-time`; consumo×previsão de compra. Regras antes de ML — exige dado real fluindo pelo fio (Tier 0 já no ar).
3. **Portal do Cliente** (reusa o padrão de acesso externo por token do portal do parceiro + a lente de campo): cura os 5 medos, sem ver custo/margem.
4. **Sob demanda**: caminho eng→arq ("revisar_projeto"), serralheria/pintura standalone, Documentos, tela IA central.

## 🔗 Dependências críticas (a ordem não é opcional)
- A **linhagem pai/raiz + identidade (Tier 0, no ar)** é pré-requisito do `useContextoCriacao` e do preditivo — por isso veio primeiro. ✅ feito.
- O **KIT DE TELA + a LENTE estendida** vêm ANTES da maratona de telas, senão cada módulo diverge (fere fonte única).
- O **átomo universal + motor de template** vêm ANTES dos ofícios, senão viram N tabelas.
- O **preditivo** vem por ÚLTIMO — precisa de volume de dado real; não se prevê com o banco vazio.
- **Ligar a IA** destrava metade da visão sem código (só operacional).

---

## 🔧 REFINAMENTO DO DONO (02/jul) — fornecedor = CONTA multi-tenant, não frente da obra do Hub
> Verbatim: *"empreiteira, marcenaria, vidraçaria são todos prestadores de serviço, têm que ter cadastro no multi-tenant, com área que deriva para o gerenciamento do seu serviço atrelado aos que estão nas camadas acima, assim como rastreamento das suas mão de obra, então precisa ter usuário também. Mas na visão da engenharia e arquitetura até do cliente final — cada um com sua visualização específica — podem ver somente a tela do fornecedor."*

**Isto CORRIGE a conclusão da mesa** (que tratava marcenaria/vidraçaria/empreiteira como *template numa frente da obra do Hub*). O modelo certo:
- Cada fornecedor (empreiteira/marcenaria/vidraçaria/…) é uma **CONTA no multi-tenant** — com **cadastro + user(login) próprios** e sua **ÁREA** para **gerenciar o próprio serviço** (o serviço universal, do lado do fornecedor) + **rastrear a SUA mão de obra**.
- O serviço do fornecedor é **ATRELADO cross-conta** ao negócio/obra da camada acima (eng/arq/Hub que contratou), pelo **código-fio + linhagem pai/raiz** (Tier 0, no ar).
- As camadas acima (engenharia, arquitetura, **cliente final**) veem **só a LENTE** do trabalho do fornecedor ("a tela do fornecedor" filtrada por papel) — cada um sua visualização.

**Reconciliação (o que muda × o que se mantém):**
- ✅ **Mantém:** o serviço universal continua **1 átomo** (não N módulos) + o **template por ofício** (é como o serviço nasce configurado).
- 🔧 **Muda:** a CASA do serviço é a **conta do fornecedor** (tenant próprio), não uma frente da obra do Hub. Empreiteira/marcenaria/vidraçaria deixam de ser "papel/template no Hub" e passam a **conta-fornecedor com serviço universal atrelado cross-conta + lente por camada**.
- **Isto VALIDA o Tier 0:** a **identidade GLOBAL** + a **linhagem pai/raiz** são exatamente o que permite o serviço do fornecedor (um negócio-filho na conta DELE) apontar pro negócio-raiz na conta do Hub — **cross-tenant, sem duplicar cadastro**. Casa com a memória `modelo-tenant-first-servico-universal`, `integracao-contas-negocio-spine`, `crm-cross-conta-visibilidade`.
- **Impacto no roadmap:** isto é a **"coluna do fornecedor" cross-conta** (o coração da Maratona 2) — maior que "template". Depende do **multi-tenant/RLS firme** (parte da Maratona 3) + da **lente de campo** (F1). Construível sobre o Tier 0, mas é a parte mais arquitetural. No caso **Consulado**, se houver marcenaria/vidraçaria, cada fornecedor é uma conta cujo serviço se atrela à obra do Consulado (visível ao eng/arq/cliente por lente) — vira o exemplo multi-conta perfeito.

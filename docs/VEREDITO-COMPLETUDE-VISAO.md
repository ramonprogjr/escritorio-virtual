# 🔍 VEREDITO — "Está TUDO o que queremos no sistema capturado?"

> Resposta à pergunta do dono (09/jul, antes de viajar). Auditoria Fable-max de 5 lentes (alma do produto ·
> dinheiro/rede · IA-diamante · arquitetura/rastreabilidade · operação/verticais) cruzando **~60 memórias + doc-mãe**
> contra o **CRONOGRAMA-UNICO + specs vivas**, com conferência nos documentos reais (não no resumo).
> **Pendente:** ratificar as colocações numa "sessão de captura" de ~1h ao dono voltar.

## Resposta direta: **NÃO — a maior parte está capturada, mas achamos 19 gaps (1 crítico, 4 altos, 9 médios, 5 pequenos).**

A desconfiança do dono estava certa: "nada se perde" ainda **não era verdade** — 19 desejos dele estavam fora de
TODAS as listas (cronograma, V1, estacionamento, specs). **O MVP das 12 semanas NÃO muda** — nenhum desses fura a
fila; a regra da troca 1-por-1 continua. Custo de fechar tudo: **~1h de atualização de documentos** (feita em parte
já nesta madrugada — ver "Ação" no fim).

> **Correção a favor:** uma lente marcou o **preditivo** (prever falta de material — o moat) como perdido. Conferido:
> **está capturado** (Fase 3 do ROADMAP-VISAO-DEFINITIVA-MODULOS, doc vivo). NÃO é gap.

---

## 🔴 CRÍTICO (1)
- **LEVANTAMENTOS + ORÇAMENTOS** — a planilha orçamentária como ESCOPO (orçamento=cronograma=escopo); memorial→planilha
  →proposta→contrato→cronograma; orçamento por IA (memorial PDF → planilha de custos). **O coração DEPENDE disso:** a SC
  de Compras herda a unidade da planilha orçamentária (decisão ratificada), mas a planilha ninguém tem tarefa de
  construir (a SPEC-COMPRAS só cita "frente futura" em rodapé). → **spec própria (SPEC-LEVANTAMENTOS-ORCAMENTOS) +
  1º item da vertical Engenharia no V1**; mesa logo após o track de Compras estabilizar.

## 🟠 ALTOS (4)
1. **DIÁRIO DE OBRA (RDO)** — o dono disse "TEM QUE TER", em formato que já apresentou; alimenta o Portal (medo #3). Os
   docs até PRESSUPÕEM que existe (tela "Hoje" lista "diário não preenchido"), mas nenhum item o CONSTRÓI. → item no V1
   junto do Portal + puxar "recuperar docs do Asana" (já estacionado) p/ achar o formato.
2. **OPERAÇÃO DE CAMPO física/logística** — tablet comodato (check-in/out), totem de compra por voz, entrega 2 níveis
   (planejado × Lalamove c/ frete auto), ponto de obra georreferenciado, diário automático, piloto SP ~20 fornecedores.
   Zero menção nos docs vivos. → linha nomeada no ESTACIONAMENTO, etiqueta F8 (junto do marketplace).
3. **CRM CROSS-CONTA (parceiro↔parceiro)** — negócio aparece p/ todos os envolvidos, mas só o DONO do negócio (e o Hub)
   move; envolvido vê com a cor do mercado de origem e só comenta/atribui. As altitudes do Hub (V1) são OUTRA coisa. →
   onda no DESIGN-RBAC (ou spec via a mesa prometida), antes do 2º tenant.
4. **LICENÇA DE MÓDULOS / ENTITLEMENTS** — o que cada plano libera (hub_tenant_modulos + guard + menu por plano); torna a
   assinatura cobrável por módulo (1ª fonte de receita). Doc-mãe marca "[GAP, DESENHADO]"; MET-05 não nomeia. → item ao
   lado do billing no V1 F4.

## 🟡 MÉDIOS (9)
- **Engenharia profunda:** medição RICA (vídeo + FVS/fichas + pontos de melhoria), boletim com trava (medido nunca passa
  do contratado sem aditivo), qualidade/RNC, SST com bloqueio, Gantt/Curva-S visual, score de fornecedor + avanço
  ancorado em EVIDÊNCIA (hoje o slider infla). → balde no V1 junto do Portal.
- **Processo de auditoria que LASTREIA o selo ⓥ do Portal** (visita in loco, carimbo nome+data, papéis do time real). →
  spec curta referenciada pelo POR-01.
- **Mensageria entre as partes** (Hub·arquiteto·engenheiro·fornecedor·cliente, tudo logado) — notificação ≠ mensageria. →
  V1 junto do Portal.
- **Tela estilo Artifacts** (gerar relatório/doc via IA, cobrar spread por token). → estacionamento (deps: IA-03 + metering).
- **Editar fluxo do agente por conversa/voz** — F8 excluiu de propósito, nada retoma. → fila dos agentes pós draft→publicar.
- **IA concatenada além de compras** — "injeção de IA nas telas" é MENOS que o registry de ferramentas (ação c/ allowlist)
  em obras/medição/estoque/financeiro. → renomear/expandir o item do estacionamento (guarda-chuva da visão-diamante).
- **Arquitetura como CARTEIRA DE PROJETOS** (funil Briefing→Estudo→Anteprojeto→Executivo→Aprovação→Entrega) + fix da tela
  atual (hoje é funil de lead, o dono já diagnosticou errado). → estacionamento (no mínimo o fix).
- **Imóvel ligado à espinha** (captador/proprietário) — jornada imobiliária nasce do imóvel; hoje ilhado. → RAS-06 (carona
  na Semana 9 que já faz RAS-03/04).
- **Escrow com dinheiro REAL em custódia** (banco/gateway + float/rendimento) — hoje só contábil; exige mesa jurídica. →
  estacionamento com trava "jurídico BACEN antes de build".

## ⚪ PEQUENOS (5)
- Fontes acessórias do doc-mãe (publicidade de parceiro C6 · taxa de homologação C7 · dados/analytics como produto C5 ·
  treinamentos · locação própria de equipamentos) → 1 linha no estacionamento.
- Refinos de rastreabilidade (indicador visível no "Relacionados"; vínculo pessoa↔empresa TEMPORAL valido_de/ate + N:N) →
  fase 3 do 04-ROADMAP.
- Trava "NUNCA assumir Hub único" (futuro franquia recursiva) → critério de aceite no TEN-04.
- Aplicar a PIRÂMIDE DE MERCADOS como critério das Semanas 8-9 (custo zero, mesma frente).
- Migração Fase 6 do copiloto (seed identidade slug=copiloto-global + setor_ia) esperando OK — fora de toda lista de gate.
  → vagão da janela S1/S4 (~2 min) ou riscar se obsoleta.

---

## O que ESTÁ seguro (para dormir tranquilo)
Tronco do MVP (Compras 1-7 · funis 8-9 · dinheiro 10 · honestidade 11 · E2E-mãe 12) · V1 com dono e lugar (Portal+5
medos · marketplace/lojas · carteira/Tijolos/cobrança · Anthropic · 2 altitudes do Hub · clawback hold 7d) ·
estacionamento real (gestor de tarefas+"Hoje" · central de aprovações · notificações · portal do fornecedor · design
overhaul · agentes F8-F10). **Adiado ≠ perdido:** preços/carteira e rotação de chaves têm lugar e gatilho.

---

# PARTE 2 — Auditoria dos 6 CRONOGRAMAS antigos (perdeu algo dos planos?): **SIM**

Segunda auditoria (independente): leu os 12 docs de plano antigos e checou se cada escopo caiu em algum balde do único.
Confirmou perda e achou itens que a auditoria da visão não pegou (e **derrubou 3 acusações** conferindo o código:
webhook da Mari JÁ tem HMAC+fail-closed; TEN-03 majoritariamente fechado no banco; disciplina de operação tem base).

**As 6 perdas ALTAS (parte já sobrepõe a visão):**
1. **Orçamento por IA (memorial→planilha) — "o moat".** 3 auditorias independentes. Fora de semana, V1 e estacionamento.
   (= o CRÍTICO Levantamentos+Orçamentos da Parte 1, visto do lado do produto.)
2. **Fecho da camada de obra:** Curva-S exposta, RDO/diário, boletim de medição com trava (medido ≤ contratado sem
   aditivo) + retenção, EAP prev×exec×saldo com aditivos. `hub_diario_rdo` não existe; migração `curva_s` é FILE-ONLY.
   É o insumo de evidência do Portal (F7).
3. **EVT-01 + marketing:** analytics sobre hub_eventos, **UTM na captação**, CAC por mercado/bairro, cron de KPIs, Meta
   Lead Ads + landing/forms públicos. **Cada lead que entra hoje sem UTM = CAC irrecuperável.**
4. **RAS-05 (MDO fonte única) + `hub_obra_alocacoes`** (quem executou qual obra) — classe da linhagem (irrecuperável); a
   S1 cria "freelance/diária" tocando MDO sem a fonte existir.
5. **Módulo Arquitetura além do funil** (ficha/briefing, aprovações do cliente, honorário, tela v2 — spec paga existe).
   ARQ é 1 dos 6 mercados; só o funil entrou.
6. **Fechos P0 de operação do CRM** (próxima-ação obrigatória, follow-up por prazo, alerta de parado) — o próprio
   rastreador marca P0; são os loops de hábito diário.

**MÉDIAS (8):** OBR-02 (medição atômica via RPC — a S10 pendura dinheiro nela sem transação) · RAS-02 (auto-código por
trigger + contador por-tenant; TEN-01 depende) · **bugs de produção nomeados** (Precificação sobrescreve a cobrança da
rede = dinheiro; custo sem vínculo zera cobertura; ambiente Sala/sala quebra subtotal) · 6 migrações órfãs (N1 trava
salvar Negócio, anti-recebível-dup, quem-deu-baixa, CPF especialista, tenant em hub_leads_crm, merge com backup) · **drop
das 3 RPCs de hard-delete dormentes** (arma carregada contra "nunca apaga") · BI generativo · PII no histórico do Git ·
escala horizontal (dedup distribuído — 2 réplicas duplicam compra) · 2FA · Onda C self-service · dedup por documento
CPF/CNPJ · **seed do catálogo** (S1 cria hub_produtos VAZIO; balcão S5 e roleplay S7 cotam sobre vazio) · reset de senha.

**RITMO (as 5 auditorias em coro):** Semanas 8-12 carregam TODA a Fase 3 em 5 semanas sem folga; a S10 tem 4 frentes; a
S1 depende de 5 gates seus. **Não por acaso, os itens do MVP antigo que sumiram (EVT-01, RAS-05, OBR-02) são os que não
couberam aí** — é corte por falta de espaço, não decisão consciente.

---

## Ação desta madrugada (feito) + o que ratificar ao voltar
- ✅ Veredito completo gravado (este doc). · ✅ **Captura no CRONOGRAMA-UNICO** (seção nova no fim): os 24 nomes dobrados
  no **estacionamento** e nas **linhas novas de V1 (F5/F6/F7/F8)** — "nada se perde" virou verdade. · ✅ TEN-03 devolvido
  à lista do F5.
- ⏳ **Ratificar ao voltar (NÃO mexi no MVP sozinho):** as **propostas de troca 1-por-1** nas 12 semanas (UTM na captação,
  alocação MDO mínima, OBR-02 no vagão da S4, seed do catálogo dentro de compras, config de senha, bugs de dinheiro) — e
  agendar a mesa de **Levantamentos+Orçamentos** (a única com pressa — o coração já herda a unidade da planilha).

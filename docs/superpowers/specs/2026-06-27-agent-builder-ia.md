# 🛠️ Agent Builder por IA — descreve (texto/PDF/áudio) → IA monta o playbook + regras

> Spec + plano (mesa redonda de 5 lentes com auditoria meticulosa do código + dogfooding hands-on do wizard). 27/jun/2026. Conecta [[visao-ia-first-comando-multimodal]], [[agentes-ia-audit-redesign]], [[creditos-ia-metering-visao]].

## A virada de valor
Hoje, criar o playbook de um agente exige escolher cargo do catálogo OU subir um `.md`. A virada: o dono **descreve em palavras** (ou PDF, ou áudio) como quer que o agente atenda → a IA **monta o playbook (fluxo) + regras (tom, o que coletar, pode/não-pode)** → ele revisa, ajusta e publica. "Descrevi e a IA montou a Mari."

## Dogfooding hands-on do wizard (criei "SDR Teste Dogfood" pela tela) — fricções achadas
- **8 passos é MUITO** pra criar um agente (Cargo→Identidade→Personalidade→Documentos→Revisão→Ferramentas→Materiais→Canal) — intimida. Candidato a reduzir/reagrupar.
- **Mercados são siglas crípticas** (IMB/ARQ/RFM/MRC/ENG/SRV/PRO/FOR) — o dono não sabe o que são. → rótulos legíveis.
- **Bug de glyph:** o checkmark dos passos concluídos e o "Fixo do cargo" renderizam truncados ("—S"/"—x"). → corrigir o ícone.
- **Card do agente (lista)** só tem ligar/excluir — falta **Editar** e **Conversar/testar** óbvios.
- ✅ **Funcionando bem (minhas mudanças):** Personalidade = matriz **5×5** (Comportamento×Conduta) + passo **Modelo** (Econômico/Turbo/Turbo-alto-valor) + preview do RESULTADO. Confirmado ao vivo.
- **O grande gap = este feature:** não há "descreva e a IA monta". Hoje é catálogo ou upload de markdown.

## Auditoria do que JÁ existe (mesa redonda, fiel ao código) — só 1 peça é nova
| Área | Já existe (reuso) | Falta |
|---|---|---|
| Schema do fluxo | `lib/playbook/flow-definition-types.ts` (PlaybookFlowDefinition, 4 kinds) | embutir no prompt (não o template inteiro) |
| Parse + validação | `flow-parse.ts` + `flow-validate.ts` (erros pt-BR) | só chamar no pipeline |
| Montagem markdown + fallback | `playbook-flow-markdown.ts` + `ensureMarkdownWithWhatsappFlow` | reuso direto |
| **Gerador descrição→playbook** | precedente `sugerir-cargo-catalogo.ts` | **`gerar-fluxo-ia.ts` + endpoint (ÚNICO novo)** |
| PDF | `extrairTextoDocumentoRag` | só decodificar buffer |
| Áudio | `mistralTranscreverAudioUrl` | precisa URL pública (subir ao Storage) |
| Persistir/publicar/cache | `PUT /playbook/conteudo` já valida+salva+invalida cache | zero código novo |
| Análise de qualidade | `analyzePlaybookWithMistral` + `/playbook/analisar` | disparar automático |
| Refino conversacional | `calibracao-chat` + `briefing-flow-simulator` | reusar (não fazer editor novo) |
| Metering Tijolos | `registrarConsumoIA` | chamar por fase |
| UI | `PlaybookUploadAnalisePanel` (upload+análise+nota) no wizard | add aba "Gerar com IA" |

## Workflow (ótica do dono)
1. Na criação/edição do agente, passo de playbook: aba **"Gerar com IA"** já selecionada (ao lado de "Carregar .md").
2. Caixa de texto grande + **3 chips de exemplo** (SDR de obra, Recepção de arquitetura, Pós-venda) que pré-preenchem (Click-and-Go contra a folha em branco).
3. Descreve (tom, o que coletar, pode/não-pode) → **"Gerar playbook com IA"** (✨).
4. Estado de geração com **progresso por etapa** ("Lendo… Montando identidade… Definindo triagem… Revisando regras…").
5. Recebe **rascunho em cards por seção** (Identidade, Tom, Triagem, Qualificação, Regras), em linguagem natural; JSON técnico sob toggle "Ver estrutura técnica".
6. **Nota de qualidade (0-10)** automática ao lado (verde se boa, atenção+sugestões se fraca).
7. Ajusta: edita nos cards OU "O que mudar?" + Regenerar OU chat de calibração; pode **"Simular atendimento"** antes de publicar.
8. **"Confirmar e publicar"** → valida, salva, invalida cache; a Mari já usa no próximo atendimento. *(Fase 2: PDF/DOCX; Fase 3: áudio.)*

## Fases
- **Fase 1 — MVP (texto → playbook + regras):** NOVOS `lib/playbook/gerar-fluxo-ia.ts` (2 fases: narrativa temp~0.4 → JSON do fluxo temp~0.2; system prompt com o schema comentado + mini-exemplo de 6 steps/4 kinds), `app/api/hub/agentes/[slug]/playbook/gerar-por-ia/route.ts` (espelha `cargos/sugerir`; service-role; checa agente↔tenant; devolve {markdown, flowDefinition, regras, analise, avisos} SEM persistir), `gerar-fluxo-ia.test.ts`. Pipeline parse→validate→**auto-fix** (2 tentativas, 2ª em Claude)→fallback template. UI aditiva (aba "Gerar com IA"). Publicar via PUT `/playbook/conteudo` existente. registrarConsumoIA por fase. **Risco médio.**
- **Fase 2 — PDF/DOCX:** endpoint aceita pdfBase64 → `extrairTextoDocumentoRag` → mesmo motor. **Risco baixo.**
- **Fase 3 — Áudio:** subir ao Storage → URL pública → `mistralTranscreverAudioUrl` → confirmar transcrição → mesmo motor. Anti-SSRF (validar domínio). **Risco alto.**
- **Fase 4 — Instrumentação** (hub_eventos: % criados via IA, regenerações, tempo<3min) + endurecimento opcional. **Risco baixo.**

## Riscos & mitigações (resumo)
- **JSON inválido do LLM (~20-30% em flows com IDs cross-ref):** 2 fases + parse/validate imediato + auto-fix com errors[] + fallback template → dono nunca fica sem playbook.
- **Inflar escopo:** travar Fase 1 em 1 textarea + 1 botão + reuso; PDF/áudio são fases posteriores.
- **JSON válido mas ruim semanticamente:** Revisão legível + nota + "Simular atendimento".
- **Multi-tenant (endpoints service-role):** checar agente↔tenant EXPLICITAMENTE.
- **Áudio/Storage + SSRF; PDF-imagem vazio:** tratados nas fases 2/3.

## Régua
A IA **sugere, o dono confirma** — nunca publica sozinha. MVP = 1 lib + 1 endpoint + 1 bloco de UI; todo o resto é reuso. Aditivo, com gates, sem migração.

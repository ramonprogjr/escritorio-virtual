# PLANO DE GO-LIVE — Mari no WhatsApp (atendimento IA)

> Fonte: mesa redonda (Fable + agentes, verificação adversarial) lendo o **código e o banco reais** (não docs). 09/jul/2026.
> Ressalva: 4 dos 6 agentes de descoberta caíram por sobrecarga da API (529); a verificação adversarial cobriu as dimensões críticas (pausa/handoff, cadastro, editor de fluxo, mídia, só-novos), então o veredito abaixo está fundamentado — mas as dimensões "agentes/Mari" e "mídia" merecem uma 2ª passada quando a API estabilizar.

## Resumo em 1 linha
A máquina **existe e é mais real do que se esperava** (construtor de fluxos tipo n8n e handoff por lead **funcionam de verdade**), mas a **pausa do painel é fachada**, **mídia (áudio/foto) é fachada**, e **religar o webhook como está = responder cliente errado**. Com 5 correções cirúrgicas (esforço P), dá pra ligar amanhã com segurança **honesta — controlada e reversível em 1 clique**, não perfeita.

## O que é REAL (reaproveitar)
- **Construtor de fluxos PDF/voz/texto → nós editáveis (n8n simplificado):** wired ponta a ponta. Upload PDF/DOCX + gravação de voz → Mistral gera o fluxo (6 tipos de nó: mensagem, formulário, múltipla escolha, PDF, áudio, handoff); editor visual com nós arrastáveis (`@xyflow/react`); o fluxo **atende de verdade** no WhatsApp. Arquivos: `AgenteBuilderIaPanel.tsx`, `playbook/gerar-por-ia/route.ts`, `gerar-fluxo-ia.ts`, `playbook-flow-visual/FlowCanvas.tsx`, `playbook-flow-maria.ts`.
- **Handoff humano (pausa por lead) — CONFIÁVEL:** `hub_leads_crm.humano_responsavel` é o gate real (`inbound-message-processor.ts:146-174`). Setado pelo botão "assumir" **e automaticamente quando o dono responde pelo celular** (`human-handoff-from-device.ts`). O worker re-lê fresco antes de processar (robusto contra corrida). **Regra de ouro operacional: respondeu pelo celular = Mari cala naquele lead.**
- **Cadastro automático de lead + funil:** inbound novo cria pessoa+lead com pipeline/estágio; 9 pipelines seedados; menus/múltipla escolha rodam.
- **Direcionamento IA → parceiros:** o motor existe (`sugerir-encaminhamento-auto.ts` → candidatos por mercado/cidade, top 5, cria encaminhamento) + UI de confirmar/manual (`DirecionarLeadDrawer.tsx`). "Não funciona" ≈ faltam **escritórios cadastrados como parceiros** (`hub_parceiros`) com `mercado=arquitetura`+região homologada.

## O que é FACHADA / QUEBRADO (honesto)
- **"Pausar a IA" do painel NÃO pausa** (`ia_whatsapp_pausada` e `hub_conversas.ia_ativa` = 0 referências no processador). A única pausa global hoje é o **webhook desligado**.
- **"Só leads novos" NÃO existe:** cliente ativo que não está no CRM entra como `isNovo=true` → indistinguível de lead novo → a IA responde.
- **Mídia = só texto:** áudio chega como `"[audio recebido]"` (código de transcrição existe mas é *dead code*); foto = zero visão/OCR. Lead manda áudio → Mari responde fora de contexto.
- **Dedup frágil:** sem normalizar DDI/9º dígito, sem UNIQUE em telefone → duplicatas + risco de responder cliente errado.
- **Mercado quase sempre vira "IMB"** na ficha; **"editar fluxo por voz" não existe** (voz só gera fluxo novo).

## Decisão nº 1 do dono: NÚMERO NOVO ou ATUAL?
- **Cenário A — número NOVO só pra captação (RECOMENDADO, ~1h):** clientes ativos ficam **fisicamente fora do alcance** da Mari. Elimina ~80% do risco de uma vez. Dono conecta um chip novo na UAZAPI; eu faço smoke test; liga.
- **Cenário B — número atual:** exige as 5 correções cirúrgicas abaixo **+ a lista dos telefones dos clientes ativos** (pra semear como bloqueados).

## Plano Cenário B — 5 correções cirúrgicas (esforço P, hoje)
1. **Trava allowlist temporal no webhook:** IA só responde se o lead nasceu **após `IA_GOLIVE_AT`** E `humano_responsavel` vazio. Quem já falou antes = silêncio total.
2. **Semear clientes ativos** em `hub_leads_crm` com `humano_responsavel='dono'` (precisa da lista do dono).
3. **Dedup tolerante:** usar `telefonesConversaEquivalentes` (já existe) no lookup + checar `.error`.
4. **Guard-rail de mídia:** áudio/foto → resposta fixa educada ("recebi seu áudio, pode escrever em texto?"), não manda placeholder pro LLM.
5. **Botão de pânico REAL:** processador passa a ler um flag global de pausa (ressuscitar `ia_whatsapp_pausada` com leitura real no gate). O botão do painel passa a pausar de verdade.
→ Deploy → smoke test comigo → só então ligar o webhook.

## Roadmap da visão completa (reaproveitar × construir)
| Item | Base | Falta | Esforço |
|---|---|---|---|
| PDF→fluxo editável | pronto | OCR p/ PDF escaneado; confirmar flag no build | P/M |
| Editar fluxo por VOZ | transcrição + edit por patch existem | ponte voz→intenção→patch no nó | M |
| Áudio inbound | `enriquecerMensagemInboundAudio` pronto (sem chamador) | ligar 1 chamada no worker | **P** |
| Foto inbound (visão) | nada | download UAZAPI + modelo multimodal (pixtral) | M |
| Menu reclassifica mercado | menus rodam | escolha atualizar mercado/pipeline na ficha | **P** |
| Follow-up automático | fila+worker existem | scheduler de re-contato | M |
| Pausa por lista/etiqueta WhatsApp | nada | sync labels UAZAPI → deny-list | M |
| Direcionamento arquitetura | motor pronto | cadastrar/homologar escritórios como parceiros | **P** |
| Dedup canônico definitivo | função existe | migração UNIQUE telefone (janela) | M |

Ordem pós-go-live: áudio inbound (P) → menu reclassifica mercado (P) → direcionamento (P) → follow-up (M) → voz (M) → foto (M).

## Precisa do dono (bloqueante)
1. **Número novo ou atual?** (Cenário A vs B)
2. **Lista de telefones dos clientes ativos** (obrigatória no Cenário B)
3. Confirmar `MISTRAL_API_KEY` viva no Render
4. Ligar o webhook só após o meu OK no smoke test

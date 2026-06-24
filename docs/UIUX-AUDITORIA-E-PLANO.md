# Auditoria de UI/UX & Plano de Implementação — Plataforma Obra10+

> **Objetivo.** Auditar o plano da v2 ([INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md](INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md)) pela lente da **usabilidade** e definir COMO implementar a interface. Princípio do cliente: **preencher tudo deve ser fácil — conversacional, por múltipla escolha e automatizado.** Dois trilhos: **Click-and-Go** (toque) e **Talk-and-Go** (voz). Digitar é o último recurso.
>
> **Status:** v1 — 2026-06-24. Lente UX-director + Taste aplicada sobre a spec v2. Respeita o **design system Obra10+** (dark verde+dourado tokenizado; **não** azul/Shadcn).

---

## 1. Princípio de usabilidade (o norte de toda tela)

> **O usuário escolhe e confirma — quase nunca digita.** Cada campo deve poder ser preenchido por **(a) toque em opção** (chip/múltipla escolha), **(b) voz** (fala → IA transcreve e preenche), ou **(c) digitação** (fallback). O default visível é escolha/voz. A IA **pré-preenche com origem + confiança**; o humano **confirma com 1 toque**.

Três mandamentos:
1. **Click-and-Go** — qualquer ação principal em ≤2 toques; nada de formulário-labirinto.
2. **Talk-and-Go** — um botão de microfone onipresente cria/preenche/move por voz ("novo lead, reforma, Vila Mariana, 120 mil" → cria o lead com campos preenchidos para confirmar).
3. **A IA faz o trabalho chato** — busca, dedup, classificação, próxima-ação, resumo. O humano decide, não data-entra.

---

## 2. Os 3 modos de entrada (todo campo suporta)

| Modo | Como funciona | Quando é o default |
|------|---------------|--------------------|
| **Múltipla escolha (chips)** | opções tocáveis (mercado, etapa, tipo, UF, faixa de valor) | campos categóricos — **maioria** |
| **Voz (Talk-and-Go)** | microfone → transcrição → IA distribui nos campos → confirma | criação rápida, campo, mãos ocupadas |
| **Digitação** | teclado | nomes, valores livres, fallback |

- **Faixas em vez de número exato** quando possível (ticket: <50k · 50–120k · 120–300k · 300k+) — escolha, não digitação.
- **Autocomplete agressivo** em vínculos (Pessoa/Empresa/Imóvel) com criar-no-lugar.
- **"Completar depois"** em tudo que não trava o salvamento (rascunho contínuo).

---

## 3. Auditoria do plano v2 (heurística de usabilidade)

### ✅ Pontos fortes do plano
- **Faseamento manual-first** protege a usabilidade (não há "IA tapando buraco de UX").
- **Imóvel central** dá uma âncora de navegação natural (ficha-360 = menos telas soltas).
- **Códigos curtos** (PS2026001) são escaneáveis — bom para reconhecimento.
- **Ficha do negócio já tem** próxima-ação auto-save + nota inline → padrão certo a replicar.

### ⚠️ Riscos de usabilidade detectados (e mitigação)
| # | Risco | Onde | Mitigação |
|---|------|------|-----------|
| R1 | **Menu sobrecarregado** — 9 grupos × até 9 itens = 60+ destinos | §8 do menu | **Disclosure progressivo**: mostrar por papel + plano; grupos colapsados; "favoritos"; busca/command-bar (Ctrl/voz) |
| R2 | **Wizard de obra longo** (5 passos × muitos campos) | Gestão de Obra | cada passo **click/talk**; só Eng. responsável é obrigatório; resto "completar na obra"; barra de progresso + salvar-e-sair |
| R3 | **Cadastros ricos viram formulário-labirinto** | Pessoa/Empresa/Imóvel/Negócio | **Smart Field** (chip+voz+texto); campos avançados escondidos atrás de "mais detalhes"; IA pré-preenche |
| R4 | **Distribuição manual cansa o Hub** | Motor de leads | tela de fila com **cartão de recomendação** (top-3 fornecedores + score) → 1 toque "direcionar"; lote |
| R5 | **Dashboard genérico** ("vanity metrics") | Hub | só **dados acionáveis** (§5 abaixo): o que exige ação hoje, não números bonitos |
| R6 | **Mobile tratado como desktop encolhido** | tudo | mobile = **campo** (voz/foto/evidência, ações grandes); desktop = gestão/aprovação |
| R7 | **Confiança da IA invisível** | campos auto | **badge de confiança** (alta/média/baixa) + toque para corrigir; nunca gravar derivado sem confirmar |

---

## 4. Padrões de UI por tipo de tela

- **Cadastro (Pessoa/Empresa/Imóvel/Negócio):** topo = **Smart Field** + microfone; corpo = chips de múltipla escolha; "mais detalhes" recolhido; rodapé = **Salvar** sempre ativo (rascunho). IA preenche e marca confiança.
- **Lista (Pessoas/Negócios/Imóveis):** colunas customizáveis (já existe), busca instantânea, **quick-add** (+ flutuante com voz), ações em lote.
- **Pipeline / Kanban:** arrastar entre etapas; cartão com próxima-ação + selo de SLA; quick-actions no hover/long-press.
- **Inbox / Atendimento:** respostas rápidas sugeridas pela IA; converter conversa → lead/negócio em 1 toque.
- **Fila de distribuição (Hub):** cartão do lead + **top-3 fornecedores recomendados (score visível)** → "Direcionar" 1 toque ou "Automático".
- **Wizard de obra:** 2 cartões grandes nos forks (Construção/Reforma, Com/Sem projeto); cada passo click/talk; IA extrai do projeto em background sem travar a tela.
- **Avanço & Medição (desktop):** tabela por item com evidência; "fiscal de evidências" destaca o que falta; gates claros (rascunho→técnico→cliente→financeiro).

---

## 5. Dashboard do Hub — "dados úteis" + controle total

O cliente pediu **total controle + dashboard com dados úteis**. Regra: **só entra no dashboard o que pede uma decisão/ação.**

**Cards acionáveis (ordem de prioridade):**
1. **Leads aguardando direcionamento** (nº + botão "distribuir") — o gargalo.
2. **SLA estourando / estourado** (fornecedores que não responderam no prazo) → redistribuir.
3. **Ranking de fornecedores** (conversão, tempo de resposta, qualidade) — clicável p/ drill.
4. **Funil global** (leads→negócios→ganhos por mercado) — onde trava.
5. **Obras em risco** (atraso previsto pelo ritmo, marco em risco).
6. **Financeiro** (a receber, retenção a liberar, medições paradas em aprovação).
7. **Leads sem resposta há X** → ação de cobrança/redistribuição.

**Comportamento:** todo card é **clicável** (drill até o fornecedor/lead/obra). **Controle total:** o Hub abre qualquer fornecedor e vê tudo (§5 da spec). **[FUTURO]** os relatórios/insights mais profundos são **generativos sob demanda** pela IA (Bloco H) — o dashboard nasce com cards fixos úteis; a IA pluga depois para perguntas livres ("qual fornecedor converte mais em obras > R$100k?").

---

## 6. Componentes-chave a construir (base do design system)

| Componente | O que é | Reuso |
|-----------|---------|-------|
| **SmartField** | input híbrido: chip/múltipla escolha + microfone + texto, com badge de confiança | todos os cadastros e o wizard |
| **CommandBar (Talk/Type-and-Go)** | barra global (atalho + voz): "criar/ mover/ buscar/ direcionar" | toda a plataforma |
| **ConfidenceBadge** | alta/média/baixa + origem (arquivo/IA) + toque p/ corrigir | campos derivados por IA |
| **QuickAdd (FAB)** | botão flutuante "+" com voz para criar lead/negócio/tarefa | listas e mobile |
| **RecommendationCard** | lead + top-3 fornecedores (score) + "Direcionar"/"Automático" | fila de distribuição |
| **BottomSheet mobile** | ações grandes, foto/voz/evidência | campo (obra/atendimento) |
| **EvidenceCapture** | foto/medição/doc com 2 toques, datado e vinculado | obra/medição |

Tokens e estética já existem (`globals.css`, `--obra-*`/`--brand-*`): dark, verde #003b26, dourado #c9a24a. **Manter**; só criar os componentes acima sobre eles.

---

## 7. Acessibilidade & responsividade
- **Mobile = campo:** alvos de toque grandes, voz e foto em destaque, fluxo de 1 mão; ações pesadas (montar boletim, editar escopo) ficam no desktop.
- **Contraste** no tema dark (texto #e6edf3 / muted #8b949e) — validar AA.
- **Voz com fallback** sempre (nem todo ambiente permite falar).
- **Teclado/leitor de tela** nos formulários (a base é HTML semântico).

---

## 8. Plano de implementação da UI (mapeado à ordem de dev da spec §13)

| Onda | Entrega de UI | Depende de |
|------|---------------|-----------|
| **U1 — agora** | **Menu lateral** (árvore §8 da spec) com disclosure por papel/plano + **CommandBar** (atalho; voz vem depois) | design system (existe) |
| **U2** | **SmartField + ConfidenceBadge + QuickAdd**; aplicar nos cadastros (Pessoa/Empresa/Imóvel/Negócio) — fichas Pipedrive | U1 |
| **U3** | **Pipeline/Kanban** customizável + cartões com SLA; **Inbox** com respostas sugeridas | U2 |
| **U4** | **Fila de distribuição** + RecommendationCard; **Dashboard do Hub** (cards acionáveis §5) | motor de score |
| **U5** | **Wizard de obra** (click/talk) + telas de Escopo/Cronograma/Medição com EvidenceCapture | gestão de obra |
| **U6 — [FUTURO]** | **Talk-and-Go pleno** (voz preenche tudo) + relatórios generativos | IA/Bloco H |

> Voz (Talk-and-Go) entra **incremental**: o componente já nasce com o botão de microfone em U2, mas o preenchimento por voz "de verdade" amadurece com a IA (U6). Até lá, **Click-and-Go** (múltipla escolha) carrega a usabilidade.

---

## 9. Decisões de UX em aberto (resolver com o Wendel)
1. **Voz:** transcrição no dispositivo ou via serviço? (custo + privacidade) — afeta quando o Talk-and-Go fica "real".
2. **Faixas vs. valores exatos** nos campos financeiros do comercial (escolha-primeiro?).
3. **Densidade do dashboard** do Hub: 5 cards essenciais ou 7+? (sugiro começar com os 5 primeiros do §5).
4. **Onboarding do usuário** novo (membro recém-elegível): tour guiado ou aprender-fazendo?

---

### Resumo em uma frase
A interface é construída para **escolher e confirmar, não digitar**: **Click-and-Go** (múltipla escolha) carrega o dia a dia agora, **Talk-and-Go** (voz) entra incremental, a **IA pré-preenche com confiança visível**, e o **Dashboard do Hub** mostra só o que exige ação — dando ao Hub o **controle total** sobre uma rede onde cada fornecedor vê apenas o que é seu.

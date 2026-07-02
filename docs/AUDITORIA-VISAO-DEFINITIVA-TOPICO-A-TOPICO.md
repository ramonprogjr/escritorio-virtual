# 🔍 Auditoria da Visão Definitiva — tópico a tópico (mesa redonda)

> Resultado bruto da mesa redonda (5 blocos, `wf_f0af4e81-420`) sobre `VISAO-DEFINITIVA-SISTEMA-USUARIO-TELA-IA.md`. Cada tópico: **veredito** (manter/melhorar/cortar/depende), **prioridade**, o que **já existe**, e a **melhoria do CEO**. A síntese/roadmap está em `ROADMAP-VISAO-DEFINITIVA-MODULOS.md`.
>
> Legenda: 🟢 manter · 🟡 melhorar · 🔴 cortar · 🔵 depende

## Bloco 1 — Personas, Lentes, Permissões (§5, §7, §8, §17)
| Tópico | Veredito | Prio | Já existe | Melhoria do CEO |
|---|---|---|---|---|
| 11 personas do dono | 🟡 | P1 | RBAC 5 níveis (owner/gestor/comercial/financeiro/atendente)+parceiro | Colapsar 11→7 papéis-raiz + 2 EIXOS: nível(rank)×função-AEC(capability). Evita combinatória 11×N |
| Lente por papel (hoje é de rota) | 🟡 | P1 | Lente de menu+rota+ação (crm-permissoes, sem drift) | Falta lente de CAMPO (esconder custo/margem no servidor). Lente = {telas}+{capabilities}+{campos mascarados} |
| RBAC atual vs personas AEC | 🟡 | P1 | 5 níveis + ROTA_ROLES_EXATAS, testado | NÃO add níveis; add 2º eixo função (arq/eng/campo/compras) como capability |
| Início por perfil (§7) | 🟡 | P1 | Só atendente bifurca; Dashboard comercial-cêntrico | 1 Início COMPONÍVEL por capability (blocos condicionais), não 11 dashboards |
| **Tela "Hoje" (§8)** — a mais importante | 🟡 | **P0** | Embrião `CrmOQuePrecisaDeVoce` (agrega por regra, comercial-only) | Promover a ROTA universal; cada módulo REGISTRA pendências; zero tabela nova |
| +Novo contextual (§9) | 🟢 | P2 | `CrmQuickAdd` (4 ações, deep-link, role-filtered) | Manter regra de ouro: só add ação quando tela-destino existir |
| **Permissões §17 + risco §20** | 🟡 | **P0** | RBAC prova que dá lente sem duplicar (5 papéis, mesmas telas) | **TRAVAR diretriz: tela por OBJETO, persona = LENTE.** Ataca o maior risco do produto |
| Personas externas (cliente/prestador/campo) | 🔵 | P1 | Portal parceiro (token) = embrião reusável; portal cliente só desenhado | Priorizar CLIENTE (moat de confiança) reusando token + lente de campo. Não 3 portais de uma vez |

## Bloco 2 — Áreas e Conexões (§3, §4, §19)
| Tópico | Veredito | Prio | Já existe | Melhoria do CEO |
|---|---|---|---|---|
| Área 1 — Arquitetura | 🟢 | P1 | hub_projetos+fases, fila SLA, gerar-obra c/ EAP-semente | Fazer o quantitativo/memorial descer como lista preliminar de compras (fecha arq→produtos) |
| **Área 2 — Engenharia (a joia)** | 🟢 | **P0** | Átomo COMPLETO: escopo→SC→estoque→medição→financeiro→curva-S | **Promover a "unidade de execução universal"** e reusar (não copiar) — maior ROI |
| Área 3 — Serviços (o buraco) | 🟡 | P1 | Só tabelas-casca; sem tela, sem ciclo | Serviço = instância LEVE do átomo (1 frente, sem curva-S). Não 4 módulos paralelos |
| Área 4 — Produtos | 🟡 | P1 | hub_catalogo (API), estoque só por obra | Tela Produtos + ficha (onde usado/preço/obras); estoque global = LENTE, não tabela |
| Caminho 1 — arq→eng (referência) | 🟢 | P0 | gerar-obra: gate server + idempotência + linhagem + tenant-guard | **É o molde canônico** — caminhos 2/4 devem COPIAR, não reinventar |
| Caminho 2 — eng→arq | 🟡 | P2 | Restrição 'virou_pendencia'+slot; fila do arquiteto | Add acao 'revisar_projeto' → pendência na fila → revisão reabre item. Pequeno, aditivo |
| Caminho 3 — eng→produtos | 🟢 | P1 | restrição(material)→SC rascunho→estoque libera (E3→E5) | Falta o GATILHO preditivo (data×estoque×lead-time). Mostrar na tela Hoje |
| Caminho 4 — serviço→produtos | 🟡 | P2 | Cadeia igual já existe na obra (E5) | Herda de graça quando Serviço for instância do átomo. Dependente |
| Caminho 5 — produto→eng/serviços (moat) | 🟡 | P1 | catálogo→SC→estoque→custo real existe na obra | Falta histórico consumo→previsão. Determinístico antes de ML |
| **§19 — 14 telas essenciais** | 🟡 | **P0** | 7/14 sólidas (Início/Projetos/Obras/Pessoas/Fornec/Financeiro/Relatórios) | Faltam: **Hoje**(❌ keystone), Serviços, Produtos, Estoque-global, Compras-cockpit, Documentos, IA-central |
| **Spawn mágico ganho→obra AINDA VIVO** | 🟡 | **P0** | PATCH etapa→ganho auto-insere obra REAL sem confirmação | Trocar por propor+confirmar. **Fere premissa 4 + decisão travada; bloqueia dado real** |

## Bloco 3 — IA-Coordenadora e Voz (§2, §10, §11, §22)
| Tópico | Veredito | Prio | Já existe | Melhoria do CEO |
|---|---|---|---|---|
| §10 — "Perguntar à IA" cria AÇÃO | 🟢 | P0 | Copiloto de Voz completo (interpretar→propõe HMAC / executar revalida) | Fundar, não reconstruir. FAB é superior à barra fixa no mobile |
| Allowlist + zero spawn mágico | 🟢 | P0 | Allowlist estrita no código; escrow/aprovação nunca por voz; auditado | Manter no CÓDIGO (config em banco = forjável). "Irreversível-para-fora" fica fora da voz |
| Pipeline de voz | 🟢 | P0 | Web Speech + fallback Voxtral/Groq; rate-limit; fail-closed HMAC | **Ligar a chave e testar ao vivo no device do dono** (saldo Tijolos não pode zerar) |
| §2 — 3 cliques / Talk-and-Go | 🟡 | P1 | Copiloto colapsa criar obra/SC/avanço em 1 comando+1 confirmar | Unificar +Novo contextual E copiloto na MESMA allowlist e MESMA confirmação |
| §11.1 — IA LEMBRA | 🟡 | P1 | Memória por lead/agente; hub_eventos append-only | Recall cross-entidade navegando o CÓDIGO-FIO (ator_id do Tier 0), não tabela paralela |
| §11.2 — IA COBRA | 🟡 | P1 | Ciclos comerciais (dispatch+SLA); hub_obra_hoje cruza dados | 1 ciclo "coordenador de obra" que ENFILEIRA no Gestor de Tarefas + Aprovações (PUSH, não PULL) |
| §11.3 — IA PROTEGE (o mais forte) | 🟢 | P0 | Central Aprovações (2 autoridades), escrow, imutabilidade, dedup | Padrão-ouro. Só destravar escrow (janela do dono) + RLS tenant-scope antes da rede |
| §11.4 — IA MEDE | 🔵 | P2 | Curva-S, medição, financeiro-resumo, metering | NÃO dashboard novo. Expor métricas como ferramenta de LEITURA do copiloto |
| **§11.5/6 — PREVÊ/ORIENTA (o moat)** | 🟡 | P1 | hub_obra_hoje = embrião de cruzamento; tudo reativo hoje | Construir SOBRE o Tier 0; começar por REGRAS determinísticas. **Último** — precisa dado real |
| §22 — comportamento da IA | 🟢 | P0 | Confiança<0.7, "não invente", fail-closed, fallback 3 provedores | Calibrar o prompt com comandos reais do dono ao ligar a chave |
| §19 — tela "IA" central | 🟡 | P2 | Copiloto FAB+painel+histórico | Transformar /historico numa tela leve (mesmo motor, zero backend novo) |

## Bloco 4 — Segmentos (§6.3–6.7)
| Tópico | Veredito | Prio | Já existe | Melhoria do CEO |
|---|---|---|---|---|
| **Decisão-mãe: 1 serviço universal vs N tabelas** | 🟡 | **P0** | esteira ENTREGA_POR_MERCADO roteia p/ hub_marcenaria/vidracaria (FANTASMA) | **Convergir no spine** (hub_obras/itens); ofício = DADO. Aposentar tabelas-fantasma antes de dado real |
| **Motor de template por ofício** | 🟡 | **P0** | Mecanismo pronto no e0b (hub_eap_presets + taxonomia) | Add dimensão OFÍCIO + atributos + guardrails de IA como DADO. **Único build novo — destrava todos** |
| §6.3 Marcenaria | 🟢 | P1 | Mercado MRC + pipeline 10 estágios; tabela fantasma | Template sobre o spine; produção off-site = frente c/ diário; ferragens via taxonomia |
| §6.4 Vidraçaria (guardrail espessura) | 🟡 | P1 | Quase nada (nem no picker) | Guardrail "sem foto+espessura → orçamento travado" como REGRA DE TEMPLATE. Protótipo de todos os bloqueios |
| §6.5 Serralheria | 🔵 | P2 | Nada | Não é módulo — template com etapa "fabricação+acabamento". Sob demanda |
| **§6.6 Pintura** | 🔴 | P2 | **JÁ é disciplina no EAP** (PINT-* na taxonomia) | **NÃO é segmento.** Sub-escopo de obra (frente) OU execução avulsa de 1 frente. Zero módulo |
| §6.7 Empreiteira | 🟢 | P1 | O mais pronto: medição E7c + escrow E6 + contratos | **É papel/contrato**, não módulo. Ligar escrow fecha "pagamento por etapa com evidência". Maior ROI/esforço |
| Priorização p/ o dono | 🔵 | P1 | Obra/reforma + arquitetura já têm execução real | Ordem: motor template → empreiteira → marcenaria+vidraçaria → serralheria/pintura sob demanda |

## Bloco 5 — Telas, Rigidez, Molde (§9, §12, §13-16, §18)
| Tópico | Veredito | Prio | Já existe | Melhoria do CEO |
|---|---|---|---|---|
| §9 — +Novo contextual | 🟡 | P1 | FAB 4 ações FIXAS, context-BLIND | Ler CrmShellContext + anexar contexto ao deep-link (obra já pré-vincula). Camada fina, não engine gigante |
| Engine de contexto | 🟡 | P1 | Criação context-aware espalhada (props caso a caso) | Extrair `useContextoCriacao()` — 1 fonte de contexto; linhagem carimbada num lugar só |
| §12 — Rigidez invisível | 🟢 | P1 | PROVA VIVA em ObraItensSecao (situação auto×andamento, 5 bloqueios) | Extrair como KIT nomeado (SeloSituacao+ChipAndamento+Bloqueios); serviço/campo herdam |
| §13-16 — Fluxos 3-cliques | 🔵 | P1 | Eng/Arq têm (wizard, medir, compras); Serviço não | Priorizar SERVIÇO UNIVERSAL como próximo molde; 1 fluxo + preset por segmento |
| §18 — "nenhuma tela é só cadastro" | 🟡 | P1 | Metade: onde-usado + histórico existem | Falta camada prescritiva: completude/próximo-passo/risco. 1 componente `FichaContextoStrip` reusável |
| **Molde reusável (shell)** | 🟢 | **P0** | `CadastroPremiumSideover` já é shell de NovaObra/GerarObra/fichas | **Formalizar KIT DE TELA versionado** (shell+ficha+rigidez+contexto). Toda tela nova nasce dele |

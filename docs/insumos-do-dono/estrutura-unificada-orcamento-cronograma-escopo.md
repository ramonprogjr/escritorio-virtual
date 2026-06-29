# ⭐ A ESTRUTURA UNIFICADA — orçamento = cronograma = gestão = escopo (insumo do dono, 29/jun)

> A chave-mestra da camada AEC. Uma ÚNICA estrutura organiza orçamento, cronograma, gestão E define o escopo. Liga [[eap-ambiente-orcamento-ia]] (E0.5 taxonomia), [[spec-gestao-obras-engenharia]], a planilha real ([[planilha real do dono]]), E4 (cronograma) e o Orçamento IA. **Planilha real do dono:** https://docs.google.com/spreadsheets/d/1KOPhfX8HXk_tOJwigbstCgEzkKHxU7sG/edit (orçamento — analisar e espelhar).

## 1. A estrutura (uma só, para tudo)
**ambiente → serviço/frente → material + mão de obra.**
- Separa por **ambiente** (cômodo/andar/área), por **serviço/frente** (disciplina/atividade), e dentro de cada um, **material** e **mão de obra** (e equipamento).
- É a MESMA estrutura que o dono usa para **orçar** e que deve organizar a **gestão/cronograma**. "É a maneira fácil e clara de organizar."

## 2. O mesmo fio em TODOS os artefatos
A estrutura aparece idêntica (compatível) em:
**memorial descritivo → planilha orçamentária → orçamento → proposta comercial → contrato → cronograma → gestão da obra.**
- Um item descrito no memorial é o mesmo da planilha orçamentária, o mesmo do contrato, o mesmo que vira tarefa/medição na gestão. **Sem retrabalho, sem divergência entre documentos.**

## 3. De onde nasce
- **Projetos executivos do arquiteto** + **informações extraídas no local** (levantamento/site survey).
- Serve de **parâmetro para o levantamento de quantidades** de materiais e equipamentos.

## 4. ⭐ A planilha É o ESCOPO ("se está ali, está; se não está, não está")
- A planilha unificada **define o escopo contratado**. Se um item está nela → está no escopo. Se não está → não está (é aditivo).
- **Mata a discussão "tá ou não no escopo"** — a fonte é única e explícita.
- **Cura o medo de ser enganado** + realiza o princípio **honesto, sem mentiras** (a honestidade é a arquitetura) + alimenta a engenharia auditorial do Hub e o escrow (paga-se pelo que está no escopo medido).

## 5. Consequência de ARQUITETURA (como construir)
- **NÃO** construir E4 (cronograma), Orçamento IA, memorial, proposta e contrato isolados. Eles **compartilham UMA estrutura** (a EAP-taxonomia E0.5 já é a base: segmento→ambiente→disciplina→atividade; agora + material/mão de obra/equipamento e o eixo de quantidades/preço).
- O **dado-mãe** é o **item de escopo** (ambiente + serviço + material/MO + quantidade + preço). Dele se projetam: linha do orçamento, cláusula/anexo do contrato, parágrafo do memorial, barra do cronograma (com peso), frente de medição, requisição de compra (quantidade), tarefa.
- **E4 reconstruído unificado:** a Curva S/cronograma pendura no MESMO item de escopo que o orçamento — peso e avanço por item de escopo, não uma estrutura paralela.
- O **Orçamento IA** (memorial PDF → planilha) preenche essa estrutura; a IA levanta quantidades a partir dos projetos executivos.

## 6. Pendência
- **Analisar a planilha real** (link acima) e espelhar a estrutura EXATA (abas, colunas, como ele separa ambiente/serviço/material/MO, como calcula quantidade/preço). Persistir o dump como fizemos com a planilha do Consulado.
- Mesa redonda do **Orçamento IA + E4 unificados** sobre esta estrutura, quando for construir.

## 7. ⭐ O PROCESSO com espinha dorsal ÚNICA (dono, 29/jun — a outra metade)
- **O ARQUITETO é a FONTE:** responsável por entregar **projeto executivo + memorial descritivo**. É o mestre de onde a estrutura unificada nasce. (Liga ao módulo Arquitetura/A0-A2 e ao elo "Gerar Obra".)
- **O ORÇAMENTO é o GATE de disparidade:** qualquer divergência (na obra, na marcenaria, em QUALQUER atividade) é **identificada no momento de orçar** — porque cada orçamento de atividade bate contra o mestre do arquiteto (executivo+memorial). Pega a disparidade CEDO, antes de virar briga/atraso/custo extra.
- **PADRONIZAÇÃO = superpoder da IA:** se TODOS trabalham do mesmo jeito (mesma estrutura), a IA consegue (a) **achar disparidades** automaticamente e (b) **operar o sistema como um todo**. A uniformidade é o que torna a auditoria por IA possível.
- **Consequência de build:** o **Orçamento IA** ganha um JOB explícito: cruzar memorial/executivo do arquiteto × orçamento de cada atividade/fornecedor e **FLAGAR o que não bate** (vira item na [[central-aprovacoes-tela-unificada]]). A disparidade detectada = uma aprovação/decisão. O arquiteto valida/ajusta o mestre; o resto herda. **É a honestidade-sem-mentiras virando processo auditável por IA.**

## 8. ⭐ Mecânica do ORÇAMENTO (dono, 29/jun)
- **BDI default = 1 (neutro), AJUSTÁVEL pela empresa.** Cada empresa configura o seu BDI (markup sobre o custo direto); nasce em 1 (sem acréscimo) e a empresa ajusta. Por-empresa, não global.
- **Campos CUSTOMIZÁVEIS + hierarquia EDITÁVEL:** o usuário pode **editar ou criar pontos principais e subitens** — a estrutura NÃO é template fixo, é uma árvore que o usuário molda (casa com a EAP editável e o funil editável). Pontos principais = seções; subitens = composições/serviços.
- **Futuro = BASE DE PREÇOS por usuário + IA ORÇA SOZINHA:** cada usuário acumula a sua **base de preços própria** (composições/preços unitários históricos); a **IA gera o orçamento sozinha** a partir dessa base + os projetos executivos do arquiteto. É o destino do Orçamento IA — **a base de preços do usuário é o combustível da IA**. (Liga [[creditos-ia-metering-visao]]: orçar com IA consome créditos.)
- **Consequência de modelo:** o "item de escopo" precisa de **árvore editável (pai/filho)** + **preço_unit do usuário** (base de preços) + **BDI por empresa** + **quantidade × preço × BDI = total**. Tudo customizável.

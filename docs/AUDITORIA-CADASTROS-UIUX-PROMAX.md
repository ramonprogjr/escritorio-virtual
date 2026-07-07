# Auditoria UI/UX ProMax — Cadastros (Fable + E2E ao vivo)

> Origem: queixa direta do dono ("os botões estão muito feios, disfuncionais, mal aproveitados").
> Método: E2E ao vivo (produção) + mesa Fable de 6 lentes ProMax. Ancorado em arquivo:linha.
> Premissas: Click-and-Go (≤3 cliques), IA-first/conversacional, dark verde+dourado TRAVADA,
> "identidade esconde, chama pelo nome". Data: 06/jul/2026.

## Diagnóstico de fundo

A tela de Cadastros **acumula sem hierarquia**: 4 formas de criar competindo, 3 caixas de busca,
barra de filtro sobrecarregada, código de identidade exposto, e o copiloto (única IA da tela)
**atrapalhando** em vez de ajudar. É o oposto das premissas do dono — em vez de Click-and-Go/IA-first,
é "escolher entre muitos botões iguais + digitar formulário".

### Os 4 problemas-mãe (confirmados no código + ao vivo)
1. **Sem hierarquia de ação** — 2 botões VERDES idênticos ("+ Convidar" e "+ Novo cadastro",
   mesmo `#003b26`/`#c9a24a`/peso 700) + 2 links de navegação ("Mão de obra", "Duplicatas")
   **intercalados** entre eles = 4 pílulas de peso igual. `page.tsx:409-488`.
2. **4 formas de criar** — os 2 botões + o FAB `CrmQuickAdd` (âmbar) + o FAB do `CopilotoVoz` (mic),
   os dois FABs **no mesmo canto** (o copiloto sobe 160px só pra não colidir — gambiarra).
3. **Código de identidade exposto** — a coluna `codigo` (PS2026013) é visível por padrão e a
   primeira depois do Nome, em dourado mono. Viola a regra do dono. `cadastro-list-columns.tsx:100`.
   (O mobile já a esconde — o desktop não herdou.)
4. **IA que atrapalha** — o balão "TENTE DIZER" do copiloto é posicionado por cima da tabela e
   **cobre a coluna TELEFONE**; e o copiloto é lead-only (sem contexto/ação nos Cadastros). `CopilotoVoz.tsx:831`.

## Plano priorizado (o CEO executa os P0/P1 seguros; IA-first fica para o dono decidir)

### P0 — cortes seguros de alto impacto (executar já, sem decisão)
| # | O quê | Arquivo |
|---|-------|---------|
| P0-1 | **Esconder o código de identidade** por padrão (`defaultOff:true`), como o mobile já faz | `lib/crm/cadastro-list-columns.tsx` (pessoa + empresa) |
| P0-2 | **Hierarquia dos botões**: 1 primário sólido dourado "Novo cadastro"; "Convidar" vira secundário (outline); navegação (Mão de obra/Duplicatas) sai do cluster de criação | `app/crm/cadastro/page.tsx` |
| P0-3 | **Copiloto não cobre a tabela**: reposicionar/suprimir o auto-hint sobre a área de dados | `components/crm/CopilotoVoz.tsx` |

### P1 — uso (executar após P0)
- **"Ver" (👁) redundante** na linha — a linha inteira já abre o view; remover o ícone. `page.tsx` + `CadastroListaTable/Cards`.
- **Telefone duplicado** (subtítulo + coluna) — coluna `defaultOff`, mantém o subtítulo. `cadastro-list-columns.tsx`.
- **"Novo cadastro" determinístico** — split Pessoa/Empresa (hoje adivinha PF/PJ pelo filtro e sempre abre PF). `page.tsx`.
- **Filtros colapsáveis no desktop** — só Busca + Lista inline; os 4 filtros atrás de um botão "Filtros" (o padrão colapsável já existe no mobile). `CadastroFiltrosBar.tsx`.
- **Fundir Tipo+Perfil** num badge junto ao Nome (2 colunas → 1 chip "PF · Lead"). `cadastro-list-columns.tsx`.

### P2 / IA-first (DECISÃO do dono — desenho pronto, não executo sem OK)
- **Cadastro por voz/colar-texto**: campo único "Cole ou fale os dados" → a IA extrai nome/CPF/telefone/UF → pré-preenche → humano confirma (0 digitação, ≤2 cliques). Reusa o painel de confirmação dourado do copiloto.
- **Busca conversacional única** substituindo as 3 buscas + 5 dropdowns ("arquitetos de SP com telefone").
- **Dedup proativa**: a IA sugere "parece o mesmo João — mesclar?" no cadastro (hoje é caçar no link "Duplicatas").
- **Copiloto ciente da rota**: nos Cadastros ele cria pessoa/empresa/convida e resume — vira O ponto de entrada IA-first único (absorvendo o FAB "+").
- **Coluna de sinal de negócio** (nº ativos + valor) no lugar do ruído (Código/Origem/Área).

## Cliques por tarefa (alvo)
- Criar PF/PJ: hoje 3-4 (trocar filtro → botão → wizard) → **2** (Novo cadastro → Pessoa/Empresa → confirmar).
- Buscar/filtrar: hoje até 6 toques em dropdowns → **1** (busca conversacional) ou 2 (Filtros → aplicar).
- Ver: 1 (clique na linha) · Editar: 1 · Excluir: 2 (com confirmação) — já OK.

## O que NÃO mexer
- Cards no mobile (`CadastroListaCards`) — já é o padrão enxuto certo; alinhar o desktop a ele.
- A `CadastroFiltrosBar` colapsável — reusar o padrão dela no desktop, não reescrever.
- Design system dark verde+dourado (TRAVADO).

Detalhe completo das 6 lentes: scratchpad `cadastros-audit.md` (37KB, arquivo:linha por problema).

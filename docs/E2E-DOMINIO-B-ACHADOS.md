# Auditoria E2E — DOMÍNIO B: Cadastros

> READ-ONLY. Régua-mãe: o melhor para o sistema — crítico, seguro, cuidadoso, com CERTEZA.
> Data: 2026-06-30 · Branch: `wendel/dev`
> Escopo: cadastro PF/PJ (wizard + lista/cards + sideovers), contatos de notificação, parceiros, fornecedores, especialistas, empresas (escritórios), duplicatas.

## Telas e arquivos auditados (reais)

| Tela | Arquivo | Padrão |
|---|---|---|
| Hub de Cadastro (PF/PJ) | `app/crm/cadastro/page.tsx` | tabela (desktop) + cards (mobile) + sideovers + wizard |
| Wizard novo cadastro | `components/crm/cadastro/CadastroWizard.tsx` | painel lateral, IA-CNPJ, dedup ao vivo |
| Lista tabela | `components/crm/cadastro/CadastroListaTable.tsx` | tabela com scroll horizontal |
| Lista cards (mobile) | `components/crm/cadastro/CadastroListaCards.tsx` | cards verticais |
| Filtros | `components/crm/cadastro/CadastroFiltrosBar.tsx` | busca + selects (colapsa no mobile) |
| Sideover contato | `components/crm/cadastro/CadastroContactoSideover.tsx` | ver/editar/excluir + abas |
| Pessoas (legado) | `app/crm/pessoas/page.tsx` | redirect → /crm/cadastro |
| Duplicatas | `app/crm/pessoas/duplicatas/page.tsx` | merge guiado (homologação) |
| Contatos notificação | `app/crm/contatos/page.tsx` | form + cards (Supabase anon direto) |
| Parceiros | `app/crm/parceiros/page.tsx` | abas + tabela |
| Fornecedores | `app/crm/fornecedores/page.tsx` | form inline + lista-linhas |
| Especialistas | `app/crm/especialistas/page.tsx` | form chips + lista-linhas |
| Empresas/Escritórios | `app/crm/empresas/page.tsx` | tabela (admin owner-only) |
| API cadastro | `app/api/crm/cadastro/route.ts` · `lib/crm/salvar-super-cadastro.ts` | |
| API pessoas | `app/api/crm/pessoas/route.ts` · `app/api/crm/pessoas/[id]/route.ts` | |
| API empresas | `app/api/crm/empresas/[id]/route.ts` | |
| API bulk-delete | `app/api/crm/cadastro/bulk-delete/route.ts` · `lib/crm/excluir-cadastro-crm.ts` | |
| Dedup ao vivo | `app/api/crm/pessoas/verificar-documento/route.ts` | |

---

# 🔴 BLOQUEADORES

## B1 — Vazamento cross-tenant na leitura/edição/exclusão de UM contato (`/api/crm/pessoas/[id]`)
**Arquivo:** `app/api/crm/pessoas/[id]/route.ts` — GET (L57-61), PATCH (L195-200), DELETE (L243-247).
**Problema:** as três operações usam o **service-role key** (bypassa RLS) e filtram **só por `id`** (`.eq("id", id)`), sem nenhum filtro de tenant. Qualquer gestor de um escritório A que conheça/adivinhe o UUID de uma pessoa do escritório B consegue **ler, editar e excluir** esse registro. A LISTA (`GET /api/crm/pessoas`) é corretamente escopada por `tenantScopeOrFilter(g.ctx.tenantId)` (route.ts L150-151), mas o acesso individual não — exatamente o padrão registrado em memória `tenant-null-leak-pattern.md`.
**Evidência:** DELETE em L243 faz `.from("hub_pessoas").select(...).eq("id", id).maybeSingle()` e em seguida `excluirPessoaCrm(supabase, id)` sem tenant. O guard `requireCrmGestor` confirma papel, mas **não confina ao tenant do caller**.
**Ajuste concreto:** após resolver `g.ctx.tenantId`, buscar o registro com guarda de tenant e retornar 404 se não pertencer:
```ts
const { data: existente } = await supabase
  .from("hub_pessoas").select("...").eq("id", id).maybeSingle();
if (!existente) return 404;
const tid = existente.tenant_id;
if (tid != null && tid !== g.ctx.tenantId && tid !== DEFAULT_OBRA10_TENANT_ID) {
  return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
}
```
Aplicar o mesmo gate antes de PATCH e da RPC de DELETE. (Idealmente, passar `p_tenant` para a RPC `hub_delete_pessoa_crm` e filtrar lá — ver B3.)

## B2 — Mesmo vazamento cross-tenant em empresas (`/api/crm/empresas/[id]`)
**Arquivo:** `app/api/crm/empresas/[id]/route.ts` — GET (L67-71), PATCH (L172-177), DELETE (L229-233).
**Problema:** idêntico ao B1 — service-role + `.eq("id", id)` puro, sem tenant. Leitura/edição/exclusão de empresa de outro escritório por ID. O `validarCnpjEmpresaDisponivelPatch` recebe `guard.ctx.tenantId` (L148), mas o UPDATE em si (L172) não confina por tenant.
**Ajuste concreto:** mesmo gate de tenant do B1 (buscar `tenant_id` do registro, comparar com `guard.ctx.tenantId`, 404 se divergir), antes de PATCH/DELETE.

## B3 — `bulk-delete` exclui por ID sem confinar ao tenant do caller
**Arquivo:** `app/api/crm/cadastro/bulk-delete/route.ts` (L47-58) → `lib/crm/excluir-cadastro-crm.ts` (L41-82).
**Problema:** o handler está corretamente atrás de `requireCrmGestor` (L17), mas chama `excluirPessoaCrm(supabase, id)` / `excluirEmpresaCrm(supabase, id)` passando **apenas o id** — `g.ctx.tenantId` nunca é usado. As funções chamam `supabase.rpc("hub_delete_pessoa_crm", { p_id })` sem parâmetro de tenant. Um gestor pode enviar até 100 IDs de qualquer tenant e excluí-los em lote (a segurança depende inteiramente de a RPC fazer o confinamento — não verificável neste repo).
**Ajuste concreto:** propagar `g.ctx.tenantId` para as funções de exclusão e para a RPC (`p_tenant`), filtrando o delete por `tenant_id` dentro da função SQL; ou, no mínimo, pré-verificar cada id contra o tenant do caller antes de excluir. Vale para a exclusão single também (B1/B2).

## B4 — Endpoint de dedup é um oráculo aberto e cross-tenant (`verificar-documento`)
**Arquivo:** `app/api/crm/pessoas/verificar-documento/route.ts` (L19-73).
**Problema:** (a) **sem nenhum guard de auth** — não chama `requireCrmSessao`/`requireInternalApiKey`; (b) `buscarPessoaPorDocumento(supabase, tipo, documento)` é chamado **sem tenantId**, então busca em toda a base; (c) quando acha, **retorna `nome` e `codigo` do titular** (L65-68). Resultado: qualquer um com a sessão pode testar um CPF/CNPJ e descobrir **o nome da pessoa associada em qualquer escritório** — enumeração de dados pessoais (LGPD) e vazamento cross-tenant. O caminho do wizard (`salvar-super-cadastro`) já foi corrigido para mensagens genéricas e dedup escopado; este endpoint de verificação ao vivo ficou para trás.
**Ajuste concreto:** exigir sessão (`requireCrmSessao`) e passar `g.ctx.tenantId` ao `buscarPessoaPorDocumento`; na resposta de duplicado, **não** devolver `nome`/`codigo` de outro registro — apenas `{ disponivel:false, duplicado:true, error:"Documento já cadastrado neste escritório." }`.

## B5 — Dedup do POST legado `/api/crm/pessoas` não é escopado por tenant (e vaza nome/código)
**Arquivo:** `app/api/crm/pessoas/route.ts` — POST, dedup telefone (L262-266) e documento (L281-285).
**Problema:** ambos os SELECTs de duplicidade usam `.eq("telefone", ...)` / `.eq("documento", ...)` **sem** `.or(tenantScopeOrFilter(tenantId))`, embora o tenant esteja disponível em `g.ctx.tenantId` (L246). Além de bloquear cadastro por colisão com outro escritório, a resposta 409 devolve `nome` e `codigo` do registro de outro tenant (L271-274, L291-294). O caminho gêmeo em `salvar-super-cadastro.ts` (L228-258) já faz isso certo — este ficou inconsistente.
**Ajuste concreto:** adicionar `.or(tenantScopeOrFilter(tenantId))` aos dois SELECTs e trocar a mensagem 409 por genérica ("já cadastrado neste escritório"), sem expor nome/código.

> Observação de prioridade: B1–B5 são todos o mesmo defeito sistêmico (service-role + filtro só por id/sem tenant). Corrigir junto, em lote, reusando `tenantScopeOrFilter`/comparação `!== ctx.tenantId → 404`, como já feito nas listas. O CEO sempre verifica achados de integridade/segurança — este é o item nº1.

---

# 🟢 AJUSTES AUTÔNOMOS (ordenados por valor)

## A1 — Tenant do wizard vem do `defaultTenantId()`, não do escritório do usuário
**Arquivo:** `app/api/crm/cadastro/route.ts` (L44): `const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();`.
**Problema:** `tenantIdFromRequest` só honra `x-tenant-id` se vier com a `INTERNAL_API_KEY` (forjabilidade — correto). Para o **browser**, isso sempre cai em `defaultTenantId()`. Logo, **todo cadastro feito pelo wizard é gravado no tenant padrão Obra10**, mesmo que o usuário pertença a outro escritório. Hoje, com um tenant só, é invisível; no multi-tenant, mistura dados. Funcionalmente "grava de verdade" (não é fachada), mas no tenant errado.
**Ajuste:** derivar o tenant de `getCallerContext(request).ctx.tenantId` (como faz `/api/crm/pessoas`), não de `tenantIdFromRequest`. Trocar para o padrão `requireCrmComercial(request)` e usar `g.ctx.tenantId`.

## A2 — Tabela como TELA DE TRABALHO no desktop (viola a régua eterna)
**Arquivos:** `app/crm/cadastro/page.tsx` (L857-882 pessoas, L940-965 empresas), `app/crm/parceiros/page.tsx` (L277), `app/crm/empresas/page.tsx` (L171-212).
**Problema:** no desktop o cadastro usa `CadastroListaTable` (tabela com scroll horizontal, colunas configuráveis) como superfície primária de trabalho. A régua "CEO de produto" diz: tabela = relatório (em /crm/relatorios); telas de trabalho devem ser cards/Click-and-Go. No **mobile** já está certo (cards). Parceiros e Escritórios também usam tabela.
**Ajuste autônomo (baixo risco):** o componente de cards (`CadastroListaCards`) já existe e funciona; estender o uso de cards ao desktop (grid responsivo) é viável sem novo backend. **Mas** a decisão de trocar a superfície primária é de UX e deve passar pelo dono → ver 🟡 D1 (não fazer unilateralmente).

## A3 — `window.confirm` nativo no Escritórios (inconsistente com o resto do CRM)
**Arquivo:** `app/crm/empresas/page.tsx` (L98): `if (desativando && !window.confirm(...))`.
**Problema:** o restante do domínio já migrou para `CrmConfirmDialog` (cadastro) / confirmação inline (sideover). O `window.confirm` quebra a identidade visual dark/dourada e a memória registra "native alert/confirm replaced across CRM".
**Ajuste:** trocar por `CrmConfirmDialog` (já importado em cadastro) para desativar escritório.

## A4 — Contatos de notificação gravam direto via Supabase anon do browser (sem API, sem tenant)
**Arquivo:** `app/crm/contatos/page.tsx` (L57, L82-84, L94, L99) — `supabase.from("hub_contatos_notificacao").select/insert/update/delete` no cliente.
**Problema:** (a) a tabela `hub_contatos_notificacao` **não tem CREATE TABLE nem RLS no repo** (confirmado em `docs/database-schema-context.md` L87); a única proteção é uma RLS que não dá para verificar aqui. (b) o `select("*").order("nome")` (L57) e o `insert({...form})` (L84) **não passam tenant_id** — depende 100% de RLS para isolar escritórios. (c) é a única tela do domínio que não usa rota server + guard de papel.
**Ajuste:** mover CRUD para uma rota `/api/crm/contatos` com `requireCrmGestor` + `g.ctx.tenantId` no insert/select, como as demais. Se a urgência for menor, no mínimo confirmar a RLS da tabela no DB e setar `tenant_id` no insert.

## A5 — Botão "Salvar" do wizard fica habilitado mesmo com dedup em andamento/duplicado
**Arquivo:** `components/crm/cadastro/CadastroWizard.tsx` — botão salvar (L1018-1021) só desabilita por `salvando || buscandoCnpj`.
**Problema:** se o documento está sendo verificado (`docVerificando`) ou já deu "duplicado" (`docHint` not-ok, `docHintOk=false`), o usuário ainda pode clicar Salvar; a validação final em `salvar()` (L418-430) só checa formato/validade do documento, não o resultado da disponibilidade — então um CPF/CNPJ já existente pode ser submetido e só falha no 409 do servidor (mensagem boa, mas é round-trip desnecessário e confunde).
**Ajuste:** desabilitar Salvar enquanto `docVerificando` e quando `docHint && !docHintOk` (duplicado/ inválido), com tooltip explicando.

## A6 — `CadastroRowActions` é código morto
**Arquivo:** `components/crm/cadastro/CadastroContactoSideover.tsx` (L829-860).
**Problema:** componente exportado mas não usado (a tabela usa seus próprios botões em `CadastroListaTable`). Mantém superfície de manutenção sem valor.
**Ajuste:** remover (ou confirmar se algum outro arquivo importa antes).

## A7 — Inconsistência de rótulo PF/PJ entre telas
**Arquivos:** `app/crm/cadastro/page.tsx` (badge "Emp"/"PF", L99-107; filtro "PF e Emp", L364-368) vs `CadastroWizard.tsx` ("Pessoa física"/"Empresa") vs `CadastroContactoSideover.tsx` ("Pessoa jurídica"/"Pessoa física", L444).
**Problema:** o mesmo conceito aparece como "Emp", "Empresa", "Pessoa jurídica", "PJ" em telas diferentes. Pequena fricção de leitura/consistência.
**Ajuste:** padronizar um vocabulário (sugiro "Pessoa"/"Empresa" no card e "Pessoa física"/"Empresa" no detalhe), centralizando o label.

## A8 — Tabela mobile dos Escritórios pode estourar horizontalmente
**Arquivo:** `app/crm/empresas/page.tsx` (L171-212) — `<table>` 4 colunas sem versão card.
**Problema:** é admin owner-only e raro, mas no celular a tabela de 4 colunas (Nome/Slug/Estado/Ações) força scroll horizontal. Diferente do cadastro, aqui não há fallback de cards.
**Ajuste:** baixa prioridade — ou colapsar Slug no mobile, ou cards simples. (Owner-only, uso esporádico.)

## A9 — A11y: contraste e foco de teclado em chips/toggles
**Arquivos:** `app/crm/especialistas/page.tsx` (chips L199-214; toggle "Tem equipe" L229-244), `app/crm/contatos/page.tsx` (Toggle L22-37 sem `role="switch"`/`aria-checked`), `app/crm/fornecedores/page.tsx` (toggle recebe_leads **tem** `role="switch"` L233-235 — usar como referência).
**Problema:** o Toggle de contatos (L22-37) é um `<button>` sem `role="switch"`/`aria-checked`/`aria-label` — leitor de tela não anuncia estado. Chips de especialidade dependem de cor (dourado) para indicar seleção, sem `aria-pressed`. Texto `#8b949e` sobre `#0a140f` em labels de 11px fica perto do limite de contraste.
**Ajuste:** adicionar `role="switch" aria-checked` + `aria-label` ao Toggle de contatos; `aria-pressed` aos chips; subir labels mínimos para 12px ou clarear a cor.

---

# 🟡 DECISÕES PARA O DONO

## D1 — Trocar a tabela do desktop por cards é mudança de UX (precisa de aval)
A régua "tabela = relatório, nunca tela de trabalho" indica que o cadastro (pessoas/empresas/parceiros) deveria ser cards no desktop também. **Mas** a tabela traz colunas configuráveis (`ColunasMenu`), seleção em massa e densidade que operadores podem preferir. **Pergunta ao dono:** (a) migrar desktop para cards (Click-and-Go) mantendo a tabela só em /crm/relatorios? (b) ou manter um toggle cards/tabela como já existe em Imóveis? (c) quais campos viram o "card" canônico de pessoa (nome, código, telefone+DDD, área, origem) e de empresa (razão, CNPJ, segmento, mercado)?

## D2 — Telefone exposto a clique no card mobile (suspeita do mapa) — é decisão de produto
**Arquivos:** `app/crm/cadastro/page.tsx` — `CadastroCardWhatsApp` (L110-125, abre `wa.me`) e `pessoaPrimaryColumn.subtitle` com `CrmTelefoneCell` (L667-671). Botão "WhatsApp" full-width no rodapé de cada card mobile, mais o número clicável (copiar) no subtítulo.
**Análise honesta:** não é um bug — é intencional e útil (vendedor quer falar rápido). O risco é de **exposição/privacidade**: o número aparece e é acionável já na listagem, e o `CrmTelefoneCell` mostra DDD + número formatado para qualquer papel com acesso à lista. **Pergunta ao dono:** manter o número visível + botão WhatsApp na lista para todos os papéis, ou (a) ocultar dígitos para papéis abaixo de comercial, (b) mostrar só o botão "WhatsApp" sem revelar o número no card? Não altero sem aval por ser política de dados.

## D3 — Merge de duplicatas está "em homologação" (botão travado) — quando ligar?
**Arquivo:** `app/crm/pessoas/duplicatas/page.tsx` (L193-210, L517-537) — `mergeHabilitado=false` por padrão; botão "Mesclar" desabilitado com banner honesto.
**Análise:** a tela está pronta e honesta (não é fachada — diz que está em homologação). A fusão real (`/api/crm/pessoas/merge`) existe mas está atrás de uma flag. **Pergunta ao dono:** liberar o merge real agora (e em qual ambiente)? Quem pode mesclar (gestor+? owner?)?

## D4 — Dois cadastros de "fornecedor/parceiro" coexistem com modelos diferentes
**Arquivos:** `app/crm/fornecedores/page.tsx` (`hub_fornecedores`, status_acesso + mercados + recebe_leads) vs `app/crm/parceiros/page.tsx` (`hub_parceiros` + satélites captação/homologação). Memória confirma a coexistência (4284, 25/jun).
**Análise:** não é bug, mas é confuso conceitualmente (dois lugares para "quem recebe lead/é da rede"). **Pergunta ao dono:** consolidar em uma jornada única (parceiro = fornecedor homologado) ou manter separados por propósito (parceiro = jornada/onboarding; fornecedor = registro+motor)? Decisão de modelo de negócio.

---

## Sumário executivo

- **Funcionalidade E2E:** o caminho principal (wizard PF/PJ → grava → lead no funil → aparece na lista) é **real**, com dedup ao vivo (CPF/CNPJ/telefone), busca de CNPJ (OpenCNPJ) e CEP (ViaCEP), exclusão single + massa com auditoria, e merge de duplicatas honesto. Não encontrei botão morto que quebre o fluxo (exceto `CadastroRowActions` órfão, A6). Mobile dos cards está OK conforme correção prévia.
- **Segurança (o ponto crítico):** há um defeito **sistêmico** de confinamento por tenant no acesso individual (B1, B2, B3) e no dedup (B4, B5) — service-role bypassa RLS e os handlers filtram só por `id`/documento sem tenant. As **listas** já estão escopadas; o **acesso por ID e o dedup ao vivo** não. Some-se a isso o wizard gravando no tenant padrão (A1) e os contatos de notificação escrevendo via anon sem tenant (A4). É o tema dominante e deve ser corrigido em lote.
- **UX/Marca:** identidade dark verde+dourado consistente; sem azul Shadcn residual nas telas do domínio. A maior divergência da régua é tabela-como-tela no desktop (D1) e um `window.confirm` nativo (A3).
- **A11y:** lacunas pontuais em toggles/chips e tamanhos de fonte mínimos (A9).

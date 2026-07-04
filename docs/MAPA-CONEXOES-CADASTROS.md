# 🕸️ MAPA DAS CONEXÕES DOS CADASTROS — Hub × Tenants
> Como pessoas · empresas · negócios · leads · parceiros · mão de obra · imóveis · produtos se ligam (ou NÃO se ligam) no Obra10+. Levantado do **código real** (4 leitores paralelos + grafo de FKs do banco), 04/jul/2026. Base da rastreabilidade (blueprint-mãe). **Diagnóstico honesto no §5 — é onde está o trabalho.**

---

## 1. A FOTO (modelo mental em 1 minuto)
A espinha é o **NEGÓCIO**. Tudo nasce de um **lead**, vira **negócio**, que ancora **envolvidos** (pessoa/empresa/parceiro por papel) e, ao ser ganho, **deriva uma entrega** (obra ou projeto). O usuário acha tudo pelo **NOME** (código de identidade é interno/escondido).

```
                    hub_pessoas_empresas (N:N, cargo+principal)
        PESSOA (PES) ⇄──────────────────────────────────⇄ EMPRESA (EMP)
           │  ▲                                              ▲
           │  │ (PJ = MESMA entidade em 2 códigos: PES+EMP)  │
   pessoa_id│  └───────── "Representante legal" ─────────────┘
           ▼
   LEAD (LED) ──converte──▶ NEGÓCIO (NG+mercado)  ◀── ESPINHA
                                │  │  │
             negocio_pai_id ────┘  │  └──── hub_negocio_vinculos (N:N por PAPEL)
             negocio_raiz_id ──────┘         └─ pessoa/empresa/PARCEIRO(PAR)/lead_origem
                                │
                     (ao GANHAR) deriva entrega por mercado
                                │
                ARQ ▶ PROJETO (PRJ) ──gerar-obra──▶ OBRA (OBR) ◀── default (não-ARQ)
                                                        │
                                        obra_id (SC) ◀──┘──▶ cliente_*_id (soft)
                                                        │
                                   PEDIDO/SC (PED) · ITENS · ESTOQUE · CATÁLOGO (produtos)

   ILHADOS (sem FK à espinha):  ESPECIALISTA/mão de obra (ESP) · IMÓVEL (IMO, FKs não populadas) · hub_profissionais (legado, sem tenant)
```

---

## 2. AS ENTIDADES
| Entidade | Tabela | Código | tenant_id? | O que é |
|---|---|---|---|---|
| Pessoa | `hub_pessoas` | **PES** | ✅ | Contato único (PF **ou** PJ). Raiz de identidade. Dedup por CPF/CNPJ. |
| Empresa | `hub_empresas` | **EMP** | ✅ | PJ (razão/CNPJ/segmento). Criada auto quando cadastro PJ tem CNPJ. |
| Vínculo P↔E | `hub_pessoas_empresas` | — | ✅ | **N:N** pessoa↔empresa com `cargo`+`principal`. |
| Lead | `hub_leads_crm` | **LED** | ✅ | Origem comercial; ao qualificar vira negócio. |
| **Negócio** | `hub_negocios` | **NG**+mercado | ✅ | **A espinha.** Deal com origem, envolvidos, linhagem e entrega. |
| Vínculo de negócio | `hub_negocio_vinculos` | — | ✅ | **N:N** negócio↔envolvidos por **papel**. Fonte de verdade do "quem é quem". |
| Obra | `hub_obras` | **OBR** | ✅ | Entrega física (EAP/medições/escrow) de negócio ganho não-ARQ. |
| Projeto | `hub_projetos` | **PRJ** | ✅ | Entrega de arquitetura; `responsavel_id` = chave técnica do escrow. |
| Parceiro | `hub_parceiros` | **PAR** | ✅ | Rede externa (corretor/arquiteto/fornecedor) que indica/capta e recebe leads. |
| Especialista | `hub_especialistas` | **ESP** | ✅ | Mão de obra sem login. **Ilhado** (sem FK). |
| Imóvel | `hub_imoveis` | **IMO** | ✅ | Captação/corretagem. FKs de captação/dono **não populadas**. |
| Profissional (legado) | `hub_profissionais` | — | ❌ | Stub de MDO que duplica especialista. |
| Catálogo | `hub_catalogo` | codigo TEXT | ✅ (NULL=global) | Dicionário de materiais/disciplinas (Click-and-Go). |
| Pedido/SC | `hub_pedidos_material` | **PED**/SC | ✅ | Solicitação de compra; só toca a espinha via `obra_id`. |

---

## 3. AS CONEXÕES (por camada)

### 3.1 Identidade (pessoa ↔ empresa)
- **Real e viva:** `hub_pessoas_empresas` (N:N, `cargo`+`principal`). É o que o Relacionados lê.
- **PJ = dupla identidade:** um cadastro PJ vira **pessoa-PJ (PES)** + **empresa (EMP)** com o mesmo CNPJ, reconciliados só pelo vínculo "Representante legal".
- **FK escalar `hub_pessoas.empresa_id` está MORTA** (nunca escrita/lida no código — só o N:N vale).

### 3.2 Espinha (lead → negócio → linhagem)
- **Lead→negócio:** conversão cria o negócio e grava `hub_leads_crm.negocio_id` de volta; o link confiável é o **vínculo** `papel='lead_origem'` (a coluna `hub_negocios.lead_id` aponta para a tabela **legada** `hub_leads` e fica `null`).
- **Envolvidos:** pessoa (`contato_principal`), empresa, **parceiro** (`papel='parceiro'`) — tudo por `hub_negocio_vinculos`. Não há `parceiro_id` em `hub_negocios`.
- **Linhagem:** `negocio_pai_id` (pai→filhos) + `negocio_raiz_id` (âncora O(1) da árvore).
- **Entrega:** ao ganhar, deriva **obra** (default) ou **projeto** (ARQ) por `negocio_id`.

### 3.3 Execução + rede
- **Projeto→Obra:** `hub_projetos.obra_id` (elo arquitetura→engenharia; a obra herda cliente + `negocio_id`).
- **Parceiro→negócio:** só via vínculos. **Parceiro→lead:** distribuição via `hub_encaminhamentos.encaminhado_para` (**texto = nome**, não FK) + `metadata.parceiro_id` (JSON).
- **Especialista:** **nenhuma** conexão à espinha.

### 3.4 Produtos + rastreio
- **Produtos→espinha:** só por `hub_pedidos_material.obra_id → hub_obras → cliente_*_id` (**soft**, 2 saltos). SC sem obra = solta.
- **Rastreio:** `/api/crm/rastreio` resolve por **CÓDIGO** (6 prefixos PES/EMP/LED/NEG/PAR/IMO) e por **NOME** (ILIKE, `.eq(tenant)` puro).

---

## 4. ISOLAMENTO POR TENANT (o modelo + as brechas)
- **Tenant sentinela do Hub:** `00000000-0000-4000-8000-000000000001`. `crmDb()` é **service-role → BYPASSA RLS**; a barreira **primária é o código**.
- **Tenant vem SEMPRE da sessão** (`g.ctx.tenantId`), nunca do header forjável. ✅
- **Dois padrões convivendo** (fonte de assimetria):
  - **Estrito** `.eq('tenant_id', tenantId)` — não vê legado. Usado em busca por NOME, GET de projetos/pedidos, guards de detalhe (404 cross-tenant). ✅ o certo.
  - **Frouxo** `tenantScopeOrFilter()` = `tenant OU tenant_id IS NULL OU Obra10` — tolera legado, mas é **over-share** (linha com tenant NULL vaza entre tenants). Usado em listas, resolver por código, catálogo, imóveis, especialistas, parceiros.

---

## 5. ⚠️ OS GAPS DE RASTREABILIDADE (o diagnóstico honesto — é aqui o trabalho)
Ranqueado por impacto na "rastreabilidade total" (a alma do produto):

**🔴 Estruturais (a linhagem não é alimentada / cadastros ilhados)**
1. **Linhagem pai/raiz do negócio é DORMENTE no código.** `negocio_pai_id`/`negocio_raiz_id` são **lidas** (Relacionados) mas **nunca escritas** por nenhum fluxo — só por seed SQL. A árvore existe no schema e na UI, mas o app **não a semeia** em produção.
2. **A árvore de NEGÓCIOS e a esteira de ENTREGAS são dois grafos separados.** Ganhar um negócio cria uma obra/projeto (via `negocio_id`), **não** um negócio-filho. Nunca se cruzam via pai/raiz.
3. **Especialista (mão de obra) é uma ILHA.** Sem FK e sem tabela de alocação obra↔especialista → **impossível rastrear quem executou a obra**.
4. **Imóvel desconectado no runtime.** `imovel_id` do negócio e as FKs de captação/dono nunca são gravadas → o funil de corretagem (captação→negócio→venda) não é rastreável, e o imóvel nem aparece no Relacionados.
5. **Parceiro some do Relacionados.** É gravado no vínculo (`papel='parceiro'`), mas o endpoint só materializa `pessoa`/`empresa` → o indicador/corretor **não aparece na árvore** exibida.

**🟡 Semânticos (vocabulário/chaves divergentes)**
6. **`lead_id` ambíguo:** FK aponta para a tabela **legada** `hub_leads`; a conversão grava `null`, mas o POST direto grava id de `hub_leads_crm` (tabela errada da FK). A verdade do link é o vínculo, não a coluna.
7. **Papéis fragmentados sem enum central:** o *writer* só emite `cliente/contato_principal/lead_origem/empresa/parceiro/participante`; os *readers* (escrow, rastreio) esperam papéis **técnicos** (arquiteto/engenharia/prestador) que **só entram via seed** — o escrow depende de dado semeado fora do app.
8. **Atores de compra são TEXTO, não FK:** `solicitado_por`/`aprovado_por`/`registrado_por` não amarram em `hub_pessoas`/`users` → "quem pediu/aprovou/registrou" **não volta na espinha** (relevante pro escrow/dupla-chave).
9. **Fornecedor da cotação vive em JSON** (`cotacoes_json`), não relacional → não dá pra joinar fornecedor↔compra.

**🟠 Rastreio/código (enumerável + irresolvível + assimétrico)**
10. **Prefixos cunhados mas IRRESOLVÍVEIS:** a RPC cunha `PD/FR/ES/OB/PJ/SV`, o regex aceita, mas o resolver só mapeia 6 (PES/EMP/LED/NEG/PAR/IMO) → produto/fornecedor/especialista/obra/projeto/serviço geram código que dá **404** no rastreio.
11. **Produtos fora da cadeia de rastreio:** `PED-`/`SC-` não resolvem em `/api/crm/rastreio`.
12. **Contador de código de ENTIDADE é GLOBAL** (`hub_codigo_contador (entidade,ano)`) → códigos sequenciais/enumeráveis entre tenants (o `codigo` é UNIQUE **por tenant**, então o mesmo código coexiste → isolar por tenant na resolução é **obrigatório**).
13. **Assimetria código×nome:** a mesma rota acha por **código** uma linha legada/null que a busca por **nome** (estrita) não acha.

**🔵 Segurança/tenant (over-share latente)**
14. **Inserts degradam removendo `tenant_id`** (negócio, vínculos) em erro de FK/coluna → linhas nascem sem tenant e depois vazam pelo filtro frouxo `is.null`.
15. **`derivarEntregaDoNegocio` não valida o tenant do negócio** antes de criar a entrega no tenant do caller → possível materializar entrega de um `negocio_id` alheio.
16. **`hub_pedidos_material` tem policy ANON** `USING (tenant_id IS NULL OR = default)` — o over-share anônimo já flagrado na auditoria (janela do dono).

---

## 6. LEITURA DO CEO (o que isso significa pro roadmap)
- A **rastreabilidade-mãe** (a promessa "nada se perde, tudo linkado") está **meio construída**: o *schema* e a *UI de Relacionados* existem, mas o *código não alimenta a linhagem* nem conecta 3 cadastros (especialista/imóvel/produtos). Hoje o que segura a rastreabilidade viva é **`hub_negocio_vinculos` + a busca por NOME** — e o negócio-raiz do Consulado só tem linhagem porque foi **semeado por SQL**.
- **Prioridades naturais** (quando o dono quiser atacar a rastreabilidade): (a) escrever `negocio_pai_id/raiz_id` no fluxo real; (b) tabela de alocação **obra↔especialista** (quem executou); (c) popular as FKs do **imóvel**; (d) materializar **parceiro** no Relacionados; (e) fechar os prefixos **irresolvíveis** do resolver; (f) trocar os atores TEXT por FK (pro escrow). Itens de **janela**: UNIQUE `(tenant_id, documento)`, contador de código por-tenant, policy ANON de `hub_pedidos_material`.
- **Nada disso é urgente/quebrado** — é o mapa do que falta pra rastreabilidade ficar **total** de verdade. Cada item vira uma onda no processo (E2E → mesa → CEO aprova → dono valida).

> *Fonte: workflow `mapa-conexoes-cadastros` (4 analistas, código real + FKs do banco). Evidências arquivo:linha no journal do run. Este doc é vivo — atualiza quando um gap for fechado.*

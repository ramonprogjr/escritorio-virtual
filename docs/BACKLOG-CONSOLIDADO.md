# 📋 BACKLOG CONSOLIDADO — Obra10+ / Escritório Virtual
> **Fonte única viva.** Substitui os ~23 docs de pendência/auditoria espalhados (`PENDENCIAS*.md`, `DECISOES*.md`, `HANDOFF*.md`, `AUDITORIA*.md`, `BACKLOG-FEATURES.md`, `AEC-ATIVACAO-BACKLOG.md`, `00-RETOMADA*.md`...). Daqui pra frente, pendência nova entra AQUI.
> Gerado em 06/jul a partir da extração fiel dos 9 docs mais atuais (~110 ocorrências → ~67 itens únicos). Nada foi inventado.

---

## Por que este doc existe
As pendências "se desdobraram" ao longo de muitas etapas e viraram **23 documentos diferentes** dizendo, em parte, as mesmas coisas. Isso é o que te deixou perdido. A cura não é mais um doc — é **um só**. Este.

Eixo principal aqui = **quem destrava** (você, eu, ou uma decisão), porque é isso que te ajuda a agir:
- 🔑 **`[VOCÊ]`** — depende de você: deploy, credencial, migração em produção, acesso externo, janela.
- 🛠️ **`[EU]`** — trabalho de código que eu faço sozinho (com gate verde), sem depender de você.
- 🧭 **`[DECISÃO]`** — uma escolha de produto/negócio que só você pode fazer.

---

## 📌 LOG DE EXECUÇÃO — fila 🛠️EU (autônomo, 06/jul) · VERIFICÁVEL POR COMMIT
> Registro anti-esquecimento (o dono pediu: *"anote pra não alucinar nem deixar pendência pra trás; guarde num local que possa verificar"*). Cada item tem o hash — confira com `git show <hash>`. Ponto de retorno seguro: tag `ponto-retorno-06jul` (`1526250`).

**Deploy do lote (staging/Ramon):** `d5f4667` em `origin` + `backup` (branch `feature/escritorio-visual`, árvore idêntica ao dev). O SEC-8 (`570557d`) veio DEPOIS do deploy → entra no próximo deploy.

| Item da fila 🛠️EU | Estado | Commit |
|---|---|---|
| SEC-1 (vazamento nas Aprovações) | ✅ auditado (7 superfícies + refutação adversarial) → **já estava fechado**; endurecidos 2 UPDATEs de cotação | `669c5e0` |
| "Previsto" sempre R$ 0 | ✅ soma `valor_contrato` dos itens (E2) | `9c0a55a` |
| Autor da medição por NOME (não UUID) | ✅ resolve em `users(name/email)` no GET | `adc7b5e` |
| Consistência: reverte avanço se a trilha (insert) falha | ✅ guarda otimista, zero regressão | `6d67ac7` |
| SEC-8 (custo da IA falhava calado) | ✅ loga com contexto p/ reconciliação | `570557d` |

**⏸️ DEFERIDO — NÃO ESQUECER (pendência viva, não sumiu):**
- **SEC-7 — a IA gravar auditoria SISTÊMICA de tudo que escreve** (tabela `hub_acoes_ia`). Por que não fiz agora: é lacuna **sistêmica** — o executor `lib/hub/executar-ferramenta-ia.ts` já grava em ALGUNS pontos (ex.: linha 281) mas não em todos; e `docs/DIVIDAS-TECNICAS.md §E3` manda **"resolver JUNTO da Central de Aprovações"** (o formato do registro depende do que a Central vai consumir no loop de aprendizado). Fazer agora arriscaria **formato errado + logs duplicados** no coração da IA. **Retomar como MESA DEDICADA.** Ponto de injeção já mapeado: executor central `executar-ferramenta-ia.ts:593` + mapa `HUB_FERRAMENTA_ACESSO` em `agente-ferramentas-registry.ts:1172`.

**🔎 TRIAGEM da fila [CODE] restante (mesa de 6 lentes, 06/jul) — a fila [CODE] está essencialmente ZERADA.** Verificado contra o código ATUAL (não os docs velhos):

| Item | Veredito | Evidência |
|---|---|---|
| AUT-2 dedup de lead por telefone | ✅ FECHADO | 3 intakes linkam pessoa: CRM `vincularPessoaPorTelefone` (leads route:213), legado `garantirPessoaParaLead`, WhatsApp webhook |
| AUT-12 estoque saída×devolução | ✅ FECHADO | `abrirMov(item, tipo)` já abre no tipo certo (ObraComprasEstoqueSecao:694) |
| AUT-14 erros do login em PT | ✅ FECHADO | `traduzirErroAuth` (login/page.tsx:35-55) |
| AUT-11 picker participantes → combobox | ✅ FECHADO | `ParticipantePicker` com busca (ressalva menor: busca limit=100) |
| AUT-8 EAP "ambiente primeiro" | ✅ FECHADO | não reproduzível — ambiente vive na ArvoreEscopo, não no wizard |
| AUT-5 azul fora do CRM | ✅ FECHADO | 0 azul; tudo verde+dourado (resíduo cosmético: hex em vez de tokens `--obra-*`) |
| AUT-16 rotas mortas /comando /agentes | ✅ FECHADO | deletadas; só sobra ref stale em doc/artefato gerado |
| AUT-7 índice `idx_taxonomia_tenant` redundante | 🔑 JANELA | código PRONTO (DROP em `20260819120000`), só aplicar na janela do dono |

**Conclusão da fila 🛠️EU:** nada mais acionável por mim agora — só o **SEC-7 (mesa dedicada)**. O restante do backlog é **🔑 SUA janela** (migrações/RLS/secrets) + **🧭 SUAS decisões** + **🚀 roadmap**. O que eu podia fazer sozinho, com segurança, **está feito e no staging.**

---

## ✅ JÁ RESOLVIDO neste ciclo (05–06/jul) — pra você ver o avanço
Estes SAÍRAM da lista. Estão no código (`wendel/dev`, gate verde) e **já subiram ao staging** no deploy `d5f4667` (você/CEO revisa ao vivo).

| # | O que era | Estado |
|---|-----------|--------|
| A1 | **Bug do dinheiro**: negócio de mercado "ganho" não virava obra/recebível e sumia dos KPIs | ✅ corrigido (deriva o fecho pelo tipo da etapa) |
| A2 | Propostas não apareciam na ficha do negócio | ✅ seção read-only na ficha |
| A3 | Pessoa não mostrava negócios ligados por vínculo N:N | ✅ ficha junta diretos + N:N |
| A4 | Lead sem forma de vincular a uma pessoa do Hub | ✅ botão "vincular pessoa" |
| AUT-3/4 | Histórico de medição existia no banco mas nenhuma tela mostrava; e a lista truncava em 500 | ✅ tela "Medições do item" + paginação |
| **AUT-6** | **Foto da medição não persistia** (ficava só no aparelho) | ✅ **sobe em bucket privado + link temporário assinado** |
| — | Vídeo da medição (mesmo padrão da foto) | ✅ campo de vídeo + player no histórico |
| RDO | Diário de obra era só stub | ✅ registro básico (resumo+clima) gravando |
| Janela | Buckets privados, log de erros, tabela do diário, colunas de medição rica, ficha FVS, tabela de Nota Fiscal (anexar) | ✅ **aplicado em produção** (06/jul, com você) |
| Leak | Vazamento cross-tenant Faixa A (rotas privadas) | ✅ no ar (`a2b2566`+`02f6471`) |

---

## 🔑 SÓ VOCÊ DESTRAVA — e quase tudo cabe em UMA janela
A maior parte das suas pendências é **infra + segurança + banco** e pode ser feita numa **única janela concentrada** comigo do lado. Depois dela, um monte de coisa destrava de uma vez.

### Bloco 1 — A JANELA DE PRODUÇÃO (fazer de uma vez)
- **Segurança RLS — Faixa B** *(Faixa A já foi)*: fechar as tabelas ainda abertas (`USING(true)`/anon), backfill do tenant NULL e trocar o filtro legado por `.eq` puro (inclui a busca por código). *Sem isso, um ambiente novo nasce vazando.*
- **Aplicar as ~19 migrações "janela do dono"** (AEC, obra, RLS financeiro, escrow, estrutura unificada, medição, curva-S) + as **2 do caminho do dinheiro** (Pipeline Total + índice anti-recebível-duplicado — checar duplicatas antes).
- **`delete = arquiva` em 5 endpoints** que ainda apagam de verdade (falta a coluna de arquivo).
- **`hub_obras.projeto_id` + UNIQUE** (mata a corrida criar-obra→PATCH).
- **Migration "baseline"** (no-op em prod) pra o banco **reconstruir do zero** — hoje não reconstrói, e isso trava o teste automático (E2E) no CI. *(este item eu preparo `[EU]`, você só aplica na janela)*

### Bloco 2 — SECRETS no Render (sem código, só painel)
- `MISTRAL_API_KEY` (+ opcional `GROQ_API_KEY` de reserva) e `COPILOTO_HMAC_SECRET` → **liga a IA** (é o coração do MVP).
- `CRON_SECRET` → cron seguro + "Executar agora".
- Conferir `WEBHOOK_SECRET`, `UAZAPI_*`, `SUPABASE_*`; e **remover** `NEXT_PUBLIC_INTERNAL_API_KEY`/`NEXT_PUBLIC_TENANT_ID` do bundle.

### Bloco 3 — Higiene de credencial / chaves
- **Rotacionar** `SUPABASE_SERVICE_ROLE_KEY` + o token pessoal `sbp_...` (fazer juntos).
- Confirmar (memória diz que já): `backup-auto.yml` removido e `.env` fora do OneDrive.
- Finalizar o **push pro seu GitHub de backup** (o repo atual é do dev demitido).
- **Config Supabase Auth**: Redirect URL do `/redefinir-senha` + SMTP próprio + password policy + trocar a senha que apareceu no chat.

### Bloco 4 — Ligar o que já existe (com sua validação)
- **Ligar o middleware** (~60 rotas hoje abertas) — validar login + captação pública antes.
- **Deploy** do que está em `wendel/dev` (foto/vídeo, diário, correção do dinheiro, espinha) — *esperando o dev te dar o Render.*
- **Validar a IA ao vivo** (3 testes: gerar fluxo, atendimento WhatsApp, copiloto de voz).
- **Validação visual no celular** (cadastros, scroll dos kanbans, funil vertical) + conferir a Fase 2.3 logado.
- **Multi-tenant real** (hoje é tenant fixo=1) — janela maior, modelo já escolhido, ~55% feito.
- **Credenciais Meta** (Lead Ads/DM) + enriquecer taxonomia EAP (cobre 5 de 15 disciplinas).

---

## 🛠️ EU FAÇO SOZINHO — fila de código (não depende de você)
Posso tocar em paralelo, cada um com gate verde e commit isolado. **Prioridade minha, de cima pra baixo:**

1. **SEC-1 — vazamento nas Aprovações** (`lib/ia/aprovacoes.ts`): sem filtro de tenant, e é por onde o dinheiro do escrow passa. *Verificar se já fechou; se não, é o nº 1.*
2. **Qualidade da medição**: autor aparecendo como código (mostrar nome); insert virar transação (hoje atualiza o avanço antes e pode deixar rastro órfão); card "Previsto" sempre R$ 0.
3. **SEC-7/SEC-8** — IA de escrita não grava auditoria (o aprendizado da Central de Aprovações depende disso); snapshot de custo falha calado.
4. **Cadastro automático / código único** — formulário insere lead sem criar pessoa e sem deduplicar por telefone.
5. **UX de formulário** — combobox com busca nos participantes do negócio (hoje `<select>` com 100+); erros do Supabase em português no login; tokenizar as telas de detalhe fora do CRM (ainda azuis).
6. **Operação** — estoque (saída × devolução usam o mesmo handler); wizard EAP expor "ambiente primeiro".
7. **Limpeza** — remover rotas mortas `/comando` e `/agentes` (mock); índice de taxonomia redundante; RPCs de hard-delete dormentes.
8. **Re-rodar a auditoria de escopo completo** — o mapa "botão/tela/seção que falta" por persona.

---

## 🧭 SÓ VOCÊ DECIDE — decisões de produto (viram código quando você bater o martelo)
- **Valor do lead: faixa ou número exato?** (destrava o SmartField de faixa + correção da IA nos formulários).
- **Voz (Talk-and-Go): no aparelho ou serviço?** (custo × privacidade).
- **Escrow: as 2 chaves são papéis distintos** (técnico do responsável × Hub)? — modelar "um pagamento exige as duas".
- **Planos SaaS** (nomes, preços, o que cada plano libera) + **markup dos créditos de IA** (por escritório ou por mercado).
- **Fornecedor × parceiro × empresa-cadastro** — desambiguar os conceitos e as telas.
- **`/crm/tarefas`**: renomear "Próximas ações" ou construir o Gestor de Tarefas universal?
- **Captação pública** — quais formulários ficam sem login.
- **`MOTOR_FONTE=fornecedores`** — virar a chave do motor de distribuição?
- **Comunidade (Membros) → CRM** e **abrir login externo** (cliente/fornecedor/mão de obra).
- Regras de negócio soltas: comodato, frete Lalamove (repasse × spread), KPIs iniciais, política "entregue × aprovado", saldo de Tijolos negativo, comissão imutável no fechamento.

---

## 🚀 GRANDES (roadmap) — os "temas-mãe" que você já pediu
Não são bugs; são módulos. Cada um vira uma onda própria.
- **Coração IA-first / conversacional** cobrindo o fluxo inteiro: receber leads → solicitar fornecedores → levantamentos → orçamento → compras → follow-ups → check-in/out. *(o "nº 1")*
- **Diário de obra completo** (o básico já entrou; falta o rico + o automático a partir dos eventos).
- **Medição rica** por atividade/ambiente/fornecedor (material do avanço, foto ✅, vídeo ✅, fichas de verificação).
- **Tudo na nuvem com log e segurança** (fotos ✅, contratos, propostas, orçamentos, notas fiscais, vídeos).
- **Ponto de obra georreferenciado** (check-in/out foto+GPS) · **Compras "totem + iFood"** com spread · **Voz → lista de materiais** · **Comunidade com feed**.

---

## 🎯 Recomendação do CEO — o próximo melhor passo
1. **Enquanto você não me libera o Render/janela**, eu avanço a **fila `[EU]`** começando pelo nº 1 (SEC-1 Aprovações) e pela qualidade da medição — trabalho seguro que não depende de você.
2. **Quando você tiver 1–2h comigo**, fazemos **a Janela de Produção (Bloco 1+2+3)** de uma vez — ela sozinha destrava segurança, o caminho do dinheiro, a IA e o deploy.
3. **Em paralelo, quando puder**, me responda as **decisões** de maior alavanca primeiro: *faixa×exato*, *escrow 2 chaves*, *planos SaaS*. Cada uma libera uma fila de código.

> Métrica-mãe: o sistema facilita a sua vida. Cada item acima existe pra tirar um atrito real — não pra inchar o produto.

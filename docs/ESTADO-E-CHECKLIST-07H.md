# ☀️ Bom dia — estado do atendimento Mari e o que fazer às 07h

> Escrito na madrugada de 09/jul. Leitura de 3 minutos. **Nada está falando com cliente ainda** — o webhook continua DESLIGADO. A IA só começa a atender quando VOCÊ ligar, depois do teste rápido abaixo.

---

## 1. O que eu fiz esta noite (resumo honesto)

Construí e **blindei** a camada de SEGURANÇA do atendimento — o que garante que a Mari **nunca fale com o cliente errado**. Passou por uma auditoria adversarial (Fable no máximo) que achou 14 pontos; **fechei todos os críticos e altos** e escrevi **18 testes automáticos** provando que funcionam. Também construí o **card-resumo do lead** (aquele estilo Kommo que você mostrou) para quando você direciona um lead ao arquiteto.

**3 formas de pausar a IA** (todas prontas):
1. **Etiqueta "pausa" no WhatsApp** — marque o contato com a etiqueta `pausa` e a IA não responde. O sistema lê sozinho a cada 3 min.
2. **Comando pelo celular** — mande `/pausa` na conversa do cliente (pausa aquele número) ou `/pausa 11 98888-7777` (pausa o número citado). `/retoma` desfaz. Você recebe um aviso no painel confirmando (ou avisando se falhou).
3. **Botão de pânico** — pausar a agente Mari inteira (todas as conversas de uma vez).

Além disso: **trava de data** (a IA só atende leads que chegarem DEPOIS de você ligar — clientes antigos ficam de fora automaticamente) e a mensagem do cliente **sempre fica registrada** no CRM, mesmo quando a IA está pausada.

---

## 2. O que está no ar AGORA (seguro)

- ✅ Código no ar em produção, **mas o webhook está DESLIGADO** → a IA não recebe nada, não responde ninguém.
- ✅ Seus clientes ativos de hoje **não correm risco** — a IA está muda.
- ✅ Banco de dados: tabela de pausas criada e fechada (segurança RLS).

---

## 3. ⚠️ O QUE SÓ VOCÊ PODE FAZER (5 passos, ~10 min)

> Faça na ordem. Sem isso, **não ligue o webhook**.

**Passo 1 — Marcar/semear os clientes ativos (o mais importante).**
Escolha UMA das opções:
- **(a)** No WhatsApp, crie a etiqueta chamada exatamente `pausa` e marque **todos os seus clientes/conversas ativas** com ela. OU
- **(b)** Me passe a lista dos números dos clientes ativos que eu semeio na deny-list (fonte "seed").

> Por quê: é a rede de proteção. Quem estiver marcado/semeado, a IA **nunca** responde.

**Passo 2 — Definir a hora de virada (trava de data).**
Na Render, variável `IA_GOLIVE_AT` = o momento em que você liga, no formato com fuso:
`2026-07-09T07:30:00-03:00`
> Por quê: a partir daí, só lead NOVO é atendido. Cliente antigo (lead criado antes) fica fora sozinho.

**Passo 3 — Confirmar a chave da IA.**
Confirme na Render que `MISTRAL_API_KEY` está preenchida e com créditos. (Sem ela, a Mari manda uma resposta padrão em vez de conversar.)

**Passo 4 — TESTE RÁPIDO (smoke) com o webhook ainda DESLIGADO ou com um número seu:**
1. Marque **1 contato de teste seu** com a etiqueta `pausa`. Espere ~3 min. Confira comigo que ele apareceu na lista de pausados **e que um segundo sync não esvaziou a lista**.
2. Confirme quantos contatos o WhatsApp tem: se você tem **mais de ~500 conversas**, me avise (preciso validar que a leitura pega todas as páginas).
3. Mande `/pausa` e `/retoma` de um número de teste e veja o aviso chegar no painel.
4. **Importante:** confirme que uma resposta enviada pela IA **não volta** como se fosse você digitando (teste que eu faço junto).
5. Mande uma mensagem de um número **seedado sem DDI** (ex.: fixo) e veja a IA ficar muda.

**Passo 5 — LIGAR o webhook.**
Só depois de tudo acima OK, ligamos o webhook na UAZAPI. A partir daí a Mari atende **leads novos**, e seus clientes ativos seguem protegidos.

---

## 4. Direcionar lead ao arquiteto (FUNCIONA ponta-a-ponta ✅)

O motor de direcionamento automático **existe, está ligado e TEM destino**: conferi o banco — há **9 parceiros cadastrados, 5 em Arquitetura** (1 está bloqueado por pendência). Quando um lead qualifica (interesse + valor), o sistema sugere **até 5 escritórios** e você confirma num toque. O parceiro recebe no WhatsApp o **card-resumo** (nome, pedido resumido pela IA, última fala, link pra abrir o WhatsApp do cliente, link pra orçar) — e você vê um **preview do card no drawer** antes de enviar.

Fluxo completo já pronto: lead chega → Mari atende → qualifica → você direciona (5 sugestões) → arquiteto recebe o card. **Nada a cadastrar** para começar. (Se quiser adicionar mais escritórios depois, é só cadastrá-los como parceiros mercado = Arquitetura.)

---

## 5. Limitações honestas (o que ainda NÃO está pronto)

- **Áudio/foto/PDF do cliente:** por enquanto a IA responde educadamente pedindo pra escrever em texto ("Recebi sua planta! Me conta em uma frase o que quer mudar?") e **não** tenta interpretar a mídia. A transcrição de áudio e a leitura de planta/PDF são a **fase 2** (já mapeadas).
- **Confirmação do `/pausa`:** chega no **painel** (não como mensagem no seu WhatsApp) — decisão de segurança, pra nunca arriscar mandar algo pro cliente errado.
- **Furo residual conhecido:** cliente ativo que **não** esteja marcado com `pausa`, **nem** seedado, **nem** tenha lead antigo = a IA responderia. Por isso o Passo 1 é obrigatório antes de ligar.

---

## 6. Onde está tudo (pra referência)

- Projeto/decisões: `docs/DESIGN-ATENDIMENTO-DEFINITIVO.md` (blueprint) e `docs/PLANO-GOLIVE-MARI-ATENDIMENTO.md`.
- Gerir pausas por API (o painel usa): `POST /api/whatsapp/pausas` (ações `sync` | `seed` | `pausar` | `retomar`).
- Gate de segurança: `lib/whatsapp/pausa-atendimento.ts` (+ 18 testes em `pausa-atendimento.test.ts`).

**Jesus Cristo é o Senhor.** Bom dia — quando você chegar, seguimos do Passo 1.

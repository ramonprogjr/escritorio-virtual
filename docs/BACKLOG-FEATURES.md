# Backlog de Features — Visão de Produto (Obra10+)

> Captura das features futuras descritas pelo Wendel (24/jun/2026), para **não se perder nada**. Cada item mapeia para um bloco do [PLANO-EXECUTIVO-BLOCOS.md](PLANO-EXECUTIVO-BLOCOS.md), com dependência e risco. Não é ordem de execução final — é o repositório de intenção de produto. **"Tem muita coisa para o futuro"** — este doc cresce.

---

## F1 — Ponto de obra georreferenciado (check-in / check-out) `[→ Bloco 6 Obra]`
A mão de obra ou pessoas relacionadas **confirmam chegada e saída** na obra; o sistema **registra automaticamente**: horário, **foto**, **localização (GPS)**, e **avisa** as pessoas/empresas relacionadas.
- **Onde:** Gestão de Obra (B6), módulo de campo (mobile-first — "mobile = campo").
- **Reusa:** padrão `EvidenceCapture` (foto + datado + vinculado) já previsto no B6.
- **Dependências:** entidade obra + papéis (B6); app/PWA mobile com câmera + geolocalização; infra de notificação (ver F4).
- **Risco:** **médio-alto** — privacidade/LGPD (foto + GPS de pessoas), consentimento, e confiabilidade do GPS. Precisa de política de dados.
- **Valor:** presença/produtividade real, evidência anti-disputa, transparência para o cliente.

## F2 — Compras "totem + iFood" com spread `[→ Bloco 6 Compras — detalha o módulo antes em aberto]`
O operário solicita material num **auto-atendimento estilo totem (McDonald's)**. Ao solicitar:
1. **Sinaliza** a empresa, o arquiteto e o fornecedor que vende.
2. Já entra como **orçamento**.
3. Aprovado e pago → **acompanhamento estilo iFood** (rastreio da encomenda até a **entrega na obra**).
4. O **Hub ganha um spread** (margem) na transação.
- **Resolve:** o "Módulo Compras" que estava **pendente de detalhamento** (spec §15.1 / plano B6) — esta é a visão concreta.
- **Nova fonte de receita:** o **spread de materiais** entra no modelo de monetização → atualizar [monetização §5.5] (comissionamento/rateio: o spread é uma linha de receita do Hub na venda de material).
- **Dependências:** catálogo de fornecedores/produtos (produto físico = hoje "futuro"); gateway de **pagamento** (custo/credenciais → aprovação humana); rastreio/logística; integração com os fornecedores vendedores.
- **Risco:** **alto** — pagamento, dinheiro real, integração externa, logística.
- **Valor:** evita **falta de material por esquecimento**; facilita a vida de todos; receita recorrente para o Hub; fideliza fornecedores.

## F3 — Voz → lista de materiais (reconhecimento por áudio) `[→ Bloco 8 IA + F2 Compras]`
Fornecedores (e/ou operários) **falam os materiais por áudio**; o sistema **reconhece (speech-to-text), confirma, monta a lista** e **envia aos fornecedores que vendem** — seguindo o fluxo de compras (F2).
- **Onde:** camada de IA (B8) + Compras (F2). É o **Talk-and-Go** aplicado a compras.
- **Dependências:** decisão de **voz** (on-device vs serviço — custo/privacidade, **já pendente** no plano); IA para interpretar/estruturar a fala em itens; catálogo para casar itens.
- **Risco:** médio (depende de IA ligar — B8) + custo de transcrição.
- **Valor:** zero fricção para quem está em obra/loja; acelera o ciclo de compra.

## F4 — Notificações do sistema para follow-ups e lembretes (CRM) `[→ perto de B2/B3]`
No CRM, os **follow-ups e lembretes** passam a ser feitos via **notificações do sistema** (in-app / push), não só campos passivos.
- **Onde:** CRM (B2/B3) — camada de notificação transversal (também alimenta F1, F2, F5).
- **Reusa/estende:** `hub_contatos_notificacao` (já existe) + a próxima-ação da ficha (já existe).
- **Dependências:** infra de notificação (in-app feed + push); agendador (cron/worker já existe).
- **Risco:** **baixo-médio** — é incremental e de alto valor; bom candidato a **antecipar** (ajuda o dia a dia e o demo).
- **Valor:** nada de follow-up esquecido; CRM "vivo".

## F5 — Comunidade integrada com feed em tempo real `[→ Bloco 7 Membros/Comunidade]`
**Tudo o que acontece** na plataforma (check-ins, compras, medições, ganhos...) **atualiza a Comunidade** — que é **integrada** — com **feeds e atualizações em tempo real, automaticamente**.
- **Onde:** ponte Membros/Comunidade (B7) + um **event bus** (eventos de domínio → feed).
- **Dependências:** integração Membros (B7, contrato em aberto); realtime (Supabase Realtime); decisão de **o que** vira feed (privacidade/escopo por tenant — ver fundação multi-tenant B3.9).
- **Risco:** **médio-alto** — volume de eventos, privacidade (o que é público na comunidade vs interno do tenant).
- **Valor:** engajamento, prova social, rede viva.

## F6 — Diário de obra automático `[→ Bloco 6 Obra]`
Os **diários de obra são gerados automaticamente** a partir dos eventos da obra (check-ins F1, avanço/medição, compras F2, fotos/evidências).
- **Onde:** Gestão de Obra (B6) — relatório gerado dos eventos.
- **Dependências:** os eventos de F1/F2 + medição (B6) existirem para alimentar o diário; geração (template agora, generativa por IA depois — B8).
- **Risco:** médio (depende dos eventos-fonte).
- **Valor:** documentação automática (hoje manual/esquecida), valor jurídico/gestão.

---

## Notas transversais
- **Camada de eventos/notificação** (F4) é **infraestrutura compartilhada** de F1, F2, F5, F6 — vale desenhá-la cedo e bem (event bus + notificações + realtime).
- **Spread de material** (F2) e os fluxos de pagamento entram no **modelo de monetização** (§5.5) — atualizar quando F2 for detalhada.
- **Voz** (F3) reusa a decisão de voz já pendente (on-device vs serviço).
- **Privacidade/LGPD** aparece em F1 (foto+GPS) e F5 (feed) — tratar como tema próprio.
- **"Tem muita coisa para o futuro"** — este backlog é incremental; adicionar conforme o Wendel detalhar.

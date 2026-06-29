# Operação de campo: tablet por comodato + totem de compra + entrega (Lalamove) — insumo do dono (29/jun)

> O modelo operacional na obra. Liga a [[marketplace-rede-servicos-ifood]], [[portal-cliente-medos-cura]], backlog (ponto de obra foto+GPS, voz→materiais). O dono pediu: "minha ideia, você deve melhorá-la."

## 1. Alerta PREDITIVO de material (o moat confirmado)
Com estoque + IA + o **planejamento (EAP/cronograma)**, avisar **quando vai faltar material E em qual FASE vai faltar**. (Por isso o dono mandou a planilha — pra fazer "do jeito dele, melhorado".) → o pedido nasce **antes** do stockout.

## 2. Entrega em DOIS níveis
- **Planejado:** o **próprio fornecedor entrega** (agendado, mais barato).
- **Imediato:** rede estilo **Lalamove**. **Início: usar a própria Lalamove** (API). **Cotação de frete automática** pelo porte do item: **moto** (item pequeno) / **carro** / **van** / **caminhão**. → "vamos pensar juntos."
  - *(Minha melhoria: o item do catálogo carrega dimensão/peso → o sistema escolhe o veículo e cota o frete sozinho. E decide o nível: se a necessidade foi PREVISTA, vai pro fornecedor (planejado); se é "faltou agora", vai pro Lalamove.)*

## 3. Hardware na obra: TABLET por COMODATO
- Toda obra tem um **tablet** do Hub (por comodato) pra o sistema operar na obra — **além do login próprio** de cada usuário.
- **Check-in/check-out é EXCLUSIVO no equipamento do Hub** (controle + geolocalização + dado confiável). É a âncora de controle.

## 4. IA de campo: o tablet "toca" e pergunta (ideia do dono p/ melhorar)
- A IA faz o **tablet tocar** e faz **perguntas direcionadas a especialidades específicas presentes** na obra (checkin diz quem está lá): tem material? como está o andamento? a obra está limpa?
- **Cruza as respostas com as imagens e dados do projeto** no sistema → **força follow-up + anti-fraude** (o declarado bate com a evidência?). É o "somos juízes" no campo.
  - *(Minha melhoria: pra NÃO virar alarme chato (fadiga de alerta mata ferramenta de campo): perguntar a PESSOA CERTA (por especialidade+checkin), no MOMENTO CERTO (antes do checkout/almoço, pausas naturais), o MÍNIMO (só o que o sistema não infere). Frasear como "já vi X na foto, confirma?" — reduz o esforço e o cross-check vira a verdade. Um "check de 30s" por papel/dia.)*

## 5. Totem de compra (estilo totem do McDonald's) — voz/assistido
- O usuário **fala ou escreve "comprar tinta"**.
- O sistema **puxa os dados do projeto** → sabe e **sugere as cores usadas na obra**, mostra **fotos, marca, tamanho, quantidade, para quando a entrega**.
- Pedido pronto → vai **automático aos responsáveis E ao fornecedor** → entra no ciclo (cotação/aprovação/pagamento/escrow/entrega/tracking).
- **Gatilho pela mão de obra:** ao fazer **checkin** (geo+papel conhecidos), o sistema pode **pré-preparar a necessidade provável** ("você está na frente de pintura do Andar 8 — precisa de tinta?"). O totem fica 1-toque porque o contexto já é conhecido.

## 6. Teste inicial (cold-start disciplinado)
- **Só São Paulo capital.** ~**20 fornecedores de regiões diferentes**, **poucos por região** (densidade + controle).
- **Fornecedores trabalham dentro dos NOSSOS KPIs** (quem vende produto/insumo tem que cumprir).
  - *(Minha sugestão de KPIs: % entrega no prazo, frescor de preço, fill rate (atendeu o pedido completo?), taxa de devolução/defeito, tempo de resposta. Score governa ranking e permanência — a "engenharia auditorial" aplicada ao marketplace.)*

## 7. Dor REAL validada (hoje mesmo)
Um engenheiro do dono **teve que largar a obra sozinha pra comprar um rolo de cabo elétrico**. "Eu pagaria por agilidade." → é a prova viva da urgência (item pequeno, custo enorme em tempo/risco).

## Minha leitura pragmática (honesta)
- **A sequência certa:** o **cérebro** (planejamento→predição) é o que faz o totem e a entrega valerem. Fundação = E5 (pedido/estoque) + checkin (já existe) + dados de projeto (já existem). Tudo isso **já está no nosso caminho**.
- **Hardware/comodato é o ponto mais pesado** (capital, logística, roubo/quebra, conectividade na obra, manutenção). Sugestão: **v1 = app kiosk em Android barato travado** + **celular do operário com geofence** como fallback; o tablet-comodato vira o padrão premium/escala. O check-in-exclusivo-no-equipamento-do-Hub é ótimo p/ controle — só pesar o atrito/custo no cold-start.
- **Lalamove primeiro (não construir frota):** asset-light, certíssimo. Rede própria só quando o volume justificar.
- **Tudo isso é FASE 2/3** sobre a fundação que estamos construindo agora — mas o desenho já fica pronto pra plugar.

## Perguntas p/ o dono
1. O tablet-comodato é condição de entrada do fornecedor/obra desde o teste, ou começamos com celular+geofence e o tablet entra depois?
2. O frete (Lalamove) é repassado ao cliente no custo, ou entra no spread/serviço?
3. Os KPIs de fornecedor: começamos com quais 3-4 (pra não engessar o onboarding dos 20)?

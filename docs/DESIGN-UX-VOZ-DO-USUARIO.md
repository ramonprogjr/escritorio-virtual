# 👥 DESIGN UX — Voz do Usuário (roleplay Fable: arquiteta/engenheiro/corretora/prestador)
> Mesa Fable roleplay — 06/jul. Fluxos/telas/IA-first vividos por 4 personas. Complementa [[spec-rede-comissoes-financeiro-por-negocio]] e [[decisoes-alavanca-06jul-faixa-escrow-tijolos]]. Aprovado pelo CEO.

## 🔀 Fluxos-chave
## Fluxo 1 — Indicação → Comissão (Claudia corretora + Marina arquiteta, as duas pontas)
1. **Capturar falando** (calçada, 30s): segura o microfone → "indiquei a Fernanda, prima da Dona Lúcia, reforma, manda pra Marina" → card pré-preenchido (quem / pra quê / pra qual parceiro / % prevista) → **1 botão Confirmar**.
2. **Carimbo imediato e imutável**: "Indicação registrada 05/07 09h17 — 10% do valor do projeto — regra: cadastro de parceiro Claudia". A prova nasce ANTES do negócio existir — é isso que tira a indicação do WhatsApp.
3. **Do outro lado, o lead chega carimbado**: Marina abre o app e vê "Novo lead: Casa Alphaville — indicado por Ricardo M." sem ninguém digitar origem. O split herda do cadastro do parceiro (ou nasce no negócio) e aparece na CARA do negócio.
4. **Vácuo preenchido pelo sistema**: "Marina visualizou" → "agendou reunião" → "proposta enviada, sua parte: R$ 1.800". Cada push deep-linka. Silêncio de 3 dias = abandono; SLA joga a favor de quem indicou.
5. **Fechamento com simulação**: antes de marcar ganho, Marina pergunta "se eu fechar em 38 mil, quanto EU levo e quanto vai pro Ricardo?" → líquido dela, parte dele, taxa do Hub, datas.

## Fluxo 2 — Ganho → Nascimento automático (o momento mais crítico do produto)
1. Toque em "Marcar como ganho".
2. **No segundo seguinte**, confirmação explícita: "Negócio ganho. Criados: Obra Casa Alphaville, 3 recebíveis seus (R$ 11.4k/15.2k/11.4k), 1 recebível do Ricardo. Ver extrato." — com links.
3. Se a tela ficar muda, o usuário confere tudo na mão por desconfiança (ou duplica). Este é o fecho de loop que liga CRM → obra → financeiro que já está na espinha do sistema (`tipo_fecho`).

## Fluxo 3 — Serviço do prestador, ponta a ponta (Jonas: aceito → foto → aprovou → caiu)
1. **Convite pelo zap** com link → entra **sem senha** (número + código SMS, "igual banco").
2. Tela única: "VOCÊ TEM 1 SERVIÇO — Pintura apto 302 — R$ 1.800 — começa segunda" → botões gigantes **ACEITO / NÃO POSSO**.
3. Pós-aceite, a frase de ouro do escrow: **"O dinheiro já está separado."** (dupla-chave traduzida pra linguagem de gente — mata o medo nº 1: fazer e o cara sumir).
4. Avanço = **CÂMERA direto + falar** ("terminei a primeira demão da sala") → IA transcreve e classifica na EAP → "Confirma?" → verde. 10 segundos, mão suja de tinta. Offline honesto: foto fica no aparelho, sobe com sinal, avisa "suas 3 fotos de ontem foram enviadas ✓".
5. Botão **TERMINEI** (essa palavra) → rastreio 4 bolinhas estilo Correios: ENVIADO → EM ANÁLISE → APROVADO → PAGO, com nome de quem aprova e prazo ("se passar de sexta, a gente cobra ele pra você").
6. "APROVADO! Cai até terça via PIX" → PIX cai na data → **conversão permanente**. Próximo serviço ele aceita antes do concorrente.

## Fluxo 4 — Medição e pagamento com 2 chaves (Rogério engenheiro + Marina arquiteta)
1. Home = "Minha fila": 1 medição a confirmar, 2 pagamentos aguardando OK — nada em menu profundo; app sabe em qual obra ele está (GPS/última obra).
2. **MEDIR abre a câmera** (nunca formulário): 4 fotos + vídeo, fala as quantidades e ressalvas → IA devolve "39,5 de 42 m² (94%). Confere?" → confirma **ou corrige por voz com motivo registrado** ("não, 90%, falta encunhar") — medição que não pode contestar é medição que não assina.
3. **Aprovação de pagamento em UMA tela**: combinado (escopo+preço) × medido (fotos de agora) × histórico do prestador na obra → OK técnico com **valor por extenso** (fricção desejada — assina cheque).
4. Carimbo protetor: "Seu OK registrado 7h38. Aguardando chave do Hub. Você não pagou — aprovou." Pipeline visível pra mostrar ao prestador onde está o dinheiro dele.
5. Aviso ativo quando o dinheiro SAI: "o Hub liberou os R$ 1.880 do João às 15h02".

## Fluxo 5 — "Cadê meu dinheiro?" (a pergunta nº 1 de todas as personas)
1. Falado ou 0 toques na home: "quanto eu tenho pra receber este mês e quando cai cada parcela?"
2. Resposta = extrato de banco: 3 linhas, data + valor + origem + status + **próximo passo por status** ("aguardando repasse; se atrasar, o Hub cobra em 13/07").
3. Cobrança delegada sem constrangimento: "dá um toque na Marina sobre a Fernanda" — o Hub cobra, o usuário não vira o chato da rede.

## Fluxo 6 — Fechamento do dia
"Resume meu dia" → o que mediu/aprovou/ganhou, R$ a receber nos próximos dias, pendências de amanhã, e a frase-ouro: **"nada travado esperando você"**. É a ausência de pontas soltas — não feature — que faz voltar amanhã.

## 🖥️ Telas
## Sistema de telas (a home MUDA por papel; o resto é compartilhado com lentes)

### 1. Home por papel — a regra: o primeiro olhar responde a pergunta nº 1 daquela persona
- **Prestador (Jonas)**: tela ÚNICA — "VOCÊ TEM 1 SERVIÇO" + valor grande + ACEITO/NÃO POSSO. Sem menu, sem sidebar, sem as palavras EAP/escopo/medição/dashboard. Hierarquia: valor R$ → endereço/data → 2 botões. Nada mais.
- **Corretor (Claudia)**: home = EXTRATO. 3 números grandes: Previsto / A Receber / Recebido (em R$). Tocar em qualquer número abre a origem por negócio. Se abrir em dashboard de obra, ela fecha o app.
- **Engenheiro (Rogério)**: home = "Minha fila" — cartão único no topo com tudo que espera o OK dele (medições, pagamentos, prestadores), agrupado por obra. Hierarquia: pendências → 3 obras → financeiro consolidado.
- **Arquiteta (Marina)**: cockpit — leads novos carimbados com "indicado por" + aprovações pendentes (2ª chave) + "a receber este mês" visível sem toque.

### 2. Tela do negócio com FAIXA DE SPLIT na cara
"Deste negócio: você 90% / Ricardo 10%" + R$ de cada parte, **bruto E líquido da taxa do Hub**, ANTES de fechar. Aba secundária de comissão = Marina fecha com medo ou liga pro parceiro. Lente "minha parte" para participantes: linha do tempo do estágio, minha %, regra que gerou, data prevista.

### 3. Extrato "Meu Dinheiro" (universal, estética de banco)
Linhas: data / valor / origem (honorário, comissão, medição) / status (confirmado, aguardando, atrasado) / **próximo passo do status** / comprovante PIX baixável. Para Jonas: versão sem gráficos — A RECEBER (com data) + JÁ RECEBI NO MÊS + lista com ✓. Exportável (imposto de renda da Claudia; referência de serviço do Jonas).

### 4. Aprovação de pagamento (2ª chave) — a única tela onde atrito é feature
UMA página: combinado (escopo+preço unitário) × medido (fotos de agora) × histórico do prestador (recebido, retenção) × quem deu a 1ª chave → confirmação com **valor por extenso**. Depois: pipeline carimbado (Medido → OK técnico 7h38 → Chave Hub → Pago + comprovante).

### 5. Medição/avanço de campo — câmera primeiro, formulário nunca
Botão CÂMERA gigante + microfone → captura → IA transcreve e resume "X de Y (Z%)" → 1 toque confirma ou corrige por voz. **Fila de upload honesta**: "enviando 2 de 5" / "salvo no aparelho, envio quando pegar sinal" / "tudo na nuvem ✓" — nunca spinner mudo. Check de nuvem por foto.

### 6. Rastreio do pagamento (prestador) — 4 bolinhas estilo Correios
ENVIADO → EM ANÁLISE → APROVADO → PAGO. Cada bolinha: data, nome de quem precisa agir, prazo previsto. Bolinha amarela é clicável: "e aí, quando sai?" → resposta humana + "se passar de sexta, a gente cobra ele pra você".

### 7. "Minhas participações" / "Minhas indicações"
A visão do MEU dinheiro dentro de negócios de OUTROS (funil que eu não opero): indicação → o que vale → fase → documento-âncora do valor → % travada com log de quando a regra nasceu. Status semáforo: aguardando parceiro / andando / fechou / perdeu (com motivo). Com "visto" do parceiro (mata o vácuo).

### 8. Fluxo "Indicar" de 1 toque
Botão fixo + microfone → card pré-preenchido → Confirmar único → comprovante carimbado (data/hora, regra escrita, imutável).

### 9. Carteira com separação DURA
Duas seções com cara visualmente diferente: "**Meu dinheiro** (R$, sacável via PIX)" vs "**Meus créditos** (Tijolos, para usar IA no app)". Nunca somados juntos. Saldo de Tijolos com equivalente em R$ + extrato de consumo por ação de IA + PIX pra comprar. **Para o prestador: Tijolos nem aparecem.**

### 10. Confirmação pós-ganho
Lista do que nasceu automaticamente (obra + recebíveis meus e dos parceiros) com links. É a tela que impede a conferência-por-desconfiança.

### 11. Ficha do prestador pronta para aprovação
Docs, histórico na plataforma, avaliação → aprovar em 2 toques. Ninguém digita dados de terceiro em pé na obra.

### 12. Extrato compartilhável com o cliente
Gerado por voz ("manda o extrato do Jardim Europa pro cliente"): pago/pendente linha a linha com evidência (foto) e quem aprovou. Cara de documento bancário. **Mesma fonte que o Hub vê** — sem versão paralela.

### 13. Resumo do dia
O que fiz (com foto, hora e meu nome), o que liberou, o que me espera amanhã, e "nada esperando você" quando for verdade.

## 🗣️ Padrões IA-first (Talk-and-Go)
## Os momentos Talk-and-Go que mais aliviam atrito (rankeados pela dor que curam)

### 1. A pergunta do dinheiro em linguagem natural — a nº 1 das 4 personas
"Quanto eu tenho pra receber este mês e quando cai cada parcela?" / "quando cai o dinheiro da venda do Roberto?" / "quem me deve?" → resposta-extrato: valor + data + status + próximo passo + link. Marina: "a conta que me dava ansiedade virou uma frase — é o momento em que o app ganha meu coração." Nunca deveria exigir navegação.

### 2. Registro de campo por voz + câmera (medição, avanço, diário)
Mão suja, sol, 4G ruim: falar durante o vídeo ("42 m², ficou 3 m perto da porta") e a IA preenche a medição, classifica na EAP e só pede CONFIRMA. É onde TODO app de obra morre hoje — e onde o WhatsApp+caderninho vence se falharmos. Inclui correção por voz com motivo ("não, 90%, falta encunhar") e diário ditado ao fim da visita.

### 3. Indicação falada em 30 segundos (o momento nº 1 da corretora)
"Indiquei a Fernanda, prima da Dona Lúcia, reforma, manda pra Marina" → card + 1 Confirmar + carimbo imutável. Se virar formulário de 12 campos, a indicação vai pro zap e a plataforma perde o registro E a corretora perde a prova.

### 4. Simulação de split antes de fechar
"Se eu fechar em 38 mil, quanto EU levo e quanto vai pro Ricardo?" → líquido meu, parte do parceiro, taxa do Hub, datas. Fazer isso clicando exigiria uma calculadora escondida em 3 telas.

### 5. Cobrança delegada — a IA como neutralizador de constrangimento
"Dá um toque na Marina sobre a Fernanda" / "se passar de sexta, a gente cobra ele pra você". Cobrar humano é constrangedor e assimétrico (o pequeno cobrando o grande); o sistema cobrando POR você preserva a relação e — palavras do Jonas — "nenhum app nunca fez isso por mim".

### 6. Tradutor de jargão sem vergonha
"O que significa 'aguardando chave técnica'?" → "Falta a aprovação do arquiteto. Cobramos ele por você." Jonas tem vergonha de perguntar a um humano o que é EAP; pergunta pra IA sem custo social. Todo termo de sistema precisa de tradução de uma frase, in-place.

### 7. Resumo do dia / "tem algo esperando eu?"
Resposta falada no carro, mãos no volante: financeiro da obra, pendências, e a frase de paz "nada travado esperando você". Fechamento mental sem abrir 5 telas.

### 8. Geração de documentos por voz
"Monta o orçamento a partir deste memorial (PDF)" (horas de planilha → minutos + consumo de Tijolos transparente) e "manda o extrato da obra pro cliente" (a planilha de domingo à noite virou uma frase).

### 9. Follow-up sugerido, decisão humana
"O cliente Alphaville não responde há 4 dias, quer que eu mande a mensagem X?" → usuário só confirma. **Padrão transversal: a IA sugere e executa o trivial; o humano confirma o que leva o nome dele — e o log separa sugestão de decisão.**

### Regra de ouro do conversacional
Toda ação por voz devolve um **card de confirmação do que a IA entendeu** antes de executar, e o registro guarda "o que falei → o que o sistema entendeu → o que confirmei". É a defesa do usuário ("pra ninguém dizer que eu declarei outra coisa") e a nossa.

## 🎯 Princípios de design
- ESTÉTICA DE BANCO, NUNCA DE JOGUINHO: dinheiro tratado com a seriedade de extrato bancário — datas, valores, status, comprovante; zero gráfico de pizza e gamificação nas telas de dinheiro (as 4 personas convergem nisso).
- DINHEIRO SEMPRE COM DATA E PRÓXIMO PASSO: valor sem 'quando' aumenta ansiedade; status sem ação ('aguardando repasse') vira ansiedade — cada status diz o que acontece a seguir e quem age ('se atrasar, o Hub cobra em 13/07').
- CÂMERA E VOZ PRIMEIRO EM CAMPO, FORMULÁRIO NUNCA: qualquer digitação obrigatória em pé na obra/calçada = abandono para o WhatsApp; o teto é capturar → IA resume → 1 toque confirma.
- FRICÇÃO PROPORCIONAL À RESPONSABILIDADE: o app inteiro é 1 toque, EXCETO assinar pagamento — aí a 2ª chave quer valor por extenso ('me trata como quem assina cheque'). Resolve a tensão Jonas-simples × Marina-controle: quem só recebe confirma com 1 botão; quem aprova tecnicamente ganha a fricção que pediu.
- O SISTEMA MOSTRA O QUE FEZ SOZINHO: toda automação (ganho → obra + recebíveis) devolve confirmação explícita com links; tela muda após ação importante = pânico silencioso e conferência-por-desconfiança.
- UPLOAD HONESTO, OFFLINE-FIRST: estado de persistência sempre visível ('enviando 2 de 5' / 'salvo no aparelho, sobe com sinal' / 'na nuvem ✓'); spinner mudo = usuário duplica no WhatsApp e o zap vira o sistema de verdade.
- LINGUAGEM POR PAPEL, PROFUNDIDADE SOB DEMANDA: zero jargão (EAP, escrow, tenant, chave técnica, códigos PS/NG) para prestador e corretor — 'Falta a aprovação do arquiteto'; o controle profundo (logs, bases de cálculo) existe mas atrás de um toque, não na frente. Jonas vê 4 bolinhas; Marina vê o pipeline completo — é a MESMA verdade em duas lentes.
- SEPARAÇÃO GRITANTE R$ × TIJOLOS: comissão = R$ sacável via PIX, Tijolo = crédito de IA; nunca somados, nunca vizinhos, seções com cara diferente; para o prestador, Tijolos nem aparecem — qualquer ambiguidade lê como pirâmide/golpe e é quase irreversível.
- 'NADA ESPERANDO VOCÊ' DITO COM TODAS AS LETRAS: a fila de pendências é explícita e a ausência de pendência é declarada — é o que permite confiar que quando tiver algo, o app avisa.
- LOG IMUTÁVEL É PRODUTO, NÃO BASTIDOR: carimbo de quem/quando/regra em split, indicação, medição, chave, pagamento — visível ao usuário porque é a defesa jurídica dele ('minhas fotos são minha testemunha'); edição vira nova versão, nunca sobrescreve.
- SPLIT NA CARA E TRAVADO NA ORIGEM: a regra de comissão aparece na faixa do negócio (com base bruto/líquido explícita) e nasce carimbada no momento da indicação — mudança de % sem consentimento é linha vermelha de confiança.
- DARK DE VERDADE COM CONTRASTE ALTO E ALVOS GRANDES: sol na tela, reflexo, Android antigo, dedo empoeirado — letra grande, máx. 2 decisões por tela no mobile de campo; alinhado ao dark verde+dourado já travado.
- MÁXIMO 3 TOQUES ATÉ A AÇÃO DE CAMPO: navegação Empresa>Obra>EAP>pavimento>serviço mata o uso; contexto (GPS/última obra) pré-seleciona onde o usuário está.

## 💡 Voz do Usuário — insights que o código não pega
- O WHATSAPP É O CONCORRENTE REAL, E ELE VENCE POR CONFIANÇA, NÃO POR FEATURE: 'o zap nunca me deixou na mão e o caderninho nunca pediu senha' (Jonas). Qualquer falha de persistência ou silêncio faz o usuário duplicar no zap — e a cópia de segurança vira o sistema de verdade, o app vira enfeite. Auditoria de código nunca veria isso: o código 'funciona', mas o usuário já migrou.
- O PÂNICO DO SILÊNCIO PÓS-AÇÃO: marcar 'ganho' e a tela ficar quieta gera 'será que registrou? cadê minhas parcelas?' — o usuário confere tudo na mão por desconfiança, que é o oposto de produto bom. O bug não é funcional, é emocional: falta a confirmação do que nasceu.
- TIJOLO LÊ COMO GOLPE PARA QUEM JÁ FOI ENGANADO: 'promessa de ponto e crédito pra quem trabalha de mão de obra sempre foi jeito de não pagar o peão' (Jonas); 'cheiro de pirâmide' (Claudia); 'se eu achar que fui paga em Tijolo, saio no mesmo dia' (Marina). É trauma cultural, não confusão de UI — exige separação gritante e, para o prestador, ocultação total.
- 'O DINHEIRO JÁ ESTÁ SEPARADO' É O ESCROW INTEIRO EM UMA FRASE: o medo nº 1 do prestador não é o serviço, é fazer e o cara sumir. A dupla-chave técnica que construímos só gera confiança se for TRADUZIDA — mostrada como cofre antes do pincel encostar na parede. Jargão ('aguardando chave técnica da vertical') faz o mesmo mecanismo parecer travado.
- COBRAR É CONSTRANGEDOR — E O SISTEMA COBRANDO POR VOCÊ É INÉDITO PARA O PEQUENO: 'pela primeira vez um app do lado do pequeno' (Jonas, sobre 'se passar de sexta a gente cobra ele pra você'); 'eu não viro a chata da rede' (Claudia). A IA como neutralizador de constrangimento social é um diferencial que nenhuma auditoria técnica listaria.
- A FOTO É TESTEMUNHA JURÍDICA, NÃO ANEXO: 'já perdi evidência em outro app e virou palavra do prestador contra a minha' (Marina); 'a foto é meu comprovante' (Jonas). Foto que some com 'erro de conexão' quebra confiança de forma quase irreversível — a fila de upload honesta é feature de confiança, não de infra.
- O ÚNICO LUGAR ONDE O USUÁRIO PEDE FRICÇÃO: Marina QUER valor por extenso ao aprovar pagamento — 'é o único lugar do app onde atrito é feature'. Todo o resto do app pede 1 toque. Otimizar fricção uniformemente (pra cima ou pra baixo) erraria nos dois sentidos.
- VERGONHA DE JARGÃO É BARREIRA SILENCIOSA: Jonas 'não sabe o que é EAP e tem vergonha de perguntar' — ele não abre ticket, não pergunta ao Ramon, simplesmente conclui 'isso não é pra mim' e some. Perguntar à IA não tem custo social — o tradutor in-place é retenção.
- O OK TÉCNICO PRECISA DIZER O QUE NÃO É: Rogério faz questão que o app deixe claro 'eu aprovei, mas eu não paguei' — senão a cobrança do prestador cai nele. O carimbo 'seu OK 7h38, com o financeiro do Hub desde então' o protege da saia justa. Responsabilidade preta no branco é UX.
- O DIA BOM É A AUSÊNCIA DE PONTAS SOLTAS: 'fecho o app com a sensação rara de que nada ficou solto — é essa sensação que me faz voltar amanhã, não é feature' (Marina). Retenção mora no resumo do dia e no 'nada esperando você', não em telas novas.
- STATUS SEM PRÓXIMO PASSO É ANSIEDADE, NÃO INFORMAÇÃO: 'aguardando repasse do vendedor' incomoda não por ser ruim, mas porque 'eu não sei o que EU posso fazer com isso — espero, cobro ou desisto?'. Todo estado precisa de dono e desfecho previsto.
- VELOCIDADE DE ACEITE É VANTAGEM COMPETITIVA DO PRESTADOR: 'vou clicar em ACEITO mais rápido que o Almir lá do bairro, porque quem responde primeiro pega o serviço' — o fluxo zap→1 toque não é conveniência, é o motivo de ele preferir a plataforma.
- LOGIN COM SENHA É PAREDE FATAL (confirma a auditoria de retenção de 05/jul pela voz): Jonas tem UMA senha na vida (a do banco) e um e-mail que nunca abre; 'esqueci a senha' termina em ligação pro arquiteto e o sistema vira enfeite. SMS no número, 'igual banco', é o único caminho que ele reconhece como seguro.
- O MEDO DA RENEGOCIAÇÃO PELAS COSTAS: a pulga de Marina em 'Minhas participações' não é a UI — é 'quem garante que o Ricardo registrou o valor certo?'. Só o log acalma: regra criada no momento da indicação + documento-âncora do valor anexado. Split imutável na origem é o contrato social da rede.

## 🧭 Decisões do dono (UX)
1. BASE DO SPLIT — BRUTO OU LÍQUIDO DA TAXA DO HUB: Marina fez conta de cabeça no meio do fluxo porque não sabia se os 10% do Ricardo incidem antes ou depois da taxa. É regra de negócio que define TODO cálculo de comissão exibido; precisa ser travada pelo dono e ficar explícita na faixa de split de cada negócio.
2. LOGIN DO PRESTADOR SEM SENHA (link WhatsApp + OTP por SMS no número): confirma a parede fatal já apontada na auditoria de retenção. Envolve custo de SMS, mudança no fluxo de auth do Supabase e postura de segurança — decisão de infra+negócio do dono. Sem isso, a persona prestador não entra no sistema, ponto.
3. COBRANÇA AUTOMÁTICA PELO HUB (SLA com escalada): 'se atrasar, o Hub cobra em 13/07' e 'se passar de sexta, a gente cobra ele pra você' são promessas ao usuário que viram obrigação operacional do Hub — política de prazos, tom da cobrança e o que acontece se o cobrado não responder são decisões do dono.
4. EXPOSIÇÃO DA CARTEIRA TIJOLOS POR PAPEL: recomendação da mesa é OCULTAR Tijolos completamente para o prestador e separar de forma gritante para os demais (duas seções, nunca somadas). Mexe no modelo da moeda da plataforma (spread, upsell de créditos) — o dono decide até onde a carteira aparece para quem.
5. SPLIT IMUTÁVEL CARIMBADO NA ORIGEM: a regra de comissão nasce travada no momento da indicação (com documento-âncora do valor) e alteração de % exige consentimento do afetado + log. É o contrato social da rede de parceiros — precisa de aval do dono porque restringe renegociações comerciais legítimas também.
6. DATA PREVISTA DE PAGAMENTO COMO COMPROMISSO EXIBIDO: 'cai até terça via PIX' converte o prestador PARA SEMPRE — mas só se cumprir. Exibir estimativa honesta que pode mudar vs data firme é decisão de risco/operação financeira do dono (Claudia: 'prefiro estimativa honesta que mude a nada').
7. CONTEXTO DE OBRA POR GPS: o engenheiro espera que o app saiba em qual das 3 obras ele está. Envolve permissão de localização e privacidade dos usuários de campo — dono decide se entra e com qual fallback (última obra visitada).
8. EXTRATO COMPARTILHÁVEL COM O CLIENTE FINAL = MESMA FONTE DO HUB: gerar por voz um extrato pago/pendente com evidências para o cliente da obra expõe dados do financeiro para fora da plataforma — alinhado à alma do Portal do Cliente, mas o dono trava o quê aparece (valores de prestadores? só marcos?).
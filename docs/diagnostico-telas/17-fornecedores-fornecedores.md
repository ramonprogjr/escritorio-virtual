# Fornecedores  ·  Fornecedores

**Rota:** 

## Veredito do diretor
Tela bonita e coesa (dark verde+dourado), com boa estrutura leve (form inline, lista em vez de planilha, edição em 1 clique) — mas REPROVADA no que mais importa: ela NÃO cumpre o job-fim do produto. Confirmei no código (app/crm/fornecedores/page.tsx, linhas 40-43 e 144-155): o formulário só captura 7 campos de contato; NÃO existe mercados, NEM recebe_leads, NEM status_acesso. A API trafega esses três campos, mas a UI os ignora — logo todo fornecedor nasce sem mercado e sem flag de recebimento, ou seja, FORA do motor de distribuição, e não há como aprová-lo pela tela. Isso é fachada parcial: cadastra mas não habilita. Para o TODO, esta é a tela-base do motor multi-tenant — sem ela funcionando, o Hub não distribui lead nenhum, e telas a jusante (Distribuição de Leads, Negócios) operam sobre uma base vazia/inconsistente. Veredito: a tela tem ossatura boa; o problema é de COMPLETUDE funcional e de IA-first, não de redesenho. Prioridade absoluta: fechar o trio mercados+recebe_leads+status. Sem isso, nada mais nesta tela importa.

## Cenários trazidos
- SERVIR O HUB vs SERVIR O COMERCIAL: O propósito real desta tela é alimentar o HUB (quem recebe lead, em quais mercados, com qual aderência). O ângulo comercial (contato, telefone) é secundário e já está coberto. Decisão de diretor: esta tela é do HUB — priorizar mercados+recebe_leads+status sobre qualquer enriquecimento de contato.
- TABELA vs CARTÕES vs LISTA-AÇÃO: hoje é lista clicável (boa, cumpre 'tabela != tela de trabalho'). Não virar tabela (regressão). O upgrade certo é manter a lista mas torná-la ACIONÁVEL: badge 'recebe leads on/off' + mercados na linha + ações rápidas Aprovar/Recusar/WhatsApp, homologando em <=2 cliques sem abrir form. Cartões só se houver foto/marca do escritório — desnecessário agora.
- PF AQUI vs PF EM ESPECIALISTAS: conflito conceitual real. Memória define Especialistas (mão de obra, sem login) como cadastro SEPARADO. Cenário A (recomendado): fornecedor = PJ; remover o toggle PF e redirecionar PF para Especialistas, evitando dado duplicado que polui o score de aderência. Cenário B: manter PF só se houver MEI fornecedor legítimo da rede — então rotular claramente. Default do diretor: Cenário A.
- IA-FIRST POR CNPJ vs DIGITAÇÃO MANUAL: hoje é digitação pura. Cenário-alvo: 'Buscar por CNPJ' pré-preenche razão social/cidade/UF (Receita) e a IA sugere mercados a partir do CNAE — usuário só confirma (Click-and-Go). Reduz erro e padroniza área de atuação, que hoje em texto livre QUEBRA o score do motor.
- PROMOVER MEMBRO vs CADASTRAR DO ZERO: membro elegível já migra como fornecedor (memória). O estado vazio e o botão Novo deveriam oferecer 'Promover membro homologado' — reaproveita base existente em vez de redigitar. Evita a tela nascer vazia e conecta com a Área de Membros (referência visual boa).

## ✅ Manter
- Form inline (não navega) — ajuda os <=3 cliques
- Lista vertical clicável em vez de planilha — respeita 'tabela != tela de trabalho'
- Edição em 1 clique reaproveitando o mesmo form
- Chips de status com cor semântica (Pendente/Aprovado/Recusado/Bloqueado)
- Identidade visual dark verde+dourado coesa
- Estado vazio com CTA guiando a primeira ação
- Select de UF (já é Click-and-Go)

## ❌ Remover (ruído)
- Campo 'Área de atuação' em TEXTO LIVRE — gera 'elétrica/Elétrica/eletricista' e quebra o score de aderência do motor; substituir por chips
- Subtítulo com jargão técnico ('PJ por área de atuação · homologação por status · formato da rede') — descreve o modelo de dados, não o job; reescrever orientado ao usuário
- Toggle Pessoa Física (decisão default) — PF pertence a Especialistas; remover para evitar dado duplicado e confusão conceitual
- Ambiguidade do botão que serve de toggle sem trocar o rótulo para 'Fechar' quando aberto

## 🤖 Promover a IA-first / 1-toque
- Busca por CNPJ que pré-preenche razão social/cidade/UF (Receita) — 1 toque preenche o cadastro
- IA sugere MERCADOS a partir do CNAE/CNPJ — usuário só confirma chips (Click-and-Go)
- Promoção de membros homologados elegíveis no estado vazio e no botão Novo — sem redigitar
- Ações rápidas na lista (Aprovar/Recusar/WhatsApp) — homologar em <=2 cliques sem abrir form
- Estado vazio que sugere importar membros em vez de só pedir cadastro manual

## 🎯 Ações priorizadas

- **P1** · medio · risco baixo — Adicionar ao form os 3 campos do motor: MERCADOS (chips multi-escolha, formato Membros), RECEBE_LEADS (toggle on/off bem visível) e controle de STATUS_ACESSO (Aprovar/Recusar/Bloquear) na edição. A API já trafega os três — é ligar a UI ao que já existe. Sem isso a tela não cumpre seu propósito.  _(premissa: Acima de tudo ÚTIL e funcional (não-fachada): habilita o fornecedor para a distribuição, que é o job-fim do produto.)_
- **P2** · medio · risco baixo — Trocar 'Área de atuação' texto livre por CHIPS de múltipla escolha (mercados/áreas padronizados, ref. formato Membros), eliminando inconsistência que quebra o score de aderência fornecedor<->lead.  _(premissa: Click-and-Go (escolher, não digitar) + dados consistentes que o motor consegue pontuar.)_
- **P3** · medio · risco baixo — Tornar a lista ACIONÁVEL: mostrar badge 'recebe leads on/off' e mercados na linha, e ações rápidas inline Aprovar/Recusar/WhatsApp para homologar em <=2 cliques sem abrir o form.  _(premissa: Máximo de cliques baixo + a homologação (job central) passa a ser executável direto.)_
- **P4** · medio · risco medio — IA-first no cadastro: botão 'Buscar por CNPJ' pré-preenche razão social/cidade/UF e a IA sugere mercados pelo CNAE; usuário confirma. Adicionar validação de CNPJ/CPF/e-mail e máscara de telefone.  _(premissa: IA-first (sugere e pré-preenche, usuário confirma) + prático e fácil; reduz erro de digitação.)_
- **P5** · pequeno · risco medio — Resolver o conflito PF/Especialistas: remover o toggle PF (fornecedor = PJ) e redirecionar PF para o cadastro de Especialistas; reescrever o subtítulo para linguagem do usuário ('Empresas homologadas que recebem e atendem leads da sua rede'). Ajustar rótulo do botão para 'Fechar' quando aberto.  _(premissa: Fácil de entender + coerência com o TODO (Especialistas é cadastro separado, sem duplicar dado).)_
- **P6** · medio · risco baixo — Estado vazio e botão Novo oferecerem 'Promover membros homologados' como atalho, reaproveitando a base elegível (membro migra como fornecedor) em vez de cadastro do zero.  _(premissa: Útil e prático; conecta com a Área de Membros (referência visual) e evita base vazia.)_
- **P7** · pequeno · risco baixo — Migrar estilos inline para os tokens --obra-*/--brand-* do design system, sem mudar a aparência.  _(premissa: Bonito e coeso + manutenção; melhoria técnica que serve à consistência entre telas.)_

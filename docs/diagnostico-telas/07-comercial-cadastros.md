# Cadastros  ·  Comercial

**Rota:** 

## Veredito do diretor
A tela cumpre o job (achar, criar, abrir, editar, excluir cadastro com codigo unico) e tem fundamentos certos: busca multi-campo, codigo unico em destaque, telefone clicavel, coluna primaria sticky, sideovers de detalhe e wizard com varios pontos de entrada e pre-selecao de tipo. Mas, como esta, ela VIOLA a regra eterna 'tabela != tela de trabalho': por padrao TODAS as ~21/22 colunas vem visiveis (confirmei no codigo: a tabela renderiza todas as colunas recebidas e o hook so persiste as OCULTAS), incluindo ruido real (Tenant/UUID, 6 colunas de endereco, JSON 'Extras' cru, 2 datas de auditoria, flags de acesso). O resultado e uma planilha com rolagem horizontal, hierarquia fraca e zero IA-first na varredura. O 'menu Colunas' e um band-aid que inverte o onus: o usuario tem que esconder ~15 colunas para a tela ficar usavel. Veredito: APROVADA NO CONCEITO, REPROVADA NA EXECUCAO. Nao reescrever do zero (a logica de busca/sideover/wizard e boa); a correcao e cirurgica e de alto impacto/baixo esforco — inverter o default de colunas, podar ruido, e arrumar a hierarquia do header e das abas. Esse e um quick win que destrava a percepcao de 'sistema premium e facil' em uma das telas mais usadas do comercial.

## Cenários trazidos
- SERVIR O COMERCIAL vs SERVIR O HUB: a tela e a BASE de cadastro do tenant (job comercial = achar/criar/abrir pessoa-empresa). Gestao de acesso/homologacao (Convidar parceiro, flags Acesso) pertence ao HUB e ja tem rota propria (/crm/parceiros). Decisao do diretor: esta tela serve o COMERCIAL; o que e hub/acesso sai daqui ou vira badge resumido. Nao misturar 'base de dados' com 'gestao de acesso' na mesma tela.
- TABELA vs CARTOES: opcao A (barata, ja) = manter tabela mas com default ENXUTO (5-6 colunas) e resto opt-in; opcao B (alinhada a referencia Membros) = layout de cartoes de cadastro (avatar/iniciais + 3-4 dados-chave + acao). Recomendo faseado: A agora (corrige a dor imediata sem risco), B como evolucao para coerencia visual com Membros. Decidir B so depois que o default enxuto provar quais 4-5 campos importam de verdade.
- ONDE PERSONALIZAR COLUNA PESADA: se o usuario quer planilha completa (exportar, cruzar tudo), isso e RELATORIO. Cenario: mover a capacidade de 'ver todas as colunas/exportar' para /crm/relatorios e deixar a tela de Cadastros leve. Mantem coerencia com a regra eterna em todas as telas (nao so nesta).
- IA-FIRST DA BUSCA: opcao incremental = autofocus + atalho '/' + contadores agora; opcao ambiciosa = busca por intencao ('engenheiros de SP', 'empresas inativas em MG') que ja aplica filtros. A busca semantica depende de credito de IA (Tijolos) e custo por consulta — vale como fase 2, atras de um fallback deterministico que nunca quebra.
- SELECAO EM MASSA: hoje so serve para EXCLUIR (pior caso para destacar numa tela diaria). Cenario A = enriquecer com acoes de valor (atribuir responsavel, criar negocio, distribuir lead, exportar) e rebaixar excluir; cenario B = remover a selecao multipla ate existir caso de uso nao-destrutivo. Recomendo B agora (remove risco e ruido) e A quando a distribuicao de leads pedir acao em lote — ai a selecao nasce com proposito alinhado ao hub.

## ✅ Manter
- Busca multi-campo (nome/razao, codigo, CPF/CNPJ, e-mail, telefone) com debounce — nucleo do job
- Codigo unico (CPF/CNPJ) em destaque dourado na celula primaria — chave de dedup e identidade
- Coluna primaria Nome sticky com subtitulo codigo + telefone clicavel (Click-and-Go no contato)
- Sideovers de detalhe (Contacto/Empresa) — esta e a verdadeira tela de trabalho do cadastro; e onde endereco/extras/vinculos devem viver
- Wizard de criacao com pre-selecao de tipo (PF/PJ) e multiplos pontos de entrada (CTA, deep-link, FAB)
- Filtros que mudam por contexto (Contatos vs Empresas) — Tipo/UF/Origem/Mercado/Segmento sao cortes reais
- Banner de erro com 'Tentar novamente' (funcional, nao fachada)
- EmptyState acionavel

## ❌ Remover (ruído)
- Coluna 'Tenant' (UUID) da UI de negocio — zero valor, ilegivel, detalhe de infra e risco de confusao; restringir a modo debug/admin se necessario
- As 6 colunas de endereco (CEP, Logradouro, Numero, Complemento, Bairro, Cidade) do conjunto PADRAO — detalhe do registro, pertence ao sideover; opt-in no maximo
- Coluna 'Extras' com JSON cru truncado — extrair so o util ('Indicado por') como badge nomeado; nunca JSON cru
- As 2 colunas de auditoria 'Criado em' e 'Atualizado' do padrao — virar ordenacao 'Mais recentes' e detalhe no sideover
- Icone 'Ver' nas Acoes — redundante com o clique na linha que ja abre view
- Selecao em massa enquanto a unica acao for excluir — remover ate haver acao de valor
- Botao 'Limpar filtros' quando nao ha filtro ativo — so exibir com filtro/busca ativo, com contador ('Limpar (3)')
- Banner de sucesso persistente — auto-dismiss em ~4s
- Termo PT-PT 'registo' — padronizar 'registro' (PT-BR)

## 🤖 Promover a IA-first / 1-toque
- Default de colunas ENXUTO definido por heuristica/IA (Nome+telefone na celula primaria + E-mail, Area/Segmento, UF, Origem/Mercado) — resto opt-in; a IA pode aprender quais colunas o usuario mais abre e sugerir
- Busca IA-first por intencao que ja aplica filtros (Click-and-Go: usuario digita linguagem natural, IA pre-aplica e usuario confirma)
- Wizard de criacao que pre-preenche via CPF/CNPJ (dedup por codigo unico) + enriquecimento IA, usuario so confirma — 1 toque para criar
- Sugestao de filtros frequentes / 'salvar este filtro' aprendido pelo uso
- Quando houver acao em massa, IA sugere proxima acao (ex.: 'distribuir estes 8 leads para empresas homologadas em MG')

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Inverter o default de colunas: definir conjunto enxuto (Nome+telefone primario + E-mail, Area/Segmento, UF, Origem/Mercado) e tornar TODO o resto opt-in via ColunasMenu. Mexer na config de colunas (lib/crm/cadastro-list-columns), nao na tabela. Aditivo e reversivel.  _(premissa: tabela != tela de trabalho; minimo de cliques; util e facil de entender)_
- **P1** · pequeno · risco baixo — Remover do padrao (e da UI no caso do Tenant) o ruido: Tenant/UUID, 6 colunas de endereco, JSON 'Extras' cru, 2 datas de auditoria. Endereco/datas viram opt-in e detalhe do sideover; 'Extras' vira badge 'Indicado por'.  _(premissa: a informacao e MESMO necessaria aqui? util e facil de entender; sem vazar detalhe interno)_
- **P2** · pequeno · risco baixo — Promover 'Contatos | Empresas' de <select> embutido para abas/segmented control proeminente no topo, separado da linha de filtros; deixa claro que e o modo da tela inteira, nao um filtro.  _(premissa: <=1 clique para mudar de universo; clareza/hierarquia; mobile importa)_
- **P2** · medio · risco medio — Arrumar hierarquia do header: 1 CTA primario unico 'Novo cadastro' (preenchido verde+dourado); rebaixar 'Convidar parceiro' a secundario (outline) com rotulo claro — idealmente mover para /crm/parceiros; tratar 'Mao de obra' como item de navegacao (sub-item de Cadastros: Contatos/Empresas/Especialistas), nao botao de acao.  _(premissa: 1 acao primaria clara; nao misturar base de dados com gestao de acesso; mobile (empilhamento))_
- **P2** · pequeno · risco baixo — Adicionar contador de resultados ('38 contatos') + badge de filtros ativos; so mostrar 'Limpar filtros' quando houver filtro/busca ativo ('Limpar (3)'). Em telas estreitas, colapsar filtros secundarios atras de 'Filtros'.  _(premissa: feedback de estado; pratico e facil; mobile importa)_
- **P3** · medio · risco baixo — Polimentos de execucao: remover icone 'Ver' (linha ja abre view) e mover 'Excluir' para overflow '...'; autofocus + atalho '/' na busca; skeleton no load; EmptyState contextual (filtro ativo vs base vazia); auto-dismiss do banner de sucesso; padronizar 'registro' (PT-BR).  _(premissa: funcional nao-fachada; reduzir risco de exclusao acidental; clareza)_
- **P3** · pequeno · risco baixo — Remover a selecao em massa enquanto a unica acao for destrutiva (excluir). Reintroduzir so quando houver acao de valor (atribuir responsavel, criar negocio, distribuir lead, exportar) — alinhada ao hub/distribuicao.  _(premissa: nao destacar acao destrutiva em tela diaria; investir UI so onde ha valor)_
- **P3** · pequeno · risco baixo — Renomear rotulos confusos: 'Ativo' (empresas) para 'Situacao' (linguagem de negocio, nao jargao de banco); resolver colisao 'Tipo' (PF/Emp) vs 'Perfil' (campo tipo) e padronizar 'Perfil' como chip de valores controlados.  _(premissa: util e facil de entender; linguagem do usuario, nao do banco)_
- **P4** · grande · risco medio — Fase 2 (depois do default enxuto provar os campos-chave): avaliar layout de cartoes de cadastro (avatar/iniciais + 3-4 dados + acao) a la referencia Membros, para coerencia visual; e busca IA-first por intencao com fallback deterministico. Levar a capacidade de 'todas as colunas/exportar' para /crm/relatorios.  _(premissa: bonito e coeso com o todo (referencia Membros); IA-first; tabela pesada = relatorio)_

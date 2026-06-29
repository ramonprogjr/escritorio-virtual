---
name: diagnostico-tela-a-tela-plano-acao
description: Diagnóstico completo das 33 telas + plano de ação macro de design (aguarda aprovação do dono p/ executar)
metadata:
  type: project
---

Na noite de 26-27/jun rodou uma **varredura tela-a-tela completa** (workflow, 67 agentes: mesa-redonda audita cada elemento → diretor avalia+cenários → CEO sintetiza), sob as premissas do dono (≤3 cliques, IA-first, bonito, prático, **útil e fácil de entender**). Pedido dele: pensar cada item AGORA pra não ficar remendando depois; ele aprova de manhã, daí executamos.

**Onde está:** `docs/diagnostico-telas/` (1 .md por tela, índice em README.md) + **`docs/PLANO-ACAO-MACRO-DESIGN.md`** (parecer do CEO + temas transversais + telas prioritárias + 7 fases).

**Achados-chave (3 dívidas que se repetem):**
1. **FACHADA / MENTIRA DE DADO (P0, bloqueia apresentação):** progresso fake 0.42 (Negócios), confiança "85%" default (Aprovações, route.ts:36), ring saúde 0.35 hardcoded (Agentes/Ciclos), KPIs calculados sobre a página paginada que mudam ao "carregar mais" (Negócios/Imóveis), Conversões=0 sempre (Campanhas, falta field na Windsor), valor financeiro arredondado "R$ 2k" em telas de PAGAR (Contas a pagar/receber), selo "Verificado" órfão (Especialistas). Regra: número que mente é pior que ausente.
2. **IA-first só no diagnóstico, ausente na AÇÃO:** falta Click-and-Go real onde o motor JÁ existe — Distribuição (fila com confirmar 1-toque, reusar sugerirEncaminhamento/DistribuirLeadPanel), Atendimento (sugerir resposta), Dashboard (Ação agora c/ recomendação), Negócios (próxima ação), Tarefas. Anti-padrão proibido vivo: DIGITAR UUID/slug/UF/texto-livre (Pedidos, Projetos, Ciclos, Distribuição, Fornecedores).
3. **Vazamento técnico p/ o usuário:** env vars (UAZAPI/WINDSOR/ANTHROPIC), nomes de tabela, slugs, "porta 3001", SQL, PT-PT ("registo","activar"), "parceiro" divergente do mestre, azuis Shadcn fora da trava verde+dourado.

**Sequência das 7 fases:** F0 estancar fachada/mentira → F1 copy/poda (vazamento técnico, idioma, azuis) → F2 blindar ações sensíveis/financeiras (feedback+undo) → F3 ativar IA-first onde o motor existe → F4 tabela→cards/Kanban + KPIs duplicados → F5 separar plataforma×tenant (condicionar por perfil) → F6 conectar financeiro/obra ao motor + deferir gestão de obra (aguarda dados do dono). Tudo ADITIVO, com gates. Ver [[feedback-auditoria-tem-que-consertar]] (auditoria tem que CONSERTAR, não só relatório).

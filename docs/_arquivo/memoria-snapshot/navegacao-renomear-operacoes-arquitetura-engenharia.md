---
name: navegacao-renomear-operacoes-arquitetura-engenharia
description: REQUISITO (atribuído p/ executar no momento oportuno do cronograma) — renomear/reestruturar navegação: Operações/Obras→Operações; Projetos→Arquitetura (com Projetos dentro); Obras→Engenharia (com Construção + Reforma separados)
metadata:
  type: project
---

Pedido do Wendel (25/jun/2026). **Regra:** *"tudo que peço deve ser atribuído; no momento oportuno do planejamento; o cronograma é absoluto"* — ou seja, **registrar agora e executar no ponto certo da sequência**, não fora de hora.

**Renomeações/reestruturação de navegação (menu `lib/crm-nav-groups.ts`):**
1. Grupo **"Operações / Obras" → "Operações"** (só esse nome).
2. **"Projetos" → "Arquitetura"** — e **dentro de Arquitetura deve existir "Projetos"** (Projetos pertence a Arquitetura, que terá **outros campos** que o Wendel adicionará depois).
3. **"Obras" → "Engenharia"** — e **dentro de Engenharia: "Construção" e "Reforma" separados** (cada um terá mais serviços atrelados que ele vai relacionar depois).

**Implicação:** Arquitetura e Engenharia viram **áreas/módulos** com sub-itens (não só links soltos). Isso é fundação para os módulos futuros (Bloco 6 Obra/Engenharia + Arquitetura). Mexe em: `lib/crm-nav-groups.ts`, `app/crm/layout.tsx` (grupos aninhados), e possivelmente nas rotas/telas correspondentes (projetos→arquitetura, obras→engenharia/construção/reforma). Fazer **aditivo**, preservando rotas existentes; mapear destino antes de renomear. Ver [[plano-executivo-blocos]] (Onda UX-R / Bloco 6), [[menu-navegacao-consolidado]] se existir.

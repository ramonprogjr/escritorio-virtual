# 🌙 PLANO DE AVANÇO — maratona noturna 29→30/jun (autônomo)

> Mandato do dono: "trabalhar a noite toda, avance com o que não depende de mim, mesa redonda para todo ponto interessante ou importante." Régua por frente: **(mesa redonda se for design novo) → build → auditoria adversarial → gates (tsc+vitest+build) → deploy (#N) com `git pull --rebase`.** Migrações = SÓ-ARQUIVO (janela do dono). Tudo aditivo, tolerante, tenant-safe, honesto (funcional, não fachada).

## Régua de autonomia
- ✅ Faço sozinho: mesas (design), builds (file-only migrations + código tolerante), auditorias, fix, deploys, docs/memória.
- ⛔ NÃO bloqueio a noite por: aplicar migrações (sua janela), Mistral/Groq (amanhã), 3b margem, GitHub próprio, BaaS — sigo construindo tolerante.

## Sequência (ordem de dependência + valor)
1. **#14 — Orçamentária v1 (obra):** planilha orçamentária (CSV) + memorial descritivo da MESMA árvore. [build em curso → auditoria → deploy]
2. **🟡 MESA — Orçamentária como SETOR cross-vertical:** o padrão único de orçamento p/ arquitetura·engenharia·serviços·produtos (modelo + navegação + reuso do motor). [design doc] — rodando AGORA em paralelo.
3. **#15 — Orçamentária: Proposta + Contrato:** os outros artefatos da mesma árvore (bifurca tipo_contrato). [build → auditoria → deploy]
4. **#16 — Ambiente como nível real da EAP:** `tipo_no` (frente/ambiente/disciplina) + area_m2 — ambiente vira nó real. [migração só-arquivo + build → auditoria → deploy]
5. **#17 — E4 Curva-S:** cronograma/curva-S pendurado no PESO do item de escopo (físico×financeiro). [build → auditoria → deploy]
6. **🟡 MESA — Central de Aprovações** (espinha de decisão) → build fundação → **#18**.
7. **🟡 MESA — Gestor de Tarefas universal** (espinha de execução) → build fundação → **#19**.
8. **🟡 MESA — Portal do Cliente** (cura os 5 medos) → build → **#20**.
9. Se a noite render: E8 RDO · cross-conta CRM · Hub dashboards absurdamente bons.

## Pendências do dono (não bloqueiam — pra quando você acordar)
- Aplicar migrações na ordem (E0→E6 + E7/E7b/E7c + as da noite) = liga custo/preço/medição/etc.
- Mistral → Groq FREE no Render (atalho em `MISTRAL-RESOLVER-AMANHA.md`).
- 3b margem (Hub vê custo×preço?) · GitHub próprio de backup · parceiro BaaS.

## Estado ao iniciar a noite
13 deploys auditados no ar · planilha viva (Fase 2) + medição (Fase 3a) prontas · Orçamentária v1 em build.

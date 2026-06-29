---
name: modulo-engenharia-obra
description: "Módulo Engenharia/Gestão de Obra (Bloco 3) — wizard 5 passos + 4 telas (Escopo, Cronograma/Curva S, Avanço&Medição); 2 forks Construção×Reforma e Com×Sem projeto; é o destino do botão \"Gerar obra\" (Bloco G)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 635246fa-0a11-4787-bf12-7900cf1c8059
---

Lado "executar" de [[plataforma-arquitetura-visao]]. Quando um negócio é GANHO no CRM e vira projeto/obra/serviço, entra aqui. É o destino do botão **"Gerar obra/projeto" no negócio ganho (Bloco G)** — já existe no código (commits e561dab/656610f).

**2 forks comandam tudo:**
- **Construção × Reforma:** Reforma injeta frente *Demolição* + campo **"existente (as-found)"**; Construção = sequência estrutural sem "existente".
- **Com projeto × Sem projeto** = a **fonte da verdade** da medição: Com projeto → mede CONTRA O PROJETO (IA extrai de PDF/DWG/XLSX/IFC-BIM); Sem projeto → mede CONTRA O ESCOPO ACORDADO (IA estima de descrição/área/fotos, marca "estimativa"). Projeto que chega depois → reconciliação → aditivos.

**4 telas (+ wizard):**
1. **Wizard de obra (5 passos):** Tipo → Origem → Dados+Contrato (cliente do CRM, valor, prazo, forma de medição, BDI, retenção, papéis — mín. Eng. responsável; código curto alimenta Compras `CO.<código>`) → confirmar frentes→itens (selo Projeto/Estimativa/Aditivo, critério de aceite, evidência) → cronograma-base+quantitativos+financeiro → "Criar obra" gera EAP+cronograma+Curva S+Cockpit.
2. **Escopo & Quantidades (EAP):** frentes→itens prev×exec×saldo; aditivos recalculam tudo; saldo → requisição de compra 1 clique.
3. **Cronograma & Curva S:** Gantt + caminho crítico + previsão de atraso pelo ritmo real; baseline travada + revisões rastreáveis; vínculo cronograma↔compra↔avanço.
4. **Avanço & Medição:** avanço físico → faturamento; **regra dura: medido nunca passa do contratado sem aditivo aprovado**; retenção controlada; gates Rascunho→técnico(Eng)→cliente/fiscal→financeiro; Curva físico-financeiro (previsto×realizado×medido×faturado); medição aprovada → conta a receber.

**Transversais:** confiança visível em campo da IA + correção 1 toque; origem rastreável (arquivo+página) p/ auditoria; **aprovação humana obrigatória** em contrato/prazo/dinheiro/critério de aceite/baseline/aditivo; mobile=campo (evidência/voz/foto), desktop=montar/aprovar boletim; sem evidência → item bloqueado.

**Pendência:** módulo **Compras** (`CO.<código>`, requisição por saldo, lead time) citado mas ainda NÃO detalhado pelo Wendel — bloco futuro.

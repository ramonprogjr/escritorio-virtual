---
name: operacao-campo-tablet-totem
description: "Operação de campo: alerta preditivo de material (por fase), tablet por comodato (checkin exclusivo), IA que 'toca' e pergunta cruzando com fotos, totem de compra por voz, entrega 2 níveis (fornecedor/Lalamove), teste SP 20 fornecedores"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**Modelo operacional na obra (dono, 29/jun).** Doc: `docs/insumos-do-dono/campo-tablet-totem-entrega.md`. Dor real validada: engenheiro largou a obra p/ comprar 1 rolo de cabo — "pagaria por agilidade".

1. **Predição (o moat):** estoque + IA + planejamento (EAP/cronograma) → avisa **quando E em qual FASE** vai faltar material. Por isso a planilha do dono.
2. **Entrega 2 níveis:** planejado = **fornecedor entrega**; imediato = **estilo Lalamove** (começar usando a Lalamove/API), **cotação de frete automática** por porte (moto/carro/van/caminhão; item carrega dimensão/peso).
3. **Tablet por COMODATO** em toda obra; **check-in/out EXCLUSIVO no equipamento do Hub** (controle+geo). *(Minha ressalva: hardware é o ponto mais caro — v1 pode ser kiosk Android + celular/geofence; tablet vira premium/escala.)*
4. **IA de campo:** o tablet "toca" e pergunta a **especialidades presentes** (material/andamento/limpeza), **cruza com fotos/dados do projeto** → força follow-up + anti-fraude. *(Melhoria: pessoa certa, momento certo (antes do checkout), mínimo, "já vi X, confirma?" — sem fadiga de alerta.)*
5. **Totem de compra (estilo McDonald's):** voz/texto "comprar tinta" → puxa projeto (cores/specs) → sugere marca/tamanho/qtd/fotos/prazo → vai aos responsáveis + fornecedor → ciclo. Gatilho no **checkin** (geo+papel → pré-prepara a necessidade).
6. **Teste:** só **SP capital**, ~20 fornecedores de regiões diferentes, poucos por região, **dentro dos KPIs** (on-time %, frescor de preço, fill rate, devolução, resposta).
7. **Tudo FASE 2/3** sobre a fundação atual (E5 pedido/estoque + checkin já existe + dados de projeto). Asset-light (Lalamove, não frota). Ver [[marketplace-rede-servicos-ifood]], [[modelos-contrato-escrow-auditoria]].

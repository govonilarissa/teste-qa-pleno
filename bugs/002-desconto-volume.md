# [002] Cotações nos limites de volume recebem desconto da faixa inferior

**Severidade:** Crítica
**Versão afetada:** v2
**Ambiente:** `http://localhost:3002`, carga inicial (200 cotações)

## Passos para reproduzir

1. Resetar os dados: `curl -X POST http://localhost:3002/_reset`
2. Criar cotações com `volumes` exatamente nos limites da tabela da SPEC:
   ```bash
   curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
     -d '{"cliente":"Comercial Aurora","peso_kg":5,"volumes":20,"uf_origem":"SP","uf_destino":"SP"}'
   curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
     -d '{"cliente":"Comercial Aurora","peso_kg":5,"volumes":50,"uf_origem":"SP","uf_destino":"SP"}'
   ```
3. Conferir o campo `desconto` na resposta.

## Resultado esperado (e a fonte)

`SPEC-desconto-por-volume.md`, seção "regra", tabela:

| Volumes    | Desconto |
| ---------- | -------- |
| 10 a 19    | 5%       |
| 20 a 49    | 10%      |
| 50 ou mais | 15%      |

A tabela usa faixas fechadas ("10 **a** 19", 20 **a** 49 e "50 **ou mais**"): um pedido de exatamente 20 volumes está em "20 a 49" (10%), e um de exatamente 50 está em "50 ou mais" (15%). Esses dois pontos são indiscutíveis sob qualquer leitura da SPEC (inclusive sob a leitura mais restritiva da frase "acima de 10 volumes" discutida em `PERGUNTAS_AO_PO.md` #1 (que só afeta o caso de `volumes = 10`, não 20 nem 50)).

## Resultado obtido

| Volumes | `desconto` esperado | `desconto` obtido na v2 |
| ------- | ------------------- | ----------------------- |
| 20      | 0.10 (10%)          | **0.05** (5%)           |
| 50      | 0.15 (15%)          | **0.10** (10%)          |

## Causa provável

`src/pricing/v2.js`, função `descontoPorVolume` (linhas 17-23):

```js
function descontoPorVolume(volumes) {
  const qtd = Number(volumes);
  if (qtd > 50) return 0.15;
  if (qtd > 20) return 0.1;
  if (qtd > 10) return 0.05;
  return 0;
}
```

Os três comparadores usam `>` (estritamente maior) em vez de `>=`. Isso desloca cada fronteira em uma unidade: `qtd === 20` cai no `if (qtd > 10)` em vez de `if (qtd > 20)`, e `qtd === 50` cai no `if (qtd > 20)` em vez de receber 15%. O mesmo padrão de erro do bug #001 (comparação de fronteira trocada), mas na feature nova.

## Impacto

Na carga inicial, **7 cotações têm `volumes = 20`** (ids 19, 65, 88, 111, 134, 157, 180) e recebem 5% de desconto em vez de 10%. Nenhuma cotação da carga inicial atinge `volumes = 50`, mas o defeito foi confirmado criando uma cotação nova (evidência abaixo) e é a mesma classe de bug, na mesma função.

Somando ao bug relacionado de `volumes = 10` (36 cotações, ids presentes na carga inicial do seed), cuja correção depende da resposta à `PERGUNTAS_AO_PO.md` #1: entre 7 e 43 cotações da carga inicial (3,5% a 21,5% do total) recebem um percentual de desconto diferente do que a tabela da SPEC determina.

## Evidência

```
$ curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
  -d '{"cliente":"Comercial Aurora","peso_kg":5,"volumes":20,"uf_origem":"SP","uf_destino":"SP"}'
{"id":201,...,"volumes":20,"desconto":0.05,"valor_total":26.6}

$ curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
  -d '{"cliente":"Comercial Aurora","peso_kg":5,"volumes":50,"uf_origem":"SP","uf_destino":"SP"}'
{"id":202,...,"volumes":50,"desconto":0.1,"valor_total":25.2}
```

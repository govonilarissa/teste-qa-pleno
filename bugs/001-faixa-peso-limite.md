# [001] Cotações no limite da faixa são cobradas incorretamente na faixa superior

**Severidade:** Crítica
**Versão afetada:** v2
**Ambiente:** `http://localhost:3002`, carga inicial (200 cotações)

## Passos para reproduzir

1. Resetar os dados: `curl -X POST http://localhost:3002/_reset`
2. Criar uma cotação com peso exatamente no limite da faixa (10 kg, mesma UF de origem e destino para isolar o efeito):
   ```bash
   curl -s -X POST http://localhost:3002/api/cotacoes \
     -H "Content-Type: application/json" \
     -d '{"cliente":"Comercial Aurora","peso_kg":10,"volumes":1,"uf_origem":"SP","uf_destino":"SP"}'
   ```
3. Repetir com `peso_kg: 50` e `peso_kg: 100`.
4. Repetir os mesmos três casos em `http://localhost:3001` (v1) para comparação.

## Resultado esperado (e a fonte)

Segundo o README, seção "faixa de peso": **"Os limites são inclusivos: uma cotação de exatamente 10 kg pertence à primeira faixa, uma de exatamente 50 kg à segunda, e uma de exatamente 100 kg à terceira."**

O changelog da v2 confirma que isso não deveria ter mudado: **"Sem alterações nesta versão: [...] Carga inicial de dados"** e não lista a tabela de faixa de peso entre as mudanças, a única mudança deveria ser o desconto por volume.

| Peso   | `valor_base` esperado |
| ------ | --------------------- |
| 10 kg  | R$ 25,00 (1ª faixa)   |
| 50 kg  | R$ 60,00 (2ª faixa)   |
| 100 kg | R$ 110,00 (3ª faixa)  |

## Resultado obtido

Na v1, os três casos batem com o esperado. Na v2, os três caem na faixa seguinte (mais cara):

| Peso   | v1 `valor_base` | v2 `valor_base` |
| ------ | --------------- | --------------- |
| 10 kg  | 25              | **60**          |
| 50 kg  | 60              | **110**         |
| 100 kg | 110             | **180**         |

## Causa provável

O erro está na condição de comparação utilizada em `src/pricing/v2.js`, na função `precificar` (linha 26):

```js
const faixa = FAIXAS.find((f) => Number(cotacao.peso_kg) < f.ate);
```

A v2 utiliza `<` (menor que), fazendo com que uma cotação cujo peso seja exatamente igual ao limite da faixa não seja considerada nela e avance para a faixa seguinte.

Na implementação da v1 (`src/pricing/v1.js`, linha 18), a comparação é feita com `<=` (menor ou igual), comportamento que está de acordo com a regra documentada no README de que **os limites das faixas são inclusivos.**

Portanto, trata-se de uma **regressão introduzida na v2**, causada pela alteração de `<=` para `<`.

## Impacto

Na carga inicial de 200 cotações, **20 cotações (10%)** têm peso exatamente em um dos três limites e caem na faixa errada, todas para a faixa **mais cara**. Contagem obtida consultando a API:

```js
// GET /api/cotacoes?limit=500, filtrando peso_kg em {10, 50, 100}
peso=10 kg  -> 7 cotações  (ids 33, 66, 99, 130, 132, 165, 198)
peso=50 kg  -> 6 cotações  (ids 22, 55, 88, 121, 154, 187)
peso=100 kg -> 7 cotações  (ids 11, 30, 44, 77, 110, 143, 176)
```

Exemplo concreto (cotação 33, 10 kg, SP-SP): v1 cobra R$ 28,00; v2 cobraria R$ 67,20 pela mesma cotação.

## Evidência

```
$ curl -s -X POST http://localhost:3001/api/cotacoes -H "Content-Type: application/json" \
  -d '{"cliente":"Comercial Aurora","peso_kg":10,"volumes":1,"uf_origem":"SP","uf_destino":"SP"}'
{"id":201,...,"valor_base":25,"multiplicador":1,"desconto":0,"valor_total":28}

$ curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
  -d '{"cliente":"Comercial Aurora","peso_kg":10,"volumes":1,"uf_origem":"SP","uf_destino":"SP"}'
{"id":201,...,"valor_base":60,"multiplicador":1,"desconto":0,"valor_total":67.2}
```

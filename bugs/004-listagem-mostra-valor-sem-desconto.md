# [004] Listagem da v2 renomeia `valor_total` para `total` e mostra o preço SEM desconto — diferente do que a fatura cobra

**Severidade:** Crítica
**Versão afetada:** v2
**Ambiente:** `http://localhost:3002`, carga inicial (200 cotações)

## Passos para reproduzir

1. Resetar os dados: `curl -X POST http://localhost:3002/_reset`
2. Pegar uma cotação com desconto na listagem, por exemplo a #10 (15 volumes,
   tem 5% de desconto):
   ```bash
   curl -s "http://localhost:3002/api/cotacoes?cliente=" | jq '.itens[] | select(.id==10)'
   ```
3. Comparar com o detalhe da mesma cotação:
   ```bash
   curl -s http://localhost:3002/api/cotacoes/10
   ```
4. Comparar os dois valores. Repita a mesma comparação em v1 (onde não deveria
   haver diferença nenhuma).

## Resultado esperado (e a fonte)

Segundo o README, contrato de `GET /api/cotacoes`: o item da listagem tem o campo **`valor_total`**, e o próprio README afirma explicitamente: **"O campo`valor_total` é o mesmo apresentado na listagem para a mesma cotação"** (seção `GET /api/cotacoes/{id}`), ou seja, listagem e detalhe 
**têm que bater**, isso é parte do contrato documentado.

O changelog da v2 diz que a listagem só ficou "mais enxuta" (menos campos por item), não informa troca de nome de campo nem mudança de valor.

## Resultado obtido

Na v2, o item da listagem não tem `valor_total`: tem somente um campo `total` calculado, **ignorando o desconto real da cotação** (o código força `volumes: 1` antes de calcular, o que zera qualquer desconto por volume). O detalhe (`GET/api/cotacoes/{id}`) e a fatura emitida usam o valor correto, com desconto. Ou seja: o operador vê um preço na tabela e a cotação é faturada por outro.

```
listagem (#10): total = 127.68   (sem desconto)
detalhe  (#10): valor_total = 121.29   (com 5% de desconto)
fatura, se emitida agora: R$ 121,29 (bate com o detalhe, não com a listagem)
```

## Causa provável

`src/cotacoes.js`, função `itemDeLista` (linhas 12-27).

No fluxo da v2, o preço é recalculado com `volumes: 1`:

```js
function itemDeLista(cotacao, motor, versao) {
  const valores = motor.precificar(cotacao);
  if (versao === 'v2') {
    const semDesconto = motor.precificar({ ...cotacao, volumes: 1 });
    return {
      id: cotacao.id, cliente: cotacao.cliente, peso_kg: cotacao.peso_kg,
      volumes: cotacao.volumes, uf_origem: cotacao.uf_origem, uf_destino: cotacao.uf_destino,
      faturada: cotacao.faturada, total: semDesconto.valor_total,
    };
  }
  return { ..., valor_total: valores.valor_total };
}
```

Isso faz com que a listagem ignore o volume real da cotação e retorne o preço sem considerar o desconto por volume. A variável `valores`, que já contém o preço correto calculado anteriormente, não é utilizada nesse fluxo.

Além disso, a v2 retorna o campo `total`, enquanto o contrato da API documenta `valor_total`. A v1 continua utilizando valor_total, portanto a v2 também quebra a compatibilidade com o contrato existente.

Em resumo: a v2 possui dois problemas na listagem: **recalcula o preço com `volumes: 1` e retorna o campo com nome incorreto (`total` em vez de `valor_total`)**.

## Impacto

Na carga inicial, **95 das 200 cotações (47,5%)** possuem desconto por volume e, por isso, apresentam valores diferentes entre a listagem e o detalhe da cotação.

Na listagem, o valor apresentado é sempre **maior que o valor correto**, pois o cálculo desconsidera o desconto por volume. A fatura, por outro lado, utiliza o valor correto, com o desconto aplicado.

Isso gera uma **inconsistência entre os valores apresentados ao operador**, podendo levar à comunicação de um preço incorreto ao cliente e gerar dúvidas ou reclamações quando o valor faturado for diferente do informado na listagem.

## Evidência

```
$ curl -s "http://localhost:3002/api/cotacoes?limit=500" | jq '.itens[] | select(.id==10)'
{"id":10,"cliente":"Indústria Horizonte","peso_kg":34,"volumes":11,"uf_origem":"RS","uf_destino":"SP","faturada":true,"total":127.68}

$ curl -s http://localhost:3002/api/cotacoes/10
{"id":10,"cliente":"Indústria Horizonte","peso_kg":34,"volumes":11,"uf_origem":"RS","uf_destino":"SP","faturada":true,"criada_em":"2026-06-11","valor_base":60,"multiplicador":1.9,"desconto":0.05,"valor_total":121.29}
```
# [003] v2 trunca o valor final em vez de arredondar — cobra sistematicamente a menos (às vezes a mais, por erro de ponto flutuante)

**Severidade:** Crítica
**Versão afetada:** v2
**Ambiente:** `http://localhost:3001` e `http://localhost:3002`, carga inicial (200 cotações)

## Passos para reproduzir

**Caso A - com desconto (o mais comum):**

```bash
curl -X POST http://localhost:3002/_reset
curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
  -d '{"cliente":"Comercial Aurora","peso_kg":5,"volumes":15,"uf_origem":"SP","uf_destino":"BA"}'
```

**Caso B - sem desconto nenhum envolvido (mostra que o problema não é só do desconto, é do arredondamento final em si):**

```bash
curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
  -d '{"cliente":"Comercial Aurora","peso_kg":150,"volumes":1,"uf_origem":"SP","uf_destino":"MG"}'
```

## Resultado esperado (e a fonte)

README, seção "valor final": **"O valor final é apresentado em reais com duas casas decimais, arredondado pela regra comercial (a partir de cinco milésimos, arredonda para cima)."** A SPEC (seção "regra") não redefine essa regra, diz apenas que o desconto entra depois do imposto, e que "o valor final continua expresso em reais com duas casas decimais", isto é, segue a mesma regra de arredondamento do README.

- **Caso A:** 5 kg, SP-BA, sem desconto dá R$ 53,20 (exemplo do próprio README). Com 15 volumes (5% de desconto, SPEC seção 2): `53,20 × 0,95 = 50,54`, arredondamento comercial não muda nada aqui, o resultado já é exato em 2 casas.
- **Caso B:** 150 kg, SP-MG: `180 × 1,4 × 1,12 = 282,24` (mesma fórmula do exemplo de 100kg SP-MG do README, só que na 4ª faixa de peso).

## Resultado obtido

| Caso               | Esperado  | v2 obtido     |
| ------------------ | --------- | ------------- |
| A (5% de desconto) | R$ 50,54  | **R$ 50,53**  |
| B (sem desconto)   | R$ 282,24 | **R$ 282,22** |

## Causa provável

`src/pricing/v2.js`, função `precificar` (linhas 25-39):

```js
const valorRota = faixa.preco * multiplicador;
const comDesconto = Math.trunc(valorRota * (1 - desconto) * 100) / 100;
const comImposto = comDesconto * (1 + IMPOSTO);
return { ..., valor_total: Math.trunc(comImposto * 100) / 100 };
```

Foram encontrados dois problemas:

1. **`Math.trunc` em vez de `Math.round`.** `Math.trunc` sempre corta para baixo; a regra comercial do README é "meio para cima" (arredonda a partir de 5 milésimos). `src/pricing/v1.js` usa `Math.round(comImposto * 100) / 100`, que é o comportamento correto, a v2 trocou a função e não arredonda mais para cima, só para baixo.

2. **Erro de ponto flutuante amplificado por um truncamento intermediário que não está em nenhuma fonte.** A SPEC descreve a sequência valor da rota - imposto - desconto, mas o código faz desconto - imposto, e introduz um `Math.trunc` no meio (`comDesconto`) que a SPEC nunca pede. Isso explica o Caso B: `180 × 1.4` não é exatamente `252` em ponto flutuante (é `251.99999999999997`), e o `Math.trunc` intermediário converte esse quase 252 em `251.99`. `Math.round`, usado uma única vez no final (como a v1 faz), absorve esse tipo de erro de ponto flutuante sem problema; truncar duas vezes não.

## Impacto

Rodando a suíte de regressão contra as 200 cotações da carga inicial: **125 das 200 cotações (62,5%) saem com `valor_total` diferente do que a fórmula documentada (README + SPEC) determina**, número que soma os bugs #001, #002 e #003 juntos, porque todos afetam o mesmo campo final. Isolando só o efeito deste bug (mantendo fixo o `desconto` que a própria v2 calculou, para não misturar com o bug #002): **79 das 200 cotações têm `valor_total` incorreto só por causa do arredondamento/ordem de cálculo**, somando R$ 1,03 a menos cobrado nessas cotações (sistematicamente para baixo (63 de 79 por causa do `Math.trunc`, nunca para cima)). Em escala de produção, sobre a base inteira de clientes, esse "sempre um pouco a menos" tira dinheiro na mesa todo santo dia; o Caso B mostra que também pode sair para cima ou para baixo de forma imprevisível quando o erro de ponto flutuante bate do lado errado.

## Evidência

```
$ curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
  -d '{"cliente":"QA","peso_kg":5,"volumes":15,"uf_origem":"SP","uf_destino":"BA"}'
{"id":201,...,"valor_base":25,"multiplicador":1.9,"desconto":0.05,"valor_total":50.53}

$ curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
  -d '{"cliente":"QA","peso_kg":150,"volumes":1,"uf_origem":"SP","uf_destino":"MG"}'
{"id":202,...,"valor_base":180,"multiplicador":1.4,"desconto":0,"valor_total":282.22}
```

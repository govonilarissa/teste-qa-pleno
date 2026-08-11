# Decisão de release — v2

## Decisão: GO / NO-GO

**Decisão: NO-GO**

**Data da análise:** 10/08/2026

**Versões comparadas:** v1 (produção) × v2 (release candidate)

## Justificativa

Considerando os efeitos dos bugs #001–#003 em conjunto, **125 das 200 cotações da carga inicial (62,5%) apresentam `valor_total` diferente do valor esperado**. Não é um caso isolado: são três problemas independentes no motor de precificação, cada um suficiente, por si só, para reprovar a release.

1. **Cotações no limite da faixa são cobradas incorretamente na faixa superior** (`bugs/001`): uma cotação de exatamente 10, 50 ou 100 kg é classificada na faixa de peso seguinte. Isso **não tem relação com a feature nova**: é uma regressão em uma regra vigente. O changelog da v2 não lista a tabela de faixa de peso entre as alterações, e a seção "Sem alterações nesta versão" indica que essa regra deveria ter sido preservada. 20 das 200 cotações da carga inicial são afetadas. Em um dos casos, o valor passa de R$ 28,00 para R$ 67,20 pela mesma cotação.

2. **Cotações nos limites de volume recebem desconto da faixa inferior** (`bugs/002`): 20 e 50 volumes têm comportamento inequívoco segundo a tabela da SPEC, mas caem na faixa de desconto inferior. Assim, uma cotação exatamente com 20 ou 50 volumes não recebe o desconto definido para sua faixa.

3. **O valor final é truncado em vez de arredondado e calculado na ordem incorreta em relação à SPEC** (`bugs/003`): o cálculo pode produzir valores inferiores ao esperado e, em alguns casos, divergências relacionadas à representação de ponto flutuante, inclusive em cotações sem desconto.

Há ainda um quarto problema, de natureza diferente: a tela de listagem mostra um valor que **não corresponde ao valor apresentado no detalhe e utilizado na fatura** (`bugs/004`, 95 das 200 cotações). O operador visualiza um preço e o sistema utiliza outro no faturamento. Embora isso não altere o valor efetivamente cobrado pela fatura, gera uma inconsistência operacional com potencial de reclamações e retrabalho de suporte.

Nenhum desses quatro problemas depende da ambiguidade registrada em `PERGUNTAS_AO_PO.md` #1. Mesmo na interpretação mais favorável à v2, os bugs #001–#004 permanecem. Este é um sistema em que **erro de preço representa impacto financeiro direto**, com possibilidade de cobrança a maior ou a menor para os clientes. A v2 apresenta divergências de preço em mais da metade da carga inicial analisada e, portanto, **não deve ser liberada nesse estado**.

### Impacto sobre cotações pendentes

O impacto não está restrito à carga inicial. O sistema não congela o preço da cotação no momento da criação: `src/cotacoes.js` e `src/faturas.js` recalculam `motor.precificar(cotacao)` quando a cotação é lida ou faturada, utilizando o motor da versão que estiver em produção naquele momento.

Isso significa que **cotações pendentes existentes antes da subida da v2 também estarão sujeitas ao comportamento do novo motor quando forem faturadas**, independentemente de quando foram criadas.

Na carga inicial, 140 das 200 cotações estão pendentes. Dessas, 94 possuem `volumes >= 10`; 90 apresentam divergência de valor quando recalculadas pela v2 em razão dos bugs já identificados. As 60 cotações já faturadas permanecem protegidas pela regra de não retroatividade definida na SPEC.

## Resumo dos problemas encontrados

| #   | Problema                                                                           | Severidade | Versão | Impacto medido                                                                                                           | Bloqueia? |
| --- | ---------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------ | --------- |
| 1   | Faixa de peso vira exclusiva (`<` em vez de `<=`)                                  | Crítica    | v2     | 20/200 cotações (10%) classificadas na faixa errada, com impacto para cima no valor                                      | **Sim**   |
| 2   | Fronteiras do desconto por volume erradas (`>` em vez de `>=`)                     | Crítica    | v2     | 7–43/200 cotações com percentual diferente, dependendo da definição para `volumes = 10`; 20 e 50 volumes são inequívocos | **Sim**   |
| 3   | Truncamento em vez de arredondamento comercial e ordem de cálculo incorreta        | Crítica    | v2     | 79/200 cotações com desconto apresentam valor incorreto; o efeito também ocorre em cenários sem desconto                 | **Sim**   |
| 4   | Listagem mostra valor sem desconto e renomeia `valor_total` para `total` sem aviso | Crítica    | v2     | 95/200 cotações (47,5%) apresentam valor divergente entre listagem e detalhe/fatura                                      | **Sim**   |

Considerando os bugs #001–#003 em conjunto, **125 das 200 cotações da carga inicial apresentam `valor_total` diferente do esperado**, com **R$ 2.488,31 de diferença líquida** nesse lote: 59 cotações cobrando a mais e 66 cobrando a menos.

Esse número foi obtido comparando cada cotação contra uma **implementação de referência independente** em `regressao/precificacao.ref.js`, e não contra o próprio código da v2.

## Condições para um novo GO

1. **Corrigir `src/pricing/v2.js` — faixa de peso:** trocar `<` por `<=` na busca da faixa de peso (linha 26) e revalidar os cenários de fronteira nas duas versões. Todos os testes correspondentes do describe **"Faixa de peso"** devem passar.

2. **Corrigir `descontoPorVolume` em `src/pricing/v2.js`:** corrigir as comparações de fronteira para que 20 e 50 volumes recebam os descontos definidos pela SPEC. O caso de `volumes = 10` permanece condicionado à resposta do PO e deve ser definido antes do próximo GO.

3. **Corrigir o cálculo de `valor_total` em `src/pricing/v2.js`:** aplicar o imposto antes do desconto, conforme a ordem definida na SPEC, e utilizar `Math.round` para o arredondamento comercial, realizando uma única operação de arredondamento ao final do cálculo. Nenhum truncamento intermediário deve permanecer. A comparação com a implementação de referência deve resultar em **0 divergências**.

4. **Corrigir `itemDeLista` em `src/cotacoes.js`:** o ramo `v2` deve retornar o valor real da cotação, sem recalcular o preço com `volumes: 1`, e o campo deve permanecer como `valor_total`, conforme documentado no README. Os testes do describe **"Contrato de listagem"** devem passar.

5. **Executar a suíte completa de regressão:** `node --test regressao/regressao.test.js`, confirmando que todos os testes passam e que não existem falhas relacionadas aos bugs corrigidos.

6. **Revalidar os bugs críticos #001–#004:** após as correções, executar novamente os cenários afetados e confirmar que não existem novas divergências ou regressões.

7. **Definir `volumes = 10`:** obter resposta do PO à `PERGUNTAS_AO_PO.md` #1 antes do próximo GO, para fechar definitivamente o comportamento dessa fronteira.

## Riscos aceitos

| Risco                                                                               | Por que é aceitável                                                                                                                                                                                             | Como detectaríamos em produção                                                                                                                 |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Concorrência no faturamento da mesma cotação (não investigada, ver `ESTRATEGIA.md`) | Não é uma regressão conhecida da v2. A implementação é a mesma da v1, trata-se de um risco teórico não confirmado                                                                                               | Verificar se existe mais de uma fatura para a mesma `id_cotacao` em `GET /api/faturas?id_cotacao=X`                                            |
| Regra para `volumes = 10` ainda indefinida                                          | Não altera a decisão de NO-GO, pois as fronteiras de 20 e 50 volumes já apresentam defeito independentemente da resposta do PO                                                                                  | Comparar o comportamento para `volumes = 10` com a regra definida pelo PO após a decisão                                                       |
| Regra sobre cotações pendentes antes do corte ainda indefinida                      | Não altera a decisão de NO-GO desta rodada, mas precisa ser definida antes de um futuro GO. Se o PO determinar que o preço deve permanecer congelado na criação, será necessário implementar esse comportamento | Identificar divergência entre o valor informado antes da subida da v2 e o valor faturado posteriormente para uma cotação criada antes do corte |

## Recomendação de acompanhamento

Após as correções e um novo GO, recomenda-se realizar monitoramento reforçado nos primeiros dias da v2, comparando os valores das novas cotações com uma implementação de referência independente baseada na fórmula documentada na SPEC.

O objetivo é identificar rapidamente divergências entre o `valor_total` calculado pela aplicação e o valor esperado, principalmente nos limites de faixa de peso, nas faixas de desconto por volume e nas regras de arredondamento.

**Critério de alerta: qualquer divergência confirmada que resulte em cobrança incorreta deve gerar investigação imediata, avaliação do impacto e análise da necessidade de rollback.**

A suíte de regressão deve permanecer como critério de entrada para a release, mantendo **0 divergências nos cenários cobertos**. O monitoramento pós-release complementa essa validação, verificando o comportamento da v2 com dados reais e combinações que não necessariamente estavam presentes na carga inicial.

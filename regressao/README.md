# Suíte de regressão

## Como rodar

A partir da raiz do projeto, execute:

`node --test regressao/regressao.test.js`

Não é necessária nenhuma instalação adicional. A suíte utiliza o executor de testes nativo do Node.js (`node:test`) e os módulos do próprio projeto.

## Pré-condições

- Node.js 18 ou superior.
- Executar o comando a partir da raiz do projeto (não é necessário iniciar as APIs nas portas 3001 e 3002: a suíte importa diretamente os módulos de v1 e v2).

## Ferramenta escolhida e por quê

Foi utilizado o executor de testes nativo do Node.js (`node:test`), sem dependências adicionais.

A escolha reduz a configuração necessária e permite validar diretamente as funções de v1 e v2, além de comparar os valores calculados com uma implementação de referência independente.

## Cenários cobertos

| #   | Cenário                            | O que protege                                           | v1 esperado         | v2 esperado                              |
| --- | ---------------------------------- | ------------------------------------------------------- | ------------------- | ---------------------------------------- |
| 1   | Carga inicial                      | Integridade da carga inicial e status das cotações      | OK                  | OK                                       |
| 2   | Campos obrigatórios na criação     | Validação do payload                                    | 422                 | 422                                      |
| 3   | Peso ou volume inválido            | Validação dos valores de entrada                        | 422                 | 422                                      |
| 4   | Cotação inexistente                | Comportamento da consulta                               | `null`              | `null`                                   |
| 5   | Faturamento de cotação inexistente | Contrato do faturamento                                 | 404                 | 404                                      |
| 6   | Faturamento duplicado              | Impede faturar a mesma cotação duas vezes               | 409                 | 409                                      |
| 7   | Faturamento de cotação pendente    | Emissão da fatura e bloqueio de novo faturamento        | 201 / 409           | 201 / 409                                |
| 8   | Limites da faixa de peso           | Regras inclusivas de 10, 50 e 100 kg                    | Conforme README     | Falha no bug #001                        |
| 9   | Exemplos de precificação           | Valores definidos nos exemplos do README                | Conforme esperado   | Falha quando aplicável                   |
| 10  | Desconto por volume                | Faixas e limites de 10, 20 e 50 volumes                 | Sem desconto        | Falha nos limites afetados pelo bug #002 |
| 11  | Cálculo do valor final             | Ordem do cálculo, desconto e arredondamento             | Conforme referência | Falha no bug #003                        |
| 12  | Carga inicial × referência         | Identifica divergências de precificação em toda a carga | 0 divergências      | Falha no bug #003                        |
| 13  | Faturamento                        | Valor utilizado na emissão da fatura                    | Conforme esperado   | Conforme cálculo atual                   |
| 14  | Listagem × detalhe                 | Consistência do valor retornado pela API                | Valores iguais      | Falha no bug #004                        |

## Como a suíte compara v1 e v2

A suíte utiliza três formas de validação:

- **Comparação com a v1:** a v1 é utilizada como baseline para regras que já existiam antes da release.
- **Validação contra a implementação de referência:** `regressao/precificacao.ref.js` reproduz as regras documentadas no README e na SPEC, permitindo verificar o `valor_total` sem depender do código da v2.
- **Validação direta de contratos:** os testes verificam status, campos retornados, comportamento de faturamento e consistência entre listagem e detalhe.

Nos cenários de precificação, os mesmos casos são executados nos dois motores quando aplicável. As fronteiras de peso e volume possuem valores esperados explícitos, enquanto a carga inicial é comparada contra a implementação de referência.

A implementação de referência é mantida separada da v2 para evitar que o teste simplesmente reproduza o mesmo código que está sendo testado.

## O que esta suíte NÃO cobre

| Lacuna                                  | Motivo                                                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testes automatizados de UI              | A tela não foi alterada na v2; a validação visual foi feita por teste exploratório manual.                                                                 |
| Todas as combinações possíveis de rota  | A função de rota não foi alterada entre v1 e v2; a cobertura indireta da carga inicial foi considerada suficiente para esta release.                       |
| Testes de concorrência no faturamento   | Não houve alteração na implementação de faturamento entre as versões; o risco foi considerado fora do escopo.                                              |
| Testes de performance ou carga          | O objetivo da suíte é validar regras e regressões funcionais, não desempenho.                                                                              |
| Testes com grande volume de requisições | A carga inicial de 200 cotações foi utilizada como base para a validação desta release.                                                                    |
| Comportamentos ainda ambíguos na SPEC   | O caso de `volumes = 10` permanece condicionado à definição registrada em `PERGUNTAS_AO_PO.md`.                                                            |
| Cenários não presentes na carga inicial | A implementação de referência e os testes de fronteira cobrem as principais regras, mas não substituem testes com todas as combinações possíveis de dados. |

## Saída esperada

No estado atual da v2, a suíte apresenta falhas relacionadas aos bugs identificados durante a análise. Essas falhas são esperadas e utilizadas como evidência para a decisão de NO-GO.

Após as correções dos bugs #001, #002, #003 e #004, a suíte deve ser executada novamente e terminar sem falhas.

Comando:

`node --test regressao/regressao.test.js`

Critério para um novo GO:

`0 fail`

Todas as falhas devem estar corrigidas ou formalmente justificadas antes da liberação da v2.

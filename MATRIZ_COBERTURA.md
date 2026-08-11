# Matriz de cobertura

## Como ler esta matriz

- **Automatizado:** existe um teste em `regressao/regressao.test.js` que falha sozinho se o comportamento regredir; roda com `node --test regressao/regressao.test.js`.
- **Manual:** validado batendo na API, com evidência nos arquivos de `bugs/`.
- **Resultado:** `Bug #00X` (falha identificada e registrada no respectivo arquivo em `bugs/`), `Pendente` (comportamento depende de definição do PO e está registrado em `PERGUNTAS_AO_PO.md`) ou `OK` (comportamento validado e conforme a regra esperada).

## Risco × cobertura

| #   | Risco                                                           | Área                  | Como foi coberto                                                                                                    | Automatizado? | Resultado | Problema aberto                                  |
| --- | --------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------- | --------- | ------------------------------------------------ |
| 1   | Faixa de peso alterada (regressão)                              | Motor de precificação | Análise das 200 cotações + testes de fronteira (10, 50, 100 kg) + leitura de código (`src/pricing/v2.js:26`)        | Sim           | Bug #001  | `bugs/001-faixa-peso-limite.md`                  |
| 2   | Fronteiras de desconto erradas                                  | Desconto por volume   | Testes de fronteira (10, 20, 50 volumes) + análise das 200 cotações + leitura de código (`src/pricing/v2.js:19-21`) | Sim           | Bug #002  | `bugs/002-desconto-volume.md`                    |
| 3   | Arredondamento e ordem de cálculo errados                       | Motor de precificação | Análise das 200 cotações contra implementação de referência + leitura de código (`src/pricing/v2.js:28-33`)         | Sim           | Bug #003  | `bugs/003-arredondamento-incorreto.md`           |
| 4   | Listagem mostra valor sem desconto e renomeia campo             | Contrato da API       | Comparação campo a campo listagem × detalhe nas 200 cotações + leitura de código (`src/cotacoes.js:12-27`)          | Sim           | Bug #004  | `bugs/004-listagem-mostra-valor-sem-desconto.md` |
| 5   | Ambiguidade: volumes = 10 tem desconto?                         | Desconto por volume   | Análise da SPEC + leitura de código + quantificação de impacto                                                      | Não           | Pendente  | `PERGUNTAS_AO_PO.md` #1                          |
| 6   | Ambiguidade: cotação pré-existente não faturada ganha desconto? | Faturamento           | Análise da SPEC + leitura de código (`src/faturas.js`) + quantificação de impacto                                   | Não           | Pendente  | `PERGUNTAS_AO_PO.md` #2                          |
| 7   | Somente a tela de detalhe mostra percentual de desconto         | Tela de operação      | Exploratório manual na v2                                                                                           | Não           | OK        | —                                                |

## Cobertura por regra de negócio

| Regra                                       | Fonte  | Cenários testados                                                                                     | Situação                                                                     |
| ------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Faixa de peso                               | README | Limites das faixas e valores de fronteira anterior e posterior, comparando v1 e v2                    | **Bug #001** — `<` em vez de `<=`                                            |
| Multiplicador de rota                       | README | Diferentes combinações de UF presentes na carga inicial + comparação entre v1 e v2                    | **OK** — comportamento preservado                                            |
| Imposto (12%)                               | README | Cálculo do valor final em diferentes cenários de cotação + comparação entre v1 e v2                   | **OK** — comportamento preservado                                            |
| Arredondamento do valor final               | README | Cenários com e sem desconto + comparação com implementação de referência                              | **Bug #003** — uso de `Math.trunc` e ordem de cálculo incorreta              |
| Fatura única por cotação                    | README | Tentativa de faturar uma mesma cotação mais de uma vez                                                | **OK** — segunda tentativa retorna `409`                                     |
| Desconto por volume                         | SPEC   | Valores de fronteira anterior, igual e posterior aos limites das faixas + critérios de aceite da SPEC | **Bug #002** — `>` em vez de `>=` + **Pendente** — regra para `volumes = 10` |
| Contrato `GET /api/cotacoes` (listagem)     | README | Comparação dos campos retornados na listagem com os dados do detalhe                                  | **Bug #004** — retorna `total` sem desconto em vez de `valor_total`          |
| Contrato `GET /api/cotacoes/{id}` (detalhe) | README | Consulta de cotações criadas e comparação com os dados utilizados no cálculo                          | **OK** — estrutura preservada                                                |
| Contrato `POST /api/cotacoes` (criação)     | README | Campos obrigatórios ausentes, peso inválido e payloads com diferentes combinações de entrada          | **OK** — validações preservadas                                              |
| Contrato `POST /api/cotacoes/{id}/faturar`  | README | Faturamento de cotação pendente, já faturada e inexistente                                            | **OK**                                                                       |

## Lacunas conhecidas

Espelha a seção "O que decidi NÃO testar" de `ESTRATEGIA.md`.

| Lacuna                                       | Risco | Observação                                                                                                                                            |
| -------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cobertura de todas as 36 combinações de rota | Baixo | A função `multiplicadorRota` é idêntica em v1 e v2 e não sofreu alterações na release. As combinações não exercitadas permanecem fora do escopo.      |
| Teste de concorrência no faturamento         | Baixo | Risco teórico não confirmado. A implementação do faturamento não sofreu alterações entre v1 e v2.                                                     |
| Teste de performance da listagem             | Baixo | O foco da validação é a correção funcional do contrato e dos valores retornados. A avaliação de performance fica fora do escopo desta release.        |
| Testes de UI automatizados                   | Baixo | A interface não sofreu alterações na v2. Foi realizado exploratório manual para verificar possíveis diferenças visuais e funcionais entre as versões. |
| Carga com volume real de requisições         | Médio | Testes de carga e estresse estão fora do escopo desta avaliação, que tem como foco a validação funcional e a decisão de release.                      |

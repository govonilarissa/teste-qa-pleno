# Estratégia de teste

## Contexto e objetivo da validação

A v2 do sistema de cotação e faturamento está agendada para subir em produção na sexta-feira. Ela traz uma feature nova (desconto por volume, aprovada pela diretoria comercial), segundo o changelog, preserva todo o restante do comportamento da v1. O objetivo é decidir se a v2 pode subir na sexta-feira ou se os problemas encontrados bloqueiam a release.

## Análise de risco

| Área                        | O que pode dar errado                                                                          | Impacto se acontecer                                                                                                        | Probabilidade                                                             | Prioridade |
| --------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- |
| Motor de precificação       | Cálculo incorreto do valor final (faixa de peso, multiplicador, imposto ou arredondamento)     | Crítico: valores cobrados a mais ou a menos para os clientes                                                                | Alta: código novo e alteração não documentada no changelog                | **1**      |
| Desconto por volume         | Percentual incorreto ou fronteiras das faixas aplicadas de forma indevida                      | Crítico: valor final incorreto para cotações com volume a partir de 10 unidades                                             | Alta: feature novae regras de fronteira não totalmente detalhadas na SPEC | **1**      |
| Contrato da API de listagem | Campo retornado com nome diferente do documentado ou valor divergente entre listagem e detalhe | Crítico: operador visualiza um preço e a fatura utiliza outro; integrações que dependem de `valor_total` podem ser afetadas | Média: alteração no payload sem detalhamento no changelog                 | **2**      |
| Carga inicial de dados      | Dados do seed divergentes com o contrato documentado                                           | Médio: informações incompletas ou inconsistentes nas cotações existentes                                                    | Confirmada: comportamento já presente na v1                               | **4**      |
| Tela de operação            | Campo de desconto não é exposto corretamente no menu inicial                                   | Médio: operador não consegue visualizar todas as informações da cotação                                                     | Baixa: HTML/CSS não foram alterados na v2                                 | **5**      |

## Fontes de verdade usadas

- **README** para o que já está em produção (v1): faixa de peso multiplicador de rota, imposto, regra de arredondamento, contrato de cada rota.
- **SPEC-desconto-por-volume.md** para a feature nova: tabela de percentuais, ordem de cálculo, restrições (não retroativo, sem acúmulo).
- **Comparação direta v1 × v2 via API**, sempre que uma fonte documental não bastava para eu confiar no resultado.

## Abordagem por área

- **Motor de precificação:** em vez de só repetir os 5 exemplos do README, escrevi uma implementação de referência independente (`regressao/precificacao.ref.js`, baseada no texto do README/SPEC, não no código-fonte) e rodei contra as 200 cotações da carga inicial via API.
- **Desconto por volume:** testes de fronteira nos valores imediatamente anterior, igual e posterior aos limites das faixas (9, 10, 11; 19, 20, 21; 49, 50, 51), com foco na validação das condições de inclusão (`>` vs. `>=`). As falhas identificadas ocorreram justamente nesses limites.
- **Listagem vs. detalhe/fatura:** comparação cruzada entre os dois endpoints para as 200 cotações, porque segundo o README os dois valores batem.
- **Faturamento e contrato REST:** exploratório dirigido pelo contrato documentado (404/409/422, mensagens de erro exatas), rodado nas duas versões.
- **Leitura de código:** usei para confirmar a causa raiz de cada bug (arquivo e linha, nos relatórios em `bugs/`) e, principalmente, para mapear **o que de fato é diferente entre v1 e v2**.
- **Front-end: Tela de operação:** teste exploratório manual comparando v1 e v2, com foco em identificar diferenças visuais ou funcionais que possam impactar a operação.

## O que decidi NÃO testar

| Ficou de fora                                   | Por quê                                                                                                                                                                                     | Risco que estou aceitando                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Testes de UI automatizados (cliques, navegação) | A interface não sofreu alterações na v2 e a validação do front-end será feita por teste exploratório manual. O foco desta etapa é o comportamento do novo contrato e das regras de negócio. | Eventuais bugs de UI podem não ser detectados; caso existam, não seriam específicos da v2.                                      |
| UFs fora das 6 documentadas (SP/RJ/MG/PR/RS/BA) | `multiplicadorRota` permanece igual em `v1.js` e `v2.js`, incluindo o comportamento para UFs não mapeadas. Não houve alteração nessa regra na v2.                                           | Possíveis problemas com UFs não documentadas permanecem fora do escopo, pois não representam uma regressão introduzida pela v2. |

## Ambiente e dados

- **Ambiente:** duas instâncias locais da aplicação rodando lado a lado: v1 na porta `3001` e v2 na porta `3002`.
- **Dados:** carga inicial fixa de 200 cotações, complementada por cotações e faturas criadas via API durante os testes.
- **Ferramentas:** Node.js e Postman.
- **Ferramentas de apoio:** Claude e OpenCode.

## Limitações da minha análise

- As respostas do PO às perguntas 1 e 2 de `PERGUNTAS_AO_PO.md` estão pendentes, o que mantém em aberto a definição exata do comportamento para `volumes = 10` e para cotações pré-existentes não faturadas.

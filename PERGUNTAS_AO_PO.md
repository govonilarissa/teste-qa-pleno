# Perguntas ao Product Owner

<!-- Este arquivo é entregável.

     Use-o para o que você NÃO conseguiu decidir sozinho a partir do README, da
     especificação e do changelog — e que precisa de uma definição de produto
     antes de virar um "esperado" no seu relatório.

     Registrar a dúvida aqui não é sinal de insegurança: é o contrário. Assumir
     uma interpretação em silêncio e reportar como problema aquilo que talvez
     nunca tenha sido definido é o erro que queremos ver você evitar. -->

## Perguntas em aberto

<!-- Para cada pergunta, use o bloco abaixo. Copie quantas vezes precisar. -->

### 1. A regra de desconto vale a partir de 10 volumes ou só acima de 10?

**Onde apareceu:** `SPEC-desconto-por-volume.md`, seção 4.

**O que está ambíguo:** A tabela de regras de desconto diz:

| Volumes    | Desconto |
| ---------- | -------- |
| 10 a 19    | 5%       |
| 20 a 49    | 10%      |
| 50 ou mais | 15%      |

"10 a 19" inclui o 10, mas o parágrafo abaixo da tabela diz: "A política vale para pedidos **acima de 10 volumes**". A própria SPEC se contradiz sobre o que acontece quando o volume for exatamente 10. Os critérios de aceite (seção 4) não testam esse valor, usam 15, 30, 80 e 3, todos longe da fronteira, então não ajudam a esclarecer.

**O que a v1 faz hoje:** Não se aplica, a v1 não tem a regra de desconto.

**O que a v2 faz:** Quando o `volumes = 10` não há desconto para o cliente (o código usa `if (qtd > 10) return 0.05`, ou seja, segue a leitura "acima de 10", assim como na regra da própria SPEC, mas não segue a regra da tabela. Ver `bugs/002-desconto-volume.md`).

**Por que isso importa:** Na carga inicial, **36 cotações têm exatamente `volumes = 10`**. Se a regra for de fato a da tabela ("10 a 19" = 5%), essas 36 cotações não irão receber o desconto na v2. Se a leitura correta for "acima de 10", o comportamento atual da v2 para `volumes = 10` está correto e é só o bug #002 (as fronteiras 20 e 50, que não há contradição) que precisa de correção.

**Interpretação que adotei enquanto não há resposta:** Tratei a **tabela** como a fonte de verdade, enquanto a frase "acima de 10" se lê como uma explicação solta de contexto, não uma redefinição da faixa. É essa leitura que usei em `regressao/precificacao.ref.js` e no cálculo de impacto financeiro em `RELEASE_DECISION.md`. Se o PO confirmar a descrição textual em vez da tabela: as 36 cotações com `volumes = 10` deixariam de receber o desconto.

**Bloqueia o go/no-go?** Não sozinha, mas não muda a decisão. Mesmo na leitura mais favorável à v2, as fronteiras de 20 e 50 volumes continuam erradas, e os bugs #001 e #003 (faixa de peso e arredondamento) já são suficientes para reprovar a release por conta própria, sem depender desta resposta.

---

### 2. Cotações criadas antes da v2, mas ainda não faturadas, devem receber o desconto quando forem faturadas depois do corte?

**Onde apareceu:** `SPEC-desconto-por-volume.md`, seção 5, e `src/faturas.js`, função `faturar`.

**O que está ambíguo:** A SPEC diz: "A política não é retroativa. Cotações já faturadas mantêm o valor pelo qual foram faturadas; não há recálculo nem nota de ajuste." Essa frase só fala de cotações **já faturadas**. Ela não diz nada sobre cotações que já existem no sistema, com preço já calculado e possivelmente já informado ao cliente, mas que ainda **não foram** faturadas no momento em que a v2 sobe.

**O que a v1 faz hoje:** Não se aplica, a v1 não tem a regra de desconto.

**O que a v2 faz:** O valor só é calculado (via `motor.precificar(cotacao)`) no momento da emissão da fatura, olhando os dados atuais da cotação. Ou seja, qualquer cotação ainda pendente, quando for faturada usa o preço vigente no momento da emissão por padrão de implementação, não por uma decisão documentada.

**Por que isso importa:** Na carga inicial, 140 das 200 cotações estão pendentes (ainda não foram faturadas), e 94 dessas 140 têm `volumes >= 10`. Com a v2, essas 94 cotações, que hoje não possuem desconto na v1, **passariam a receber desconto quando fossem faturadas**, mesmo tendo sido criadas antes da implementação da nova regra. O impacto, portanto, depende do momento do faturamento, e não da data de criação da cotação. Comando usado: `GET /api/cotacoes?limit=500`, filtrando `faturada === false` e depois `volumes >= 10`.

**Interpretação que adotei enquanto não há resposta:** Segui o comportamento atual do sistema, e como não há nenhum trecho do README, SPEC ou changelog que diga que cotação deveria ter preço congelado na criação; "congelar só na emissão" é consistente com a regra de faturamento já vigente na v1 ("a fatura é emitida pelo valor final vigente da cotação no momento da emissão"). Mas é uma decisão de política comercial, não uma leitura técnica.

**Bloqueia o go/no-go?** Não. A decisão desta release já é NO-GO devido aos bugs #001-#004, independentemente da resposta. No entanto, essa questão precisa ser esclarecida antes de uma futura tentativa de GO: se a regra correta for não alterar o preço de cotações criadas antes da mudança, será necessária uma feature que congele o preço/percentual no momento da criação da cotação e não apenas na emissão.

---

## Decisões que tomei sem perguntar

- **Desconto visível só no detalhe, não na listagem.** A SPEC (seção 3) diz que "a tela de detalhe deve mostrar o percentual", não menciona a listagem. Interpretei que a listagem não é obrigada a expor `desconto`, e de fato nem a v1 expõe (mesmo sem a feature). Não reportei isso como bug.

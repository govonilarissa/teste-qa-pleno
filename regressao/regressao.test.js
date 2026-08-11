const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const v1 = require("../src/pricing/v1.js");
const v2 = require("../src/pricing/v2.js");
const { store, reset } = require("../src/store.js");
const { criar, buscar, listar } = require("../src/cotacoes.js");
const { faturar } = require("../src/faturas.js");
const { calcularEsperado } = require("./precificacao.ref.js");

function novaCotacao(sobrescrever = {}) {
  return {
    cliente: "QA Regressão",
    peso_kg: 10,
    volumes: 1,
    uf_origem: "SP",
    uf_destino: "SP",
    ...sobrescrever,
  };
}

function buscarDireto(id, motor) {
  const cotacao = store.cotacoes.find((c) => c.id === id);
  if (!cotacao) return null;
  return { ...cotacao, ...motor.precificar(cotacao) };
}

describe("contrato básico da API", () => {
  beforeEach(() => reset());

  test("carrega as 200 cotações com o status esperado", () => {
    assert.equal(store.cotacoes.length, 200);
    assert.equal(store.cotacoes[0].faturada, true);
    assert.equal(store.cotacoes[59].faturada, true);
    assert.equal(store.cotacoes[60].faturada, false);
  });

  test("recusa cotação sem campos obrigatórios", () => {
    const r = criar({ cliente: "X" }, v1);
    assert.equal(r.status, 422);
  });

  test("recusa peso zero ou volume inválido", () => {
    assert.equal(criar(novaCotacao({ peso_kg: 0 }), v1).status, 422);
    assert.equal(criar(novaCotacao({ volumes: 0 }), v1).status, 422);
  });

  test("retorna null para cotação inexistente", () => {
    assert.equal(buscar(999999, v1), null);
  });

  test("retorna 404 ao faturar cotação inexistente", () => {
    return faturar(999999, v1).then((r) => assert.equal(r.status, 404));
  });

  test("não permite faturar uma cotação duas vezes", () => {
    return faturar(1, v1).then((r) => assert.equal(r.status, 409));
  });

  test("fatura uma cotação pendente e bloqueia novo faturamento", async () => {
    const primeira = await faturar(70, v1);
    assert.equal(primeira.status, 201);

    const segunda = await faturar(70, v1);
    assert.equal(segunda.status, 409);
  });
});

describe("faixa de peso", () => {
  const casos = [
    { peso_kg: 10, esperado: 25, rotulo: "10 kg" },
    { peso_kg: 10.01, esperado: 60, rotulo: "10.01 kg" },
    { peso_kg: 50, esperado: 60, rotulo: "50 kg" },
    { peso_kg: 50.01, esperado: 110, rotulo: "50.01 kg" },
    { peso_kg: 100, esperado: 110, rotulo: "100 kg" },
    { peso_kg: 100.01, esperado: 180, rotulo: "100.01 kg" },
  ];

  for (const c of casos) {
    test(`v1: ${c.rotulo}`, () => {
      assert.equal(
        v1.precificar(novaCotacao({ peso_kg: c.peso_kg })).valor_base,
        c.esperado,
      );
    });

    // Bug #001: v2 usa < em vez de <=.
    test(`v2: ${c.rotulo}`, () => {
      assert.equal(
        v2.precificar(novaCotacao({ peso_kg: c.peso_kg })).valor_base,
        c.esperado,
      );
    });
  }
});

describe("exemplos de precificação", () => {
  const exemplos = [
    { peso_kg: 10, uf_origem: "SP", uf_destino: "SP", esperado: 28.0 },
    { peso_kg: 5, uf_origem: "SP", uf_destino: "BA", esperado: 53.2 },
    { peso_kg: 50, uf_origem: "SP", uf_destino: "BA", esperado: 127.68 },
    { peso_kg: 100, uf_origem: "SP", uf_destino: "MG", esperado: 172.48 },
    { peso_kg: 150, uf_origem: "SP", uf_destino: "MG", esperado: 282.24 },
  ];

  for (const ex of exemplos) {
    test(`v1: ${ex.peso_kg} kg ${ex.uf_origem} → ${ex.uf_destino}`, () => {
      assert.equal(v1.precificar(novaCotacao(ex)).valor_total, ex.esperado);
    });

    test(`v2: ${ex.peso_kg} kg ${ex.uf_origem} → ${ex.uf_destino}`, () => {
      assert.equal(v2.precificar(novaCotacao(ex)).valor_total, ex.esperado);
    });
  }
});

describe("desconto por volume", () => {
  const inequivocos = [
    { volumes: 15, esperado: 0.05 },
    { volumes: 19, esperado: 0.05 },
    { volumes: 20, esperado: 0.1 },
    { volumes: 30, esperado: 0.1 },
    { volumes: 49, esperado: 0.1 },
    { volumes: 50, esperado: 0.15 },
    { volumes: 80, esperado: 0.15 },
    { volumes: 3, esperado: 0 },
    { volumes: 9, esperado: 0 },
  ];

  for (const c of inequivocos) {
    // Bug #002: v2 usa > em vez de >=.
    test(`v2: ${c.volumes} volumes`, () => {
      assert.equal(
        v2.precificar(novaCotacao({ volumes: c.volumes })).desconto,
        c.esperado,
      );
    });
  }

  // Regra pendente de definição do PO.
  test("v2: 10 volumes", () => {
    assert.equal(v2.precificar(novaCotacao({ volumes: 10 })).desconto, 0.05);
  });

  test("v1 nunca aplica desconto", () => {
    assert.equal(v1.precificar(novaCotacao({ volumes: 80 })).desconto, 0);
  });
});

describe("cálculo do valor final", () => {
  test("aplica desconto e arredondamento corretamente", () => {
    const r = v2.precificar(
      novaCotacao({
        peso_kg: 5,
        uf_origem: "SP",
        uf_destino: "BA",
        volumes: 15,
      }),
    );

    assert.equal(r.valor_total, 50.54);
  });

  test("v2 calcula o valor esperado para a carga inicial", () => {
    const divergentes = [];

    for (const cot of store.cotacoes) {
      const resultado = v2.precificar(cot);
      const esperado = calcularEsperado(cot, { comDesconto: true });

      if (Math.abs(resultado.valor_total - esperado.valor_total) > 0.001) {
        divergentes.push({
          id: cot.id,
          atual: resultado.valor_total,
          esperado: esperado.valor_total,
        });
      }
    }

    assert.equal(
      divergentes.length,
      0,
      `${divergentes.length}/200 divergentes. amostra: ${JSON.stringify(
        divergentes.slice(0, 5),
      )}`,
    );
  });

  test("v1 mantém os valores esperados", () => {
    const divergentes = [];

    for (const cot of store.cotacoes) {
      const resultado = v1.precificar(cot);
      const esperado = calcularEsperado(cot, { comDesconto: false });

      if (Math.abs(resultado.valor_total - esperado.valor_total) > 0.001) {
        divergentes.push({
          id: cot.id,
          atual: resultado.valor_total,
          esperado: esperado.valor_total,
        });
      }
    }

    assert.equal(
      divergentes.length,
      0,
      `v1 divergiu em ${divergentes.length} cotações`,
    );
  });
});

describe("faturamento", () => {
  beforeEach(() => reset());

  test("faturamento mantém o valor calculado na emissão", async () => {
    const cotacao = buscarDireto(65, v2);
    const fatura = await faturar(65, v2);

    assert.equal(fatura.status, 201);
    assert.equal(fatura.corpo.valor, cotacao.valor_total);
  });
});

describe("listagem de cotações", () => {
  beforeEach(() => reset());

  test("v1: listagem e detalhe têm o mesmo valor", () => {
    const { itens } = listar({ limit: 500 }, v1);

    for (const item of itens.slice(0, 20)) {
      assert.ok("valor_total" in item, `item #${item.id} sem valor_total`);

      const detalhe = buscarDireto(item.id, v1);

      assert.equal(item.valor_total, detalhe.valor_total);
    }
  });

  // Bug #004: v2 retorna total sem desconto e renomeia o campo.
  test("v2: listagem e detalhe têm o mesmo valor com desconto", () => {
    const { itens } = listar({ limit: 500 }, v2, "v2");
    const divergentes = [];

    for (const item of itens) {
      const valorListagem = item.valor_total ?? item.total;
      const detalhe = buscarDireto(item.id, v2);

      if (
        detalhe.desconto > 0 &&
        Math.abs(valorListagem - detalhe.valor_total) > 0.001
      ) {
        divergentes.push({
          id: item.id,
          listagem: valorListagem,
          detalhe: detalhe.valor_total,
        });
      }
    }

    assert.equal(
      divergentes.length,
      0,
      `${divergentes.length}/200 divergentes. amostra: ${JSON.stringify(
        divergentes.slice(0, 5),
      )}`,
    );
  });
});

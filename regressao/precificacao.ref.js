// Regras usadas como referência para validar a precificação.
// Baseadas no README e na SPEC de desconto por volume.

const FAIXAS = [
  { ate: 10, preco: 25 },
  { ate: 50, preco: 60 },
  { ate: 100, preco: 110 },
  { ate: Infinity, preco: 180 },
];

const REGIOES = {
  SP: "sudeste",
  RJ: "sudeste",
  MG: "sudeste",
  PR: "sul",
  RS: "sul",
  BA: "nordeste",
};

const IMPOSTO = 0.12;

function valorBase(peso_kg) {
  return FAIXAS.find((f) => Number(peso_kg) <= f.ate).preco;
}

function multiplicadorRota(uf_origem, uf_destino) {
  if (uf_origem === uf_destino) return 1;

  if (REGIOES[uf_origem] && REGIOES[uf_origem] === REGIOES[uf_destino]) {
    return 1.4;
  }

  return 1.9;
}

// A tabela da SPEC define as faixas como inclusivas.
// O caso de 10 volumes depende da definição do PO.
function descontoPorVolume(volumes) {
  const qtd = Number(volumes);

  if (qtd >= 50) return 0.15;
  if (qtd >= 20) return 0.1;
  if (qtd >= 10) return 0.05;

  return 0;
}

// Arredondamento comercial para duas casas decimais.
function arredondarComercial(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

// Calcula o valor esperado para comparar com v1 ou v2.
// A v1 não possui desconto; a v2 segue a regra da SPEC.
function calcularEsperado(
  { peso_kg, volumes, uf_origem, uf_destino },
  { comDesconto },
) {
  const base = valorBase(peso_kg);
  const multiplicador = multiplicadorRota(uf_origem, uf_destino);
  const desconto = comDesconto ? descontoPorVolume(volumes) : 0;

  const valorRota = base * multiplicador;
  const comImposto = valorRota * (1 + IMPOSTO);
  const valorFinal = comDesconto ? comImposto * (1 - desconto) : comImposto;

  return {
    valor_base: base,
    multiplicador,
    desconto,
    valor_total: arredondarComercial(valorFinal),
  };
}

module.exports = {
  calcularEsperado,
  valorBase,
  multiplicadorRota,
  descontoPorVolume,
  arredondarComercial,
  IMPOSTO,
};

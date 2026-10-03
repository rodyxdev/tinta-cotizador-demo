import {
  type Line,
  type LineInput,
  type Product,
  type QuoteInput,
  type QuoteVersion,
  type Rules,
  uid,
} from "./model";
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function integer(n: number, min: number, max: number, name: string) {
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw new Error(`${name}: usa un número entre ${min} y ${max}.`);
}
export const round = (num: bigint, den: bigint) => {
  if (den <= 0n || num < 0n) throw new Error("Cálculo monetario inválido.");
  const value = Number((num + den / 2n) / den);
  if (!Number.isSafeInteger(value))
    throw new Error("El importe supera el límite de la demo.");
  return value;
};
export function validateRules(r: Rules) {
  integer(r.marginBps, 0, 9500, "Margen");
  integer(r.taxBps, 0, 10000, "Impuesto");
  integer(r.depositBps, 0, 10000, "Anticipo");
}
export function calculateLine(
  input: LineInput,
  p: Product,
  rules: Rules,
): Line {
  validateRules(rules);
  assert(!p.archived, "El producto está archivado.");
  integer(input.quantity, p.min, p.max, "Cantidad");
  integer(input.widthMm, p.minMm, p.maxMm, "Ancho en mm");
  integer(input.heightMm, p.minMm, p.maxMm, "Alto en mm");
  if (p.fixed)
    assert(
      input.widthMm === p.fixed[0] && input.heightMm === p.fixed[1],
      "La medida de tarjetas es 9 × 5 cm.",
    );
  const material = p.materials.find((m) => m.id === input.materialId);
  assert(material, "Selecciona un material válido.");
  const finish = p.finishes.find((f) => f.id === input.finishId);
  assert(
    finish && finish.materials.includes(material.id),
    "El acabado no es compatible con el material.",
  );
  integer(p.setupCents, 0, 100000000, "Preparación");
  integer(material.cents, 0, 100000000, "Costo de material");
  integer(finish.cents, 0, 100000000, "Costo de acabado");
  const area =
    BigInt(input.widthMm) * BigInt(input.heightMm) * BigInt(input.quantity);
  const denom = 1000000n;
  const tier = p.sizeTiers?.find(
    (t) => input.widthMm * input.heightMm <= t.maxMm2,
  );
  assert(
    !p.sizeTiers?.length || tier,
    "Esta medida no tiene un rango de precio configurado.",
  );
  const sizeFactor = tier?.factor ?? 1;
  integer(sizeFactor, 1, 100, "Factor de tamaño");
  const materialNum =
    p.unit === "area"
      ? area * BigInt(material.cents)
      : BigInt(input.quantity * material.cents * sizeFactor) * denom;
  const finishNum =
    BigInt(finish.cents) *
    (finish.basis === "lot"
      ? denom
      : finish.basis === "piece"
        ? BigInt(input.quantity) * denom
        : area);
  const costNum = BigInt(p.setupCents) * denom + materialNum + finishNum;
  return {
    ...input,
    productName: p.name,
    productCode: p.code,
    materialName: material.name,
    finishName: finish.name,
    unit: p.unit,
    areaM2: Number(area) / 1000000,
    setupCents: p.setupCents,
    materialCostCents: round(materialNum, denom),
    finishCostCents: round(finishNum, denom),
    costCents: round(costNum, denom),
    saleCents: round(costNum * 10000n, denom * BigInt(10000 - rules.marginBps)),
    requiresDesign: p.requiresDesign,
  };
}
export function calculateQuote(
  input: QuoteInput,
  products: Product[],
  rules: Rules,
): Omit<QuoteVersion, "id" | "number" | "status" | "createdAt"> {
  assert(input.customerId, "Selecciona un cliente.");
  assert(
    input.lines.length > 0 && input.lines.length <= 20,
    "Incluye entre 1 y 20 partidas.",
  );
  assert(
    new Set(input.lines.map((l) => l.id)).size === input.lines.length,
    "Las partidas tienen identificadores repetidos.",
  );
  integer(input.discountBps, 0, 2000, "Descuento");
  integer(input.leadDays, 1, 60, "Días de elaboración");
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(input.validUntil) &&
      !Number.isNaN(Date.parse(input.validUntil)) &&
      new Date(input.validUntil).toISOString().slice(0, 10) ===
        input.validUntil,
    "La vigencia es inválida.",
  );
  assert(
    input.notes.length <= 2000,
    "Las observaciones no deben superar 2000 caracteres.",
  );
  const lines = input.lines.map((l) => {
    const p = products.find((p) => p.id === l.productId);
    assert(p, "Producto inexistente.");
    return calculateLine(l, p, rules);
  });
  const subtotalCents = lines.reduce((n, l) => n + l.saleCents, 0);
  integer(subtotalCents, 0, Number.MAX_SAFE_INTEGER, "Subtotal");
  const discountCents = round(
    BigInt(subtotalCents) * BigInt(input.discountBps),
    10000n,
  );
  const taxCents = round(
    BigInt(subtotalCents - discountCents) * BigInt(rules.taxBps),
    10000n,
  );
  const totalCents = subtotalCents - discountCents + taxCents;
  integer(totalCents, 0, Number.MAX_SAFE_INTEGER, "Total");
  return {
    ...input,
    lines,
    rules: { ...rules },
    subtotalCents,
    discountCents,
    taxCents,
    totalCents,
  };
}
export function defaultLine(p: Product): LineInput {
  return {
    id: uid(),
    productId: p.id,
    quantity: p.min,
    materialId: p.materials[0].id,
    finishId: p.finishes[0].id,
    widthMm: p.fixed?.[0] ?? (p.unit === "area" ? 2000 : 50),
    heightMm: p.fixed?.[1] ?? (p.unit === "area" ? 1000 : 50),
  };
}

import {
  type Line,
  type QuoteVersion,
  type State,
  agreement,
  balance,
  currentVersion,
  deposit,
  effectiveStatus,
  paid,
} from "./model";
export function commercial(v: QuoteVersion) {
  return {
    id: v.id,
    number: v.number,
    status: effectiveStatus(v),
    createdAt: v.createdAt,
    emittedAt: v.emittedAt,
    customerSnapshot: v.customerSnapshot,
    businessSnapshot: v.businessSnapshot,
    validUntil: v.validUntil,
    leadDays: v.leadDays,
    notes: v.notes,
    response: v.response,
    subtotalCents: v.subtotalCents,
    discountCents: v.discountCents,
    taxCents: v.taxCents,
    totalCents: v.totalCents,
    depositCents: deposit(v),
    lines: v.lines.map(publicLine),
  };
}
export function publicLine(l: Line) {
  return {
    id: l.id,
    productName: l.productName,
    productCode: l.productCode,
    quantity: l.quantity,
    widthMm: l.widthMm,
    heightMm: l.heightMm,
    materialName: l.materialName,
    finishName: l.finishName,
    saleCents: l.saleCents,
    unit: l.unit,
    areaM2: l.areaM2,
    requiresDesign: l.requiresDesign,
  };
}
export function portalFor(s: State, customerId: string) {
  const c = s.customers.find((c) => c.id === customerId);
  return {
    customer: c ? { id: c.id, name: c.name } : undefined,
    business: {
      name: s.settings.business,
      email: s.settings.email,
      phone: s.settings.phone,
    },
    quotes: s.quotes
      .filter(
        (q) =>
          q.customerId === customerId && currentVersion(q).status !== "draft",
      )
      .map((q) => ({
        id: q.id,
        folio: q.folio,
        currentId: q.currentId,
        current: commercial(currentVersion(q)),
        versions: q.versions
          .filter((v) => v.status !== "draft")
          .map(commercial),
        orderChangeId: q.orderChangeId,
      })),
    orders: s.orders
      .filter((o) => o.customerId === customerId)
      .map((o) => ({
        id: o.id,
        folio: o.folio,
        stage: o.stage,
        due: o.due,
        responsible: o.responsible,
        current: commercial(agreement(o)),
        designs: o.designs.map((d) => ({
          id: d.id,
          lineId: d.lineId,
          number: d.number,
          imageId: d.imageId,
          comment: d.comment,
          at: d.at,
          review: d.review,
          response: d.response,
          matchesSpecs: agreement(o).lines.some(
            (l) =>
              l.id === d.lineId &&
              [
                l.productId,
                l.quantity,
                l.materialId,
                l.finishId,
                l.widthMm,
                l.heightMm,
              ].join("|") === d.specKey,
          ),
        })),
        paidCents: paid(s, o.id),
        balanceCents: balance(s, o),
        payments: s.payments
          .filter((p) => p.orderId === o.id)
          .map((p) => ({
            id: p.id,
            cents: p.cents,
            at: p.at,
            method: p.method,
            reversed: Boolean(p.reversesId),
          })),
        events: s.events
          .filter((e) => e.entityId === o.id && e.public)
          .map((e) => ({ id: e.id, at: e.at, actor: e.actor, text: e.text })),
      })),
  };
}
export type Portal = ReturnType<typeof portalFor>;
export type CommercialVersion = ReturnType<typeof commercial>;

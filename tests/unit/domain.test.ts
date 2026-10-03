import { describe, it, expect } from "vitest";
import { seed } from "../../src/demo/seed";
import { apply } from "../../src/domain/commands";
import {
  calculateLine,
  calculateQuote,
  defaultLine,
} from "../../src/domain/pricing";
import {
  type Actor,
  type Quote,
  type QuoteInput,
  agreement,
  balance,
  blockers,
  currentVersion,
  deposit,
  draftVersion,
  latestDesign,
  paid,
  specKey,
  today,
  addDays,
} from "../../src/domain/model";
import { portalFor } from "../../src/domain/portal";
import { printableQuote } from "../../src/documents/export";
const admin: Actor = { role: "admin", name: "Admin" },
  production: Actor = { role: "production", name: "Producción" };
const client = (id: string): Actor => ({
  role: "client",
  name: "Cliente",
  customerId: id,
});
const now = new Date("2026-10-03T18:00:00Z"),
  at = now.toISOString();
const draft = (s: ReturnType<typeof seed>) =>
  s.quotes.find((q) => currentVersion(q).status === "draft")!;
const pending = (s: ReturnType<typeof seed>) =>
  s.quotes.find(
    (q) =>
      currentVersion(q).status === "sent" &&
      currentVersion(q).validUntil > today(now),
  )!;
const img = (id: string) => ({
  id,
  name: "demo.png",
  type: "image/png",
  bytes: 100,
  width: 100,
  height: 100,
});
describe("Cálculos monetarios y compatibilidad", () => {
  it("rechaza un total que supera la precisión segura al sumar el impuesto", () => {
    const s = seed(now),
      p = s.products[0];
    p.materials[0].cents = 100000000;
    p.sizeTiers = [{ maxMm2: 8100, factor: 100 }];
    expect(() =>
      calculateQuote(
        {
          customerId: "c1",
          lines: [{ ...defaultLine(p), quantity: 100000 }],
          discountBps: 0,
          notes: "",
          leadDays: 5,
          validUntil: "2026-10-10",
        },
        s.products,
        { marginBps: 8000, taxBps: 10000, depositBps: 5000 },
      ),
    ).toThrow("Total");
  });
  it("calcula preparación y material por pieza, con margen sobre venta", () => {
    const s = seed(now),
      p = s.products[0];
    const l = calculateLine(defaultLine(p), p, s.settings);
    expect(l.costCents).toBe(30000);
    expect(l.saleCents).toBe(50000);
    expect(l.saleCents).not.toBe(42000);
  });
  it("convierte centímetros, calcula superficie, descuento e impuesto", () => {
    const s = seed(now),
      l = defaultLine(s.products[2]);
    l.quantity = 2;
    l.finishId = "eyelets";
    const q = calculateQuote(
      {
        customerId: "c1",
        lines: [l],
        discountBps: 1000,
        notes: "",
        leadDays: 5,
        validUntil: addDays(today(now), 7),
      },
      s.products,
      s.settings,
    );
    expect(q.lines[0].areaM2).toBe(4);
    expect(q.lines[0].costCents).toBe(42000);
    expect(q.subtotalCents).toBe(70000);
    expect(q.discountCents).toBe(7000);
    expect(q.taxCents).toBe(10080);
    expect(q.totalCents).toBe(73080);
  });
  it("no redondea prematuramente una superficie pequeña", () => {
    const s = seed(now),
      p = s.products[2];
    p.setupCents = 0;
    p.materials[0].cents = 10000;
    const l = { ...defaultLine(p), widthMm: 101, heightMm: 103 };
    const out = calculateLine(l, p, {
      marginBps: 0,
      taxBps: 0,
      depositBps: 5000,
    });
    expect(out.areaM2).toBe(0.010403);
    expect(out.saleCents).toBe(104);
  });
  it("respeta los rangos de costo de etiquetas sin solapamientos", () => {
    const s = seed(now),
      p = s.products[1];
    p.setupCents = 0;
    const l = defaultLine(p);
    expect(calculateLine(l, p, s.settings).costCents).toBe(3000);
    expect(calculateLine({ ...l, widthMm: 51 }, p, s.settings).costCents).toBe(
      6000,
    );
    expect(
      calculateLine({ ...l, widthMm: 101, heightMm: 100 }, p, s.settings)
        .costCents,
    ).toBe(12000);
  });
  it.each([0, 99, 100001, 100.5, NaN])(
    "rechaza cantidad de tarjetas %s",
    (n) => {
      const s = seed(now),
        p = s.products[0];
      expect(() =>
        calculateLine({ ...defaultLine(p), quantity: n }, p, s.settings),
      ).toThrow();
    },
  );
  it("rechaza acabados incompatibles y medidas fijas distintas", () => {
    const s = seed(now);
    expect(() =>
      calculateLine(
        { ...defaultLine(s.products[1]), finishId: "matte" },
        s.products[1],
        s.settings,
      ),
    ).toThrow("compatible");
    expect(() =>
      calculateLine(
        { ...defaultLine(s.products[0]), widthMm: 80 },
        s.products[0],
        s.settings,
      ),
    ).toThrow("9 × 5");
  });
  it("rechaza margen del 100%, descuentos excesivos y productos archivados", () => {
    const s = seed(now),
      p = s.products[0];
    expect(() =>
      calculateLine(defaultLine(p), p, { ...s.settings, marginBps: 10000 }),
    ).toThrow();
    p.archived = true;
    expect(() => calculateLine(defaultLine(p), p, s.settings)).toThrow(
      "archivado",
    );
    const q = draft(s);
    expect(() =>
      calculateQuote(
        { ...currentVersion(q), discountBps: 2001 },
        s.products,
        s.settings,
      ),
    ).toThrow("Descuento");
  });
  it("redondea el anticipo hacia arriba al centavo", () => {
    const s = seed(now),
      v = currentVersion(draft(s));
    expect(
      deposit({
        ...v,
        totalCents: 101,
        rules: { ...v.rules, depositBps: 5000 },
      }),
    ).toBe(51);
  });
});
describe("Versiones comerciales y conversión", () => {
  it("conserva el precio emitido al cambiar catálogo y reglas", () => {
    const s = seed(now),
      q = pending(s),
      before = structuredClone(currentVersion(q));
    s.products[2].materials[0].cents *= 3;
    s.settings.marginBps = 5000;
    expect(currentVersion(q)).toEqual(before);
  });
  it("mantiene la enviada mientras hay borrador; emitir sustituye la anterior", () => {
    const s = seed(now),
      q = pending(s),
      oldId = q.currentId;
    apply(s, { type: "quote.revise", quoteId: q.id }, admin, at);
    expect(q.currentId).toBe(oldId);
    const d = draftVersion(q)!;
    apply(
      s,
      { type: "quote.issue", quoteId: q.id, versionId: d.id },
      admin,
      at,
    );
    expect(q.currentId).toBe(d.id);
    expect(q.versions[0].status).toBe("superseded");
    expect(() =>
      apply(
        s,
        {
          type: "quote.respond",
          quoteId: q.id,
          versionId: oldId,
          accept: true,
          comment: "",
        },
        client(q.customerId),
        at,
      ),
    ).toThrow("vigente");
  });
  it("bloquea la aceptación vencida y exige reemisión", () => {
    const s = seed(now),
      q = s.quotes.find((q) => currentVersion(q).validUntil < today(now))!;
    expect(() =>
      apply(
        s,
        {
          type: "quote.respond",
          quoteId: q.id,
          versionId: q.currentId,
          accept: true,
          comment: "",
        },
        client(q.customerId),
        at,
      ),
    ).toThrow("vigente");
    apply(s, { type: "quote.revise", quoteId: q.id }, admin, at);
    apply(
      s,
      { type: "quote.issue", quoteId: q.id, versionId: draftVersion(q)!.id },
      admin,
      at,
    );
    apply(
      s,
      {
        type: "quote.respond",
        quoteId: q.id,
        versionId: q.currentId,
        accept: true,
        comment: "",
      },
      client(q.customerId),
      at,
    );
    expect(currentVersion(q).status).toBe("accepted");
  });
  it("aceptación y conversión son resistentes a operaciones duplicadas", () => {
    const s = seed(now),
      q = pending(s);
    apply(
      s,
      {
        type: "quote.respond",
        quoteId: q.id,
        versionId: q.currentId,
        accept: true,
        comment: "",
      },
      client(q.customerId),
      at,
    );
    expect(() =>
      apply(
        s,
        {
          type: "quote.respond",
          quoteId: q.id,
          versionId: q.currentId,
          accept: true,
          comment: "",
        },
        client(q.customerId),
        at,
      ),
    ).toThrow();
    const count = s.orders.length,
      id = apply(s, { type: "order.convert", quoteId: q.id }, admin, at);
    expect(apply(s, { type: "order.convert", quoteId: q.id }, admin, at)).toBe(
      id,
    );
    expect(s.orders.length).toBe(count + 1);
    expect(agreement(s.orders.at(-1)!)).toEqual(currentVersion(q));
  });
  it("impide convertir propuestas no aceptadas", () => {
    const s = seed(now),
      q = draft(s);
    expect(() =>
      apply(s, { type: "order.convert", quoteId: q.id }, admin, at),
    ).toThrow("aceptar");
  });
  it("valida un borrador actualizado por otra pestaña", () => {
    const s = seed(now),
      q = draft(s),
      v = currentVersion(q);
    expect(() =>
      apply(
        s,
        {
          type: "quote.save",
          quoteId: q.id,
          draftId: v.id,
          expectedUpdatedAt: "old",
          input: v,
        },
        admin,
        at,
      ),
    ).toThrow("otra pestaña");
  });
  it("impide a un cliente responder por otro", () => {
    const s = seed(now),
      q = pending(s);
    expect(() =>
      apply(
        s,
        {
          type: "quote.respond",
          quoteId: q.id,
          versionId: q.currentId,
          accept: true,
          comment: "",
        },
        client("c1"),
        at,
      ),
    ).toThrow("cliente");
  });
});
describe("Diseños, pagos y producción", () => {
  it("bloquea por diseño y por anticipo, y permite iniciar un pedido autorizado", () => {
    const s = seed(now);
    expect(blockers(s, s.orders[0]).join(" ")).toMatch("diseño");
    expect(blockers(s, s.orders[2]).join(" ")).toMatch("anticipo");
    expect(blockers(s, s.orders[4])).toEqual([]);
    expect(() =>
      apply(
        s,
        { type: "order.stage", orderId: s.orders[2].id, stage: "printing" },
        production,
        at,
      ),
    ).toThrow("anticipo");
    apply(
      s,
      { type: "order.stage", orderId: s.orders[4].id, stage: "printing" },
      production,
      at,
    );
    expect(s.orders[4].stage).toBe("printing");
  });
  it("una nueva versión invalida la aprobación sin borrar el historial", () => {
    const s = seed(now),
      o = s.orders[4],
      l = agreement(o).lines[0],
      old = latestDesign(o, l.id)!;
    apply(
      s,
      {
        type: "design.add",
        orderId: o.id,
        lineId: l.id,
        image: img("new"),
        comment: "Corrección",
      },
      admin,
      at,
    );
    expect(old.review).toBe("approved");
    expect(blockers(s, o).join(" ")).toMatch("diseño");
    expect(() =>
      apply(
        s,
        {
          type: "design.respond",
          orderId: o.id,
          lineId: l.id,
          designId: old.id,
          approve: true,
          comment: "",
        },
        client(o.customerId),
        at,
      ),
    ).toThrow("vigente");
    const d = latestDesign(o, l.id)!;
    apply(
      s,
      {
        type: "design.respond",
        orderId: o.id,
        lineId: l.id,
        designId: d.id,
        approve: true,
        comment: "Bien",
      },
      client(o.customerId),
      at,
    );
    expect(blockers(s, o)).toEqual([]);
    expect(d.response?.comment).toBe("Bien");
  });
  it("solicitar cambios requiere comentario y bloquea producción", () => {
    const s = seed(now),
      o = s.orders[4],
      l = agreement(o).lines[0];
    apply(
      s,
      {
        type: "design.add",
        orderId: o.id,
        lineId: l.id,
        image: img("new"),
        comment: "",
      },
      admin,
      at,
    );
    const d = latestDesign(o, l.id)!;
    expect(() =>
      apply(
        s,
        {
          type: "design.respond",
          orderId: o.id,
          lineId: l.id,
          designId: d.id,
          approve: false,
          comment: "",
        },
        client(o.customerId),
        at,
      ),
    ).toThrow("Describe");
    apply(
      s,
      {
        type: "design.respond",
        orderId: o.id,
        lineId: l.id,
        designId: d.id,
        approve: false,
        comment: "Otra composición",
      },
      client(o.customerId),
      at,
    );
    expect(d.review).toBe("changes");
  });
  it("no cambia el diseño en producción sin detener primero", () => {
    const s = seed(now),
      o = s.orders[1];
    expect(() =>
      apply(
        s,
        {
          type: "design.add",
          orderId: o.id,
          lineId: agreement(o).lines[0].id,
          image: img("new"),
          comment: "",
        },
        admin,
        at,
      ),
    ).toThrow("Detén");
    expect(() =>
      apply(s, { type: "order.change", orderId: o.id }, admin, at),
    ).toThrow("Detén");
    apply(
      s,
      {
        type: "order.stage",
        orderId: o.id,
        stage: "stopped",
        reason: "Revisión",
      },
      production,
      at,
    );
    const qid = apply(s, { type: "order.change", orderId: o.id }, admin, at)!;
    expect(o.openChangeId).toBe(qid);
    expect(blockers(s, o).join(" ")).toMatch("cambio");
  });
  it("aplica cambio al mismo pedido y exige aprobar especificaciones nuevas", () => {
    const s = seed(now),
      o = s.orders[4],
      oldAgreement = structuredClone(agreement(o));
    const qid = apply(s, { type: "order.change", orderId: o.id }, admin, at)!;
    const q = s.quotes.find((q) => q.id === qid)!,
      d = draftVersion(q)!;
    const input: QuoteInput = {
      ...d,
      lines: d.lines.map((l) => ({ ...l, quantity: l.quantity + 50 })),
    };
    apply(
      s,
      { type: "quote.save", quoteId: q.id, draftId: d.id, input },
      admin,
      at,
    );
    apply(
      s,
      { type: "quote.issue", quoteId: q.id, versionId: d.id },
      admin,
      at,
    );
    const count = s.orders.length;
    apply(
      s,
      {
        type: "quote.respond",
        quoteId: q.id,
        versionId: q.currentId,
        accept: true,
        comment: "",
      },
      client(o.customerId),
      at,
    );
    expect(s.orders.length).toBe(count);
    expect(o.agreements[0].version).toEqual(oldAgreement);
    expect(o.agreements.length).toBe(2);
    expect(blockers(s, o).join(" ")).toMatch("diseño");
    expect(o.openChangeId).toBeUndefined();
  });
  it("conserva acuerdo tras rechazar/cancelar y resolver explícitamente el cambio", () => {
    const s = seed(now),
      o = s.orders[4];
    apply(s, { type: "order.change", orderId: o.id }, admin, at);
    const q = s.quotes.find((q) => q.id === o.openChangeId)!;
    apply(
      s,
      { type: "quote.cancel", quoteId: q.id, reason: "Sin cambio" },
      admin,
      at,
    );
    expect(blockers(s, o).length).toBeGreaterThan(0);
    apply(
      s,
      { type: "order.keepAgreement", orderId: o.id, reason: "Se mantiene" },
      admin,
      at,
    );
    expect(blockers(s, o)).toEqual([]);
  });
  it("una reversión conserva el pago y detiene cuando invalida el anticipo", () => {
    const s = seed(now),
      o = s.orders[1],
      p = s.payments.find((p) => p.orderId === o.id)!;
    apply(
      s,
      {
        type: "payment.reverse",
        paymentId: p.id,
        reason: "Importe incorrecto",
      },
      admin,
      at,
    );
    expect(o.stage).toBe("stopped");
    expect(paid(s, o.id)).toBe(0);
    expect(s.payments.some((x) => x.id === p.id)).toBe(true);
    expect(() =>
      apply(
        s,
        { type: "payment.reverse", paymentId: p.id, reason: "otra vez" },
        admin,
        at,
      ),
    ).toThrow("revertido");
  });
  it("rechaza sobrepago y pagos del encargado de producción", () => {
    const s = seed(now),
      o = s.orders[2];
    const c = {
      type: "payment.add" as const,
      orderId: o.id,
      cents: agreement(o).totalCents + 1,
      method: "Efectivo",
      reference: "",
    };
    expect(() => apply(s, c, admin, at)).toThrow();
    expect(() => apply(s, { ...c, cents: 100 }, production, at)).toThrow(
      "administrador",
    );
  });
  it("no entrega antes de terminar y liquidar", () => {
    const s = seed(now),
      o = s.orders[4];
    expect(() =>
      apply(
        s,
        { type: "order.stage", orderId: o.id, stage: "finished" },
        production,
        at,
      ),
    ).toThrow();
    apply(
      s,
      { type: "order.stage", orderId: o.id, stage: "printing" },
      production,
      at,
    );
    apply(
      s,
      { type: "order.stage", orderId: o.id, stage: "finished" },
      production,
      at,
    );
    expect(() =>
      apply(
        s,
        { type: "order.stage", orderId: o.id, stage: "delivered" },
        admin,
        at,
      ),
    ).toThrow("saldo");
    apply(
      s,
      {
        type: "payment.add",
        orderId: o.id,
        cents: balance(s, o),
        method: "Transferencia",
        reference: "",
      },
      admin,
      at,
    );
    apply(
      s,
      { type: "order.stage", orderId: o.id, stage: "delivered" },
      admin,
      at,
    );
    expect(o.stage).toBe("delivered");
  });
  it("cancelación conserva pagos, diseños y acuerdos", () => {
    const s = seed(now),
      o = s.orders[1],
      count = s.payments.length,
      designs = o.designs.length;
    apply(
      s,
      {
        type: "order.stage",
        orderId: o.id,
        stage: "cancelled",
        reason: "Solicitud ficticia",
      },
      admin,
      at,
    );
    expect(s.payments.length).toBe(count);
    expect(o.designs.length).toBe(designs);
    expect(o.agreements.length).toBe(1);
  });
  it("rechaza imágenes fuera de los límites de archivo y cantidad", () => {
    const s = seed(now),
      o = s.orders[4],
      l = agreement(o).lines[0];
    expect(() =>
      apply(
        s,
        {
          type: "design.add",
          orderId: o.id,
          lineId: l.id,
          image: { ...img("new"), bytes: 6 * 1024 * 1024 },
          comment: "",
        },
        admin,
        at,
      ),
    ).toThrow();
    s.images = Array.from({ length: 50 }, (_, i) => img(String(i)));
    expect(() =>
      apply(
        s,
        {
          type: "design.add",
          orderId: o.id,
          lineId: l.id,
          image: img("new"),
          comment: "",
        },
        admin,
        at,
      ),
    ).toThrow("límite");
  });
});
describe("Proyección del portal y datos de ejemplo", () => {
  it("no entrega datos internos o de otros clientes al portal", () => {
    const s = seed(now),
      p = portalFor(s, "c1"),
      text = JSON.stringify(p);
    expect(text).not.toMatch(
      /costCents|marginBps|setupCents|specKey|notes internas|Nota interna/,
    );
    expect(text).not.toContain("Estudio Norte");
    expect(
      p.orders.every(
        (o) => s.orders.find((x) => x.id === o.id)?.customerId === "c1",
      ),
    ).toBe(true);
  });
  it("los documentos comerciales no contienen costos ni notas internas", () => {
    const s = seed(now),
      p = portalFor(s, "c1"),
      html = printableQuote(
        {
          ...p.quotes[0].current,
          customerSnapshot: {
            name: "<script>alert(1)</script>",
            email: "",
            phone: "",
          },
        },
        "COT-DEMO",
        "<script>alert(1)</script>",
        "Tinta",
      );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/Costo interno|Margen sobre venta|Nota interna/);
  });
  it("mantiene la identidad comercial emitida al editar el cliente y el negocio", () => {
    const s = seed(now),
      q = pending(s);
    const original = currentVersion(q).customerSnapshot!.name;
    apply(
      s,
      {
        type: "customer.save",
        customer: {
          ...s.customers.find((c) => c.id === q.customerId)!,
          name: "Nuevo nombre ficticio",
        },
      },
      admin,
      at,
    );
    apply(
      s,
      {
        type: "settings.save",
        settings: { ...s.settings, business: "Otro taller ficticio" },
      },
      admin,
      at,
    );
    const cv = portalFor(s, q.customerId).quotes.find(
      (x) => x.id === q.id,
    )!.current;
    expect(cv.customerSnapshot?.name).toBe(original);
    expect(cv.businessSnapshot?.name).toBe("Tinta · taller de impresión");
  });
  it("no reasigna una cotización emitida a otro cliente al editar su revisión", () => {
    const s = seed(now),
      q = pending(s);
    apply(s, { type: "quote.revise", quoteId: q.id }, admin, at);
    const d = draftVersion(q)!;
    expect(() =>
      apply(
        s,
        {
          type: "quote.save",
          quoteId: q.id,
          draftId: d.id,
          input: { ...d, customerId: "c1" },
        },
        admin,
        at,
      ),
    ).toThrow("conserva su cliente");
  });
  it("aceptar la enviada cancela una revisión que todavía estaba en borrador", () => {
    const s = seed(now),
      q = pending(s),
      originalId = q.currentId;
    apply(s, { type: "quote.revise", quoteId: q.id }, admin, at);
    const d = draftVersion(q)!;
    apply(
      s,
      {
        type: "quote.respond",
        quoteId: q.id,
        versionId: originalId,
        accept: true,
        comment: "",
      },
      client(q.customerId),
      at,
    );
    expect(d.status).toBe("cancelled");
    expect(draftVersion(q)).toBeUndefined();
    expect(q.currentId).toBe(originalId);
  });
  it("rechaza fechas inexistentes y rangos de precio incompletos", () => {
    const s = seed(now),
      q = draft(s);
    expect(() =>
      calculateQuote(
        { ...currentVersion(q), validUntil: "2027-02-31" },
        s.products,
        s.settings,
      ),
    ).toThrow("vigencia");
    expect(() =>
      apply(
        s,
        {
          type: "product.save",
          product: {
            ...s.products[1],
            sizeTiers: [{ maxMm2: 2500, factor: 1 }],
          },
        },
        admin,
        at,
      ),
    ).toThrow("cubrir");
  });
  it("restablecer con otro día mantiene atrasos y próximos compromisos", () => {
    const a = seed(now),
      b = seed(new Date("2027-01-15T18:00:00Z"));
    expect(a.orders[0].due).toBe("2026-10-02");
    expect(b.orders[0].due).toBe("2027-01-14");
    expect(b.orders[4].due).toBe("2027-01-19");
    expect(b.counters).toEqual(a.counters);
  });
});

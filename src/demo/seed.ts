import {
  type State,
  type Stage,
  type QuoteStatus,
  addDays,
  today,
  uid,
  specKey,
  deposit,
} from "../domain/model";
import { calculateQuote, defaultLine } from "../domain/pricing";
export function seed(now = new Date()): State {
  const day = today(now),
    at = now.toISOString();
  const s: State = {
    id: "main",
    schema: 1,
    revision: 0,
    settings: {
      business: "Tinta · taller de impresión",
      email: "hola@tinta.example",
      phone: "55 0000 0000",
      staff: ["Andrea", "Diego", "Mariana"],
      marginBps: 4000,
      taxBps: 1600,
      depositBps: 5000,
    },
    customers: [
      "Luna Café",
      "Estudio Norte",
      "Mercado Verde",
      "Casa Olivo",
      "Taller Bruma",
      "Amelia Flores",
    ].map((name, i) => ({
      id: `c${i + 1}`,
      name,
      email: `cliente${i + 1}@example.test`,
      phone: `55 0000 000${i + 1}`,
      notes: "Cliente ficticio. Contactos exclusivos para demostración.",
    })),
    products: [
      {
        id: "cards",
        code: "TAR-001",
        name: "Tarjetas",
        description:
          "Una buena primera impresión. Tarjetas en couché de 300 g.",
        unit: "piece",
        min: 100,
        max: 100000,
        minMm: 50,
        maxMm: 90,
        fixed: [90, 50],
        setupCents: 10000,
        archived: false,
        requiresDesign: true,
        materials: [{ id: "couche", name: "Couché 300 g", cents: 200 }],
        finishes: [
          {
            id: "none",
            name: "Sin acabado",
            cents: 0,
            basis: "lot",
            materials: ["couche"],
          },
          {
            id: "matte",
            name: "Laminado mate",
            cents: 25,
            basis: "piece",
            materials: ["couche"],
          },
          {
            id: "gloss",
            name: "Laminado brillante",
            cents: 30,
            basis: "piece",
            materials: ["couche"],
          },
        ],
      },
      {
        id: "labels",
        sizeTiers: [
          { maxMm2: 2500, factor: 1 },
          { maxMm2: 10000, factor: 2 },
          { maxMm2: 90000, factor: 4 },
        ],
        code: "ETQ-001",
        name: "Etiquetas",
        description:
          "Etiquetas adhesivas para productos, empaques y pequeños detalles.",
        unit: "piece",
        min: 50,
        max: 100000,
        minMm: 20,
        maxMm: 300,
        setupCents: 8000,
        archived: false,
        requiresDesign: true,
        materials: [
          { id: "paper", name: "Adhesivo de papel", cents: 60 },
          { id: "vinyl", name: "Vinil adhesivo", cents: 120 },
        ],
        finishes: [
          {
            id: "none",
            name: "Sin acabado",
            cents: 0,
            basis: "lot",
            materials: ["paper", "vinyl"],
          },
          {
            id: "matte",
            name: "Laminado mate",
            cents: 20,
            basis: "piece",
            materials: ["vinyl"],
          },
        ],
      },
      {
        id: "banners",
        code: "LON-001",
        name: "Lonas",
        description: "Impresión de gran formato para hacer visible tu negocio.",
        unit: "area",
        min: 1,
        max: 100,
        minMm: 100,
        maxMm: 5000,
        setupCents: 10000,
        archived: false,
        requiresDesign: true,
        materials: [{ id: "front", name: "Front 13 oz", cents: 7500 }],
        finishes: [
          {
            id: "none",
            name: "Sin acabado",
            cents: 0,
            basis: "lot",
            materials: ["front"],
          },
          {
            id: "eyelets",
            name: "Bastilla y ojillos",
            cents: 2000,
            basis: "lot",
            materials: ["front"],
          },
        ],
      },
    ],
    quotes: [],
    orders: [],
    payments: [],
    events: [],
    images: [
      {
        id: "sample:norte",
        name: "Estudio Norte",
        bytes: 1037494,
        type: "image/png",
        width: 1681,
        height: 936,
        path: "designs/estudio-norte.png",
      },
      {
        id: "sample:luna",
        name: "Luna Café",
        bytes: 1146958,
        type: "image/png",
        width: 1254,
        height: 1254,
        path: "designs/luna-cafe.png",
      },
      {
        id: "sample:verde",
        name: "Mercado Verde",
        bytes: 1460012,
        type: "image/png",
        width: 2172,
        height: 724,
        path: "designs/mercado-verde.png",
      },
    ],
    counters: { quote: 1000, order: 1041 },
  };
  const quote = (
    customerId: string,
    productIndex: number,
    quantity: number,
    status: QuoteStatus,
    days = 7,
  ) => {
    const line = defaultLine(s.products[productIndex]);
    line.quantity = quantity;
    if (productIndex === 2) line.finishId = "eyelets";
    const v = {
      ...calculateQuote(
        {
          customerId,
          lines: [line],
          discountBps: 0,
          notes:
            "Precio de demostración. Producción tras aprobación de diseño y anticipo.",
          leadDays: 5,
          validUntil: addDays(day, days),
        },
        s.products,
        s.settings,
      ),
      id: uid(),
      number: 1,
      createdAt: at,
      customerSnapshot: {
        name: s.customers.find((c) => c.id === customerId)!.name,
        email: s.customers.find((c) => c.id === customerId)!.email,
        phone: s.customers.find((c) => c.id === customerId)!.phone,
      },
      businessSnapshot: {
        name: s.settings.business,
        email: s.settings.email,
        phone: s.settings.phone,
      },
      status,
      emittedAt: status === "draft" ? undefined : at,
      response:
        status === "accepted"
          ? { at, actor: "Cliente demo", comment: "Acepto esta propuesta." }
          : undefined,
    };
    const q = {
      id: uid(),
      folio: `COT-${++s.counters.quote}`,
      customerId,
      currentId: v.id,
      versions: [v],
      updatedAt: at,
    };
    s.quotes.push(q);
    return q;
  };
  const stages: Stage[] = [
    "pending",
    "printing",
    "pending",
    "finished",
    "pending",
    "delivered",
  ];
  const indexes = [1, 0, 2, 0, 1, 0],
    quantities = [500, 1000, 2, 250, 200, 100];
  for (let i = 0; i < 6; i++) {
    const q = quote(`c${i + 1}`, indexes[i], quantities[i], "accepted");
    const v = q.versions[0];
    const imageId =
      indexes[i] === 0
        ? "sample:norte"
        : indexes[i] === 1
          ? "sample:luna"
          : "sample:verde";
    const line = v.lines[0];
    const o = {
      id: uid(),
      folio: `PED-${++s.counters.order}`,
      customerId: q.customerId,
      sourceQuoteId: q.id,
      agreements: [{ quoteId: q.id, version: structuredClone(v), at }],
      due: addDays(day, [-1, -2, 3, 1, 4, -4][i]),
      responsible: s.settings.staff[i % 3],
      stage: stages[i],
      notes: "Nota interna de ejemplo. Revisar empaque antes de entrega.",
      designs: [
        {
          id: uid(),
          lineId: line.id,
          number: 1,
          at,
          author: "Andrea",
          imageId,
          comment:
            i === 0
              ? "Propuesta inicial para las etiquetas de temporada."
              : "Diseño original de demostración.",
          specKey: specKey(line),
          review: (i === 0 ? "changes" : "approved") as "changes" | "approved",
          response: {
            at,
            comment:
              i === 0
                ? "Me gustaría revisar la composición. ¿Podemos probar una segunda versión?"
                : "Diseño aprobado.",
            actor: "Cliente demo",
          },
        },
      ],
      createdAt: at,
    };
    s.orders.push(o);
    if (i !== 2)
      s.payments.push({
        id: uid(),
        orderId: o.id,
        cents: i === 5 ? v.totalCents : deposit(v),
        at,
        method: "Transferencia",
        reference: `DEMO-${i + 1}`,
      });
    s.events.push({
      id: uid(),
      entityId: o.id,
      at,
      actor: "Andrea",
      text: "Pedido creado desde la cotización aceptada.",
      public: true,
    });
    if (i === 1)
      s.events.push({
        id: uid(),
        entityId: o.id,
        at,
        actor: "Diego",
        text: "Impresión en curso. El material está preparado.",
        public: true,
      });
  }
  quote("c3", 2, 1, "sent");
  quote("c2", 0, 500, "draft");
  quote("c4", 1, 100, "rejected");
  quote("c5", 2, 1, "sent", -2);
  return s;
}

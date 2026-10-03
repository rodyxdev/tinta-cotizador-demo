export type Role = "admin" | "production" | "client";
export type Stage =
  "pending" | "printing" | "stopped" | "finished" | "delivered" | "cancelled";
export type QuoteStatus =
  "draft" | "sent" | "accepted" | "rejected" | "cancelled" | "superseded";
export type Review = "pending" | "changes" | "approved";
export interface Rules {
  marginBps: number;
  taxBps: number;
  depositBps: number;
}
export interface Settings extends Rules {
  business: string;
  email: string;
  phone: string;
  staff: string[];
}
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
}
export interface Finish {
  id: string;
  name: string;
  cents: number;
  basis: "lot" | "piece" | "area";
  materials: string[];
}
export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  unit: "piece" | "area";
  min: number;
  max: number;
  minMm: number;
  maxMm: number;
  fixed?: [number, number];
  materials: { id: string; name: string; cents: number }[];
  finishes: Finish[];
  setupCents: number;
  sizeTiers?: { maxMm2: number; factor: number }[];
  archived: boolean;
  requiresDesign: boolean;
}
export interface LineInput {
  id: string;
  productId: string;
  quantity: number;
  materialId: string;
  finishId: string;
  widthMm: number;
  heightMm: number;
}
export interface Line extends LineInput {
  productName: string;
  productCode: string;
  materialName: string;
  finishName: string;
  unit: "piece" | "area";
  areaM2: number;
  costCents: number;
  saleCents: number;
  setupCents: number;
  materialCostCents: number;
  finishCostCents: number;
  requiresDesign: boolean;
}
export interface QuoteInput {
  customerId: string;
  lines: LineInput[];
  discountBps: number;
  notes: string;
  leadDays: number;
  validUntil: string;
}
export interface QuoteVersion extends QuoteInput {
  id: string;
  number: number;
  createdAt: string;
  emittedAt?: string;
  customerSnapshot?: { name: string; email: string; phone: string };
  businessSnapshot?: { name: string; email: string; phone: string };
  status: QuoteStatus;
  lines: Line[];
  rules: Rules;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  response?: { at: string; comment: string; actor: string };
}
export interface Quote {
  id: string;
  folio: string;
  customerId: string;
  currentId: string;
  versions: QuoteVersion[];
  orderChangeId?: string;
  updatedAt: string;
}
export interface Design {
  id: string;
  lineId: string;
  number: number;
  at: string;
  author: string;
  imageId: string;
  comment: string;
  specKey: string;
  review: Review;
  response?: { at: string; comment: string; actor: string };
}
export interface Order {
  id: string;
  folio: string;
  customerId: string;
  sourceQuoteId: string;
  agreements: { quoteId: string; version: QuoteVersion; at: string }[];
  due: string;
  responsible: string;
  stage: Stage;
  notes: string;
  designs: Design[];
  openChangeId?: string;
  createdAt: string;
}
export interface Payment {
  id: string;
  orderId: string;
  cents: number;
  at: string;
  method: string;
  reference: string;
  reversesId?: string;
  reason?: string;
}
export interface Event {
  id: string;
  entityId: string;
  at: string;
  actor: string;
  text: string;
  public: boolean;
}
export interface ImageRecord {
  id: string;
  name: string;
  bytes: number;
  type: string;
  width: number;
  height: number;
  blob?: Blob;
  path?: string;
}
export interface State {
  id: "main";
  schema: 1;
  revision: number;
  settings: Settings;
  customers: Customer[];
  products: Product[];
  quotes: Quote[];
  orders: Order[];
  payments: Payment[];
  events: Event[];
  images: Omit<ImageRecord, "blob">[];
  counters: { quote: number; order: number };
}
export interface Actor {
  role: Role;
  name: string;
  customerId?: string;
}
export const uid = () => crypto.randomUUID();
/** Cantidad con su palabra en singular o plural: "1 pedido", "2 pedidos", "0 pedidos".
 * Sin forma plural explícita aplica la regla básica del español; para frases o palabras
 * cuyo acento cambia (cotización → cotizaciones) se indica el plural. */
export const plural = (cantidad: number, singular: string, formaPlural?: string) =>
  `${cantidad.toLocaleString("es-MX")} ${
    cantidad === 1
      ? singular
      : (formaPlural ??
        (/[aeiouáéíóú]$/i.test(singular)
          ? `${singular}s`
          : /z$/i.test(singular)
            ? `${singular.slice(0, -1)}ces`
            : `${singular}es`))
  }`;
export const money = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    cents / 100,
  );
export const today = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const addDays = (day: string, n: number) => {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const dateLabel = (day: string) =>
  new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(day.slice(0, 10) + "T12:00:00Z"));
export const specKey = (l: LineInput) =>
  [
    l.productId,
    l.quantity,
    l.materialId,
    l.finishId,
    l.widthMm,
    l.heightMm,
  ].join("|");
export const currentVersion = (q: Quote) =>
  q.versions.find((v) => v.id === q.currentId)!;
export const draftVersion = (q: Quote) =>
  q.versions.find((v) => v.status === "draft");
export const agreement = (o: Order) =>
  o.agreements[o.agreements.length - 1].version;
export const latestDesign = (o: Order, lineId: string) =>
  o.designs.filter((d) => d.lineId === lineId).at(-1);
export const paid = (s: State, orderId: string) =>
  s.payments
    .filter((p) => p.orderId === orderId)
    .reduce((sum, p) => sum + (p.reversesId ? -p.cents : p.cents), 0);
export const balance = (s: State, o: Order) =>
  agreement(o).totalCents - paid(s, o.id);
export const deposit = (v: QuoteVersion) =>
  Number((BigInt(v.totalCents) * BigInt(v.rules.depositBps) + 9999n) / 10000n);
export const effectiveStatus = (v: QuoteVersion, day = today()) =>
  v.status === "sent" && v.validUntil < day ? "expired" : v.status;
export const stageLabels: Record<Stage, string> = {
  pending: "Pendiente",
  printing: "En producción",
  stopped: "Detenido",
  finished: "Terminado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
export const statusLabels: Record<string, string> = {
  ...stageLabels,
  draft: "Borrador",
  sent: "Pendiente de respuesta",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
  superseded: "Sustituida",
  changes: "Cambios solicitados",
  approved: "Aprobado",
};
export function blockers(s: State, o: Order): string[] {
  const v = agreement(o);
  const reasons: string[] = [];
  if (v.status !== "accepted")
    reasons.push("Falta aceptar el acuerdo comercial.");
  if (o.openChangeId)
    reasons.push("Hay una propuesta de cambio pendiente de resolver.");
  for (const l of v.lines)
    if (l.requiresDesign) {
      const d = latestDesign(o, l.id);
      if (!d || d.review !== "approved" || d.specKey !== specKey(l))
        reasons.push(`Falta aprobar el diseño vigente de ${l.productName}.`);
    }
  const missing = deposit(v) - paid(s, o.id);
  if (missing > 0) reasons.push(`Faltan ${money(missing)} de anticipo.`);
  return reasons;
}

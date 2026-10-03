import {
  type State,
  agreement,
  balance,
  blockers,
  currentVersion,
  dateLabel,
  latestDesign,
  money,
  plural,
  paid,
  specKey,
  stageLabels,
} from "../domain/model";
import { type CommercialVersion, commercial } from "../domain/portal";
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function printableQuote(
  v: CommercialVersion,
  folio: string,
  customer: string,
  business: string,
) {
  customer = v.customerSnapshot?.name ?? customer;
  business = v.businessSnapshot?.name ?? business;
  return `<h1>Cotización ${esc(folio)}</h1><p>${esc(customer)} · Versión ${v.number} · Vigente hasta ${esc(dateLabel(v.validUntil))}</p><table><thead><tr><th>Concepto y especificaciones</th><th>Cantidad</th><th>Unitario aprox.</th><th>Importe</th></tr></thead><tbody>${v.lines.map((l) => `<tr><td><strong>${esc(l.productName)}</strong><br>${l.widthMm / 10} × ${l.heightMm / 10} cm · ${esc(l.materialName)} · ${esc(l.finishName)}</td><td>${plural(l.quantity, l.unit === "area" ? "lona" : "pza")}</td><td>${money(Math.round(l.saleCents / l.quantity))}</td><td>${money(l.saleCents)}</td></tr>`).join("")}</tbody></table><div class="totals"><p>Subtotal: ${money(v.subtotalCents)}</p><p>Descuento: −${money(v.discountCents)}</p><p>Impuesto ficticio: ${money(v.taxCents)}</p><h2>Total MXN: ${money(v.totalCents)}</h2><p>Anticipo mínimo: ${money(v.depositCents)}</p></div><p>Elaboración estimada: ${plural(v.leadDays, "día")}. ${esc(v.notes)}</p><p>${esc(business)}</p>`;
}
export function printHTML(content: string, title: string) {
  const w = window.open("", "_blank");
  if (!w)
    throw new Error(
      "Permite ventanas emergentes para imprimir este documento.",
    );
  w.document.write(
    `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:15px/1.6 system-ui,sans-serif;max-width:900px;margin:40px auto;color:#172438;padding:24px}h1{font-size:28px}.demo{border:2px solid #3155e7;padding:12px;font-weight:700;color:#3155e7}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{padding:12px;text-align:left;border-bottom:1px solid #ccd2dd}.totals{text-align:right}img{max-width:260px;max-height:180px}button{padding:12px;border:0;background:#3155e7;color:white;border-radius:6px;font:inherit;cursor:pointer}@media print{button{display:none}body{margin:0;max-width:none}tr{break-inside:avoid}h2{break-after:avoid}}</style></head><body><p class="demo">DOCUMENTO DE DEMOSTRACIÓN · Sin validez fiscal</p>${content}<p>Datos ficticios. Aprobaciones simuladas, sin firma electrónica. La orden no sustituye archivos técnicos de impresión.</p><button onclick="window.print()">Imprimir / guardar PDF</button></body></html>`,
  );
  w.document.close();
}
export async function printOrder(
  s: State,
  id: string,
  kind: "production" | "delivery",
  imageURL: (id: string) => Promise<string>,
) {
  const o = s.orders.find((o) => o.id === id)!;
  if (
    kind === "production" &&
    (blockers(s, o).length || ["cancelled", "delivered"].includes(o.stage))
  )
    throw new Error(
      "La orden de producción requiere un pedido autorizado y vigente.",
    );
  if (kind === "delivery" && o.stage !== "delivered")
    throw new Error("El comprobante requiere entrega registrada.");
  const v = agreement(o),
    c = s.customers.find((c) => c.id === o.customerId)!;
  let html = `<h1>${kind === "production" ? "Orden de producción" : "Comprobante de entrega"} ${esc(o.folio)}</h1><p>${esc(c.name)} · ${esc(stageLabels[o.stage])}</p><p>Fecha comprometida: ${dateLabel(o.due)} · Responsable: ${esc(o.responsible)}</p><p>Origen: ${esc(s.quotes.find((q) => q.id === o.agreements.at(-1)!.quoteId)?.folio)} · Versión ${v.number}</p>`;
  for (const l of v.lines) {
    const d = latestDesign(o, l.id);
    html += `<h2>${esc(l.productName)} · ${plural(l.quantity, l.unit === "area" ? "lona" : "pza")}</h2><p>${l.widthMm / 10} × ${l.heightMm / 10} cm · ${esc(l.materialName)} · ${esc(l.finishName)}</p>`;
    if (
      kind === "production" &&
      d &&
      d.review === "approved" &&
      d.specKey === specKey(l)
    )
      html += `<p>Diseño aprobado v${d.number} · ID ${esc(d.id)} · ${esc(d.response?.at)}</p><img src="${esc(await imageURL(d.imageId))}" alt="Diseño aprobado">`;
  }
  if (kind === "delivery") {
    const delivered = s.events
      .filter(
        (e) => e.entityId === o.id && e.text.startsWith("Estado: Entregado"),
      )
      .at(-1);
    html += `<p>Entrega registrada: ${esc(delivered?.at ?? o.createdAt)}</p><p>Total: ${money(v.totalCents)} · Pagado: ${money(paid(s, o.id))} · Saldo: ${money(balance(s, o))}</p>`;
  }
  printHTML(html, `${o.folio} · Demostración`);
}
export function downloadCSV(s: State, type: "quotes" | "orders" | "payments") {
  const rows: unknown[][] =
    type === "quotes"
      ? [
          [
            "Documento de demostración",
            "Folio",
            "Versión",
            "Cliente",
            "Estado",
            "Total MXN",
          ],
          ...s.quotes.map((q) => {
            const v = currentVersion(q);
            return [
              "DEMO",
              q.folio,
              v.number,
              s.customers.find((c) => c.id === q.customerId)?.name,
              commercial(v).status,
              (v.totalCents / 100).toFixed(2),
            ];
          }),
        ]
      : type === "orders"
        ? [
            [
              "Documento de demostración",
              "Folio",
              "Cliente",
              "Estado",
              "Entrega",
              "Total MXN",
              "Saldo MXN",
            ],
            ...s.orders.map((o) => [
              "DEMO",
              o.folio,
              s.customers.find((c) => c.id === o.customerId)?.name,
              stageLabels[o.stage],
              o.due,
              (agreement(o).totalCents / 100).toFixed(2),
              (balance(s, o) / 100).toFixed(2),
            ]),
          ]
        : [
            [
              "Documento de demostración",
              "ID",
              "Pedido",
              "Fecha",
              "Tipo",
              "Importe MXN",
              "Método",
              "Referencia",
              "Motivo",
            ],
            ...s.payments.map((p) => [
              "DEMO",
              p.id,
              s.orders.find((o) => o.id === p.orderId)?.folio,
              p.at,
              p.reversesId ? "Reversión" : "Pago",
              (p.cents / 100).toFixed(2),
              p.method,
              p.reference,
              p.reason ?? "",
            ]),
          ];
  const cell = (v: unknown) => {
    let t = String(v ?? "");
    if (/^[\s]*[=+\-@]/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tinta-demo-${type}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import { useState } from "react";
import {
  Plus,
  Search,
  ChevronLeft,
  FileText,
  Save,
  Send,
  Trash2,
  Copy,
  ExternalLink,
  Download,
  Info,
  Package,
} from "lucide-react";
import { type UI } from "./context";
import {
  type Quote,
  type QuoteInput,
  type QuoteVersion,
  type LineInput,
  currentVersion,
  draftVersion,
  effectiveStatus,
  money,
  plural,
  dateLabel,
  addDays,
  today,
} from "../domain/model";
import { calculateQuote, defaultLine } from "../domain/pricing";
import { commercial, type CommercialVersion } from "../domain/portal";
import { downloadCSV, printableQuote, printHTML } from "../documents/export";
import { Badge, Button, Empty, Field, Heading } from "./shared";
export function QuoteList(ui: UI) {
  const { s, go } = ui;
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all");
  const rows = [...s.quotes].reverse().filter((q) => {
    const v = currentVersion(q);
    return (
      (status === "all" || effectiveStatus(v) === status) &&
      `${q.folio} ${s.customers.find((c) => c.id === q.customerId)?.name} ${v.lines.map((l) => l.productName).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  return (
    <>
      <Heading
        eyebrow="GESTIÓN COMERCIAL"
        title="Cotizaciones"
        subtitle="Precios claros. Acuerdos que conservan cada detalle."
      >
        <Button variant="secondary" onClick={() => downloadCSV(s, "quotes")}>
          <Download size={17} /> CSV
        </Button>
        <Button onClick={() => go("/cotizaciones/nueva")}>
          <Plus size={18} /> Nueva cotización
        </Button>
      </Heading>
      <section className="card">
        <div className="filter-bar">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Buscar cotizaciones"
              placeholder="Folio, cliente o producto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="control"
            aria-label="Estado de cotización"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            {[
              ["draft", "Borrador"],
              ["sent", "Por responder"],
              ["accepted", "Aceptada"],
              ["rejected", "Rechazada"],
              ["expired", "Vencida"],
              ["cancelled", "Cancelada"],
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <span className="muted">
            {plural(rows.length, "cotización", "cotizaciones")}
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Folio / cliente</th>
                <th>Conceptos</th>
                <th>Versión</th>
                <th>Vigencia</th>
                <th>Total MXN</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const v = currentVersion(q);
                return (
                  <tr key={q.id}>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => go(`/cotizaciones/${q.id}`)}
                      >
                        {q.folio}
                      </button>
                      <small>
                        {s.customers.find((c) => c.id === q.customerId)?.name}
                      </small>
                    </td>
                    <td>
                      {v.lines.map((l) => l.productName).join(", ")}
                      {q.orderChangeId && <small>Propuesta de cambio</small>}
                    </td>
                    <td>
                      v{v.number}
                      {draftVersion(q) && draftVersion(q)!.id !== v.id && (
                        <small>Revisión en borrador</small>
                      )}
                    </td>
                    <td>{dateLabel(v.validUntil)}</td>
                    <td className="amount">{money(v.totalCents)}</td>
                    <td>
                      <Badge status={effectiveStatus(v)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="No encontramos cotizaciones"
            text="Cambia los filtros o prepara una propuesta nueva."
          />
        )}
      </section>
    </>
  );
}
export function QuoteEditor(ui: UI & { quote?: Quote }) {
  const { s, run, go, busy, quote } = ui;
  const existing = quote && draftVersion(quote);
  const active = s.products.filter((p) => !p.archived);
  const [form, setForm] = useState<QuoteInput>(() =>
    existing
      ? {
          customerId: existing.customerId,
          lines: existing.lines.map((l) => ({ ...l })),
          discountBps: existing.discountBps,
          notes: existing.notes,
          leadDays: existing.leadDays,
          validUntil: existing.validUntil,
        }
      : {
          customerId: s.customers[0]?.id ?? "",
          lines: active.length ? [defaultLine(active[0])] : [],
          discountBps: 0,
          notes: "",
          leadDays: 5,
          validUntil: addDays(today(), 7),
        },
  );
  const [baseUpdatedAt] = useState(quote?.updatedAt);
  const [localError, setLocalError] = useState("");
  let calculated: ReturnType<typeof calculateQuote> | undefined;
  let calcError = "";
  try {
    calculated = calculateQuote(form, s.products, s.settings);
  } catch (e) {
    calcError = (e as Error).message;
  }
  if (quote && !existing)
    return (
      <Empty
        title="Este borrador ya no está disponible"
        text="Abre la cotización para consultar su versión actual."
      >
        <Button onClick={() => go(`/cotizaciones/${quote.id}`)}>
          Ver cotización
        </Button>
      </Empty>
    );
  const changeLine = (id: string, update: Partial<LineInput>) =>
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.id === id ? { ...l, ...update } : l)),
    }));
  const save = async () => {
    setLocalError("");
    if (calcError) {
      setLocalError(calcError);
      return;
    }
    const result = await run({
      type: "quote.save",
      quoteId: quote?.id,
      draftId: existing?.id,
      expectedUpdatedAt: baseUpdatedAt,
      input: form,
    });
    if (typeof result === "string") go(`/cotizaciones/${result}`);
  };
  return (
    <>
      <Button
        variant="ghost"
        onClick={() =>
          go(quote ? `/cotizaciones/${quote.id}` : "/cotizaciones")
        }
      >
        <ChevronLeft size={17} /> Volver a cotizaciones
      </Button>
      <Heading
        eyebrow="COTIZADOR"
        title={
          quote
            ? `Editar ${quote.folio} · v${existing!.number}`
            : "Nueva cotización"
        }
        subtitle="Selecciona las especificaciones y revisa el precio antes de emitir."
      />
      <div className="editor-layout">
        <form
          className="editor-main"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <section className="card padded">
            <h2 className="card-title">
              01 <span>Cliente y condiciones</span>
            </h2>
            <div className="form-grid">
              <Field label="Cliente ficticio">
                <select
                  value={form.customerId}
                  disabled={
                    Boolean(quote?.orderChangeId) ||
                    Boolean(quote?.versions.some((v) => v.emittedAt))
                  }
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerId: e.target.value }))
                  }
                  required
                >
                  <option value="">Selecciona un cliente</option>
                  {s.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vigencia hasta">
                <input
                  type="date"
                  min={today()}
                  value={form.validUntil}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, validUntil: e.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="Elaboración estimada (días)">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={form.leadDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, leadDays: Number(e.target.value) }))
                  }
                  required
                />
              </Field>
              <Field
                label="Descuento (%)"
                hint="Máximo 20%; se aplica antes del impuesto."
              >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="20"
                  value={form.discountBps / 100}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discountBps: Math.round(Number(e.target.value) * 100),
                    }))
                  }
                />
              </Field>
            </div>
          </section>
          <section className="card padded">
            <div className="section-head compact">
              <h2 className="card-title">
                02 <span>Productos y especificaciones</span>
              </h2>
              <Button
                variant="secondary"
                disabled={!active.length || form.lines.length >= 20}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    lines: [...f.lines, defaultLine(active[0])],
                  }))
                }
              >
                <Plus size={16} /> Añadir partida
              </Button>
            </div>
            {form.lines.map((line, i) => {
              const p = s.products.find((p) => p.id === line.productId)!;
              return (
                <div key={line.id} className="quote-line">
                  <div className="line-header">
                    <span className="line-number">{i + 1}</span>
                    <strong>{p.name}</strong>
                    <span className="muted">
                      {p.unit === "area" ? "Por metro cuadrado" : "Por pieza"}
                    </span>
                    <Button
                      variant="ghost"
                      aria-label={`Eliminar partida ${i + 1}`}
                      disabled={form.lines.length === 1}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          lines: f.lines.filter((l) => l.id !== line.id),
                        }))
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <div className="form-grid">
                    <Field label="Producto">
                      <select
                        value={line.productId}
                        onChange={(e) => {
                          const product = s.products.find(
                            (p) => p.id === e.target.value,
                          )!;
                          changeLine(line.id, {
                            ...defaultLine(product),
                            id: line.id,
                          });
                        }}
                      >
                        {s.products
                          .filter((p) => !p.archived || p.id === line.productId)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {p.archived ? " (archivado)" : ""}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field
                      label={`Cantidad (${p.unit === "area" ? "lonas" : "piezas"})`}
                      hint={`Mínimo ${p.min.toLocaleString("es-MX")}`}
                    >
                      <input
                        aria-label={`Cantidad partida ${i + 1}`}
                        type="number"
                        min={p.min}
                        max={p.max}
                        step="1"
                        value={line.quantity}
                        onChange={(e) =>
                          changeLine(line.id, {
                            quantity: Number(e.target.value),
                          })
                        }
                        required
                      />
                    </Field>
                    <Field label="Material">
                      <select
                        value={line.materialId}
                        onChange={(e) =>
                          changeLine(line.id, {
                            materialId: e.target.value,
                            finishId: p.finishes.find((f) =>
                              f.materials.includes(e.target.value),
                            )!.id,
                          })
                        }
                      >
                        {p.materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Acabado compatible">
                      <select
                        value={line.finishId}
                        onChange={(e) =>
                          changeLine(line.id, { finishId: e.target.value })
                        }
                      >
                        {p.finishes
                          .filter((f) => f.materials.includes(line.materialId))
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Ancho (cm)">
                      <input
                        type="number"
                        min={p.minMm / 10}
                        max={p.maxMm / 10}
                        step="0.1"
                        readOnly={Boolean(p.fixed)}
                        value={line.widthMm / 10}
                        onChange={(e) =>
                          changeLine(line.id, {
                            widthMm: Math.round(Number(e.target.value) * 10),
                          })
                        }
                        required
                      />
                    </Field>
                    <Field label="Alto (cm)">
                      <input
                        type="number"
                        min={p.minMm / 10}
                        max={p.maxMm / 10}
                        step="0.1"
                        readOnly={Boolean(p.fixed)}
                        value={line.heightMm / 10}
                        onChange={(e) =>
                          changeLine(line.id, {
                            heightMm: Math.round(Number(e.target.value) * 10),
                          })
                        }
                        required
                      />
                    </Field>
                  </div>
                  {calculated?.lines[i] && (
                    <div className="line-result">
                      <span>
                        {p.unit === "area"
                          ? `${calculated.lines[i].areaM2.toLocaleString("es-MX", { maximumFractionDigits: 4 })} m² en total`
                          : plural(line.quantity, "pieza")}
                      </span>
                      <strong>{money(calculated.lines[i].saleCents)}</strong>
                    </div>
                  )}
                </div>
              );
            })}
            {!form.lines.length && (
              <Empty
                title="El catálogo no tiene productos activos"
                text="Activa un producto antes de cotizar."
              />
            )}
          </section>
          <section className="card padded">
            <h2 className="card-title">
              03 <span>Observaciones comerciales</span>
            </h2>
            <Field label="Notas visibles para el cliente">
              <textarea
                placeholder="Condiciones, entrega o detalles de la propuesta…"
                maxLength={2000}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </Field>
          </section>
          {localError && (
            <p className="form-error" role="alert">
              {localError}
            </p>
          )}
          <Button type="submit" disabled={busy || !calculated}>
            <Save size={17} /> Guardar borrador
          </Button>
        </form>
        <aside className="quote-summary card padded">
          <div className="summary-icon">
            <FileText size={24} />
          </div>
          <h2>Resumen de cotización</h2>
          <p className="muted">Importes ficticios en pesos mexicanos.</p>
          {calculated ? (
            <>
              <Totals v={calculated} />
              <div className="internal-breakdown">
                <h3>Desglose interno</h3>
                {calculated.lines.map((l) => (
                  <div key={l.id} className="cost-block">
                    <strong>{l.productName}</strong>
                    <div>
                      <span>Preparación</span>
                      <span>{money(l.setupCents)}</span>
                    </div>
                    <div>
                      <span>Material</span>
                      <span>{money(l.materialCostCents)}</span>
                    </div>
                    <div>
                      <span>Acabados</span>
                      <span>{money(l.finishCostCents)}</span>
                    </div>
                  </div>
                ))}
                <div className="total-row">
                  <span>Costo interno total</span>
                  <strong>
                    {money(
                      calculated.lines.reduce((n, l) => n + l.costCents, 0),
                    )}
                  </strong>
                </div>
                <div className="total-row">
                  <span>Margen sobre venta</span>
                  <strong>{s.settings.marginBps / 100}%</strong>
                </div>
                <p>
                  <Info size={14} /> Este desglose no aparece en el portal del
                  cliente.
                </p>
              </div>
            </>
          ) : (
            <p role="status" className="form-error">
              {calcError}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
export function Totals({
  v,
}: {
  v: Pick<
    QuoteVersion,
    "subtotalCents" | "discountCents" | "taxCents" | "totalCents"
  >;
}) {
  return (
    <div className="totals">
      <div>
        <span>Subtotal</span>
        <span>{money(v.subtotalCents)}</span>
      </div>
      <div>
        <span>Descuento</span>
        <span>−{money(v.discountCents)}</span>
      </div>
      <div>
        <span>Impuesto ficticio</span>
        <span>{money(v.taxCents)}</span>
      </div>
      <div className="grand-total">
        <span>Total MXN</span>
        <strong>{money(v.totalCents)}</strong>
      </div>
    </div>
  );
}
export function CommercialLines({ v }: { v: CommercialVersion }) {
  return (
    <div className="commercial-lines">
      {v.lines.map((l) => (
        <div className="commercial-line" key={l.id}>
          <div className="product-symbol">
            <Package size={22} />
          </div>
          <div>
            <h3>{l.productName}</h3>
            <p>
              {l.quantity.toLocaleString("es-MX")}{" "}
              {l.unit === "area" ? "lonas" : "piezas"} · {l.widthMm / 10} ×{" "}
              {l.heightMm / 10} cm
            </p>
            <small>
              {l.materialName} · {l.finishName}
              {l.unit === "area" ? ` · ${l.areaM2} m² en total` : ""}
            </small>
            <small>
              Unitario aproximado: {money(Math.round(l.saleCents / l.quantity))}
            </small>
          </div>
          <strong>{money(l.saleCents)}</strong>
        </div>
      ))}
    </div>
  );
}
export function QuoteDetail(ui: UI & { quote: Quote }) {
  const { s, quote: q, go, run, client, busy, notify } = ui;
  const [selected, setSelected] = useState("");
  const v = q.versions.find((v) => v.id === selected) ?? currentVersion(q);
  const d = draftVersion(q);
  const isCurrent = v.id === q.currentId;
  const cv = commercial(v);
  const c = s.customers.find((c) => c.id === q.customerId)!;
  const revise = async () => {
    if (await run({ type: "quote.revise", quoteId: q.id }))
      go(`/cotizaciones/${q.id}/editar`);
  };
  const emit = async () => {
    if (
      d &&
      confirm(
        `Emitir ${q.folio} v${d.number} por ${money(d.totalCents)}. Se conservarán sus datos y se sustituirá la versión enviada anterior. El envío es simulado.`,
      )
    )
      await run({ type: "quote.issue", quoteId: q.id, versionId: d.id });
  };
  return (
    <>
      <Button variant="ghost" onClick={() => go("/cotizaciones")}>
        <ChevronLeft size={17} /> Cotizaciones
      </Button>
      <Heading
        eyebrow={
          q.orderChangeId ? "PROPUESTA DE CAMBIO" : "PROPUESTA COMERCIAL"
        }
        title={q.folio}
        subtitle={c.name}
      >
        <Badge status={effectiveStatus(currentVersion(q))} />
        <Button
          variant="secondary"
          onClick={() => client(q.customerId, `/portal?quote=${q.id}`)}
        >
          <ExternalLink size={16} /> Ver como cliente
        </Button>
      </Heading>
      <div className="detail-layout">
        <section>
          <div className="card padded">
            <div className="section-head compact">
              <h2>Conceptos de la versión {v.number}</h2>
              <Badge status={effectiveStatus(v)} />
            </div>
            <CommercialLines v={cv} />
            <div className="form-grid details-meta">
              <div>
                <small>Vigencia</small>
                <strong>{dateLabel(v.validUntil)}</strong>
              </div>
              <div>
                <small>Elaboración estimada</small>
                <strong>{plural(v.leadDays, "día")}</strong>
              </div>
            </div>
            {v.notes && (
              <div className="note-block">
                <small>Observaciones comerciales</small>
                <p>{v.notes}</p>
              </div>
            )}
            <Totals v={v} />
            <div className="action-row">
              <Button
                variant="secondary"
                onClick={() => {
                  try {
                    printHTML(
                      printableQuote(cv, q.folio, c.name, s.settings.business),
                      q.folio,
                    );
                  } catch (e) {
                    notify((e as Error).message, true);
                  }
                }}
              >
                <PrinterIcon /> Imprimir / PDF
              </Button>
              {isCurrent && v.status === "accepted" && !q.orderChangeId && (
                <Button
                  disabled={busy}
                  onClick={async () => {
                    const id = await run({
                      type: "order.convert",
                      quoteId: q.id,
                    });
                    if (typeof id === "string") go(`/pedidos/${id}`);
                  }}
                >
                  <Package size={17} />{" "}
                  {s.orders.some((o) => o.sourceQuoteId === q.id)
                    ? "Abrir pedido"
                    : "Convertir en pedido"}
                </Button>
              )}
            </div>
          </div>
          <section className="card padded stack-gap">
            <h2>Historial de versiones</h2>
            {[...q.versions].reverse().map((version) => (
              <button
                className={`version-row ${v.id === version.id ? "selected" : ""}`}
                key={version.id}
                onClick={() => setSelected(version.id)}
              >
                <span>
                  <strong>Versión {version.number}</strong>
                  <small>
                    {dateLabel(version.createdAt)} · {money(version.totalCents)}
                  </small>
                </span>
                <Badge status={effectiveStatus(version)} />
                {version.id === q.currentId && (
                  <span className="muted">Vigente</span>
                )}
              </button>
            ))}
            {v.response && (
              <div className="note-block">
                <small>
                  Respuesta del cliente · {dateLabel(v.response.at)}
                </small>
                <p>
                  {v.response.comment ||
                    (v.status === "accepted"
                      ? "Propuesta aceptada."
                      : "Propuesta rechazada.")}
                </p>
              </div>
            )}
          </section>
        </section>
        <aside>
          <section className="card padded stack-gap">
            <h2>Acciones comerciales</h2>
            {d && (
              <>
                <p className="muted">
                  Borrador v{d.number} listo para revisar.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => go(`/cotizaciones/${q.id}/editar`)}
                >
                  <Save size={16} /> Editar borrador
                </Button>
                <Button disabled={busy} onClick={emit}>
                  <Send size={16} /> Emitir · envío simulado
                </Button>
              </>
            )}
            {!d && currentVersion(q).status !== "accepted" && (
              <Button variant="secondary" disabled={busy} onClick={revise}>
                <Copy size={16} /> Crear nueva versión
              </Button>
            )}
            {currentVersion(q).status !== "accepted" &&
              currentVersion(q).status !== "cancelled" && (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={async () => {
                    const reason = prompt(
                      "Motivo de cancelación de la cotización:",
                    );
                    if (
                      reason?.trim() &&
                      confirm(
                        "¿Cancelar la cotización conservando su historial?",
                      )
                    )
                      await run({
                        type: "quote.cancel",
                        quoteId: q.id,
                        reason,
                      });
                  }}
                >
                  Cancelar cotización
                </Button>
              )}
            {q.orderChangeId && (
              <Button
                variant="secondary"
                onClick={() => go(`/pedidos/${q.orderChangeId}`)}
              >
                Volver al pedido
              </Button>
            )}
            <p className="muted">
              La respuesta se realiza desde la vista del cliente. No se envían
              mensajes.
            </p>
          </section>
          <section className="card padded stack-gap">
            <h2>Solo administración</h2>
            <div className="total-row">
              <span>Costo interno</span>
              <strong>
                {money(v.lines.reduce((n, l) => n + l.costCents, 0))}
              </strong>
            </div>
            <div className="total-row">
              <span>Margen sobre venta</span>
              <strong>{v.rules.marginBps / 100}%</strong>
            </div>
            <div className="total-row">
              <span>Anticipo requerido</span>
              <strong>{v.rules.depositBps / 100}%</strong>
            </div>
            <p className="muted">Reglas conservadas con esta versión.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
function PrinterIcon() {
  return <FileText size={16} />;
}

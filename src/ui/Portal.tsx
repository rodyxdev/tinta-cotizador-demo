import { useState } from "react";
import {
  Check,
  X,
  FileText,
  Printer,
  MessageSquare,
  CalendarDays,
  Wallet,
  Package,
  CheckCircle2,
} from "lucide-react";
import { type Portal as PortalData } from "../domain/portal";
import { type Command } from "../domain/commands";
import {
  type State,
  dateLabel,
  money,
  plural,
  stageLabels,
} from "../domain/model";
import { Button, Badge, Heading, Empty, DesignImage, Field } from "./shared";
import { CommercialLines, Totals } from "./Quotes";
import { printHTML, printableQuote } from "../documents/export";
export function Portal({
  data,
  images,
  busy,
  run,
  route,
  notify,
}: {
  data: PortalData;
  images: State["images"];
  busy: boolean;
  run: (c: Command) => Promise<string | true | false>;
  route: string;
  notify: (text: string, error?: boolean) => void;
}) {
  const params = new URLSearchParams(route.split("?")[1]);
  const [quoteId, setQuoteId] = useState(
    params.get("quote") ??
      data.quotes.find((q) => q.current.status === "sent")?.id ??
      data.quotes[0]?.id ??
      "",
  );
  const [orderId, setOrderId] = useState(
    params.get("order") ?? data.orders[0]?.id ?? "",
  );
  const [versionId, setVersionId] = useState("");
  const q = data.quotes.find((q) => q.id === quoteId),
    o = data.orders.find((o) => o.id === orderId);
  const v = q && (q.versions.find((v) => v.id === versionId) ?? q.current);
  const isCurrent = q?.current.id === v?.id;
  return (
    <>
      <Heading
        eyebrow="PORTAL DEL CLIENTE"
        title={`Hola, ${data.customer?.name ?? "cliente"}.`}
        subtitle="Tu cotización, tus diseños y el avance de tu pedido."
      />
      <div className="portal-welcome">
        <CheckCircle2 size={24} />
        <div>
          <strong>Revisa cada detalle antes de aprobar.</strong>
          <p>
            Las aprobaciones son simuladas. No se envían mensajes ni se realizan
            cobros.
          </p>
        </div>
      </div>
      <section className="card padded stack-gap">
        <div className="section-head compact">
          <h2>
            <FileText size={19} /> Tu cotización
          </h2>
          <select
            className="control"
            aria-label="Seleccionar cotización del cliente"
            value={quoteId}
            onChange={(e) => {
              setQuoteId(e.target.value);
              setVersionId("");
            }}
          >
            <option value="">Selecciona una cotización</option>
            {data.quotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.folio}
                {q.orderChangeId ? " · propuesta de cambio" : ""}
              </option>
            ))}
          </select>
        </div>
        {q && v ? (
          <>
            <div className="portal-quote-header">
              <div>
                <strong>
                  {q.folio} · versión {v.number}
                </strong>
                <p className="muted">
                  Vigencia hasta {dateLabel(v.validUntil)} · elaboración
                  estimada: {plural(v.leadDays, "día")}
                </p>
              </div>
              <Badge status={v.status} />
            </div>
            <CommercialLines v={v} />
            <Totals v={v} />
            {v.notes && <p className="note-block">{v.notes}</p>}
            <div className="action-row">
              {isCurrent && v.status === "sent" && (
                <>
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      if (
                        confirm(
                          `¿Aceptar ${q.folio}, versión ${v.number}, por ${money(v.totalCents)}? Confirma productos, medidas y acabados. Esta aprobación es de demostración.`,
                        )
                      )
                        await run({
                          type: "quote.respond",
                          quoteId: q.id,
                          versionId: v.id,
                          accept: true,
                          comment:
                            "Acepto los conceptos y el total de esta versión.",
                        });
                    }}
                  >
                    <Check size={17} /> Aceptar cotización
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      const comment = prompt(
                        "Comentario para rechazar la propuesta (opcional):",
                      );
                      if (
                        comment !== null &&
                        confirm(`¿Rechazar ${q.folio} v${v.number}?`)
                      )
                        await run({
                          type: "quote.respond",
                          quoteId: q.id,
                          versionId: v.id,
                          accept: false,
                          comment,
                        });
                    }}
                  >
                    <X size={17} /> Rechazar
                  </Button>
                </>
              )}
              {v.status === "expired" && (
                <p className="form-error">
                  Esta propuesta venció. El administrador debe emitir una nueva
                  versión antes de aceptarla.
                </p>
              )}
              {v.status === "accepted" && (
                <p className="ready-message">
                  <CheckCircle2 size={18} /> Propuesta aceptada. El equipo puede
                  preparar tu pedido.
                </p>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  try {
                    printHTML(
                      printableQuote(
                        v,
                        q.folio,
                        data.customer?.name ?? "",
                        data.business.name,
                      ),
                      q.folio,
                    );
                  } catch (e) {
                    notify((e as Error).message, true);
                  }
                }}
              >
                <Printer size={16} /> Imprimir / PDF
              </Button>
            </div>
            {q.versions.length > 1 && (
              <Field label="Historial comercial">
                <select
                  value={v.id}
                  onChange={(e) => setVersionId(e.target.value)}
                >
                  {[...q.versions].reverse().map((v) => (
                    <option key={v.id} value={v.id}>
                      Versión {v.number}
                      {v.id === q.currentId ? " · vigente" : " · historial"}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {!isCurrent && (
              <p className="muted">
                Estás consultando una versión anterior; las respuestas solo se
                permiten en la vigente.
              </p>
            )}
          </>
        ) : (
          <Empty
            title="Todavía no tienes una propuesta emitida"
            text="El administrador puede preparar y emitir una cotización para este cliente de ejemplo."
          />
        )}
      </section>
      <section className="card padded stack-gap">
        <div className="section-head compact">
          <h2>
            <Package size={19} /> Tu pedido
          </h2>
          <select
            className="control"
            aria-label="Seleccionar pedido del cliente"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          >
            <option value="">Selecciona un pedido</option>
            {data.orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.folio}
              </option>
            ))}
          </select>
        </div>
        {o ? (
          <>
            <div className="portal-quote-header">
              <strong>{o.folio}</strong>
              <Badge status={o.stage} />
            </div>
            <div className="portal-status-track">
              {(["pending", "printing", "finished", "delivered"] as const).map(
                (stage, i) => (
                  <div
                    key={stage}
                    className={
                      ["pending", "printing", "finished", "delivered"].indexOf(
                        o.stage,
                      ) >= i
                        ? "complete"
                        : ""
                    }
                  >
                    <span>{i + 1}</span>
                    <strong>{stageLabels[stage]}</strong>
                  </div>
                ),
              )}
            </div>
            <div className="payment-stats">
              <div>
                <small>
                  <CalendarDays size={14} /> Entrega comprometida
                </small>
                <strong>{dateLabel(o.due)}</strong>
              </div>
              <div>
                <small>
                  <Wallet size={14} /> Pagado neto
                </small>
                <strong>{money(o.paidCents)}</strong>
              </div>
              <div>
                <small>Saldo pendiente MXN</small>
                <strong>{money(o.balanceCents)}</strong>
              </div>
            </div>
            <CommercialLines v={o.current} />
          </>
        ) : (
          <Empty
            title="Tu pedido aparecerá aquí"
            text="Una vez aceptada la propuesta, el administrador puede convertirla en pedido."
          />
        )}
      </section>
      {o && (
        <>
          <Heading
            title="Revisa tus diseños"
            subtitle="Aprueba la versión vigente con sus especificaciones, o explica los cambios que necesitas."
          />
          <div className="portal-design-grid">
            {o.current.lines
              .filter((l) => l.requiresDesign)
              .map((l) => (
                <ClientDesign
                  key={`${o.id}-${l.id}`}
                  lineId={l.id}
                  order={o}
                  images={images}
                  run={run}
                  busy={busy}
                />
              ))}
          </div>
          <section className="card padded stack-gap">
            <h2>Avances de tu pedido</h2>
            {!o.events.length && (
              <p className="muted">Los próximos avances aparecerán aquí.</p>
            )}
            <div className="timeline">
              {[...o.events].reverse().map((e) => (
                <div key={e.id}>
                  <span className="timeline-dot" />
                  <strong>{e.text}</strong>
                  <small>
                    {dateLabel(e.at)} · {e.actor}
                  </small>
                </div>
              ))}
            </div>
          </section>
          {o.payments.length > 0 && (
            <section className="card padded stack-gap">
              <h2>Historial de pagos ficticios</h2>
              {o.payments.map((p) => (
                <div className="total-row" key={p.id}>
                  <span>
                    {dateLabel(p.at)} · {p.reversed ? "Reversión" : p.method}
                  </span>
                  <strong>
                    {p.reversed ? "−" : ""}
                    {money(p.cents)}
                  </strong>
                </div>
              ))}
            </section>
          )}
        </>
      )}
      <div className="portal-contact">
        <strong>{data.business.name}</strong>
        <span>{data.business.email}</span>
        <span>{data.business.phone}</span>
        <small>Datos de contacto ficticios · Sin envío de mensajes</small>
      </div>
    </>
  );
}
function ClientDesign({
  order: o,
  lineId,
  images,
  busy,
  run,
}: {
  order: PortalData["orders"][number];
  lineId: string;
  images: State["images"];
  busy: boolean;
  run: (c: Command) => Promise<string | true | false>;
}) {
  const [comment, setComment] = useState(""),
    [selected, setSelected] = useState("");
  const l = o.current.lines.find((l) => l.id === lineId)!;
  const versions = o.designs.filter((d) => d.lineId === lineId);
  const current = versions.at(-1),
    d = versions.find((d) => d.id === selected) ?? current;
  const canRespond =
    d &&
    d.id === current?.id &&
    d.matchesSpecs &&
    d.review === "pending" &&
    !["printing", "finished", "delivered", "cancelled"].includes(o.stage);
  return (
    <section className="card client-design">
      <div className="padded">
        <div className="section-head compact">
          <h2>{l.productName}</h2>
          {d && (
            <Badge
              status={
                d.id !== current?.id
                  ? "superseded"
                  : !d.matchesSpecs
                    ? "changes"
                    : d.review
              }
            >
              {d.id !== current?.id
                ? "Sustituido"
                : !d.matchesSpecs
                  ? "Especificaciones cambiaron"
                  : d.review === "pending"
                    ? "Por revisar"
                    : d.review === "changes"
                      ? "Cambios solicitados"
                      : "Aprobado"}
            </Badge>
          )}
        </div>
        <p className="muted">
          {l.quantity.toLocaleString("es-MX")}{" "}
          {l.unit === "area" ? "lonas" : "piezas"} · {l.widthMm / 10} ×{" "}
          {l.heightMm / 10} cm
        </p>
        <p className="muted">
          {l.materialName} · {l.finishName}
        </p>
      </div>
      <DesignImage
        imageId={d?.imageId}
        images={images}
        alt={`Diseño ${d ? `v${d.number}` : ""} de ${l.productName}`}
        className="large-preview"
      />
      <div className="padded stack-gap">
        {d ? (
          <>
            <div className="design-caption">
              <strong>Versión {d.number}</strong>
              <span>{dateLabel(d.at)}</span>
            </div>
            <p className="muted">{d.comment}</p>
            {d.response && (
              <div className="client-comment">
                <MessageSquare size={18} />
                <div>
                  <strong>Tu respuesta a esta versión</strong>
                  <p>{d.response.comment || "Diseño aprobado."}</p>
                  <small>{dateLabel(d.response.at)}</small>
                </div>
              </div>
            )}
            {canRespond && (
              <>
                <Field label="Comentarios o cambios solicitados">
                  <textarea
                    aria-label={`Comentarios de diseño ${l.productName}`}
                    maxLength={2000}
                    placeholder="Describe qué necesitas cambiar…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </Field>
                <div className="action-row">
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      if (
                        confirm(
                          `¿Aprobar diseño v${d.number} de ${l.productName}? ${plural(l.quantity, l.unit === "area" ? "lona" : "pieza")}, ${l.widthMm / 10} × ${l.heightMm / 10} cm, ${l.materialName}, ${l.finishName}. La aprobación es simulada.`,
                        ) &&
                        (await run({
                          type: "design.respond",
                          orderId: o.id,
                          lineId,
                          designId: d.id,
                          approve: true,
                          comment,
                        }))
                      )
                        setComment("");
                    }}
                  >
                    <Check size={17} /> Aprobar esta versión
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy || !comment.trim()}
                    onClick={async () => {
                      if (
                        confirm("¿Solicitar cambios para esta versión?") &&
                        (await run({
                          type: "design.respond",
                          orderId: o.id,
                          lineId,
                          designId: d.id,
                          approve: false,
                          comment,
                        }))
                      )
                        setComment("");
                    }}
                  >
                    <MessageSquare size={16} /> Solicitar cambios
                  </Button>
                </div>
              </>
            )}
            {versions.length > 1 && (
              <Field label="Historial de versiones de diseño">
                <select
                  value={d.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {[...versions].reverse().map((d) => (
                    <option key={d.id} value={d.id}>
                      Versión {d.number}
                      {d.id === current?.id ? " · vigente" : " · sustituida"}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        ) : (
          <Empty
            title="El equipo está preparando tu diseño"
            text="La vista previa aparecerá aquí para que puedas revisarla."
          />
        )}
      </div>
    </section>
  );
}

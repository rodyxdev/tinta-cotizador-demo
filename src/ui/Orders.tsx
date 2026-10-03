import { useState } from "react";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Play,
  Pause,
  Check,
  PackageCheck,
  Upload,
  CalendarDays,
  User,
  FileText,
  Plus,
  AlertCircle,
  MessageSquare,
  Wallet,
  History,
  Printer,
} from "lucide-react";
import { type UI } from "./context";
import {
  type Order,
  type Line,
  type Stage,
  agreement,
  balance,
  blockers,
  dateLabel,
  latestDesign,
  money,
  plural,
  paid,
  specKey,
  stageLabels,
  today,
  deposit,
} from "../domain/model";
import { inspectImage } from "../storage/store";
import { CommercialLines, Totals } from "./Quotes";
import { commercial } from "../domain/portal";
import { downloadCSV, printOrder } from "../documents/export";
import {
  Badge,
  Button,
  DesignImage,
  Empty,
  Field,
  Heading,
  imageURL,
} from "./shared";
export function OrderList(ui: UI & { board?: boolean }) {
  const { s, go, board, actor } = ui;
  const [search, setSearch] = useState(""),
    [stage, setStage] = useState("all"),
    [staff, setStaff] = useState("all"),
    [date, setDate] = useState("");
  const day = today();
  const rows = s.orders.filter(
    (o) =>
      (stage === "all" || o.stage === stage) &&
      (staff === "all" || o.responsible === staff) &&
      (!date || o.due === date) &&
      `${o.folio} ${s.customers.find((c) => c.id === o.customerId)?.name} ${agreement(
        o,
      )
        .lines.map((l) => l.productName)
        .join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        eyebrow={board ? "DEL ACUERDO AL TALLER" : "GESTIÓN DE PEDIDOS"}
        title={board ? "Tablero de producción" : "Pedidos"}
        subtitle={
          board
            ? "Cada trabajo, con su diseño autorizado y sus próximos pasos."
            : "Especificaciones, diseños y pagos en el mismo lugar."
        }
      >
        {actor.role === "admin" && (
          <Button variant="secondary" onClick={() => downloadCSV(s, "orders")}>
            <Download size={17} /> Exportar CSV
          </Button>
        )}
      </Heading>
      <div className="filter-bar card">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Buscar en pedidos"
            placeholder="Folio, cliente o producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          className="control"
          aria-label="Filtrar estado de pedido"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          {Object.entries(stageLabels).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="control"
          aria-label="Filtrar responsable"
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
        >
          <option value="all">Todos los responsables</option>
          {[
            ...new Set([
              ...s.settings.staff,
              ...s.orders.map((o) => o.responsible),
            ]),
          ].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <input
          className="control"
          aria-label="Filtrar fecha de entrega"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {date && (
          <Button variant="ghost" onClick={() => setDate("")}>
            Limpiar fecha
          </Button>
        )}
      </div>
      {board ? (
        <div className="kanban" aria-label="Pedidos por estado">
          {(
            [
              "pending",
              "printing",
              "stopped",
              "finished",
              "delivered",
              ...(stage === "cancelled" ? ["cancelled"] : []),
            ] as Stage[]
          ).map((st) => (
            <section className="kanban-column" key={st}>
              <div className="kanban-heading">
                <span className={`stage-dot ${st}`} />
                <h2>{stageLabels[st]}</h2>
                <span>{rows.filter((o) => o.stage === st).length}</span>
              </div>
              {rows
                .filter((o) => o.stage === st)
                .map((o) => (
                  <OrderCard key={o.id} ui={ui} order={o} />
                ))}
              {!rows.some((o) => o.stage === st) && (
                <p className="column-empty">Sin trabajos en este estado</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <section className="card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pedido / cliente</th>
                  <th>Productos</th>
                  <th>Entrega</th>
                  <th>Estado</th>
                  <th>Saldo</th>
                  <th>Responsable</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => go(`/pedidos/${o.id}`)}
                      >
                        {o.folio}
                      </button>
                      <small>
                        {s.customers.find((c) => c.id === o.customerId)?.name}
                      </small>
                    </td>
                    <td>
                      {agreement(o)
                        .lines.map((l) => `${l.quantity} ${l.productName}`)
                        .join(", ")}
                    </td>
                    <td
                      className={
                        o.due < day &&
                        !["delivered", "cancelled"].includes(o.stage)
                          ? "overdue"
                          : ""
                      }
                    >
                      {dateLabel(o.due)}
                      <small>
                        {o.due < day &&
                        !["delivered", "cancelled"].includes(o.stage)
                          ? "Atrasado"
                          : "Comprometida"}
                      </small>
                    </td>
                    <td>
                      <Badge status={o.stage} />
                    </td>
                    <td>{money(balance(s, o))}</td>
                    <td>{o.responsible}</td>
                    <td>
                      <Button
                        variant="ghost"
                        aria-label={`Abrir pedido ${o.folio}`}
                        onClick={() => go(`/pedidos/${o.id}`)}
                      >
                        <ChevronRight size={17} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <Empty
              title="No hay pedidos para estos filtros"
              text="Prueba otro estado, responsable o fecha."
            />
          )}
        </section>
      )}
    </>
  );
}
function OrderCard({ ui, order: o }: { ui: UI; order: Order }) {
  const v = agreement(o),
    d = latestDesign(o, v.lines[0].id),
    reasons = blockers(ui.s, o);
  const overdue =
    o.due < today() && !["delivered", "cancelled"].includes(o.stage);
  return (
    <button className="order-card" onClick={() => ui.go(`/pedidos/${o.id}`)}>
      <div className="order-card-top">
        <strong>{o.folio}</strong>
        {overdue && <span className="late-label">Atrasado</span>}
      </div>
      <h3>{ui.s.customers.find((c) => c.id === o.customerId)?.name}</h3>
      <DesignImage
        imageId={d?.imageId}
        images={ui.s.images}
        alt={`Diseño de ${v.lines[0].productName}`}
      />
      <p>
        {v.lines
          .map(
            (l) =>
              `${l.quantity.toLocaleString("es-MX")} ${l.productName.toLowerCase()}`,
          )
          .join(" · ")}
      </p>
      {["pending", "stopped"].includes(o.stage) && (
        <div className={reasons.length ? "blocker-mini" : "ready-mini"}>
          {reasons.length ? (
            <>
              <AlertCircle size={14} />
              <span>
                {reasons[0]}
                {reasons.length > 1 ? ` (+${reasons.length - 1})` : ""}
              </span>
            </>
          ) : (
            <>
              <Check size={14} /> Listo para iniciar
            </>
          )}
        </div>
      )}
      <div className="order-card-bottom">
        <span className={overdue ? "overdue" : ""}>
          <CalendarDays size={14} /> {dateLabel(o.due)}
        </span>
        <span className="avatar tiny" title={o.responsible}>
          {o.responsible[0]}
        </span>
      </div>
    </button>
  );
}
export function OrderDetail(ui: UI & { order: Order; initialTab?: string }) {
  const { s, order: o, actor, go, client, run, busy, notify } = ui;
  const [tab, setTab] = useState(ui.initialTab ?? "summary"),
    [advance, setAdvance] = useState("");
  const v = agreement(o),
    reasons = blockers(s, o),
    isAdmin = actor.role === "admin";
  const changeStage = async (stage: Stage) => {
    let reason: string | undefined;
    if (["stopped", "cancelled"].includes(stage)) {
      reason =
        prompt(
          `Motivo para ${stage === "stopped" ? "detener" : "cancelar"} ${o.folio}:`,
        ) ?? undefined;
      if (!reason?.trim()) return;
    }
    if (
      confirm(
        `¿${stage === "printing" ? (o.stage === "stopped" ? "Reanudar" : "Iniciar producción de") : stage === "finished" ? "Marcar terminado" : stage === "delivered" ? "Registrar entrega de" : stage === "stopped" ? "Detener" : "Cancelar"} ${o.folio}?${stage === "cancelled" ? " Se conservarán sus acuerdos, diseños y pagos." : ""}`,
      )
    )
      await run({ type: "order.stage", orderId: o.id, stage, reason });
  };
  return (
    <>
      <Button variant="ghost" onClick={() => go("/pedidos")}>
        <ChevronLeft size={17} /> Pedidos
      </Button>
      <Heading
        eyebrow="DETALLE DEL PEDIDO"
        title={o.folio}
        subtitle={s.customers.find((c) => c.id === o.customerId)?.name}
      >
        <Badge status={o.stage} />
        {isAdmin && (
          <Button
            variant="secondary"
            onClick={() => client(o.customerId, `/portal?order=${o.id}`)}
          >
            <ExternalLink size={16} /> Ver como cliente
          </Button>
        )}
      </Heading>
      <div className="order-meta">
        <span>
          <CalendarDays size={17} /> Entrega:{" "}
          <strong>{dateLabel(o.due)}</strong>
          {o.due < today() && !["delivered", "cancelled"].includes(o.stage) && (
            <Badge status="expired">Atrasado</Badge>
          )}
        </span>
        <span>
          <User size={17} /> {o.responsible}
        </span>
        <span>
          <Wallet size={17} /> Saldo: <strong>{money(balance(s, o))}</strong>
        </span>
      </div>
      <div className="detail-layout">
        <section>
          <div className="tabs detail-tabs">
            {[
              ["summary", "Resumen", FileText],
              ["designs", "Diseños", LayersIcon],
              ...(isAdmin ? [["payments", "Pagos", Wallet] as const] : []),
              ["history", "Historial", History],
            ].map(([id, label, Icon]) => (
              <button
                key={id as string}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id as string)}
              >
                <Icon size={16} /> {label as string}
              </button>
            ))}
          </div>
          {tab === "summary" && (
            <>
              <section className="card padded">
                <h2>Especificaciones acordadas</h2>
                <CommercialLines v={commercial(v)} />
                <p className="muted">
                  Origen:{" "}
                  {
                    s.quotes.find((q) => q.id === o.agreements.at(-1)!.quoteId)
                      ?.folio
                  }{" "}
                  · versión {v.number}. Las especificaciones y precios se
                  conservan con el acuerdo.
                </p>
                {isAdmin && <Totals v={v} />}
              </section>
              <section className="card padded stack-gap">
                <h2>Diseños del pedido</h2>
                <div className="design-mini-grid">
                  {v.lines.map((l) => {
                    const d = latestDesign(o, l.id);
                    return (
                      <button
                        key={l.id}
                        className="design-mini"
                        onClick={() => setTab("designs")}
                      >
                        <DesignImage
                          imageId={d?.imageId}
                          images={s.images}
                          alt={l.productName}
                        />
                        <strong>{l.productName}</strong>
                        <Badge status={d?.review ?? "pending"}>
                          {d
                            ? d.specKey === specKey(l)
                              ? d.review === "pending"
                                ? "Por revisar"
                                : d.review === "approved"
                                  ? "Aprobado"
                                  : "Cambios solicitados"
                              : "Especificaciones cambiaron"
                            : "Falta incorporar diseño"}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </section>
              {isAdmin && <OrderEdit ui={ui} order={o} />}
            </>
          )}
          {tab === "designs" &&
            v.lines.map((l) => (
              <DesignPanel key={l.id} ui={ui} order={o} line={l} />
            ))}
          {tab === "payments" && isAdmin && <PaymentPanel ui={ui} order={o} />}
          {tab === "history" && (
            <>
              <section className="card padded">
                <h2>Historial del pedido</h2>
                <div className="timeline">
                  {[...s.events]
                    .reverse()
                    .filter((e) => e.entityId === o.id && (isAdmin || e.public))
                    .map((e) => (
                      <div key={e.id}>
                        <span className="timeline-dot" />
                        <strong>{e.text}</strong>
                        <small>
                          {dateLabel(e.at)} · {e.actor}
                          {!e.public ? " · Interno" : ""}
                        </small>
                      </div>
                    ))}
                </div>
              </section>
              {isAdmin && (
                <section className="card padded stack-gap">
                  <h2>Acuerdos comerciales conservados</h2>
                  {[...o.agreements].reverse().map((a, i) => (
                    <details key={a.version.id}>
                      <summary>
                        {s.quotes.find((q) => q.id === a.quoteId)?.folio} · v
                        {a.version.number} · {money(a.version.totalCents)}{" "}
                        {i === 0 ? "(vigente)" : "(anterior)"}
                      </summary>
                      <CommercialLines v={commercial(a.version)} />
                    </details>
                  ))}
                </section>
              )}
            </>
          )}
        </section>
        <aside>
          <section className="card padded stack-gap">
            <h2>Siguiente paso</h2>
            {["pending", "stopped"].includes(o.stage) && (
              <>
                {reasons.length ? (
                  <div className="blockers">
                    <AlertCircle size={20} />
                    <strong>Producción bloqueada</strong>
                    <ul>
                      {reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="ready-message">
                    <Check size={20} /> Diseño y anticipo completos.
                  </div>
                )}
                <Button
                  disabled={busy || reasons.length > 0}
                  onClick={() => changeStage("printing")}
                >
                  <Play size={17} />{" "}
                  {o.stage === "stopped"
                    ? "Reanudar producción"
                    : "Iniciar producción"}
                </Button>
              </>
            )}
            {o.stage === "printing" && (
              <>
                <Button disabled={busy} onClick={() => changeStage("finished")}>
                  <Check size={17} /> Marcar terminado
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => changeStage("stopped")}
                >
                  <Pause size={17} /> Detener trabajo
                </Button>
              </>
            )}
            {o.stage === "finished" && (
              <>
                <p className="muted">
                  El pedido está terminado.
                  {balance(s, o) > 0
                    ? " Registra el saldo restante para entregarlo."
                    : " El saldo está liquidado."}
                </p>
                {isAdmin && (
                  <Button
                    disabled={busy || balance(s, o) !== 0}
                    onClick={() => changeStage("delivered")}
                  >
                    <PackageCheck size={17} /> Registrar entrega
                  </Button>
                )}
              </>
            )}
            {o.stage === "delivered" && (
              <p className="ready-message">
                <PackageCheck size={20} /> Pedido entregado y liquidado.
              </p>
            )}
            {o.stage === "cancelled" && (
              <p className="muted">
                Ejecución cancelada. Se conserva todo el historial.
              </p>
            )}
            {isAdmin && !["delivered", "cancelled"].includes(o.stage) && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => changeStage("cancelled")}
              >
                Cancelar pedido
              </Button>
            )}
          </section>
          <section className="card padded stack-gap">
            <h2>Documentos</h2>
            <Button
              variant="secondary"
              disabled={
                busy ||
                reasons.length > 0 ||
                ["delivered", "cancelled"].includes(o.stage)
              }
              onClick={async () => {
                try {
                  await printOrder(s, o.id, "production", (id) =>
                    imageURL(id, s),
                  );
                } catch (e) {
                  notify((e as Error).message, true);
                }
              }}
            >
              <Printer size={16} /> Orden de producción
            </Button>
            {o.stage === "delivered" && (
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await printOrder(s, o.id, "delivery", (id) =>
                      imageURL(id, s),
                    );
                  } catch (e) {
                    notify((e as Error).message, true);
                  }
                }}
              >
                Comprobante de entrega
              </Button>
            )}
          </section>
          {isAdmin &&
            !["finished", "delivered", "cancelled"].includes(o.stage) && (
              <section className="card padded stack-gap">
                <h2>Cambios del acuerdo</h2>
                {o.openChangeId ? (
                  <>
                    <p className="muted">
                      Hay una propuesta pendiente. Producción bloqueada hasta
                      resolverla.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => go(`/cotizaciones/${o.openChangeId}`)}
                    >
                      Revisar propuesta
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={async () => {
                        const reason = prompt(
                          "Motivo para conservar el acuerdo anterior (la propuesta debe estar rechazada o cancelada):",
                        );
                        if (
                          reason?.trim() &&
                          confirm(
                            "¿Resolver el cambio conservando el acuerdo anterior?",
                          )
                        )
                          await run({
                            type: "order.keepAgreement",
                            orderId: o.id,
                            reason,
                          });
                      }}
                    >
                      Conservar acuerdo anterior
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="muted">
                      Precio o especificaciones requieren nueva aceptación.
                      Detén primero si ya está en producción.
                    </p>
                    <Button
                      variant="secondary"
                      disabled={busy || o.stage === "printing"}
                      onClick={async () => {
                        if (
                          !confirm(
                            "¿Crear una propuesta de cambio? El pedido quedará bloqueado hasta resolverla.",
                          )
                        )
                          return;
                        const id = await run({
                          type: "order.change",
                          orderId: o.id,
                        });
                        if (typeof id === "string")
                          go(`/cotizaciones/${id}/editar`);
                      }}
                    >
                      <Plus size={16} /> Proponer cambio
                    </Button>
                  </>
                )}
              </section>
            )}
          {!["delivered", "cancelled"].includes(o.stage) && (
            <section className="card padded">
              <h2>Avance para el cliente</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await run({
                      type: "order.note",
                      orderId: o.id,
                      text: advance,
                    })
                  )
                    setAdvance("");
                }}
              >
                <Field label="Actualización pública">
                  <textarea
                    maxLength={2000}
                    value={advance}
                    onChange={(e) => setAdvance(e.target.value)}
                    placeholder="Por ejemplo: impresión lista, preparando empaque."
                    required
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  <MessageSquare size={16} /> Publicar avance local
                </Button>
              </form>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
function LayersIcon({ size }: { size?: number }) {
  return <FileText size={size} />;
}
function OrderEdit({ ui, order: o }: { ui: UI; order: Order }) {
  const [due, setDue] = useState(o.due),
    [staff, setStaff] = useState(o.responsible),
    [notes, setNotes] = useState(o.notes);
  if (["finished", "delivered", "cancelled"].includes(o.stage)) return null;
  return (
    <form
      className="card padded stack-gap"
      onSubmit={async (e) => {
        e.preventDefault();
        await ui.run({
          type: "order.update",
          orderId: o.id,
          due,
          responsible: staff,
          notes,
        });
      }}
    >
      <h2>Organización del trabajo</h2>
      <div className="form-grid">
        <Field label="Fecha comprometida">
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            required
          />
        </Field>
        <Field label="Responsable">
          <select value={staff} onChange={(e) => setStaff(e.target.value)}>
            {[...new Set([o.responsible, ...ui.s.settings.staff])].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="Notas internas"
        hint="No aparecen en el portal del cliente."
      >
        <textarea
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="secondary" disabled={ui.busy}>
        Guardar organización
      </Button>
    </form>
  );
}
function DesignPanel({
  ui,
  order: o,
  line: l,
}: {
  ui: UI;
  order: Order;
  line: Line;
}) {
  const [file, setFile] = useState<File>(),
    [comment, setComment] = useState(""),
    [processing, setProcessing] = useState(false),
    [inputKey, setInputKey] = useState(0);
  const versions = o.designs.filter((d) => d.lineId === l.id),
    d = latestDesign(o, l.id);
  const matches = d?.specKey === specKey(l);
  return (
    <section className="card padded stack-gap">
      <div className="section-head compact">
        <div>
          <h2>{l.productName}</h2>
          <p className="muted">
            {plural(l.quantity, l.unit === "area" ? "lona" : "pieza")} ·{" "}
            {l.widthMm / 10} × {l.heightMm / 10}{" "}
            cm · {l.materialName} · {l.finishName}
          </p>
        </div>
        {d && (
          <Badge status={matches ? d.review : "changes"}>
            {matches
              ? d.review === "pending"
                ? "Por revisar"
                : d.review === "approved"
                  ? "Aprobado"
                  : "Cambios solicitados"
              : "Requiere diseño para estas especificaciones"}
          </Badge>
        )}
      </div>
      <DesignImage
        imageId={d?.imageId}
        images={ui.s.images}
        alt={`Diseño vigente de ${l.productName}`}
        className="large-preview"
      />
      {d && (
        <>
          <div className="design-caption">
            <strong>Versión {d.number}</strong>
            <span>
              {dateLabel(d.at)} · {d.author}
            </span>
          </div>
          <p className="muted">{d.comment}</p>
          {d.response && (
            <div className="client-comment">
              <MessageSquare size={18} />
              <div>
                <strong>Respuesta del cliente</strong>
                <p>{d.response.comment || "Diseño aprobado."}</p>
                <small>{dateLabel(d.response.at)}</small>
              </div>
            </div>
          )}
        </>
      )}
      {ui.actor.role === "admin" &&
        !["finished", "delivered", "cancelled"].includes(o.stage) && (
          <form
            className="upload-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!file) return;
              setProcessing(true);
              try {
                const image = await inspectImage(file);
                const { blob, ...meta } = image;
                if (
                  await ui.run(
                    {
                      type: "design.add",
                      orderId: o.id,
                      lineId: l.id,
                      image: meta,
                      comment,
                    },
                    blob,
                  )
                ) {
                  setFile(undefined);
                  setComment("");
                  setInputKey((n) => n + 1);
                }
              } catch (e) {
                ui.notify((e as Error).message, true);
              } finally {
                setProcessing(false);
              }
            }}
          >
            <h3>Incorporar {d ? "nueva versión" : "diseño"}</h3>
            {o.stage === "printing" && (
              <p className="form-error">
                Detén el trabajo antes de cambiar el diseño.
              </p>
            )}
            <Field
              label="Imagen de vista previa"
              hint="PNG, JPEG o WebP · hasta 5 MiB · máximo 4096 px por lado."
            >
              <input
                key={inputKey}
                aria-label={`Subir diseño de ${l.productName}`}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0])}
                disabled={o.stage === "printing"}
                required
              />
            </Field>
            <Field label="Comentario visible para el cliente">
              <textarea
                maxLength={2000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe esta versión y lo que cambió."
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              disabled={
                ui.busy || processing || !file || o.stage === "printing"
              }
            >
              <Upload size={16} />{" "}
              {processing ? "Guardando imagen…" : "Guardar nueva versión"}
            </Button>
          </form>
        )}
      {versions.length > 0 && (
        <details className="design-history">
          <summary>Historial de diseños ({versions.length})</summary>
          {[...versions].reverse().map((old, i) => (
            <div className="design-history-row" key={old.id}>
              <DesignImage
                imageId={old.imageId}
                images={ui.s.images}
                alt={`Versión ${old.number} de ${l.productName}`}
              />
              <div>
                <strong>
                  Versión {old.number}
                  {i === 0 ? " · vigente" : " · sustituida"}
                </strong>
                <small>
                  {dateLabel(old.at)} · {old.comment}
                </small>
                <p>{old.response?.comment || "Sin respuesta del cliente."}</p>
              </div>
              <Badge status={i === 0 ? old.review : "superseded"}>
                {i === 0 && old.review === "pending"
                  ? "Por revisar"
                  : undefined}
              </Badge>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
export function decimalCents(text: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error("Escribe un importe positivo con máximo dos decimales.");
  const [whole, part = ""] = text.split(".");
  const value = Number(whole) * 100 + Number(part.padEnd(2, "0"));
  if (!Number.isSafeInteger(value))
    throw new Error("Importe fuera del límite.");
  return value;
}
export function PaymentPanel({ ui, order: o }: { ui: UI; order: Order }) {
  const [amount, setAmount] = useState(""),
    [method, setMethod] = useState("Transferencia"),
    [reference, setReference] = useState("");
  const v = agreement(o),
    payments = ui.s.payments.filter((p) => p.orderId === o.id);
  return (
    <section className="card padded stack-gap">
      <h2>Pagos de demostración</h2>
      <div className="payment-stats">
        <div>
          <small>Total acordado</small>
          <strong>{money(v.totalCents)}</strong>
        </div>
        <div>
          <small>Pagado neto</small>
          <strong>{money(paid(ui.s, o.id))}</strong>
        </div>
        <div>
          <small>Saldo pendiente</small>
          <strong>{money(balance(ui.s, o))}</strong>
        </div>
      </div>
      <p className="muted">
        Anticipo requerido: {money(deposit(v))}. Sin cobros reales ni
        comprobantes fiscales.
      </p>
      {!["delivered", "cancelled"].includes(o.stage) &&
        balance(ui.s, o) > 0 && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const cents = decimalCents(amount);
                if (
                  confirm(
                    `¿Registrar un pago ficticio de ${money(cents)} en ${o.folio}?`,
                  ) &&
                  (await ui.run({
                    type: "payment.add",
                    orderId: o.id,
                    cents,
                    method,
                    reference,
                  }))
                ) {
                  setAmount("");
                  setReference("");
                }
              } catch (e) {
                ui.notify((e as Error).message, true);
              }
            }}
          >
            <div className="form-grid">
              <Field label="Importe (MXN)">
                <input
                  aria-label="Importe del pago"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balance(ui.s, o) / 100}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </Field>
              <Field label="Método ficticio">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option>Transferencia</option>
                  <option>Efectivo</option>
                  <option>Tarjeta</option>
                </select>
              </Field>
            </div>
            <Field label="Referencia (opcional)">
              <input
                value={reference}
                maxLength={100}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
            <div className="action-row">
              <Button type="submit" disabled={ui.busy}>
                <Plus size={16} /> Registrar pago ficticio
              </Button>
              <Button
                variant="ghost"
                onClick={() => setAmount((balance(ui.s, o) / 100).toFixed(2))}
              >
                Usar saldo completo
              </Button>
            </div>
          </form>
        )}
      <div className="payment-history">
        {[...payments].reverse().map((p) => {
          const reverted = payments.some((x) => x.reversesId === p.id);
          return (
            <div className="payment-row" key={p.id}>
              <span className="round-icon blue">
                <Wallet size={17} />
              </span>
              <div>
                <strong>
                  {p.reversesId ? "Reversión" : p.method}
                  {reverted ? " · revertido" : ""}
                </strong>
                <small>
                  {dateLabel(p.at)} · {p.reference || "Sin referencia"}
                  {p.reason ? ` · ${p.reason}` : ""}
                </small>
              </div>
              <strong className={p.reversesId ? "overdue" : ""}>
                {p.reversesId ? "−" : ""}
                {money(p.cents)}
              </strong>
              {!p.reversesId && !reverted && o.stage !== "delivered" && (
                <Button
                  variant="ghost"
                  disabled={ui.busy}
                  onClick={async () => {
                    const reason = prompt(
                      "Motivo de reversión del pago ficticio:",
                    );
                    if (
                      reason?.trim() &&
                      confirm(
                        "¿Revertir este movimiento? Si deja de cumplirse el anticipo, el trabajo se detendrá.",
                      )
                    )
                      await ui.run({
                        type: "payment.reverse",
                        paymentId: p.id,
                        reason,
                      });
                  }}
                >
                  Revertir
                </Button>
              )}
            </div>
          );
        })}
        {!payments.length && (
          <Empty
            title="Sin pagos registrados"
            text="El anticipo aparecerá aquí cuando se registre."
          />
        )}
      </div>
    </section>
  );
}

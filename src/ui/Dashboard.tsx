import { useState } from "react";
import {
  Plus,
  Clock3,
  CheckCircle2,
  Printer,
  CalendarDays,
  FileText,
  Wallet,
  ChevronRight,
  Search,
} from "lucide-react";
import { type UI } from "./context";
import {
  agreement,
  balance,
  blockers,
  currentVersion,
  dateLabel,
  effectiveStatus,
  latestDesign,
  money,
  plural,
  today,
} from "../domain/model";
import { Badge, Button, DesignImage, Empty, Heading } from "./shared";
export function Dashboard({ s, go, actor }: UI) {
  const [tab, setTab] = useState("all"),
    [search, setSearch] = useState("");
  const day = today();
  const active = s.orders.filter(
    (o) => !["delivered", "cancelled"].includes(o.stage),
  );
  const ready = active.filter(
    (o) => ["pending", "stopped"].includes(o.stage) && !blockers(s, o).length,
  );
  const pending = s.quotes.filter(
    (q) => effectiveStatus(currentVersion(q)) === "sent",
  );
  const due = active.filter((o) => o.due <= day);
  const debt = active.reduce((n, o) => n + balance(s, o), 0);
  const rows = s.orders.filter(
    (o) =>
      (tab === "all" || o.stage === tab) &&
      `${o.folio} ${s.customers.find((c) => c.id === o.customerId)?.name} ${agreement(
        o,
      )
        .lines.map((l) => l.productName)
        .join(" ")}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <Heading
        eyebrow="Tinta / Operación"
        title="La mesa de trabajo"
        subtitle="Cotizaciones, archivos y trabajos que esperan salir de imprenta."
      >
        {actor.role === "admin" && (
          <Button onClick={() => go("/cotizaciones/nueva")}>
            <Plus size={18} /> Nueva cotización
          </Button>
        )}
      </Heading>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon blue">
            <FileText size={21} />
          </span>
          <p>Cotizaciones por responder</p>
          <div>
            <strong>{pending.length}</strong>
            <button onClick={() => go("/cotizaciones")}>
              Ver cotizaciones <ChevronRight size={14} />
            </button>
          </div>
          <small>Esperando la respuesta del cliente</small>
        </div>
        <div className="stat-card">
          <span className="stat-icon purple">
            <Printer size={21} />
          </span>
          <p>Trabajos activos</p>
          <div>
            <strong>{active.length}</strong>
            <span className="micro-badge">
              {plural(ready.length, "listo para iniciar", "listos para iniciar")}
            </span>
          </div>
          <small>
            {active.filter((o) => o.stage === "printing").length} en producción
            ·{" "}
            {plural(
              active.filter((o) => o.stage === "finished").length,
              "terminado",
            )}
          </small>
        </div>
        <div className="stat-card">
          <span className="stat-icon orange">
            <CalendarDays size={21} />
          </span>
          <p>Entregas por atender</p>
          <div>
            <strong>{due.length}</strong>
            <button onClick={() => go("/calendario")}>
              Ver calendario <ChevronRight size={14} />
            </button>
          </div>
          <small>
            {plural(active.filter((o) => o.due < day).length, "atrasada")} ·{" "}
            {active.filter((o) => o.due === day).length} para hoy
          </small>
        </div>
      </div>
      <div className="dashboard-middle">
        <section className="card attention">
          <div className="section-head">
            <h2>Necesitan tu atención</h2>
            <span className="counter">
              {active.filter(
                (o) => blockers(s, o).length && o.stage === "pending",
              ).length + pending.length}
            </span>
          </div>
          <button className="attention-row" onClick={() => go("/pedidos")}>
            <span className="round-icon orange">
              <Clock3 size={20} />
            </span>
            <span>
              <strong>Diseños por aprobar</strong>
              <small>
                {plural(
                  active.filter((o) =>
                    agreement(o).lines.some(
                      (l) =>
                        l.requiresDesign &&
                        latestDesign(o, l.id)?.review !== "approved",
                    ),
                  ).length,
                  "pedido esperando una decisión",
                  "pedidos esperando una decisión",
                )}
              </small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button className="attention-row" onClick={() => go("/produccion")}>
            <span className="round-icon green">
              <CheckCircle2 size={20} />
            </span>
            <span>
              <strong>Listos para imprimir</strong>
              <small>
                {plural(
                  ready.length,
                  "pedido con diseño y anticipo completos",
                  "pedidos con diseño y anticipo completos",
                )}
              </small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button className="attention-row" onClick={() => go("/pagos")}>
            <span className="round-icon blue">
              <Wallet size={20} />
            </span>
            <span>
              <strong>Saldos pendientes</strong>
              <small>{money(debt)} en pedidos activos</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </section>
        <section className="design-spotlight">
          <div>
            <span className="eyebrow">Muestra del taller</span>
            <h2>Archivo de muestra:<br />Luna Café.</h2>
            <p>Luna Café · muestra ficticia. Consulta los archivos y las aprobaciones de cada pedido.</p>
            <Button variant="secondary" onClick={() => go("/pedidos")}>
              Revisar pedidos <ChevronRight size={16} />
            </Button>
          </div>
          <DesignImage
            imageId="sample:luna"
            images={s.images}
            alt="Etiqueta original de Luna Café"
          />
        </section>
      </div>
      <section className="card orders-section">
        <div className="section-head">
          <div>
            <h2>Pedidos recientes</h2>
            <p className="muted">De la aprobación a la entrega.</p>
          </div>
          <Button variant="ghost" onClick={() => go("/pedidos")}>
            Ver todos <ChevronRight size={16} />
          </Button>
        </div>
        <div className="table-toolbar">
          <div className="tabs" aria-label="Filtrar pedidos">
            {[
              ["all", "Todos"],
              ["pending", "Pendientes"],
              ["printing", "En producción"],
              ["finished", "Terminados"],
            ].map(([id, name]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
              >
                {name}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Buscar pedidos"
              placeholder="Buscar pedido o cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pedido / cliente</th>
                <th>Trabajo</th>
                <th>Entrega</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th aria-label="Abrir pedido" />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 6).map((o) => {
                const v = agreement(o),
                  d = latestDesign(o, v.lines[0].id);
                return (
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
                      <div className="work-cell">
                        <DesignImage
                          imageId={d?.imageId}
                          images={s.images}
                          alt={v.lines[0].productName}
                        />
                        <span>
                          {v.lines[0].productName}
                          <small>
                            {v.lines[0].quantity.toLocaleString("es-MX")}{" "}
                            {v.lines[0].unit === "area" ? "lonas" : "piezas"}
                          </small>
                        </span>
                      </div>
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
                          ? "Entrega atrasada"
                          : o.due === day
                            ? "Hoy"
                            : "Fecha comprometida"}
                      </small>
                    </td>
                    <td>
                      <Badge status={o.stage} />
                    </td>
                    <td>
                      <span className="avatar tiny">{o.responsible[0]}</span>{" "}
                      {o.responsible}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        aria-label={`Abrir ${o.folio}`}
                        onClick={() => go(`/pedidos/${o.id}`)}
                      >
                        <ChevronRight size={17} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="No hay pedidos en esta vista"
            text="Prueba otro filtro o busca otro cliente."
          />
        )}
      </section>
    </>
  );
}

import { useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Mail,
  Phone,
  Users,
  Archive,
  RotateCcw,
  Save,
  Layers,
  Download,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { type UI } from "./context";
import {
  type Customer,
  type Product,
  uid,
  agreement,
  balance,
  currentVersion,
  dateLabel,
  effectiveStatus,
  money,
  plural,
  paid,
  today,
  addDays,
  stageLabels,
} from "../domain/model";
import { reset, storageMessage } from "../storage/store";
import { Badge, Button, Empty, Field, Heading, Modal } from "./shared";
import { downloadCSV } from "../documents/export";
export function Customers(ui: UI) {
  const [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Customer>(),
    [history, setHistory] = useState<Customer>();
  const { s } = ui;
  const rows = s.customers.filter((c) =>
    `${c.name} ${c.email} ${c.phone}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <Heading
        eyebrow="TU CARTERA DE DEMOSTRACIÓN"
        title="Clientes"
        subtitle="Contactos ficticios e historial de cada trabajo."
      >
        <Button
          onClick={() =>
            setEditing({ id: uid(), name: "", email: "", phone: "", notes: "" })
          }
        >
          <Plus size={18} /> Nuevo cliente
        </Button>
      </Heading>
      <section className="card">
        <div className="filter-bar">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Buscar clientes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, correo o teléfono…"
            />
          </label>
          <span className="muted">{plural(rows.length, "cliente")}</span>
        </div>
        <div className="customer-grid">
          {rows.map((c, i) => (
            <article className="customer-card" key={c.id}>
              <div className="customer-header">
                <span className={`avatar color-${i % 3}`}>
                  {c.name
                    .split(" ")
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <Button
                  variant="ghost"
                  aria-label={`Editar ${c.name}`}
                  onClick={() => setEditing(c)}
                >
                  <Pencil size={16} />
                </Button>
              </div>
              <h2>{c.name}</h2>
              <p>
                <Mail size={15} /> {c.email || "Sin correo"}
              </p>
              <p>
                <Phone size={15} /> {c.phone || "Sin teléfono"}
              </p>
              <div className="customer-counts">
                <span>
                  {plural(
                    s.quotes.filter((q) => q.customerId === c.id).length,
                    "cotización",
                    "cotizaciones",
                  )}
                </span>
                <span>
                  {plural(
                    s.orders.filter((o) => o.customerId === c.id).length,
                    "pedido",
                  )}
                </span>
              </div>
              <Button variant="secondary" onClick={() => setHistory(c)}>
                Ver historial
              </Button>
            </article>
          ))}
        </div>
        {!rows.length && (
          <Empty
            title="No encontramos clientes"
            text="Busca otro nombre o crea un cliente ficticio."
          />
        )}
      </section>
      {editing && (
        <CustomerForm
          key={editing.id}
          customer={editing}
          ui={ui}
          close={() => setEditing(undefined)}
        />
      )}
      {history && (
        <Modal
          title={`Historial · ${history.name}`}
          onClose={() => setHistory(undefined)}
        >
          <h3>Cotizaciones</h3>
          {s.quotes
            .filter((q) => q.customerId === history.id)
            .map((q) => (
              <button
                className="version-row"
                key={q.id}
                onClick={() => {
                  setHistory(undefined);
                  ui.go(`/cotizaciones/${q.id}`);
                }}
              >
                <strong>{q.folio}</strong>
                <Badge status={effectiveStatus(currentVersion(q))} />
                <span>{money(currentVersion(q).totalCents)}</span>
              </button>
            ))}
          <h3 className="mt">Pedidos</h3>
          {s.orders
            .filter((o) => o.customerId === history.id)
            .map((o) => (
              <button
                className="version-row"
                key={o.id}
                onClick={() => {
                  setHistory(undefined);
                  ui.go(`/pedidos/${o.id}`);
                }}
              >
                <strong>{o.folio}</strong>
                <Badge status={o.stage} />
                <span>{dateLabel(o.due)}</span>
              </button>
            ))}
          {!s.quotes.some((q) => q.customerId === history.id) &&
            !s.orders.some((o) => o.customerId === history.id) && (
              <Empty
                title="Todavía no hay trabajos"
                text="La primera cotización aparecerá aquí."
              />
            )}
        </Modal>
      )}
    </>
  );
}
function CustomerForm({
  ui,
  customer,
  close,
}: {
  ui: UI;
  customer: Customer;
  close: () => void;
}) {
  const [form, setForm] = useState({ ...customer });
  const matches = ui.s.customers.filter(
    (c) =>
      c.id !== form.id &&
      form.name.length > 1 &&
      c.name.toLocaleLowerCase().includes(form.name.toLocaleLowerCase()),
  );
  return (
    <Modal
      title={
        ui.s.customers.some((c) => c.id === form.id)
          ? "Editar cliente ficticio"
          : "Nuevo cliente ficticio"
      }
      onClose={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await ui.run({ type: "customer.save", customer: form })) close();
        }}
      >
        <Field label="Nombre o negocio">
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            minLength={2}
            maxLength={120}
            required
          />
        </Field>
        {matches.length > 0 && (
          <p className="duplicate-hint">
            Nombres similares: {matches.map((c) => c.name).join(", ")}. Revisa
            antes de crear un duplicado.
          </p>
        )}
        <div className="form-grid">
          <Field label="Correo ficticio">
            <input
              type="email"
              placeholder="cliente@example.test"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </Field>
          <Field label="Teléfono ficticio">
            <input
              type="tel"
              maxLength={30}
              placeholder="55 0000 0000"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </Field>
        </div>
        <Field label="Notas internas">
          <textarea
            maxLength={2000}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </Field>
        <div className="modal-actions">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={ui.busy}>
            <Save size={16} /> Guardar cliente
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Catalog(ui: UI) {
  const [editing, setEditing] = useState<Product>();
  const newProduct = (): Product => ({
    id: uid(),
    code: "",
    name: "",
    description: "",
    unit: "piece",
    min: 1,
    max: 100000,
    minMm: 20,
    maxMm: 300,
    setupCents: 0,
    archived: false,
    requiresDesign: true,
    materials: [{ id: uid(), name: "Material de ejemplo", cents: 100 }],
    finishes: [],
  });
  return (
    <>
      <Heading
        eyebrow="PRODUCTOS Y REGLAS"
        title="Catálogo"
        subtitle="Opciones compatibles y costos ficticios para cotizar."
      >
        <Button
          onClick={() => {
            const p = newProduct();
            p.finishes = [
              {
                id: uid(),
                name: "Sin acabado",
                cents: 0,
                basis: "lot",
                materials: [p.materials[0].id],
              },
            ];
            setEditing(p);
          }}
        >
          <Plus size={17} /> Nuevo producto
        </Button>
      </Heading>
      <div className="info-note">
        <Layers size={19} />
        <p>
          Los cambios se aplican a nuevas propuestas. Los acuerdos y pedidos
          existentes conservan sus precios y especificaciones.
        </p>
      </div>
      <div className="catalog-grid">
        {ui.s.products.map((p) => (
          <article className="card catalog-card" key={p.id}>
            <div
              className={`catalog-art ${p.id === "cards" ? "cards" : p.id === "labels" ? "labels" : "banners"}`}
            >
              <Layers size={42} />
              <span>{p.code}</span>
            </div>
            <div className="padded">
              <div className="section-head compact">
                <h2>{p.name}</h2>
                <Badge status={p.archived ? "superseded" : "approved"}>
                  {p.archived ? "Archivado" : "Activo"}
                </Badge>
              </div>
              <p className="muted">{p.description}</p>
              <div className="catalog-meta">
                <span>
                  {p.unit === "piece" ? "Por pieza" : "Por superficie"}
                </span>
                <span>
                  Mínimo {plural(p.min, p.unit === "piece" ? "pza" : "unidad")}
                </span>
              </div>
              <p className="muted">
                {p.materials.map((m) => m.name).join(" · ")}
              </p>
              <small>{p.finishes.map((f) => f.name).join(" · ")}</small>
              <div className="action-row">
                <Button variant="secondary" onClick={() => setEditing(p)}>
                  <Pencil size={16} /> Configurar
                </Button>
                <Button
                  variant="ghost"
                  disabled={ui.busy}
                  onClick={async () => {
                    if (
                      confirm(
                        `¿${p.archived ? "Reactivar" : "Archivar"} ${p.name}? Su historial se conservará.`,
                      )
                    )
                      await ui.run({
                        type: "product.save",
                        product: { ...p, archived: !p.archived },
                      });
                  }}
                >
                  <Archive size={16} /> {p.archived ? "Reactivar" : "Archivar"}
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <ProductForm
          key={editing.id}
          product={editing}
          ui={ui}
          close={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
function ProductForm({
  ui,
  product,
  close,
}: {
  ui: UI;
  product: Product;
  close: () => void;
}) {
  const [p, setP] = useState(structuredClone(product));
  const update = (fields: Partial<Product>) =>
    setP((p) => ({ ...p, ...fields }));
  return (
    <Modal title={`Configurar ${product.name || "producto"}`} onClose={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await ui.run({ type: "product.save", product: p })) close();
        }}
      >
        <div className="form-grid">
          <Field label="Nombre">
            <input
              value={p.name}
              onChange={(e) => update({ name: e.target.value })}
              maxLength={120}
              required
            />
          </Field>
          <Field label="Código único">
            <input
              value={p.code}
              onChange={(e) => update({ code: e.target.value })}
              maxLength={30}
              required
            />
          </Field>
          <Field label="Tipo de cálculo">
            <select
              value={p.unit}
              disabled={Boolean(p.fixed)}
              onChange={(e) =>
                update({ unit: e.target.value as Product["unit"] })
              }
            >
              <option value="piece">Por pieza</option>
              <option value="area">Por m²</option>
            </select>
          </Field>
          <Field label="Preparación (MXN)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={p.setupCents / 100}
              onChange={(e) =>
                update({ setupCents: Math.round(Number(e.target.value) * 100) })
              }
              required
            />
          </Field>
          <Field label="Cantidad mínima">
            <input
              type="number"
              min="1"
              max={p.max}
              value={p.min}
              onChange={(e) => update({ min: Number(e.target.value) })}
              required
            />
          </Field>
          <Field label="Cantidad máxima">
            <input
              type="number"
              min={p.min}
              max="100000"
              value={p.max}
              onChange={(e) => update({ max: Number(e.target.value) })}
              required
            />
          </Field>
          {!p.fixed && (
            <>
              <Field label="Medida mínima por lado (cm)">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={p.minMm / 10}
                  onChange={(e) =>
                    update({ minMm: Math.round(Number(e.target.value) * 10) })
                  }
                  required
                />
              </Field>
              <Field label="Medida máxima por lado (cm)">
                <input
                  type="number"
                  min={p.minMm / 10}
                  max="500"
                  step="0.1"
                  value={p.maxMm / 10}
                  onChange={(e) =>
                    update({ maxMm: Math.round(Number(e.target.value) * 10) })
                  }
                  required
                />
              </Field>
            </>
          )}
        </div>
        <Field label="Descripción">
          <textarea
            value={p.description}
            maxLength={500}
            onChange={(e) => update({ description: e.target.value })}
          />
        </Field>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={p.requiresDesign}
            onChange={(e) => update({ requiresDesign: e.target.checked })}
          />{" "}
          Requiere aprobación de diseño
        </label>
        <h3 className="mt">
          Materiales y costo por {p.unit === "piece" ? "pieza" : "m²"} (MXN)
        </h3>
        {p.materials.map((m, i) => (
          <div className="material-row" key={m.id}>
            <input
              className="control"
              aria-label={`Nombre material ${i + 1}`}
              value={m.name}
              onChange={(e) =>
                update({
                  materials: p.materials.map((x) =>
                    x.id === m.id ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
              required
            />
            <input
              className="control"
              aria-label={`Costo material ${i + 1}`}
              type="number"
              min="0"
              step="0.01"
              value={m.cents / 100}
              onChange={(e) =>
                update({
                  materials: p.materials.map((x) =>
                    x.id === m.id
                      ? {
                          ...x,
                          cents: Math.round(Number(e.target.value) * 100),
                        }
                      : x,
                  ),
                })
              }
              required
            />
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() => {
            const id = uid();
            update({
              materials: [
                ...p.materials,
                { id, name: "Nuevo material", cents: 100 },
              ],
              finishes: p.finishes.map((f, i) =>
                i === 0 ? { ...f, materials: [...f.materials, id] } : f,
              ),
            });
          }}
        >
          <Plus size={15} /> Añadir material
        </Button>
        {p.sizeTiers?.length && (
          <>
            <h3 className="mt mb">Rangos de tamaño por pieza</h3>
            <p className="muted">
              Límites crecientes que cubren todas las medidas. El factor
              multiplica el costo base de material.
            </p>
            {p.sizeTiers.map((tier, i) => (
              <div className="form-grid" key={i}>
                <Field label={`Superficie máxima rango ${i + 1} (cm²)`}>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={tier.maxMm2 / 100}
                    onChange={(e) =>
                      update({
                        sizeTiers: p.sizeTiers!.map((t, j) =>
                          j === i
                            ? {
                                ...t,
                                maxMm2: Math.round(
                                  Number(e.target.value) * 100,
                                ),
                              }
                            : t,
                        ),
                      })
                    }
                    required
                  />
                </Field>
                <Field label={`Factor de costo rango ${i + 1}`}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={tier.factor}
                    onChange={(e) =>
                      update({
                        sizeTiers: p.sizeTiers!.map((t, j) =>
                          j === i
                            ? { ...t, factor: Number(e.target.value) }
                            : t,
                        ),
                      })
                    }
                    required
                  />
                </Field>
              </div>
            ))}
          </>
        )}
        <h3 className="mt">Acabados y compatibilidades</h3>
        {p.finishes.map((f, i) => (
          <div className="finish-row" key={f.id}>
            <div className="form-grid">
              <Field label={`Acabado ${i + 1}`}>
                <input
                  value={f.name}
                  onChange={(e) =>
                    update({
                      finishes: p.finishes.map((x) =>
                        x.id === f.id ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                  required
                />
              </Field>
              <Field label="Costo (MXN)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={f.cents / 100}
                  onChange={(e) =>
                    update({
                      finishes: p.finishes.map((x) =>
                        x.id === f.id
                          ? {
                              ...x,
                              cents: Math.round(Number(e.target.value) * 100),
                            }
                          : x,
                      ),
                    })
                  }
                  required
                />
              </Field>
              <Field label="Unidad del costo">
                <select
                  value={f.basis}
                  onChange={(e) =>
                    update({
                      finishes: p.finishes.map((x) =>
                        x.id === f.id
                          ? { ...x, basis: e.target.value as typeof f.basis }
                          : x,
                      ),
                    })
                  }
                >
                  <option value="lot">Por lote</option>
                  <option value="piece">Por pieza</option>
                  <option value="area">Por m²</option>
                </select>
              </Field>
            </div>
            <span className="muted">Materiales compatibles</span>
            <div className="compatibilities">
              {p.materials.map((m) => (
                <label className="checkbox" key={m.id}>
                  <input
                    type="checkbox"
                    checked={f.materials.includes(m.id)}
                    onChange={(e) =>
                      update({
                        finishes: p.finishes.map((x) =>
                          x.id === f.id
                            ? {
                                ...x,
                                materials: e.target.checked
                                  ? [...x.materials, m.id]
                                  : x.materials.filter((id) => id !== m.id),
                              }
                            : x,
                        ),
                      })
                    }
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() =>
            update({
              finishes: [
                ...p.finishes,
                {
                  id: uid(),
                  name: "Nuevo acabado",
                  cents: 0,
                  basis: "lot",
                  materials: p.materials.map((m) => m.id),
                },
              ],
            })
          }
        >
          <Plus size={15} /> Añadir acabado
        </Button>
        <div className="modal-actions">
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={ui.busy}>
            Guardar reglas
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Configuration(ui: UI) {
  const [form, setForm] = useState({ ...ui.s.settings }),
    [staff, setStaff] = useState(ui.s.settings.staff.join(", ")),
    [resetting, setResetting] = useState(false);
  return (
    <>
      <Heading
        eyebrow="AJUSTES DEL TALLER"
        title="Configuración"
        subtitle="Identidad ficticia y reglas para nuevas cotizaciones."
      />
      <div className="detail-layout">
        <form
          className="card padded"
          onSubmit={async (e) => {
            e.preventDefault();
            await ui.run({
              type: "settings.save",
              settings: {
                ...form,
                staff: staff
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              },
            });
          }}
        >
          <h2 className="mb">Datos del negocio ficticio</h2>
          <Field label="Nombre">
            <input
              value={form.business}
              maxLength={120}
              onChange={(e) =>
                setForm((f) => ({ ...f, business: e.target.value }))
              }
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="Correo ficticio">
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                required
              />
            </Field>
            <Field label="Teléfono ficticio">
              <input
                value={form.phone}
                maxLength={30}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field
            label="Personal de demostración"
            hint="Nombres separados por coma."
          >
            <input
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              maxLength={200}
              required
            />
          </Field>
          <h2 className="mt mb">Reglas comerciales</h2>
          <div className="form-grid">
            <Field
              label="Margen sobre venta (%)"
              hint="Venta = costo ÷ (1 − margen)."
            >
              <input
                aria-label="Margen sobre venta"
                type="number"
                min="0"
                max="95"
                step="0.01"
                value={form.marginBps / 100}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    marginBps: Math.round(Number(e.target.value) * 100),
                  }))
                }
                required
              />
            </Field>
            <Field label="Impuesto ficticio (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.taxBps / 100}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    taxBps: Math.round(Number(e.target.value) * 100),
                  }))
                }
                required
              />
            </Field>
            <Field label="Anticipo requerido (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.depositBps / 100}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    depositBps: Math.round(Number(e.target.value) * 100),
                  }))
                }
                required
              />
            </Field>
            <Field label="Moneda">
              <input readOnly value="MXN · pesos mexicanos" />
            </Field>
          </div>
          <p className="info-note">
            Descuento máximo: 20%. La entrega requiere saldo cero. Las reglas de
            acuerdos ya emitidos se conservan.
          </p>
          <Button type="submit" disabled={ui.busy}>
            <Save size={17} /> Guardar configuración
          </Button>
        </form>
        <aside>
          <section className="card padded stack-gap">
            <h2>Almacenamiento local</h2>
            <p className="muted">
              Tus cambios se guardan en este navegador. Borrar los datos del
              sitio o cerrar una sesión privada puede eliminarlos.
            </p>
            <div className="total-row">
              <span>Imágenes</span>
              <strong>{ui.s.images.length} / 50</strong>
            </div>
            <div className="total-row">
              <span>Espacio de imágenes</span>
              <strong>
                {(
                  ui.s.images.reduce((n, i) => n + i.bytes, 0) / 1048576
                ).toFixed(1)}{" "}
                / 50 MiB
              </strong>
            </div>
            <small>Hasta 5 MiB por archivo y 10 versiones por partida.</small>
          </section>
          <section className="card padded stack-gap">
            <h2>Restablecer demo</h2>
            <p className="muted">
              Borra los cambios y las imágenes añadidas. Restaura los ejemplos
              con fechas útiles para hoy.
            </p>
            <Button
              variant="danger"
              disabled={resetting || ui.busy}
              onClick={async () => {
                if (
                  !confirm(
                    "¿Restablecer la demo? Se eliminarán todos los cambios e imágenes que añadiste en este navegador.",
                  )
                )
                  return;
                setResetting(true);
                try {
                  await reset();
                  ui.notify(
                    "Demo restablecida. Los ejemplos tienen fechas actualizadas.",
                  );
                  ui.go("/panel");
                } catch (e) {
                  ui.notify(storageMessage(e), true);
                } finally {
                  setResetting(false);
                }
              }}
            >
              <RotateCcw size={17} />{" "}
              {resetting ? "Restableciendo…" : "Restablecer demo"}
            </Button>
          </section>
        </aside>
      </div>
    </>
  );
}
export function Calendar(ui: UI) {
  const [month, setMonth] = useState(today().slice(0, 7)),
    [staff, setStaff] = useState("all"),
    [includeClosed, setIncludeClosed] = useState(false);
  const start = `${month}-01`,
    first = new Date(start + "T12:00:00Z"),
    offset = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) =>
    addDays(start, i - offset),
  );
  const move = (n: number) => {
    const d = new Date(start + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  const rows = ui.s.orders.filter(
    (o) =>
      (includeClosed || !["delivered", "cancelled"].includes(o.stage)) &&
      (staff === "all" || o.responsible === staff),
  );
  const monthRows = rows
    .filter((o) => o.due.startsWith(month))
    .sort((a, b) => a.due.localeCompare(b.due));
  return (
    <>
      <Heading
        eyebrow="COMPROMISOS DE ENTREGA"
        title="Calendario"
        subtitle="Fechas prometidas al cliente. Sin planificación automática de capacidad."
      />
      <div className="card">
        <div className="calendar-toolbar">
          <div className="month-nav">
            <Button
              variant="ghost"
              aria-label="Mes anterior"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={20} />
            </Button>
            <h2>
              {new Intl.DateTimeFormat("es-MX", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(first)}
            </h2>
            <Button
              variant="ghost"
              aria-label="Mes siguiente"
              onClick={() => move(1)}
            >
              <ChevronRight size={20} />
            </Button>
            <Button
              variant="secondary"
              onClick={() => setMonth(today().slice(0, 7))}
            >
              Hoy
            </Button>
          </div>
          <select
            className="control"
            aria-label="Responsable en calendario"
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
          >
            <option value="all">Todos los responsables</option>
            {[
              ...new Set([
                ...ui.s.settings.staff,
                ...ui.s.orders.map((o) => o.responsible),
              ]),
            ].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(e) => setIncludeClosed(e.target.checked)}
            />{" "}
            Incluir cerrados
          </label>
        </div>
        <div className="calendar-grid">
          <div className="weekdays">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-days">
            {cells.map((day) => (
              <div
                key={day}
                className={`calendar-day ${day.startsWith(month) ? "" : "outside"} ${day === today() ? "current-day" : ""}`}
              >
                <span>{Number(day.slice(-2))}</span>
                {rows
                  .filter((o) => o.due === day)
                  .map((o) => (
                    <button
                      key={o.id}
                      className={`calendar-job ${o.stage}`}
                      onClick={() => ui.go(`/pedidos/${o.id}`)}
                    >
                      <strong>{o.folio}</strong>
                      <span>
                        {
                          ui.s.customers.find((c) => c.id === o.customerId)
                            ?.name
                        }
                      </span>
                      <small>{stageLabels[o.stage]}</small>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
        <div className="calendar-agenda">
          <div className="section-head">
            <h2>Entregas del mes</h2>
            <span className="muted">{plural(monthRows.length, "compromiso")}</span>
          </div>
          {monthRows.map((o) => (
            <button
              className="agenda-row"
              key={o.id}
              onClick={() => ui.go(`/pedidos/${o.id}`)}
            >
              <span className="agenda-date">
                <strong>{Number(o.due.slice(-2))}</strong>
                {dateLabel(o.due).split(" ").slice(1).join(" ")}
              </span>
              <span>
                <strong>
                  {o.folio} ·{" "}
                  {ui.s.customers.find((c) => c.id === o.customerId)?.name}
                </strong>
                <small>
                  {o.responsible} ·{" "}
                  {agreement(o)
                    .lines.map((l) => l.productName)
                    .join(", ")}
                </small>
              </span>
              <Badge status={o.stage} />
            </button>
          ))}
          {!monthRows.length && (
            <Empty
              title="Sin entregas este mes"
              text="Selecciona otro mes o responsable."
            />
          )}
        </div>
      </div>
    </>
  );
}
export function Payments(ui: UI) {
  const [search, setSearch] = useState("");
  const { s } = ui;
  const rows = s.orders.filter((o) =>
    `${o.folio} ${s.customers.find((c) => c.id === o.customerId)?.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        eyebrow="CONTROL COMERCIAL"
        title="Pagos ficticios"
        subtitle="Anticipos, saldos y correcciones con historial."
      >
        <Button variant="secondary" onClick={() => downloadCSV(s, "payments")}>
          <Download size={17} /> Exportar movimientos
        </Button>
      </Heading>
      <section className="card">
        <div className="filter-bar">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Buscar pagos por pedido"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pedido o cliente…"
            />
          </label>
          <p className="muted">No se realizan cobros ni se emiten facturas.</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pedido / cliente</th>
                <th>Total MXN</th>
                <th>Pagado neto</th>
                <th>Saldo</th>
                <th>Estado de pago</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => ui.go(`/pedidos/${o.id}?tab=payments`)}
                    >
                      {o.folio}
                    </button>
                    <small>
                      {s.customers.find((c) => c.id === o.customerId)?.name}
                    </small>
                  </td>
                  <td>{money(agreement(o).totalCents)}</td>
                  <td>{money(paid(s, o.id))}</td>
                  <td>{money(balance(s, o))}</td>
                  <td>
                    <Badge
                      status={
                        balance(s, o) === 0
                          ? "approved"
                          : paid(s, o.id) === 0
                            ? "pending"
                            : "sent"
                      }
                    >
                      {balance(s, o) === 0
                        ? "Pagado"
                        : paid(s, o.id) === 0
                          ? "Sin pago"
                          : "Pago parcial"}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="secondary"
                      onClick={() => ui.go(`/pedidos/${o.id}?tab=payments`)}
                    >
                      Ver movimientos
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="No encontramos pedidos"
            text="Prueba otro folio o cliente."
          />
        )}
      </section>
    </>
  );
}

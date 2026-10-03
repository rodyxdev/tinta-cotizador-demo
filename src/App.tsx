import { useEffect, useState, useRef } from "react";
import {
  LayoutDashboard,
  FileText,
  Package,
  Printer,
  CalendarDays,
  Users,
  Layers,
  Settings,
  Wallet,
  LogOut,
  Menu,
  X,
  FlaskConical,
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  type Actor,
  type Role,
  type State,
  dateLabel,
  today,
} from "./domain/model";
import { type Command } from "./domain/commands";
import {
  db,
  initialize,
  observe,
  execute,
  storageMessage,
} from "./storage/store";
import { Dashboard } from "./ui/Dashboard";
import { Button, DesignImage, Empty } from "./ui/shared";
import { type UI } from "./ui/context";
import { QuoteList, QuoteDetail, QuoteEditor } from "./ui/Quotes";
import { OrderList, OrderDetail } from "./ui/Orders";
import {
  Customers,
  Catalog,
  Configuration,
  Calendar,
  Payments,
} from "./ui/Management";
import { Portal } from "./ui/Portal";
import { portalFor } from "./domain/portal";
const roleName = {
  admin: "Administrador",
  production: "Producción",
  client: "Cliente",
};
const nav = [
  ["/panel", "Panel general", LayoutDashboard],
  ["/cotizaciones", "Cotizaciones", FileText],
  ["/pedidos", "Pedidos", Package],
  ["/produccion", "Producción", Printer],
  ["/calendario", "Calendario", CalendarDays],
  ["/clientes", "Clientes", Users],
  ["/catalogo", "Catálogo", Layers],
  ["/pagos", "Pagos ficticios", Wallet],
  ["/configuracion", "Configuración", Settings],
] as const;
function readSession(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* Role selection can still work in memory. Data writes have their own explicit errors. */
  }
}
export default function App() {
  const [s, setState] = useState<State>(),
    [loadError, setLoadError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{ text: string; error: boolean }>();
  const [role, setRole] = useState<Role | null>(() => {
    const value = readSession("tinta-role");
    return ["admin", "production", "client"].includes(value ?? "")
      ? (value as Role)
      : null;
  });
  const [customerId, setCustomerId] = useState(
      readSession("tinta-customer") ?? "c1",
    ),
    [route, setRoute] = useState(location.hash.slice(1) || "/panel"),
    [mobileOpen, setMobileOpen] = useState(false),
    [, tick] = useState(0);
  const notify = (text: string, error = false) => setToast({ text, error });
  const go = (path: string) => {
    location.hash = path;
    setRoute(path);
    setMobileOpen(false);
    window.scrollTo(0, 0);
  };
  const chooseRole = (value: Role) => {
    setRole(value);
    writeSession("tinta-role", value);
    go(
      value === "client"
        ? "/portal"
        : value === "production"
          ? "/produccion"
          : "/panel",
    );
  };
  const client = (id: string, path = "/portal") => {
    setCustomerId(id);
    writeSession("tinta-customer", id);
    setRole("client");
    writeSession("tinta-role", "client");
    go(path);
  };
  useEffect(() => {
    let sub: { unsubscribe(): void } | undefined;
    let active = true;
    initialize()
      .then(() => {
        if (active)
          sub = observe(setState, (e) => setLoadError(storageMessage(e)));
      })
      .catch((e) => setLoadError(storageMessage(e)));
    return () => {
      active = false;
      sub?.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const hash = () => {
      setRoute(location.hash.slice(1) || "/panel");
      setMobileOpen(false);
    };
    const refresh = () => tick((n) => n + 1);
    window.addEventListener("hashchange", hash);
    window.addEventListener("focus", refresh);
    const t = setInterval(refresh, 60000);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("focus", refresh);
      clearInterval(t);
    };
  }, []);
  useEffect(() => {
    if (toast && !toast.error) {
      const t = setTimeout(() => setToast(undefined), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (s?.customers.length && !s.customers.some((c) => c.id === customerId)) {
      setCustomerId(s.customers[0].id);
      writeSession("tinta-customer", s.customers[0].id);
    }
  }, [s, customerId]);
  const actor: Actor = {
    role: role ?? "admin",
    name:
      role === "production"
        ? "Diego · producción"
        : role === "client"
          ? `${s?.customers.find((c) => c.id === customerId)?.name ?? "Cliente"} · cliente demo`
          : "Andrea · administración",
    customerId: role === "client" ? customerId : undefined,
  };
  const inFlight = useRef(false);
  const run = async (
    c: Command,
    blob?: Blob,
  ): Promise<string | true | false> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    try {
      const id = await execute(c, actor, blob);
      const next = await db.roots.get("main");
      if (next) setState(next);
      notify("Cambio guardado en este navegador.");
      return id ?? true;
    } catch (e) {
      notify(storageMessage(e), true);
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  if (loadError)
    return (
      <main className="loading-screen">
        <AlertCircle size={36} />
        <h1>No se pudo abrir la demo</h1>
        <p role="alert">{loadError}</p>
        <Button onClick={() => location.reload()}>Volver a intentar</Button>
      </main>
    );
  if (!s)
    return (
      <main className="loading-screen">
        <LoaderCircle className="spin" size={36} />
        <p>Cargando tu taller de demostración…</p>
      </main>
    );
  const ui: UI = { s, actor, busy, run, go, client, notify };
  const allowedNav =
    role === "production"
      ? nav.filter(([path]) =>
          ["/pedidos", "/produccion", "/calendario"].includes(path),
        )
      : nav;
  return (
    <>
      {!role ? (
        <Login s={s} onEnter={chooseRole} />
      ) : (
        <div className="app-shell">
          <a
            className="skip-link"
            href="#main-content"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("main-content")?.focus();
            }}
          >
            Saltar al contenido
          </a>
          <div className="demo-banner">
            <FlaskConical size={14} />
            <strong>Demo pública.</strong>
            <span>Usa únicamente datos ficticios.</span>
            <span className="local-note">
              Tus cambios se guardan en este navegador
            </span>
          </div>
          {mobileOpen && (
            <button
              className="sidebar-scrim"
              aria-label="Cerrar navegación"
              onClick={() => setMobileOpen(false)}
            />
          )}
          <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
            <div className="brand">
              <span className="brand-mark">t</span>
              <span>
                tinta<span className="brand-dot">.</span>
                <small>TALLER DE IMPRESIÓN</small>
              </span>
            </div>
            <div className="workspace-label">ESPACIO DE TRABAJO</div>
            <nav aria-label="Navegación principal">
              {role === "client" ? (
                <button
                  className="nav-item active"
                  onClick={() => go("/portal")}
                >
                  <Users size={19} /> Mi portal
                </button>
              ) : (
                allowedNav.map(([path, title, Icon]) => (
                  <button
                    className={`nav-item ${route.startsWith(path) ? "active" : ""}`}
                    aria-current={route.startsWith(path) ? "page" : undefined}
                    key={path}
                    onClick={() => go(path)}
                  >
                    <Icon size={19} />
                    <span>{title}</span>
                    {path === "/pedidos" && (
                      <span className="nav-count" aria-hidden="true">
                        {
                          s.orders.filter(
                            (o) =>
                              !["delivered", "cancelled"].includes(o.stage),
                          ).length
                        }
                      </span>
                    )}
                  </button>
                ))
              )}
            </nav>
            <div className="sidebar-bottom">
              <div className="demo-callout">
                <FlaskConical size={20} />
                <strong>Explora el proceso completo</strong>
                <p>Cambia de rol para cotizar, aprobar e imprimir.</p>
              </div>
              <label className="role-switch">
                <span>Vista activa</span>
                <select
                  aria-label="Cambiar rol"
                  value={role}
                  onChange={(e) => chooseRole(e.target.value as Role)}
                >
                  <option value="admin">Administrador</option>
                  <option value="production">Producción</option>
                  <option value="client">Cliente</option>
                </select>
              </label>
              <div className="profile">
                <span className="avatar">
                  {role === "client" ? "C" : role === "production" ? "D" : "A"}
                </span>
                <div>
                  <strong>
                    {role === "client"
                      ? "Cliente demo"
                      : role === "production"
                        ? "Diego"
                        : "Andrea"}
                  </strong>
                  <small>{roleName[role]}</small>
                </div>
                <Button
                  variant="ghost"
                  aria-label="Cerrar sesión simulada"
                  onClick={() => {
                    setRole(null);
                    writeSession("tinta-role", "");
                  }}
                >
                  <LogOut size={17} />
                </Button>
              </div>
            </div>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <div className="topbar-left">
                <Button
                  variant="ghost"
                  className="mobile-menu"
                  aria-label="Abrir navegación"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu size={22} />
                </Button>
                <span>
                  Taller <span className="slash">/</span>{" "}
                  <strong>
                    {role === "client"
                      ? "Portal del cliente"
                      : (nav.find(([p]) => route.startsWith(p))?.[1] ??
                        "Panel general")}
                  </strong>
                </span>
              </div>
              <div className="topbar-right">
                <span className="today">
                  <CalendarDays size={16} /> {dateLabel(today())}
                </span>
                {role !== "client" && (
                  <Button
                    variant="secondary"
                    onClick={() => client(customerId)}
                  >
                    <ExternalLink size={15} /> Portal del cliente
                  </Button>
                )}
                <span className="avatar">{actor.name[0]}</span>
              </div>
            </header>
            <main id="main-content" className="main-content" tabIndex={-1}>
              <Workspace
                route={route}
                ui={ui}
                customerId={customerId}
                onCustomer={(id) => {
                  setCustomerId(id);
                  writeSession("tinta-customer", id);
                }}
              />
            </main>
            <footer className="app-footer">
              <span>Tinta · Un taller, muchas buenas impresiones.</span>
              <span>Demo de portafolio · MXN</span>
            </footer>
          </div>
        </div>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.text}</span>
          <Button
            variant="ghost"
            aria-label="Cerrar aviso"
            onClick={() => setToast(undefined)}
          >
            <X size={17} />
          </Button>
        </div>
      )}
    </>
  );
}
function Workspace({
  ui,
  route,
  customerId,
  onCustomer,
}: {
  ui: UI;
  route: string;
  customerId: string;
  onCustomer: (id: string) => void;
}) {
  const path = route.split("?")[0],
    parts = path.split("/").filter(Boolean),
    params = new URLSearchParams(route.split("?")[1]);
  if (ui.actor.role === "client")
    return (
      <>
        <div className="example-picker">
          <span>
            <FlaskConical size={16} /> Cliente de ejemplo
          </span>
          <select
            className="control"
            aria-label="Cambiar cliente de ejemplo"
            value={customerId}
            onChange={(e) => {
              onCustomer(e.target.value);
              ui.go("/portal");
            }}
          >
            {ui.s.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <small>
            Selector de la demo; el portal muestra solo este cliente.
          </small>
        </div>
        <Portal
          key={`${customerId}-${route}`}
          data={portalFor(ui.s, customerId)}
          images={ui.s.images}
          busy={ui.busy}
          run={ui.run}
          route={route}
          notify={ui.notify}
        />
      </>
    );
  if (
    ui.actor.role === "production" &&
    !["panel", "pedidos", "produccion", "calendario"].includes(parts[0])
  )
    return (
      <Empty
        title="Esta acción está en administración"
        text="La vista de producción consulta y actualiza trabajos autorizados."
      />
    );
  if (parts[0] === "panel" || !parts[0]) return <Dashboard {...ui} />;
  if (parts[0] === "cotizaciones") {
    if (parts[1] === "nueva") return <QuoteEditor key="new" {...ui} />;
    if (!parts[1]) return <QuoteList {...ui} />;
    const q = ui.s.quotes.find((q) => q.id === parts[1]);
    if (q)
      return parts[2] === "editar" ? (
        <QuoteEditor key={q.id} {...ui} quote={q} />
      ) : (
        <QuoteDetail key={q.id} {...ui} quote={q} />
      );
  }
  if (parts[0] === "pedidos") {
    if (!parts[1]) return <OrderList {...ui} />;
    const o = ui.s.orders.find((o) => o.id === parts[1]);
    if (o)
      return (
        <OrderDetail
          key={route}
          {...ui}
          order={o}
          initialTab={params.get("tab") ?? undefined}
        />
      );
  }
  if (parts[0] === "produccion") return <OrderList {...ui} board />;
  if (parts[0] === "clientes") return <Customers {...ui} />;
  if (parts[0] === "catalogo") return <Catalog {...ui} />;
  if (parts[0] === "configuracion") return <Configuration {...ui} />;
  if (parts[0] === "calendario") return <Calendar {...ui} />;
  if (parts[0] === "pagos") return <Payments {...ui} />;
  return (
    <Empty
      title="Este registro ya no está disponible"
      text="Puede haber cambiado al restablecer la demo. Vuelve al panel."
    >
      <Button onClick={() => ui.go("/panel")}>Abrir panel</Button>
    </Empty>
  );
}
function Login({ s, onEnter }: { s: State; onEnter: (role: Role) => void }) {
  const [email, setEmail] = useState("admin@demo.test"),
    [password, setPassword] = useState("Demo123!"),
    [error, setError] = useState("");
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">t</span>
          <span>
            tinta<span className="brand-dot">.</span>
            <small>TALLER DE IMPRESIÓN</small>
          </span>
        </div>
        <p className="eyebrow">El trabajo empieza aquí</p>
        <h1>
          Cotiza.<br />
          Aprueba.<br />
          Imprime.
        </h1>
        <p>Cotiza, revisa diseños y acompaña cada pedido hasta su entrega.</p>
        <div className="login-art">
          <DesignImage
            imageId="sample:norte"
            images={s.images}
            alt="Tarjeta original de Estudio Norte"
          />
          <DesignImage
            imageId="sample:luna"
            images={s.images}
            alt="Etiqueta original de Luna Café"
          />
        </div>
        <small>
          Diseños originales y datos ficticios para explorar la demo.
        </small>
      </section>
      <section className="login-form">
        <span className="demo-pill">
          <FlaskConical size={16} /> Demo pública
        </span>
        <h2>Entra a tu taller</h2>
        <p className="muted">
          Usa únicamente datos ficticios. Todos los cambios permanecen en tu
          navegador.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email === "admin@demo.test" && password === "Demo123!")
              onEnter("admin");
            else
              setError(
                "Usa las credenciales de demostración que aparecen abajo.",
              );
          }}
        >
          <label className="field">
            <span>Correo de demostración</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Contraseña simulada</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button type="submit">Entrar como administrador</Button>
        </form>
        <div className="credentials">
          <strong>Credenciales visibles de la demo</strong>
          <span>
            admin@demo.test <span className="slash">/</span> Demo123!
          </span>
        </div>
        <div className="divider">
          <span>O explora una vista</span>
        </div>
        <div className="quick-roles">
          <Button variant="secondary" onClick={() => onEnter("admin")}>
            <LayoutDashboard size={18} /> Administración
          </Button>
          <Button variant="secondary" onClick={() => onEnter("production")}>
            <Printer size={18} /> Producción
          </Button>
          <Button variant="secondary" onClick={() => onEnter("client")}>
            <Users size={18} /> Soy cliente
          </Button>
        </div>
        <p className="login-footnote">
          Acceso simulado · Sin cobros ni mensajes reales
        </p>
      </section>
    </main>
  );
}

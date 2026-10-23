// Marco de la app con sesión (misma estética que Chef Works): menú lateral azul marino,
// barra superior con el título y, en el celular, menú desplegable + barra inferior de accesos.
import { useState, type ReactNode } from "react";
import logoNbs from "../assets/logo_nbs.png";
import { ir, type Ruta } from "../lib/ruta";
import { ROL_LABELS, type Rol } from "../lib/sesion";
import { IconoCerrar, IconoClientes, IconoCotizador, IconoMenu, IconoPresupuestos, IconoSalir } from "./Iconos";

type Seccion = "cotizador" | "presupuestos" | "clientes";

const ITEMS: { id: Seccion; nombre: string; hash: string; Icono: (p: { size?: number }) => JSX.Element }[] = [
  { id: "cotizador", nombre: "Cotizador", hash: "/", Icono: IconoCotizador },
  { id: "presupuestos", nombre: "Presupuestos", hash: "/presupuestos", Icono: IconoPresupuestos },
  { id: "clientes", nombre: "Clientes", hash: "/clientes", Icono: IconoClientes },
];

function seccionDe(ruta: Ruta): Seccion {
  if (ruta.pantalla === "cotizador") return "cotizador";
  if (ruta.pantalla === "presupuestos") return "presupuestos";
  return "clientes";
}

interface Props {
  ruta: Ruta;
  email: string;
  rol: Rol;
  onSalir: () => void;
  children: ReactNode;
}

export function Layout({ ruta, email, rol, onSalir, children }: Props) {
  const [abierto, setAbierto] = useState(false);
  const actual = seccionDe(ruta);
  const titulo = ITEMS.find((i) => i.id === actual)?.nombre ?? "NBS";

  const navegar = (hash: string) => {
    setAbierto(false);
    ir(hash);
  };

  return (
    <div className="ly">
      {abierto && <div className="ly-overlay" onClick={() => setAbierto(false)} />}

      <aside className={`ly-sidebar ${abierto ? "abierto" : ""}`}>
        <div className="ly-marca">
          <img src={logoNbs} alt="" className="ly-logo" />
          <div className="ly-marca-texto">
            <span className="ly-marca-titulo">NBS Bazar</span>
            <span className="ly-marca-tag">Profesional · CRM</span>
          </div>
          <button type="button" className="ly-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar menú">
            <IconoCerrar size={18} />
          </button>
        </div>

        <nav className="ly-nav">
          <div className="ly-seccion">
            <div className="ly-seccion-titulo">Comercial</div>
            {ITEMS.map(({ id, nombre, hash, Icono }) => (
              <button
                key={id}
                type="button"
                className={`ly-link ${actual === id ? "activo" : ""}`}
                onClick={() => navegar(hash)}
              >
                <span className="ly-icono">
                  <Icono size={17} />
                </span>
                <span>{nombre}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="ly-usuario">
          <div className="ly-usuario-info">
            <span className="ly-usuario-nombre" title={email}>
              {email}
            </span>
            <span className="ly-usuario-rol">{ROL_LABELS[rol]}</span>
          </div>
          <button type="button" className="ly-salir" onClick={onSalir} title="Cerrar sesión" aria-label="Cerrar sesión">
            <IconoSalir size={18} />
          </button>
        </div>
      </aside>

      <div className="ly-main">
        <header className="ly-topbar">
          <button type="button" className="ly-menu" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <IconoMenu size={20} />
          </button>
          <h1 className="ly-titulo">{titulo}</h1>
        </header>
        <main className="ly-contenido">{children}</main>
      </div>

      <nav className="ly-tabbar" aria-label="Accesos rápidos">
        {ITEMS.map(({ id, nombre, hash, Icono }) => (
          <button key={id} type="button" className={`ly-tab ${actual === id ? "activo" : ""}`} onClick={() => navegar(hash)}>
            <Icono size={21} />
            <span>{nombre}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

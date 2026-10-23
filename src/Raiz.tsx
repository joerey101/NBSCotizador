// Puerta de entrada: decide qué ve cada uno según la sesión y el rol.
//   sin Supabase configurado → la app como siempre (sin login)
//   sin sesión               → Login
//   link de recuperación     → NuevaClave
//   admin / vendedor         → menú lateral (Cotizador, Presupuestos, Clientes)
//   deposito                 → (stock y pedidos llegan en la etapa 6)
//   sin rol                  → aviso, sin datos
import App from "./App";
import { CLIENTE_VACIO } from "./lib/clientes";
import { ir, useRuta, type Ruta } from "./lib/ruta";
import { ROL_LABELS, useSesion, type Rol } from "./lib/sesion";
import { recargarApp, supabase } from "./lib/supabase";
import { ClienteFicha } from "./ui/crm/ClienteFicha";
import { ClienteForm } from "./ui/crm/ClienteForm";
import { ClientesLista } from "./ui/crm/ClientesLista";
import { PresupuestosLista } from "./ui/crm/PresupuestosLista";
import { Layout } from "./ui/Layout";
import { Login } from "./ui/Login";
import { NuevaClave } from "./ui/NuevaClave";

async function salir() {
  if (supabase) {
    // scope local: sale aunque no haya conexión
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: "local" });
  }
  recargarApp();
}

function PantallaCrm({ ruta }: { ruta: Ruta }) {
  switch (ruta.pantalla) {
    case "presupuestos":
      return <PresupuestosLista />;
    case "clientes":
      return <ClientesLista />;
    case "cliente":
      return <ClienteFicha id={ruta.id} />;
    case "cliente_nuevo":
      return (
        <div className="crm-panel">
          <div className="crm-encabezado">
            <h2>Nuevo cliente</h2>
          </div>
          <ClienteForm
            inicial={CLIENTE_VACIO}
            onGuardado={(c) => ir(`/clientes/${c.id}`)}
            onCancelar={() => ir("/clientes")}
          />
        </div>
      );
    default:
      return null;
  }
}

function Aviso({ titulo, texto, email, rol }: { titulo: string; texto: string; email: string; rol: Rol }) {
  return (
    <div className="app">
      <div className="barra-usuario">
        <span className="barra-email">{email}</span>
        <span className={`chip-rol rol-${rol}`}>{ROL_LABELS[rol]}</span>
        <button type="button" className="btn-salir" onClick={salir}>
          Salir
        </button>
      </div>
      <div className="aviso-rol">
        <h2>{titulo}</h2>
        <p>{texto}</p>
      </div>
    </div>
  );
}

export function Raiz() {
  const estado = useSesion();
  const ruta = useRuta();

  switch (estado.tipo) {
    case "sin_crm":
      return <App />;
    case "cargando":
      return <div className="auth-pantalla"><div className="auth-cargando">Cargando…</div></div>;
    case "sin_sesion":
      return <Login />;
    case "nueva_clave":
      return <NuevaClave />;
    case "con_sesion": {
      const email = estado.session.user.email ?? "";
      const { rol } = estado;
      if (rol === "admin" || rol === "vendedor") {
        const enCotizador = ruta.pantalla === "cotizador";
        return (
          <Layout ruta={ruta} email={email} rol={rol} onSalir={salir}>
            {/* el cotizador queda montado: al volver de otra pantalla el presupuesto sigue igual */}
            <div style={{ display: enCotizador ? undefined : "none" }}>
              <App />
            </div>
            {!enCotizador && (
              <div className="app">
                <PantallaCrm ruta={ruta} />
              </div>
            )}
          </Layout>
        );
      }
      if (rol === "deposito") {
        return (
          <Aviso
            titulo="Stock y pedidos"
            texto="Tu usuario es de depósito. Las pantallas de stock, escáner y pedidos (sin precios) se suman en una próxima etapa."
            email={email}
            rol={rol}
          />
        );
      }
      return (
        <Aviso
          titulo="Tu usuario todavía no tiene acceso"
          texto="Pedile al administrador que te asigne un rol (vendedor, depósito o administrador). Después salí y volvé a entrar."
          email={email}
          rol={rol}
        />
      );
    }
  }
}

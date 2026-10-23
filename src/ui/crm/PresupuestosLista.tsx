// Presupuestos guardados: búsqueda por número, nombre o cliente; filtro por estado.
// "Abrir" lo carga en el cotizador para seguir editándolo (el número no cambia).
import { useEffect, useState } from "react";
import { formatoMoneda } from "../../lib/pricing";
import {
  ESTADO_LABELS,
  listarPresupuestos,
  type EstadoPresupuesto,
  type PresupuestoFila,
} from "../../lib/presupuestos";
import { pedirAlCotizador } from "../../lib/eventos";
import { ir } from "../../lib/ruta";

export function abrirEnCotizador(id: string) {
  ir("/");
  pedirAlCotizador({ tipo: "abrir", id });
}

export function FilaPresupuesto({ p, mostrarCliente = true }: { p: PresupuestoFila; mostrarCliente?: boolean }) {
  return (
    <button type="button" className="crm-fila" onClick={() => abrirEnCotizador(p.id)} title="Abrir en el cotizador">
      <div className="crm-fila-principal">
        <strong>{p.numero}</strong>
        <span className={`chip-estado estado-${p.estado}`}>{ESTADO_LABELS[p.estado]}</span>
        {mostrarCliente && p.cliente_nombre && <span>{p.cliente_nombre}</span>}
        {p.titulo && <span className="crm-sec">{p.titulo}</span>}
      </div>
      <div className="crm-fila-datos">
        <span>{new Date(p.fecha + "T00:00:00").toLocaleDateString("es-AR")}</span>
        {p.total != null && <strong>{formatoMoneda(p.total, p.moneda)}</strong>}
        {p.items_pendientes > 0 && <span className="crm-pendiente">{p.items_pendientes} sin precio</span>}
      </div>
    </button>
  );
}

export function PresupuestosLista() {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<EstadoPresupuesto | "">("");
  const [filas, setFilas] = useState<PresupuestoFila[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    const t = setTimeout(() => {
      listarPresupuestos({ texto, estado })
        .then((r) => vigente && (setFilas(r), setError(null)))
        .catch((e: Error) => vigente && setError(e.message));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [texto, estado]);

  return (
    <div className="crm-panel">
      <div className="crm-encabezado">
        <h2>Presupuestos</h2>
      </div>
      <div className="crm-busqueda">
        <input
          type="search"
          className="search-input"
          autoFocus
          placeholder="Buscar por número (COT-0001), nombre o cliente…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <select className="crm-select" value={estado} onChange={(e) => setEstado(e.target.value as EstadoPresupuesto | "")}>
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_LABELS) as EstadoPresupuesto[]).map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABELS[e]}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="auth-error">{error}</div>}
      {!error && filas === null && <p className="crm-vacio">Cargando…</p>}
      {!error && filas?.length === 0 && (
        <p className="crm-vacio">
          {texto || estado ? "No hay presupuestos que coincidan." : "Todavía no hay presupuestos guardados. Se guardan desde el Cotizador."}
        </p>
      )}
      {filas && filas.length > 0 && (
        <div className="crm-tabla">
          {filas.map((p) => (
            <FilaPresupuesto key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

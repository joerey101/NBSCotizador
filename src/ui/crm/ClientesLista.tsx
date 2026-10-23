// Directorio de clientes: búsqueda por razón social, nombre comercial o CUIT.
import { useEffect, useState } from "react";
import { buscarClientes, type ClienteFila } from "../../lib/clientes";
import { ir } from "../../lib/ruta";

export function ClientesLista() {
  const [texto, setTexto] = useState("");
  const [inactivos, setInactivos] = useState(false);
  const [filas, setFilas] = useState<ClienteFila[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    const t = setTimeout(() => {
      buscarClientes(texto, inactivos)
        .then((r) => vigente && (setFilas(r), setError(null)))
        .catch((e: Error) => vigente && setError(e.message));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [texto, inactivos]);

  return (
    <div className="crm-panel">
      <div className="crm-encabezado">
        <h2>Clientes</h2>
        <button type="button" className="crm-btn-primario" onClick={() => ir("/clientes/nuevo")}>
          + Nuevo cliente
        </button>
      </div>

      <div className="crm-busqueda">
        <input
          type="search"
          className="search-input"
          autoFocus
          placeholder="Buscar por razón social, nombre comercial o CUIT…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <label className="crm-check">
          <input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} />
          Ver inactivos
        </label>
      </div>

      {error && <div className="auth-error">{error}</div>}
      {!error && filas === null && <p className="crm-vacio">Cargando…</p>}
      {!error && filas?.length === 0 && (
        <p className="crm-vacio">{texto ? "No hay clientes que coincidan." : "Todavía no hay clientes. Cargá el primero."}</p>
      )}

      {filas && filas.length > 0 && (
        <div className="crm-tabla">
          {filas.map((c) => (
            <button key={c.id} type="button" className="crm-fila" onClick={() => ir(`/clientes/${c.id}`)}>
              <div className="crm-fila-principal">
                <strong>{c.razon_social}</strong>
                {c.nombre_comercial && <span className="crm-sec">{c.nombre_comercial}</span>}
                {!c.activo && <span className="chip-rol">Inactivo</span>}
              </div>
              <div className="crm-fila-datos">
                {c.cuit && <span>CUIT {c.cuit}</span>}
                {c.ciudad && <span>{c.ciudad}</span>}
                {c.telefono && <span>{c.telefono}</span>}
              </div>
            </button>
          ))}
          {filas.length === 100 && <p className="crm-vacio">Se muestran los primeros 100. Afiná la búsqueda.</p>}
        </div>
      )}
    </div>
  );
}

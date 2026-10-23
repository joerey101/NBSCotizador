// Modal del cotizador para elegir un cliente de la lista (o crearlo en el momento).
// Devuelve el cliente y su contacto principal para completar los datos del presupuesto.
import { useEffect, useState } from "react";
import {
  buscarClientes,
  CLIENTE_VACIO,
  listarContactos,
  obtenerCliente,
  type Cliente,
  type ClienteFila,
  type Contacto,
} from "../../lib/clientes";
import type { DatosCliente } from "../../lib/types";
import { ClienteForm } from "./ClienteForm";

/** Pasa los datos del cliente guardado a la cabecera del presupuesto (vendedor, fecha y
 *  condiciones se mantienen como estaban). */
export function datosDesdeCliente(c: Cliente, contacto: Contacto | null, actual: DatosCliente): DatosCliente {
  return {
    ...actual,
    empresa: c.razon_social,
    nombre: contacto ? [contacto.nombre, contacto.apellido].filter(Boolean).join(" ") : "",
    cuit: c.cuit ?? "",
    email: contacto?.email || c.email || "",
    telefono: contacto?.telefono || c.telefono || "",
    direccion: [c.direccion, c.ciudad, c.provincia].filter(Boolean).join(", "),
  };
}

export async function cargarClienteConPrincipal(id: string): Promise<{ cliente: Cliente; contacto: Contacto | null }> {
  const [cliente, contactos] = await Promise.all([obtenerCliente(id), listarContactos(id)]);
  return { cliente, contacto: contactos.find((x) => x.es_principal) ?? contactos[0] ?? null };
}

interface Props {
  onElegir: (cliente: Cliente, contacto: Contacto | null) => void;
  onCerrar: () => void;
}

export function ClienteSelector({ onElegir, onCerrar }: Props) {
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState<ClienteFila[] | null>(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (creando) return;
    let vigente = true;
    const t = setTimeout(() => {
      buscarClientes(texto, false, 30)
        .then((r) => vigente && (setFilas(r), setError(null)))
        .catch((e: Error) => vigente && setError(e.message));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [texto, creando]);

  const elegir = async (id: string) => {
    try {
      const { cliente, contacto } = await cargarClienteConPrincipal(id);
      onElegir(cliente, contacto);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-content crm-selector" onClick={(e) => e.stopPropagation()}>
        <div className="crm-encabezado">
          <h2>{creando ? "Nuevo cliente" : "Elegir cliente"}</h2>
          <button type="button" className="btn-salir" onClick={onCerrar}>
            Cerrar
          </button>
        </div>

        {creando ? (
          <ClienteForm
            inicial={{ ...CLIENTE_VACIO, razon_social: texto }}
            onGuardado={(c) => onElegir(c, null)}
            onCancelar={() => setCreando(false)}
          />
        ) : (
          <>
            <input
              type="search"
              className="search-input"
              autoFocus
              placeholder="Buscar por razón social, nombre comercial o CUIT…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            {error && <div className="auth-error">{error}</div>}
            <div className="crm-tabla crm-selector-lista">
              {filas?.map((c) => (
                <button key={c.id} type="button" className="crm-fila" onClick={() => elegir(c.id)}>
                  <div className="crm-fila-principal">
                    <strong>{c.razon_social}</strong>
                    {c.nombre_comercial && <span className="crm-sec">{c.nombre_comercial}</span>}
                  </div>
                  <div className="crm-fila-datos">{c.cuit && <span>CUIT {c.cuit}</span>}</div>
                </button>
              ))}
              {filas?.length === 0 && <p className="crm-vacio" style={{ padding: "8px 12px" }}>No hay coincidencias.</p>}
            </div>
            <button type="button" className="crm-btn-primario" onClick={() => setCreando(true)}>
              + Crear cliente nuevo{texto ? ` “${texto}”` : ""}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Ficha del cliente: datos, edición, contactos (uno principal) y activar/desactivar.
// Presupuestos y oportunidades se suman en las etapas 3 y 4.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  actualizarCliente,
  borrarContacto,
  CONTACTO_VACIO,
  guardarContacto,
  listarContactos,
  obtenerCliente,
  type Cliente,
  type Contacto,
  type ContactoEditable,
} from "../../lib/clientes";
import { pedirAlCotizador } from "../../lib/eventos";
import { listarPresupuestos, type PresupuestoFila } from "../../lib/presupuestos";
import { ir } from "../../lib/ruta";
import { ClienteForm } from "./ClienteForm";
import { useVendedores } from "./VendedorSelect";
import { nombreVendedor } from "../../lib/equipo";
import { FilaPresupuesto } from "./PresupuestosLista";
import { LineaDeTiempo } from "./LineaDeTiempo";
import { formatoPesos, listarOportunidades, NOMBRE_ETAPA, type Oportunidad } from "../../lib/oportunidades";

function ContactoForm({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial: ContactoEditable;
  onGuardar: (c: ContactoEditable) => Promise<void>;
  onCancelar: () => void;
}) {
  const [c, setC] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const texto = (k: keyof ContactoEditable) => ({
    value: (c[k] as string | null) ?? "",
    onChange: (e: { target: { value: string } }) => setC((x) => ({ ...x, [k]: e.target.value })),
  });
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar(c);
    } finally {
      setGuardando(false);
    }
  };
  return (
    <form className="crm-form crm-subform" onSubmit={enviar}>
      <div className="crm-grid">
        <label>
          Nombre *
          <input required autoFocus {...texto("nombre")} />
        </label>
        <label>
          Apellido
          <input {...texto("apellido")} />
        </label>
        <label>
          Cargo
          <input {...texto("cargo")} />
        </label>
        <label>
          Email
          <input type="email" {...texto("email")} />
        </label>
        <label>
          Teléfono
          <input type="tel" {...texto("telefono")} />
        </label>
        <label className="crm-check">
          <input type="checkbox" checked={c.es_principal} onChange={(e) => setC({ ...c, es_principal: e.target.checked })} />
          Contacto principal
        </label>
      </div>
      <div className="crm-acciones">
        <button type="button" className="btn-salir" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="crm-btn-primario" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar contacto"}
        </button>
      </div>
    </form>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="crm-dato">
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
    </div>
  );
}

export function ClienteFicha({ id }: { id: string }) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [presupuestos, setPresupuestos] = useState<PresupuestoFila[] | null>(null);
  const [oportunidades, setOportunidades] = useState<Oportunidad[] | null>(null);
  const vendedores = useVendedores();
  const [editando, setEditando] = useState(false);
  const [contactoEnEdicion, setContactoEnEdicion] = useState<Contacto | "nuevo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [c, cs, ps, os] = await Promise.all([
        obtenerCliente(id),
        listarContactos(id),
        listarPresupuestos({ clienteId: id, limite: 50 }),
        listarOportunidades({ clienteId: id }),
      ]);
      setCliente(c);
      setContactos(cs);
      setPresupuestos(ps);
      setOportunidades(os);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    setCliente(null);
    setEditando(false);
    setContactoEnEdicion(null);
    cargar();
  }, [cargar]);

  const accion = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error && !cliente) return <div className="crm-panel"><div className="auth-error">{error}</div></div>;
  if (!cliente) return <div className="crm-panel"><p className="crm-vacio">Cargando…</p></div>;

  const { id: _id, activo, creado_en, actualizado_en, ...editable } = cliente;

  return (
    <div className="crm-panel">
      <button type="button" className="auth-link crm-volver" onClick={() => ir("/clientes")}>
        ← Clientes
      </button>

      <div className="crm-encabezado">
        <div>
          <h2>{cliente.razon_social}</h2>
          {cliente.nombre_comercial && <span className="crm-sec">{cliente.nombre_comercial}</span>}
          {!activo && <span className="chip-rol"> Inactivo</span>}
        </div>
        {!editando && (
          <div className="crm-acciones">
            <button
              type="button"
              className="btn-salir"
              onClick={() => {
                const msj = activo ? "¿Desactivar este cliente? Deja de aparecer en las búsquedas." : "¿Reactivar este cliente?";
                if (confirm(msj)) accion(() => actualizarCliente(cliente.id, { activo: !activo }));
              }}
            >
              {activo ? "Desactivar" : "Reactivar"}
            </button>
            <button type="button" className="crm-btn-primario" onClick={() => setEditando(true)}>
              Editar
            </button>
          </div>
        )}
      </div>

      {error && <div className="auth-error">{error}</div>}

      {editando ? (
        <ClienteForm
          id={cliente.id}
          inicial={editable}
          onGuardado={(c) => {
            setCliente(c);
            setEditando(false);
          }}
          onCancelar={() => setEditando(false)}
        />
      ) : (
        <div className="crm-datos">
          <Dato etiqueta="CUIT" valor={cliente.cuit} />
          <Dato etiqueta="Tipo" valor={cliente.tipo} />
          <Dato etiqueta="Segmento" valor={cliente.segmento} />
          <Dato etiqueta="Email" valor={cliente.email} />
          <Dato etiqueta="Teléfono" valor={cliente.telefono} />
          <Dato
            etiqueta="Dirección"
            valor={[cliente.direccion, cliente.ciudad, cliente.provincia, cliente.pais].filter(Boolean).join(", ") || null}
          />
          <Dato
            etiqueta="Vendedor"
            valor={(() => {
              const v = vendedores.find((x) => x.id === cliente.vendedor_id);
              return v ? nombreVendedor(v) : null;
            })()}
          />
          <Dato etiqueta="Notas" valor={cliente.notas} />
        </div>
      )}

      <div className="crm-seccion">
        <div className="crm-encabezado">
          <h3>Contactos</h3>
          {contactoEnEdicion === null && (
            <button type="button" className="btn-salir" onClick={() => setContactoEnEdicion("nuevo")}>
              + Agregar contacto
            </button>
          )}
        </div>

        {contactoEnEdicion === "nuevo" && (
          <ContactoForm
            inicial={{ ...CONTACTO_VACIO, es_principal: contactos.length === 0 }}
            onCancelar={() => setContactoEnEdicion(null)}
            onGuardar={(c) => accion(() => guardarContacto(cliente.id, c)).then(() => setContactoEnEdicion(null))}
          />
        )}

        {contactos.length === 0 && contactoEnEdicion === null && <p className="crm-vacio">Sin contactos cargados.</p>}

        {contactos.map((ct) =>
          contactoEnEdicion !== null && contactoEnEdicion !== "nuevo" && contactoEnEdicion.id === ct.id ? (
            <ContactoForm
              key={ct.id}
              inicial={ct}
              onCancelar={() => setContactoEnEdicion(null)}
              onGuardar={(c) => accion(() => guardarContacto(cliente.id, c, ct.id)).then(() => setContactoEnEdicion(null))}
            />
          ) : (
            <div key={ct.id} className="crm-contacto">
              <div>
                <strong>
                  {ct.nombre} {ct.apellido}
                </strong>
                {ct.es_principal && <span className="chip-rol rol-admin">Principal</span>}
                {ct.cargo && <span className="crm-sec"> · {ct.cargo}</span>}
                <div className="crm-fila-datos">
                  {ct.email && <a href={`mailto:${ct.email}`}>{ct.email}</a>}
                  {ct.telefono && <a href={`tel:${ct.telefono}`}>{ct.telefono}</a>}
                </div>
              </div>
              <div className="crm-acciones">
                {!ct.es_principal && (
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => accion(() => guardarContacto(cliente.id, { ...ct, es_principal: true }, ct.id))}
                  >
                    Hacer principal
                  </button>
                )}
                <button type="button" className="auth-link" onClick={() => setContactoEnEdicion(ct)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="auth-link crm-peligro"
                  onClick={() => confirm(`¿Borrar el contacto ${ct.nombre}?`) && accion(() => borrarContacto(ct.id))}
                >
                  Borrar
                </button>
              </div>
            </div>
          )
        )}
      </div>

      <div className="crm-seccion">
        <div className="crm-encabezado">
          <h3>Presupuestos</h3>
          <button
            type="button"
            className="crm-btn-primario"
            onClick={() => {
              ir("/");
              pedirAlCotizador({ tipo: "nuevo_para_cliente", clienteId: cliente.id });
            }}
          >
            + Nuevo presupuesto
          </button>
        </div>
        {presupuestos === null && <p className="crm-vacio">Cargando…</p>}
        {presupuestos?.length === 0 && <p className="crm-vacio">Todavía no tiene presupuestos guardados.</p>}
        {presupuestos && presupuestos.length > 0 && (
          <div className="crm-tabla">
            {presupuestos.map((p) => (
              <FilaPresupuesto key={p.id} p={p} mostrarCliente={false} />
            ))}
          </div>
        )}
      </div>

      <div className="crm-seccion">
        <h3>Oportunidades</h3>
        {oportunidades === null && <p className="crm-vacio">Cargando…</p>}
        {oportunidades?.length === 0 && <p className="crm-vacio">Sin oportunidades.</p>}
        {oportunidades && oportunidades.length > 0 && (
          <div className="crm-tabla">
            {oportunidades.map((o) => (
              <button key={o.id} type="button" className="crm-fila" onClick={() => ir(`/oportunidades/${o.id}`)}>
                <div className="crm-fila-principal">
                  <span className={`chip-etapa etapa-${o.etapa}`}>{NOMBRE_ETAPA[o.etapa]}</span>
                  <strong>{o.nombre}</strong>
                </div>
                <div className="crm-fila-datos">
                  <strong>{formatoPesos(o.monto_estimado)}</strong>
                  <span>{o.probabilidad ?? 0}%</span>
                  {o.proxima_accion && <span>→ {o.proxima_accion}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="crm-seccion">
        <h3>Línea de tiempo</h3>
        <LineaDeTiempo clienteId={cliente.id} />
      </div>
    </div>
  );
}

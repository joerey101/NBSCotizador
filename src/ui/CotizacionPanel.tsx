import { useRef, useState } from "react";
import type { DatosCliente, Moneda } from "../lib/types";
import type { Descuento, LineaCotizacion, Totales } from "../lib/cotizacion";
import { formatoMoneda } from "../lib/pricing";
import { LineaRow } from "./LineaRow";
import { ClienteModal } from "./ClienteModal";
import { ClienteSelector } from "./crm/ClienteSelector";
import { VendedorSelect } from "./crm/VendedorSelect";
import type { Cliente, Contacto } from "../lib/clientes";
import { ESTADO_LABELS, type EstadoPresupuesto, type PresupuestoAbierto } from "../lib/presupuestos";

/** Guardado en Supabase (solo con CRM configurado y sesión). */
export interface CrmPanel {
  abierto: PresupuestoAbierto | null;
  clienteVinculado: boolean;
  sinGuardar: boolean;
  guardando: boolean;
  aviso: { tipo: "ok" | "error"; texto: string } | null;
  onElegirCliente: (c: Cliente, contacto: Contacto | null) => void;
  vendedorId: string | null;
  onVendedor: (id: string | null, nombre: string) => void;
  onGuardar: () => void;
  onEstado: (e: EstadoPresupuesto) => void;
  onNuevo: () => void;
  onCrearPedido: () => void;
}

interface Props {
  lineas: LineaCotizacion[];
  totales: Totales;
  monedaPresupuesto: Moneda;
  descuento: Descuento;
  cliente: DatosCliente;
  onCliente: (c: DatosCliente) => void;
  onDescuento: (d: Descuento) => void;
  onCantidad: (uid: string, n: number) => void;
  onPrecio: (uid: string, v: number | null) => void;
  onQuitar: (uid: string) => void;
  onLimpiar: () => void;
  onExportar: () => void;
  onImportar: (file: File) => void;
  onDescargarExcel: () => void;
  crm?: CrmPanel;
}

export function CotizacionPanel(props: Props) {
  const { lineas, totales, monedaPresupuesto, descuento, cliente, crm } = props;
  const [modalAbierto, setModalAbierto] = useState(false);
  const [eligiendoCliente, setEligiendoCliente] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fmt = (n: number) => formatoMoneda(n, monedaPresupuesto);

  const clienteNombreMostrar = cliente.empresa || cliente.nombre || "Sin asignar";

  return (
    <aside className="cotizacion">
      <div className="cot-head">
        <h2>Cotización</h2>
        <span className="cot-count">{lineas.length} ítem{lineas.length === 1 ? "" : "s"}</span>
      </div>

      {crm && (
        <div className="cot-guardado">
          {crm.abierto ? (
            <>
              <div className="cot-numero">
                <strong>{crm.abierto.numero}</strong>
                {crm.abierto.titulo && <span title={crm.abierto.titulo}>{crm.abierto.titulo}</span>}
              </div>
              <select
                className={`cot-estado estado-${crm.abierto.estado}`}
                value={crm.abierto.estado}
                onChange={(e) => crm.onEstado(e.target.value as EstadoPresupuesto)}
                aria-label="Estado del presupuesto"
              >
                {(Object.keys(ESTADO_LABELS) as EstadoPresupuesto[]).map((e) => (
                  <option key={e} value={e}>
                    {ESTADO_LABELS[e]}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="cot-sin-numero">Presupuesto sin guardar</span>
          )}
        </div>
      )}

      {crm && (
        <label className="cot-vendedor">
          <span>Vendedor</span>
          <VendedorSelect className="cot-estado" value={crm.vendedorId} onChange={crm.onVendedor} />
        </label>
      )}

      {/* Resumen del Cliente */}
      <div className="cliente-summary-card">
        <div className="cliente-info">
          <span className="cliente-label">
            Cliente asignado:{crm?.clienteVinculado && <span className="cot-vinculado"> ✓ de la lista</span>}
          </span>
          <span className="cliente-val" title={clienteNombreMostrar}>{clienteNombreMostrar}</span>
        </div>
        <div className="cliente-botones">
          {crm && (
            <button
              type="button"
              className="btn-edit-cliente"
              onClick={() => setEligiendoCliente(true)}
              title="Elegir el cliente de la lista de Clientes (o crearlo)"
            >
              👤 Elegir cliente
            </button>
          )}
          <button
            type="button"
            className="btn-edit-cliente"
            onClick={() => setModalAbierto(true)}
            title="Editar datos de cabecera del cliente para el Excel"
          >
            ✏ Datos Cliente
          </button>
        </div>
      </div>

      {lineas.length === 0 ? (
        <p className="cot-vacia">Agregá productos desde los resultados con “+ Agregar”.</p>
      ) : (
        <>
          <div className="cot-lineas">
            {lineas.map((l) => (
              <LineaRow
                key={l.uid}
                l={l}
                calc={totales.porLinea[l.uid]}
                monedaPresupuesto={monedaPresupuesto}
                onCantidad={props.onCantidad}
                onPrecio={props.onPrecio}
                onQuitar={props.onQuitar}
              />
            ))}
          </div>

          {(totales.nPendientesPrecio > 0 || totales.nFaltaTasa > 0) && (
            <div className="cot-aviso">
              {totales.nPendientesPrecio > 0 && (
                <div>⚠ {totales.nPendientesPrecio} línea(s) sin precio: cargá el precio para sumarlas al total.</div>
              )}
              {totales.nFaltaTasa > 0 && (
                <div>⚠ {totales.nFaltaTasa} línea(s) sin tasa de cambio cargada.</div>
              )}
            </div>
          )}

          <div className="cot-descuento">
            <span className="rb-label">Descuento global</span>
            <div className="desc-row">
              <div className="segmented sm">
                <button
                  type="button"
                  className={descuento.modo === "porcentaje" ? "seg activa" : "seg"}
                  onClick={() => props.onDescuento({ ...descuento, modo: "porcentaje" })}
                >
                  %
                </button>
                <button
                  type="button"
                  className={descuento.modo === "monto" ? "seg activa" : "seg"}
                  onClick={() => props.onDescuento({ ...descuento, modo: "monto" })}
                >
                  {monedaPresupuesto}
                </button>
              </div>
              <input
                type="number"
                min={0}
                step="any"
                className="in-desc"
                value={descuento.valor || ""}
                placeholder="0"
                onChange={(e) =>
                  props.onDescuento({
                    ...descuento,
                    valor: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
            {totales.avisoDescuento && (
              <div className="desc-aviso">⚠ Descuento mayor al 30%</div>
            )}
          </div>

          <div className="cot-totales">
            <div className="tot-row">
              <span>Subtotal</span>
              <span>{fmt(totales.subtotal)}</span>
            </div>
            <div className="tot-row tot-desc">
              <span>Descuento</span>
              <span>− {fmt(totales.descuentoMonto)}</span>
            </div>
            <div className="tot-row tot-iva">
              <span>IVA</span>
              <span title="Hook preparado, apagado hasta confirmación contable">— (s/IVA)</span>
            </div>
            <div className="tot-row tot-final">
              <span>TOTAL ({monedaPresupuesto})</span>
              <span>{fmt(totales.total)}</span>
            </div>
          </div>
        </>
      )}

      {crm && (
        <div className="cot-crm-acciones">
          <button
            type="button"
            className="btn-guardar-cot"
            onClick={crm.onGuardar}
            disabled={lineas.length === 0 || crm.guardando}
          >
            {crm.guardando ? "Guardando…" : crm.abierto ? `💾 Guardar ${crm.abierto.numero}` : "💾 Guardar presupuesto"}
          </button>
          {(crm.abierto || lineas.length > 0) && (
            <button type="button" className="btn-sec" onClick={crm.onNuevo} title="Empezar un presupuesto nuevo en blanco">
              + Nuevo
            </button>
          )}
          {crm.abierto?.estado === "aprobada" && (
            <button type="button" className="btn-sec" onClick={crm.onCrearPedido} title="Crear el pedido para preparar en el depósito">
              📦 Crear pedido
            </button>
          )}
        </div>
      )}
      {crm?.sinGuardar && crm.abierto && !crm.aviso && <div className="cot-aviso-crm">Hay cambios sin guardar.</div>}
      {crm?.aviso && <div className={`cot-aviso-crm ${crm.aviso.tipo}`}>{crm.aviso.texto}</div>}

      {/* Botón Principal de Descarga Excel */}
      <div className="cot-excel-block">
        <button
          type="button"
          className="btn-excel-main"
          onClick={() => {
            if (!cliente.empresa && !cliente.nombre) {
              setModalAbierto(true);
            } else {
              props.onDescargarExcel();
            }
          }}
          disabled={lineas.length === 0}
        >
          📥 Descargar Presupuesto Oficial (Excel)
        </button>
      </div>

      <div className="cot-acciones">
        <button
          type="button"
          className="btn-sec"
          onClick={props.onExportar}
          disabled={lineas.length === 0}
          title="Exporta borrador en formato JSON"
        >
          ⬇ Guardar JSON
        </button>
        <button
          type="button"
          className="btn-sec"
          onClick={() => fileRef.current?.click()}
          title="Importa un borrador JSON previo"
        >
          ⬆ Cargar JSON
        </button>
        {lineas.length > 0 && (
          <button
            type="button"
            className="btn-sec btn-danger"
            onClick={props.onLimpiar}
          >
            Vaciar
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) props.onImportar(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* se monta al abrir: así toma los datos actuales (p. ej. después de elegir un cliente) */}
      {modalAbierto && (
        <ClienteModal
          abierto
          cliente={cliente}
          onGuardar={props.onCliente}
          onCerrar={() => setModalAbierto(false)}
          onDescargarExcel={() => {
            setModalAbierto(false);
            props.onDescargarExcel();
          }}
          cantLineas={lineas.length}
        />
      )}

      {crm && eligiendoCliente && (
        <ClienteSelector
          onCerrar={() => setEligiendoCliente(false)}
          onElegir={(c, contacto) => {
            crm.onElegirCliente(c, contacto);
            setEligiendoCliente(false);
          }}
        />
      )}
    </aside>
  );
}

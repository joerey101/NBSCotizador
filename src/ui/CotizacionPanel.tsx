import { useRef, useState } from "react";
import type { DatosCliente, Moneda } from "../lib/types";
import type { Descuento, LineaCotizacion, Totales } from "../lib/cotizacion";
import { formatoMoneda } from "../lib/pricing";
import { LineaRow } from "./LineaRow";
import { ClienteModal } from "./ClienteModal";

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
}

export function CotizacionPanel(props: Props) {
  const { lineas, totales, monedaPresupuesto, descuento, cliente } = props;
  const [modalAbierto, setModalAbierto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fmt = (n: number) => formatoMoneda(n, monedaPresupuesto);

  const clienteNombreMostrar = cliente.empresa || cliente.nombre || "Sin asignar";

  return (
    <aside className="cotizacion">
      <div className="cot-head">
        <h2>Cotización</h2>
        <span className="cot-count">{lineas.length} ítem{lineas.length === 1 ? "" : "s"}</span>
      </div>

      {/* Resumen del Cliente */}
      <div className="cliente-summary-card">
        <div className="cliente-info">
          <span className="cliente-label">Cliente asignado:</span>
          <span className="cliente-val" title={clienteNombreMostrar}>{clienteNombreMostrar}</span>
        </div>
        <button
          type="button"
          className="btn-edit-cliente"
          onClick={() => setModalAbierto(true)}
          title="Editar datos de cabecera del cliente para el Excel"
        >
          ✏ Datos Cliente
        </button>
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

      <ClienteModal
        abierto={modalAbierto}
        cliente={cliente}
        onGuardar={props.onCliente}
        onCerrar={() => setModalAbierto(false)}
        onDescargarExcel={() => {
          setModalAbierto(false);
          props.onDescargarExcel();
        }}
        cantLineas={lineas.length}
      />
    </aside>
  );
}

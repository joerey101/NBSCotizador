import type { Moneda } from "../lib/types";
import type { LineaCalculada, LineaCotizacion } from "../lib/cotizacion";
import { formatoMoneda } from "../lib/pricing";

interface Props {
  l: LineaCotizacion;
  calc: LineaCalculada;
  monedaPresupuesto: Moneda;
  onCantidad: (uid: string, n: number) => void;
  onPrecio: (uid: string, v: number | null) => void;
  onQuitar: (uid: string) => void;
}

export function LineaRow({ l, calc, monedaPresupuesto, onCantidad, onPrecio, onQuitar }: Props) {
  const editado =
    l.precioUnitarioOriginal != null &&
    l.precioListaOriginal != null &&
    l.precioUnitarioOriginal !== l.precioListaOriginal;

  return (
    <div className={"linea" + (calc.estado !== "ok" ? " linea-pend" : "")}>
      <div className="linea-info">
        <div className="linea-titulo">{l.producto}</div>
        <div className="linea-sub">
          <span className="chip chip-origen-mini">{l.origen}</span>
          {l.marca && <span className="chip chip-marca-mini">{l.marca}</span>}
          <span className="mono">{l.monedaOriginal}</span>
          {l.unidades_por_presentacion > 1 && (
            <span className="pres-info">{l.presentacion}</span>
          )}
        </div>
      </div>

      <div className="linea-controls">
        <label className="ctl">
          Cant.
          <input
            type="number" min={0} step="any" className="in-cant"
            value={l.cantidad}
            onChange={(e) => onCantidad(l.uid, Math.max(0, Number(e.target.value) || 0))}
          />
        </label>

        <label className="ctl">
          P. unit. ({l.monedaOriginal})
          <input
            type="number" min={0} step="any" className="in-precio"
            placeholder="cargar"
            value={l.precioUnitarioOriginal ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onPrecio(l.uid, v === "" ? null : Math.max(0, Number(v) || 0));
            }}
          />
        </label>
      </div>

      <div className="linea-importe">
        {calc.estado === "pendiente_precio" ? (
          <span className="badge-pend">Falta precio</span>
        ) : calc.estado === "falta_tasa" ? (
          <span className="badge-pend">Falta tasa {l.monedaOriginal}</span>
        ) : (
          <span className="imp-val">{formatoMoneda(calc.subtotalPresupuesto!, monedaPresupuesto)}</span>
        )}
        {editado && l.precioListaOriginal != null && (
          <span className="imp-ref" title="Precio de lista original">
            lista {formatoMoneda(l.precioListaOriginal, l.monedaOriginal)}
          </span>
        )}
        <button className="btn-quitar" onClick={() => onQuitar(l.uid)} title="Quitar línea">✕</button>
      </div>
    </div>
  );
}

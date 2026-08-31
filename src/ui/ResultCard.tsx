import type { Moneda, Producto, TipoCambio } from "../lib/types";
import { convertir, formatoMoneda } from "../lib/pricing";

interface Props {
  p: Producto;
  monedaPresupuesto: Moneda;
  tc: TipoCambio;
  onAgregar: (p: Producto) => void;
}

/** Color estable por origen (hash → hue): orígenes parecidos se ven distintos. */
function hueOrigen(origen: string): number {
  let h = 0;
  for (let i = 0; i < origen.length; i++) h = (h * 31 + origen.charCodeAt(i)) % 360;
  return h;
}

export function ResultCard({ p, monedaPresupuesto, tc, onAgregar }: Props) {
  const hue = hueOrigen(p.origen);
  const sinPrecio = p.precio_lista == null;
  const mismaMoneda = p.moneda === monedaPresupuesto;
  const precioPres = sinPrecio ? null : convertir(p.precio_lista, p.moneda, monedaPresupuesto, tc);

  return (
    <article className="card">
      {/* Miniatura del producto — muestra foto o placeholder */}
      <div className="card-img">
        {p.imagen ? (
          <img
            src={p.imagen}
            alt={p.producto}
            className="prod-img"
            loading="lazy"
          />
        ) : (
          <div className="prod-img-placeholder" title="Sin imagen">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
          </div>
        )}
      </div>

      <div className="card-main">
        <div className="card-titulo">
          <span className="producto">{p.producto}</span>
          {p.marca && <span className="chip chip-marca">{p.marca}</span>}
        </div>

        <div className="card-meta">
          <span
            className="chip chip-origen"
            style={{
              background: `hsl(${hue} 70% 92%)`,
              borderColor: `hsl(${hue} 60% 70%)`,
              color: `hsl(${hue} 45% 28%)`,
            }}
            title={`Origen: ${p.origen}`}
          >
            {p.origen}
          </span>
          {p.linea && <span className="chip chip-linea">Línea: {p.linea}</span>}
          <span className="chip chip-pres">{p.presentacion}</span>
          {p.categoria && <span className="chip chip-cat">{p.categoria}</span>}
          <span className="chip chip-moneda">{p.moneda}</span>
        </div>

        <div className="card-foot">
          {p.codigo_origen && <span>Cód: {p.codigo_origen}</span>}
          {p.unidades_por_presentacion > 1 && <span>Se vende en pack de {p.unidades_por_presentacion}</span>}
          {p.vigencia_lista && <span>Lista {p.vigencia_lista}</span>}
        </div>
      </div>

      <div className="card-precio">
        {sinPrecio ? (
          <span className="badge-sinprecio" title="El origen no trae precio: se carga manual al cotizar">
            A cotizar · sin precio de lista
          </span>
        ) : mismaMoneda ? (
          <>
            <div className="precio-orig">{formatoMoneda(p.precio_lista!, p.moneda)}</div>
            <div className="precio-pieza">por pieza</div>
          </>
        ) : precioPres != null ? (
          <>
            <div className="precio-orig">{formatoMoneda(precioPres, monedaPresupuesto)}</div>
            <div className="precio-pieza">por pieza</div>
            <div className="precio-ref">orig. {formatoMoneda(p.precio_lista!, p.moneda)}</div>
          </>
        ) : (
          <>
            <div className="precio-orig">{formatoMoneda(p.precio_lista!, p.moneda)}</div>
            <div className="precio-pieza">por pieza</div>
            <div className="precio-ars sin-tc">cargá tasa {p.moneda} para ver en {monedaPresupuesto}</div>
          </>
        )}
        <button className="btn-agregar" onClick={() => onAgregar(p)}>+ Agregar</button>
      </div>
    </article>
  );
}

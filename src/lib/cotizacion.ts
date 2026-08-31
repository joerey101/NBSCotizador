// Lógica PURA de la cotización: armado de líneas, conversión y totales.
// Sin React. El IVA está PREPARADO pero APAGADO (ver calcularTotales).
import type { Moneda, Producto, TipoCambio } from "./types";
import { convertir } from "./pricing";

export interface LineaCotizacion {
  uid: string;
  productoId: string;
  // snapshot (resiliente a regeneraciones del catálogo / para el export)
  producto: string;
  origen: string;
  marca: string | null;
  codigo_origen: string | null;
  presentacion: string;
  unidades_por_presentacion: number;
  monedaOriginal: Moneda;
  precioListaOriginal: number | null; // referencia (para ver desvío)
  ivaAlicuota: number; // % — preparado para cuando se active el IVA (default 21)
  imagen?: string | null;
  // editable por el vendedor
  cantidad: number; // piezas, LIBRE (no se imponen múltiplos)
  precioUnitarioOriginal: number | null; // en moneda ORIGINAL; null = pendiente
}

export type ModoDescuento = "porcentaje" | "monto";
export interface Descuento {
  modo: ModoDescuento;
  valor: number;
}

export type EstadoLinea = "ok" | "pendiente_precio" | "falta_tasa";

export interface LineaCalculada {
  uid: string;
  estado: EstadoLinea;
  subtotalOriginal: number | null; // en moneda original
  subtotalPresupuesto: number | null; // en moneda del presupuesto
  precioUnitarioPresupuesto: number | null;
}

export interface Totales {
  monedaPresupuesto: Moneda;
  subtotal: number; // en moneda presupuesto (solo líneas OK)
  descuentoMonto: number;
  baseImponible: number; // subtotal - descuento (antes de IVA)
  iva: number; // 0 mientras el hook esté apagado
  total: number;
  porLinea: Record<string, LineaCalculada>;
  nPendientesPrecio: number;
  nFaltaTasa: number;
  avisoDescuento: boolean; // descuento > 30% del subtotal
}

export function nuevoUid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `l_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}

export function crearLinea(p: Producto): LineaCotizacion {
  return {
    uid: nuevoUid(),
    productoId: p.id,
    producto: p.producto,
    origen: p.origen,
    marca: p.marca,
    codigo_origen: p.codigo_origen,
    presentacion: p.presentacion,
    unidades_por_presentacion: p.unidades_por_presentacion,
    monedaOriginal: p.moneda,
    precioListaOriginal: p.precio_lista,
    ivaAlicuota: 21,
    imagen: p.imagen ?? null,
    cantidad: 1,
    precioUnitarioOriginal: p.precio_lista, // null si el ítem no trae precio
  };
}

const IVA_ACTIVO = false; // HOOK: cambiar a true cuando facturación confirme.

export function calcularTotales(
  lineas: LineaCotizacion[],
  descuento: Descuento,
  monedaPresupuesto: Moneda,
  tc: TipoCambio
): Totales {
  const porLinea: Record<string, LineaCalculada> = {};
  let subtotal = 0;
  let nPendientesPrecio = 0;
  let nFaltaTasa = 0;
  // base ponderada de IVA (para cuando se active): suma de subtotales * alicuota
  let ivaAcum = 0;

  for (const l of lineas) {
    let estado: EstadoLinea = "ok";
    let subOrig: number | null = null;
    let subPres: number | null = null;
    let puPres: number | null = null;

    if (l.precioUnitarioOriginal == null) {
      estado = "pendiente_precio";
      nPendientesPrecio++;
    } else {
      subOrig = l.precioUnitarioOriginal * l.cantidad;
      subPres = convertir(subOrig, l.monedaOriginal, monedaPresupuesto, tc);
      puPres = convertir(l.precioUnitarioOriginal, l.monedaOriginal, monedaPresupuesto, tc);
      if (subPres == null) {
        estado = "falta_tasa";
        nFaltaTasa++;
      } else {
        subtotal += subPres;
        ivaAcum += subPres * (l.ivaAlicuota / 100);
      }
    }
    porLinea[l.uid] = {
      uid: l.uid,
      estado,
      subtotalOriginal: subOrig,
      subtotalPresupuesto: subPres,
      precioUnitarioPresupuesto: puPres,
    };
  }

  const descuentoMonto =
    descuento.modo === "porcentaje"
      ? subtotal * (descuento.valor / 100)
      : Math.min(descuento.valor, subtotal); // monto fijo no supera el subtotal

  const baseImponible = subtotal - descuentoMonto;
  // IVA proporcional al descuento (descuento ANTES de IVA)
  const factor = subtotal > 0 ? baseImponible / subtotal : 0;
  const iva = IVA_ACTIVO ? ivaAcum * factor : 0;
  const total = baseImponible + iva;

  const avisoDescuento = subtotal > 0 && descuentoMonto / subtotal > 0.3;

  return {
    monedaPresupuesto,
    subtotal,
    descuentoMonto,
    baseImponible,
    iva,
    total,
    porLinea,
    nPendientesPrecio,
    nFaltaTasa,
    avisoDescuento,
  };
}

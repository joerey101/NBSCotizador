// Presupuestos guardados en Supabase (migración 004). El número COT-NNNN lo pone la base
// y no cambia al editar. Cabecera + renglones se guardan juntos (rpc guardar_cotizacion).
import type { DatosCliente, Moneda, Producto, TipoCambio } from "./types";
import { nuevoUid, type Descuento, type LineaCotizacion, type Totales } from "./cotizacion";
import { mensajeError } from "./clientes";
import { supabase } from "./supabase";

export type EstadoPresupuesto = "borrador" | "enviada" | "aprobada";

export const ESTADO_LABELS: Record<EstadoPresupuesto, string> = {
  borrador: "Borrador",
  enviada: "Enviado",
  aprobada: "Aprobado",
};

/** Lo que el cotizador recuerda del presupuesto abierto (vínculo con la base). */
export interface PresupuestoAbierto {
  id: string;
  numero: string;
  titulo: string | null;
  estado: EstadoPresupuesto;
}

export interface PresupuestoFila {
  id: string;
  numero: string;
  titulo: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  moneda: Moneda;
  total: number | null;
  items_pendientes: number;
  estado: EstadoPresupuesto;
  fecha: string;
  actualizado_en: string;
}

/** Todo lo necesario para volver a abrir un presupuesto en el cotizador. */
export interface PresupuestoCompleto {
  abierto: PresupuestoAbierto;
  clienteId: string | null;
  cliente: DatosCliente;
  monedaPresupuesto: Moneda;
  tasas: TipoCambio;
  descuento: Descuento;
  lineas: LineaCotizacion[];
}

function db() {
  if (!supabase) throw new Error("La app no está conectada a Supabase.");
  return supabase;
}

/** Total en ARS con los tipos de cambio DEL presupuesto (embudo y comisiones van en ARS). */
export function totalEnArs(total: number, moneda: Moneda, tc: TipoCambio): number | null {
  if (moneda === "ARS") return total;
  const tasa = moneda === "USD" ? tc.USD_ARS : tc.EUR_ARS;
  return tasa ? Math.round(total * tasa * 100) / 100 : null;
}

interface DatosGuardar {
  id?: string;
  titulo: string;
  clienteId: string;
  cliente: DatosCliente;
  monedaPresupuesto: Moneda;
  tasas: TipoCambio;
  descuento: Descuento;
  lineas: LineaCotizacion[];
  totales: Totales;
}

export async function guardarPresupuesto(d: DatosGuardar): Promise<PresupuestoAbierto> {
  const c = d.cliente;
  const cab = {
    id: d.id ?? null,
    titulo: d.titulo,
    cliente_id: d.clienteId,
    cliente_nombre: c.empresa || c.nombre || null,
    cliente_contacto: c.empresa ? c.nombre || null : null,
    cliente_cuit: c.cuit || null,
    cliente_email: c.email || null,
    cliente_telefono: c.telefono || null,
    cliente_direccion: c.direccion || null,
    vendedor_nombre: c.vendedor || null,
    moneda: d.monedaPresupuesto,
    tc_usd_ars: d.tasas.USD_ARS,
    tc_eur_ars: d.tasas.EUR_ARS,
    tc_fecha: d.tasas.fecha,
    descuento_modo: d.descuento.modo,
    descuento_valor: d.descuento.valor,
    subtotal: d.totales.subtotal,
    descuento_monto: d.totales.descuentoMonto,
    total: d.totales.total,
    total_ars: totalEnArs(d.totales.total, d.monedaPresupuesto, d.tasas),
    items_pendientes: d.totales.nPendientesPrecio,
    validez: c.validez || null,
    condiciones_pago: c.condicionesPago || null,
    tiempo_entrega: c.tiempoEntrega || null,
    lugar_entrega: c.lugarEntrega || null,
    observaciones: c.observaciones || null,
    fecha: c.fecha || null,
  };
  const items = d.lineas.map((l) => ({
    producto_id: l.productoId,
    origen: l.origen,
    marca: l.marca,
    codigo_origen: l.codigo_origen,
    descripcion: l.producto,
    presentacion: l.presentacion,
    unidades_por_presentacion: l.unidades_por_presentacion,
    moneda_original: l.monedaOriginal,
    precio_lista_original: l.precioListaOriginal,
    precio_unitario: l.precioUnitarioOriginal,
    cantidad: l.cantidad,
    iva_alicuota: l.ivaAlicuota,
  }));

  const { data, error } = await db().rpc("guardar_cotizacion", { p_cab: cab, p_items: items });
  if (error) throw new Error(mensajeError(error));
  const r = data as { id: string; numero: string };

  // el estado no lo toca el guardado; se lee para devolverlo actualizado
  const { data: est } = await db().from("cotizaciones").select("estado").eq("id", r.id).single();
  return { id: r.id, numero: r.numero, titulo: d.titulo, estado: (est?.estado as EstadoPresupuesto) ?? "borrador" };
}

export async function cambiarEstado(id: string, estado: EstadoPresupuesto): Promise<void> {
  const { error } = await db().from("cotizaciones").update({ estado }).eq("id", id);
  if (error) throw new Error(mensajeError(error));
}

const COLS_LISTA = "id, numero, titulo, cliente_id, cliente_nombre, moneda, total, items_pendientes, estado, fecha, actualizado_en";

export async function listarPresupuestos(opc: {
  texto?: string;
  estado?: EstadoPresupuesto | "";
  clienteId?: string;
  limite?: number;
}): Promise<PresupuestoFila[]> {
  let q = db()
    .from("cotizaciones")
    .select(COLS_LISTA)
    .order("creado_en", { ascending: false })
    .limit(opc.limite ?? 100);
  if (opc.estado) q = q.eq("estado", opc.estado);
  if (opc.clienteId) q = q.eq("cliente_id", opc.clienteId);
  const t = (opc.texto ?? "").trim().replace(/[,()*%]/g, " ").trim();
  if (t) q = q.or(`numero.ilike.*${t}*,titulo.ilike.*${t}*,cliente_nombre.ilike.*${t}*`);
  const { data, error } = await q;
  if (error) throw new Error(mensajeError(error));
  return (data ?? []) as PresupuestoFila[];
}

/** Trae cabecera + renglones y los arma como los usa el cotizador.
 *  Las fotos no se guardan en la base: se toman del catálogo por producto_id. */
export async function abrirPresupuesto(id: string, porId: Map<string, Producto>): Promise<PresupuestoCompleto> {
  const [{ data: cab, error: e1 }, { data: items, error: e2 }] = await Promise.all([
    db().from("cotizaciones").select("*").eq("id", id).single(),
    db().from("cotizacion_items").select("*").eq("cotizacion_id", id).order("orden"),
  ]);
  if (e1) throw new Error(mensajeError(e1));
  if (e2) throw new Error(mensajeError(e2));

  const tieneEmpresa = !!cab.cliente_contacto;
  const lineas: LineaCotizacion[] = (items ?? []).map((it) => ({
    uid: nuevoUid(),
    productoId: it.producto_id ?? "",
    producto: it.descripcion,
    origen: it.origen ?? "",
    marca: it.marca,
    codigo_origen: it.codigo_origen,
    presentacion: it.presentacion ?? "Unidad",
    unidades_por_presentacion: it.unidades_por_presentacion ?? 1,
    monedaOriginal: it.moneda_original,
    precioListaOriginal: it.precio_lista_original,
    ivaAlicuota: Number(it.iva_alicuota ?? 21),
    imagen: (it.producto_id && porId.get(it.producto_id)?.imagen) || null,
    cantidad: Number(it.cantidad),
    precioUnitarioOriginal: it.precio_unitario,
  }));

  return {
    abierto: { id: cab.id, numero: cab.numero, titulo: cab.titulo, estado: cab.estado },
    clienteId: cab.cliente_id,
    cliente: {
      empresa: tieneEmpresa ? cab.cliente_nombre ?? "" : "",
      nombre: tieneEmpresa ? cab.cliente_contacto ?? "" : cab.cliente_nombre ?? "",
      cuit: cab.cliente_cuit ?? "",
      email: cab.cliente_email ?? "",
      telefono: cab.cliente_telefono ?? "",
      direccion: cab.cliente_direccion ?? "",
      vendedor: cab.vendedor_nombre ?? "",
      fecha: cab.fecha ?? "",
      validez: cab.validez ?? "",
      condicionesPago: cab.condiciones_pago ?? "",
      tiempoEntrega: cab.tiempo_entrega ?? "",
      lugarEntrega: cab.lugar_entrega ?? "",
      observaciones: cab.observaciones ?? "",
    },
    monedaPresupuesto: cab.moneda,
    tasas: { USD_ARS: cab.tc_usd_ars, EUR_ARS: cab.tc_eur_ars, fecha: cab.tc_fecha },
    descuento: { modo: cab.descuento_modo, valor: Number(cab.descuento_valor ?? 0) },
    lineas,
  };
}

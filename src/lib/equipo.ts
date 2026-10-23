// Equipo de ventas y comisiones (migración 006). La comisión se calcula en vivo en la base
// (comisiones_detalle): total neto en ARS × % del vendedor (o reparto). Se devenga al
// marcar la venta cobrada. Cada vendedor ve solo lo suyo; el admin, todo.
import { mensajeError } from "./clientes";
import { supabase } from "./supabase";

export interface Vendedor {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  cargo: string | null;
  comision_pct: number;
  activo: boolean;
  notas: string | null;
}

export type VendedorEditable = Omit<Vendedor, "id">;

export const VENDEDOR_VACIO: VendedorEditable = {
  nombre: "",
  apellido: null,
  email: null,
  telefono: null,
  cargo: null,
  comision_pct: 0,
  activo: true,
  notas: null,
};

export interface ComisionFila {
  oportunidad_id: string;
  oportunidad: string;
  cliente_id: string;
  cliente: string;
  numero: string | null;
  vendedor_id: string;
  vendedor: string;
  base_ars: number;
  porcentaje: number;
  comision: number;
  cobrada: boolean;
  fecha_cobro: string | null;
  fecha_ganada: string;
}

export type TipoMovimiento = "pago" | "consumo" | "ajuste";
export const TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  pago: "Pago",
  consumo: "Consumo de mercadería",
  ajuste: "Ajuste",
};

export interface MovimientoComision {
  id: string;
  vendedor_id: string;
  fecha: string;
  tipo: TipoMovimiento;
  monto: number;
  descripcion: string | null;
  comprobante: string | null;
  anulado: boolean;
}

export interface RepartoFila {
  vendedor_id: string;
  porcentaje: number;
}

function db() {
  if (!supabase) throw new Error("La app no está conectada a Supabase.");
  return supabase;
}

export const nombreVendedor = (v: Pick<Vendedor, "nombre" | "apellido">) => [v.nombre, v.apellido].filter(Boolean).join(" ");

export async function listarVendedores(incluirInactivos = false): Promise<Vendedor[]> {
  let q = db().from("vendedores").select("*").order("nombre");
  if (!incluirInactivos) q = q.eq("activo", true);
  const { data, error } = await q;
  if (error) throw new Error(mensajeError(error));
  return (data ?? []) as Vendedor[];
}

export async function guardarVendedor(v: VendedorEditable, id?: string): Promise<void> {
  const datos = { ...v, email: v.email?.trim() || null, comision_pct: Number(v.comision_pct) || 0 };
  const { error } = id
    ? await db().from("vendedores").update(datos).eq("id", id)
    : await db().from("vendedores").insert(datos);
  if (error) {
    if (error.code === "23505") throw new Error("Ya hay un vendedor con ese email.");
    throw new Error(mensajeError(error));
  }
}

export async function miVendedorId(): Promise<string | null> {
  const { data, error } = await db().rpc("mi_vendedor_id");
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function comisionesDetalle(): Promise<ComisionFila[]> {
  const { data, error } = await db().rpc("comisiones_detalle");
  if (error) throw new Error(mensajeError(error));
  return ((data ?? []) as ComisionFila[]).map((f) => ({
    ...f,
    base_ars: Number(f.base_ars),
    porcentaje: Number(f.porcentaje),
    comision: Number(f.comision),
  }));
}

export async function listarMovimientos(vendedorId?: string): Promise<MovimientoComision[]> {
  let q = db().from("comision_movimientos").select("*").order("fecha", { ascending: false }).order("creado_en", { ascending: false });
  if (vendedorId) q = q.eq("vendedor_id", vendedorId);
  const { data, error } = await q;
  if (error) throw new Error(mensajeError(error));
  return ((data ?? []) as MovimientoComision[]).map((m) => ({ ...m, monto: Number(m.monto) }));
}

export async function crearMovimiento(m: Omit<MovimientoComision, "id" | "anulado">): Promise<void> {
  const { error } = await db().from("comision_movimientos").insert(m);
  if (error) throw new Error(mensajeError(error));
}

export async function anularMovimiento(id: string): Promise<void> {
  const { error } = await db().from("comision_movimientos").update({ anulado: true }).eq("id", id);
  if (error) throw new Error(mensajeError(error));
}

/** Efecto en el saldo del vendedor: pagos y consumos restan; el ajuste va con su signo. */
export function efectoEnSaldo(m: Pick<MovimientoComision, "tipo" | "monto" | "anulado">): number {
  if (m.anulado) return 0;
  return m.tipo === "ajuste" ? m.monto : -Math.abs(m.monto);
}

export async function listarReparto(oportunidadId: string): Promise<RepartoFila[]> {
  const { data, error } = await db().from("comision_reparto").select("vendedor_id, porcentaje").eq("oportunidad_id", oportunidadId);
  if (error) throw new Error(mensajeError(error));
  return ((data ?? []) as RepartoFila[]).map((r) => ({ ...r, porcentaje: Number(r.porcentaje) }));
}

/** Reemplaza el reparto de la oportunidad (vacío = todo al vendedor con su %). */
export async function guardarReparto(oportunidadId: string, filas: RepartoFila[]): Promise<void> {
  const { error: e1 } = await db().from("comision_reparto").delete().eq("oportunidad_id", oportunidadId);
  if (e1) throw new Error(mensajeError(e1));
  const validas = filas.filter((f) => f.vendedor_id && f.porcentaje > 0);
  if (!validas.length) return;
  const { error } = await db()
    .from("comision_reparto")
    .insert(validas.map((f) => ({ oportunidad_id: oportunidadId, vendedor_id: f.vendedor_id, porcentaje: f.porcentaje })));
  if (error) throw new Error(mensajeError(error));
}

export async function asignarVendedor(tabla: "clientes" | "cotizaciones" | "oportunidades", id: string, vendedorId: string | null) {
  const { error } = await db().from(tabla).update({ vendedor_id: vendedorId }).eq("id", id);
  if (error) throw new Error(mensajeError(error));
}

export async function marcarCobrada(oportunidadId: string, cobrada: boolean, fecha: string | null): Promise<void> {
  const { error } = await db()
    .from("oportunidades")
    .update({ cobrada, fecha_cobro: cobrada ? fecha || new Date().toISOString().slice(0, 10) : null })
    .eq("id", oportunidadId);
  if (error) throw new Error(mensajeError(error));
}

/** "2026-10" → "octubre 2026" */
export function nombreMes(ym: string): string {
  const [a, m] = ym.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

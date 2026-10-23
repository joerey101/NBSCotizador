// Stock propio, escáner y pedidos (migración 007). El stock sale de movimientos_stock
// (nunca se borran: anular crea el inverso). El depósito nunca recibe precios: los ítems
// de pedido se leen con items_de_pedido(), que no los devuelve.
import { catalogo } from "../data/catalogo";
import type { Producto } from "./types";
import { mensajeError } from "./clientes";
import { supabase } from "./supabase";

export const TIPOS_MOVIMIENTO = [
  { id: "entrada", nombre: "Entrada", signo: 1 },
  { id: "salida", nombre: "Salida", signo: -1 },
  { id: "ajuste_positivo", nombre: "Ajuste +", signo: 1 },
  { id: "ajuste_negativo", nombre: "Ajuste −", signo: -1 },
  { id: "devolucion", nombre: "Devolución", signo: 1 },
  { id: "muestra_salida", nombre: "Muestra (sale)", signo: -1 },
  { id: "muestra_retorno", nombre: "Muestra (vuelve)", signo: 1 },
] as const;
export type TipoMovimientoStock = (typeof TIPOS_MOVIMIENTO)[number]["id"];
export const NOMBRE_TIPO = Object.fromEntries(TIPOS_MOVIMIENTO.map((t) => [t.id, t.nombre])) as Record<TipoMovimientoStock, string>;
export const SIGNO = Object.fromEntries(TIPOS_MOVIMIENTO.map((t) => [t.id, t.signo])) as Record<TipoMovimientoStock, 1 | -1>;

export interface Deposito {
  id: string;
  codigo: string;
  nombre: string;
}

export interface MovimientoStock {
  id: string;
  producto_id: string;
  descripcion: string | null;
  codigo: string | null;
  deposito_id: string;
  tipo: TipoMovimientoStock;
  cantidad: number;
  motivo: string | null;
  referencia_tipo: string | null;
  anulado: boolean;
  creado_en: string;
}

export interface StockFila {
  producto_id: string;
  deposito_id: string;
  descripcion: string | null;
  cantidad: number;
  ultimo_movimiento: string;
}

export const ESTADOS_PEDIDO = [
  { id: "pendiente", nombre: "Pendiente" },
  { id: "confirmado", nombre: "Confirmado" },
  { id: "en_preparacion", nombre: "En preparación" },
  { id: "despachado", nombre: "Despachado" },
  { id: "entregado", nombre: "Entregado" },
  { id: "cancelado", nombre: "Cancelado" },
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number]["id"];
export const NOMBRE_ESTADO_PEDIDO = Object.fromEntries(ESTADOS_PEDIDO.map((e) => [e.id, e.nombre])) as Record<EstadoPedido, string>;

export interface Pedido {
  id: string;
  numero: string;
  cotizacion_id: string | null;
  cotizacion_numero: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  estado: EstadoPedido;
  fecha_pedido: string;
  fecha_entrega: string | null;
  deposito_id: string | null;
  notas: string | null;
}

export interface ItemPedido {
  id: string;
  orden: number;
  producto_id: string | null;
  codigo_origen: string | null;
  descripcion: string;
  cantidad: number;
  cantidad_picking: number;
}

function db() {
  if (!supabase) throw new Error("La app no está conectada a Supabase.");
  return supabase;
}

// ---------- catálogo (búsqueda local por código o id) ----------

const porId = new Map(catalogo.productos.map((p) => [p.id, p]));
const norm = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
let porCodigo: Map<string, Producto[]> | null = null;

export function productoPorId(id: string | null | undefined): Producto | undefined {
  return id ? porId.get(id) : undefined;
}

/** Productos del catálogo cuyo código de proveedor coincide con lo escaneado. */
export function buscarPorCodigoProveedor(codigo: string): Producto[] {
  if (!porCodigo) {
    porCodigo = new Map();
    for (const p of catalogo.productos) {
      if (!p.codigo_origen) continue;
      const k = norm(p.codigo_origen);
      porCodigo.set(k, [...(porCodigo.get(k) ?? []), p]);
    }
  }
  const k = norm(codigo);
  return porCodigo.get(k) ?? (porId.has(codigo.trim()) ? [porId.get(codigo.trim())!] : []);
}

/** Búsqueda simple por texto en el catálogo (para vincular un código desconocido). */
export function buscarEnCatalogo(texto: string, limite = 30): Producto[] {
  const palabras = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!palabras.length) return [];
  const r: Producto[] = [];
  for (const p of catalogo.productos) {
    const t = `${p.producto} ${p.origen} ${p.codigo_origen ?? ""} ${p.linea ?? ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (palabras.every((w) => t.includes(w))) {
      r.push(p);
      if (r.length >= limite) break;
    }
  }
  return r;
}

// ---------- base ----------

export async function listarDepositos(): Promise<Deposito[]> {
  const { data, error } = await db().from("depositos").select("id, codigo, nombre").eq("activo", true).order("codigo");
  if (error) throw new Error(mensajeError(error));
  return (data ?? []) as Deposito[];
}

/** Resuelve un código escaneado: primero los aprendidos, después el código del proveedor. */
export async function resolverCodigo(codigo: string): Promise<Producto[]> {
  const c = codigo.trim();
  if (!c) return [];
  const { data } = await db().from("codigos_barra").select("producto_id").eq("codigo", c).maybeSingle();
  const aprendido = productoPorId(data?.producto_id);
  if (aprendido) return [aprendido];
  return buscarPorCodigoProveedor(c);
}

export async function aprenderCodigo(codigo: string, p: Producto): Promise<void> {
  const { error } = await db()
    .from("codigos_barra")
    .upsert({ codigo: codigo.trim(), producto_id: p.id, descripcion: p.producto });
  if (error) throw new Error(mensajeError(error));
}

export async function registrarMovimiento(m: {
  producto: Producto;
  codigo: string | null;
  deposito_id: string;
  tipo: TipoMovimientoStock;
  cantidad: number;
  motivo: string | null;
}): Promise<void> {
  const { error } = await db().from("movimientos_stock").insert({
    producto_id: m.producto.id,
    descripcion: m.producto.producto,
    codigo: m.codigo || m.producto.codigo_origen,
    deposito_id: m.deposito_id,
    tipo: m.tipo,
    cantidad: m.cantidad,
    motivo: m.motivo,
    referencia_tipo: m.codigo ? "escaner" : "manual",
  });
  if (error) throw new Error(mensajeError(error));
}

export async function ultimosMovimientos(limite = 30): Promise<MovimientoStock[]> {
  const { data, error } = await db().from("movimientos_stock").select("*").order("creado_en", { ascending: false }).limit(limite);
  if (error) throw new Error(mensajeError(error));
  return ((data ?? []) as MovimientoStock[]).map((m) => ({ ...m, cantidad: Number(m.cantidad) }));
}

export async function anularMovimiento(id: string): Promise<void> {
  const { error } = await db().rpc("anular_movimiento", { p_mov: id });
  if (error) throw new Error(mensajeError(error));
}

export async function listarStock(): Promise<StockFila[]> {
  const { data, error } = await db().from("stock_disponible").select("*").order("descripcion");
  if (error) throw new Error(mensajeError(error));
  return ((data ?? []) as StockFila[]).map((s) => ({ ...s, cantidad: Number(s.cantidad) }));
}

export async function listarPedidos(estado?: EstadoPedido | ""): Promise<Pedido[]> {
  let q = db().from("pedidos").select("*").order("creado_en", { ascending: false }).limit(200);
  if (estado) q = q.eq("estado", estado);
  const { data, error } = await q;
  if (error) throw new Error(mensajeError(error));
  return (data ?? []) as Pedido[];
}

export async function obtenerPedido(id: string): Promise<{ pedido: Pedido; items: ItemPedido[] }> {
  const [{ data: p, error: e1 }, { data: it, error: e2 }] = await Promise.all([
    db().from("pedidos").select("*").eq("id", id).single(),
    db().rpc("items_de_pedido", { p_pedido: id }),
  ]);
  if (e1) throw new Error(mensajeError(e1));
  if (e2) throw new Error(mensajeError(e2));
  return {
    pedido: p as Pedido,
    items: ((it ?? []) as ItemPedido[]).map((i) => ({ ...i, cantidad: Number(i.cantidad), cantidad_picking: Number(i.cantidad_picking) })),
  };
}

export async function marcarPicking(itemId: string, cantidad: number): Promise<void> {
  const { error } = await db().rpc("marcar_picking", { p_item: itemId, p_cantidad: cantidad });
  if (error) throw new Error(mensajeError(error));
}

export async function cambiarEstadoPedido(id: string, estado: EstadoPedido): Promise<void> {
  const { error } = await db().rpc("cambiar_estado_pedido", { p_pedido: id, p_estado: estado });
  if (error) throw new Error(mensajeError(error));
}

export async function actualizarPedido(id: string, d: Partial<Pick<Pedido, "fecha_entrega" | "notas">>): Promise<void> {
  const { error } = await db().from("pedidos").update(d).eq("id", id);
  if (error) throw new Error(mensajeError(error));
}

export async function crearPedidoDesdePresupuesto(cotizacionId: string): Promise<{ id: string; numero: string; existente: boolean }> {
  const { data, error } = await db().rpc("crear_pedido_desde_cotizacion", { p_cot: cotizacionId });
  if (error) throw new Error(mensajeError(error));
  return data as { id: string; numero: string; existente: boolean };
}

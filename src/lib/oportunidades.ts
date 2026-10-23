// Embudo de ventas (oportunidades) y actividades (migración 005). El embudo automático
// (lead al dar de alta un cliente, presupuesto guardado/aprobado) lo hace la base; acá se
// leen y se editan a mano. Montos SIEMPRE en ARS.
import { mensajeError } from "./clientes";
import { supabase } from "./supabase";

export const ETAPAS = [
  { id: "nuevo", nombre: "Nuevo", prob: 10 },
  { id: "contactado", nombre: "Contactado", prob: 20 },
  { id: "relevamiento", nombre: "Relevamiento", prob: 30 },
  { id: "presupuesto", nombre: "Presupuesto", prob: 40 },
  { id: "negociacion", nombre: "Negociación", prob: 60 },
  { id: "ganado", nombre: "Ganado", prob: 100 },
  { id: "perdido", nombre: "Perdido", prob: 0 },
] as const;

export type Etapa = (typeof ETAPAS)[number]["id"];
export const NOMBRE_ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.id, e.nombre])) as Record<Etapa, string>;

export interface Oportunidad {
  id: string;
  cliente_id: string;
  contacto_id: string | null;
  cotizacion_id: string | null;
  nombre: string;
  etapa: Etapa;
  monto_estimado: number | null;
  probabilidad: number | null;
  fecha_estimada_cierre: string | null;
  proxima_accion: string | null;
  fecha_proxima_accion: string | null;
  observaciones: string | null;
  motivo_perdida: string | null;
  cobrada: boolean;
  fecha_cobro: string | null;
  vendedor_id: string | null;
  creado_en: string;
  actualizado_en: string;
  // relaciones (para mostrar)
  clientes?: { razon_social: string } | null;
  cotizaciones?: { numero: string; estado: string } | null;
}

export type OportunidadEditable = Pick<
  Oportunidad,
  | "nombre"
  | "etapa"
  | "monto_estimado"
  | "probabilidad"
  | "fecha_estimada_cierre"
  | "proxima_accion"
  | "fecha_proxima_accion"
  | "observaciones"
  | "motivo_perdida"
>;

export const TIPOS_ACTIVIDAD = [
  { id: "llamada", nombre: "Llamada", icono: "📞" },
  { id: "reunion", nombre: "Reunión", icono: "🤝" },
  { id: "email", nombre: "Email", icono: "✉️" },
  { id: "whatsapp", nombre: "WhatsApp", icono: "💬" },
  { id: "nota", nombre: "Nota", icono: "📝" },
] as const;
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number]["id"] | "sistema";
export const ICONO_ACTIVIDAD: Record<TipoActividad, string> = {
  llamada: "📞",
  reunion: "🤝",
  email: "✉️",
  whatsapp: "💬",
  nota: "📝",
  sistema: "⚙️",
};

export interface Actividad {
  id: string;
  cliente_id: string;
  oportunidad_id: string | null;
  tipo: TipoActividad;
  titulo: string;
  descripcion: string | null;
  fecha_programada: string | null;
  fecha_realizada: string | null;
  completada: boolean;
  creado_en: string;
}

function db() {
  if (!supabase) throw new Error("La app no está conectada a Supabase.");
  return supabase;
}

const COLS = "*, clientes(razon_social), cotizaciones(numero, estado)";

export async function listarOportunidades(opc: { clienteId?: string } = {}): Promise<Oportunidad[]> {
  let q = db().from("oportunidades").select(COLS).order("actualizado_en", { ascending: false }).limit(500);
  if (opc.clienteId) q = q.eq("cliente_id", opc.clienteId);
  const { data, error } = await q;
  if (error) throw new Error(mensajeError(error));
  return (data ?? []) as Oportunidad[];
}

export async function obtenerOportunidad(id: string): Promise<Oportunidad> {
  const { data, error } = await db().from("oportunidades").select(COLS).eq("id", id).single();
  if (error) throw new Error(mensajeError(error));
  return data as Oportunidad;
}

/** Mover de etapa: la probabilidad la ajusta la base según la etapa nueva. */
export async function moverEtapa(id: string, etapa: Etapa): Promise<void> {
  const { error } = await db().from("oportunidades").update({ etapa }).eq("id", id);
  if (error) throw new Error(mensajeError(error));
}

export async function actualizarOportunidad(id: string, d: Partial<OportunidadEditable>): Promise<void> {
  const limpio = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === "" ? null : v]));
  const { error } = await db().from("oportunidades").update(limpio).eq("id", id);
  if (error) throw new Error(mensajeError(error));
}

export async function crearOportunidad(clienteId: string, nombre: string, monto: number | null): Promise<Oportunidad> {
  const { data, error } = await db()
    .from("oportunidades")
    .insert({ cliente_id: clienteId, nombre, monto_estimado: monto, etapa: "nuevo" })
    .select(COLS)
    .single();
  if (error) throw new Error(mensajeError(error));
  return data as Oportunidad;
}

export async function listarActividades(opc: { clienteId?: string; oportunidadId?: string }): Promise<Actividad[]> {
  let q = db().from("actividades").select("*").order("creado_en", { ascending: false }).limit(200);
  if (opc.clienteId) q = q.eq("cliente_id", opc.clienteId);
  if (opc.oportunidadId) q = q.eq("oportunidad_id", opc.oportunidadId);
  const { data, error } = await q;
  if (error) throw new Error(mensajeError(error));
  return (data ?? []) as Actividad[];
}

export interface NuevaActividad {
  cliente_id: string;
  oportunidad_id?: string | null;
  tipo: TipoActividad;
  titulo: string;
  descripcion?: string | null;
  /** con fecha futura queda pendiente; sin fecha se registra como hecha ahora */
  fecha_programada?: string | null;
}

export async function crearActividad(a: NuevaActividad): Promise<void> {
  const pendiente = !!a.fecha_programada;
  const { error } = await db()
    .from("actividades")
    .insert({
      ...a,
      descripcion: a.descripcion?.trim() || null,
      fecha_programada: a.fecha_programada || null,
      completada: !pendiente,
      fecha_realizada: pendiente ? null : new Date().toISOString(),
    });
  if (error) throw new Error(mensajeError(error));
}

export async function completarActividad(id: string): Promise<void> {
  const { error } = await db()
    .from("actividades")
    .update({ completada: true, fecha_realizada: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(mensajeError(error));
}

export async function borrarActividad(id: string): Promise<void> {
  const { error } = await db().from("actividades").delete().eq("id", id);
  if (error) throw new Error(mensajeError(error));
}

export function formatoPesos(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$ " + Math.round(n).toLocaleString("es-AR");
}

export function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Próxima acción vencida (fecha anterior a hoy) en una oportunidad abierta. */
export function accionVencida(o: Pick<Oportunidad, "fecha_proxima_accion" | "etapa">): boolean {
  if (!o.fecha_proxima_accion || o.etapa === "ganado" || o.etapa === "perdido") return false;
  return o.fecha_proxima_accion < new Date().toISOString().slice(0, 10);
}

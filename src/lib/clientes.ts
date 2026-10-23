// Clientes y contactos (Supabase). La seguridad está en la base (RLS, migración 003):
// admin y vendedor leen/crean/editan; solo admin borra. El CUIT lo normaliza la base.
import { supabase } from "./supabase";

export const TIPOS_CLIENTE = ["empresa", "particular", "hotel", "restaurante", "catering", "otro"] as const;
export type TipoCliente = (typeof TIPOS_CLIENTE)[number];

export interface Cliente {
  id: string;
  razon_social: string;
  nombre_comercial: string | null;
  cuit: string | null;
  tipo: TipoCliente;
  segmento: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  notas: string | null;
  vendedor_id: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export type ClienteEditable = Omit<Cliente, "id" | "activo" | "creado_en" | "actualizado_en">;

export interface Contacto {
  id: string;
  cliente_id: string;
  nombre: string;
  apellido: string | null;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  es_principal: boolean;
  activo: boolean;
  notas: string | null;
}

export type ContactoEditable = Omit<Contacto, "id" | "cliente_id" | "activo">;

export const CLIENTE_VACIO: ClienteEditable = {
  razon_social: "",
  nombre_comercial: null,
  cuit: null,
  tipo: "empresa",
  segmento: null,
  email: null,
  telefono: null,
  direccion: null,
  ciudad: null,
  provincia: null,
  pais: "Argentina",
  notas: null,
  vendedor_id: null,
};

export const CONTACTO_VACIO: ContactoEditable = {
  nombre: "",
  apellido: null,
  cargo: null,
  email: null,
  telefono: null,
  es_principal: false,
  notas: null,
};

function db() {
  if (!supabase) throw new Error("La app no está conectada a Supabase.");
  return supabase;
}

/** Textos vacíos → null (en la base, el CUIT '' chocaría con la restricción de único). */
function limpiar<T extends Record<string, unknown>>(o: T): T {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) r[k] = typeof v === "string" ? v.trim() || null : v;
  return r as T;
}

/** Mensajes de la base en castellano. */
export function mensajeError(e: { code?: string; message: string }): string {
  if (e.code === "23505" && /cuit/i.test(e.message)) return "Ya existe un cliente con ese CUIT.";
  if (e.code === "23505" && /principal/i.test(e.message)) return "El cliente ya tiene otro contacto principal.";
  if (e.code === "42501" || /row-level security/i.test(e.message)) return "Tu usuario no tiene permiso para esto.";
  if (/fetch|network/i.test(e.message)) return "No hay conexión. Los clientes necesitan internet.";
  return e.message;
}

/** Dígito verificador del CUIT (solo para avisar; no bloquea: hay casos raros y extranjeros). */
export function cuitValido(cuit: string): boolean {
  const d = cuit.replace(/\D/g, "");
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return dv === Number(d[10]);
}

const COLS_LISTA = "id, razon_social, nombre_comercial, cuit, tipo, ciudad, telefono, email, activo";
export type ClienteFila = Pick<
  Cliente,
  "id" | "razon_social" | "nombre_comercial" | "cuit" | "tipo" | "ciudad" | "telefono" | "email" | "activo"
>;

/** Busca por razón social, nombre comercial o CUIT (sin distinguir mayúsculas). */
export async function buscarClientes(texto: string, incluirInactivos: boolean, limite = 100): Promise<ClienteFila[]> {
  let q = db().from("clientes").select(COLS_LISTA).order("razon_social").limit(limite);
  if (!incluirInactivos) q = q.eq("activo", true);
  // las comas y paréntesis rompen el filtro "or" de la API
  const t = texto.trim().replace(/[,()*%]/g, " ").trim();
  if (t) {
    const digitos = t.replace(/\D/g, "");
    const filtros = [`razon_social.ilike.*${t}*`, `nombre_comercial.ilike.*${t}*`, `cuit.ilike.*${t}*`];
    // "20123456789" encuentra "20-12345678-9"
    if (digitos.length >= 8) filtros.push(`cuit.ilike.*${digitos.split("").join("*")}*`);
    q = q.or(filtros.join(","));
  }
  const { data, error } = await q;
  if (error) throw new Error(mensajeError(error));
  return (data ?? []) as ClienteFila[];
}

export async function obtenerCliente(id: string): Promise<Cliente> {
  const { data, error } = await db().from("clientes").select("*").eq("id", id).single();
  if (error) throw new Error(mensajeError(error));
  return data as Cliente;
}

/** Posibles duplicados antes de crear: mismo CUIT o razón social parecida. */
export async function posiblesDuplicados(c: Pick<ClienteEditable, "razon_social" | "cuit">, excluirId?: string) {
  const filtros: string[] = [];
  const digitos = (c.cuit ?? "").replace(/\D/g, "");
  if (digitos.length === 11) filtros.push(`cuit.eq.${digitos.replace(/^(\d{2})(\d{8})(\d)$/, "$1-$2-$3")}`);
  const nombre = c.razon_social.trim().replace(/[,()*%]/g, " ").trim();
  if (nombre.length >= 3) filtros.push(`razon_social.ilike.*${nombre}*`);
  if (!filtros.length) return [];
  let q = db().from("clientes").select(COLS_LISTA).or(filtros.join(",")).limit(5);
  if (excluirId) q = q.neq("id", excluirId);
  const { data, error } = await q;
  if (error) throw new Error(mensajeError(error));
  return (data ?? []) as ClienteFila[];
}

export async function crearCliente(c: ClienteEditable): Promise<Cliente> {
  const { data, error } = await db().from("clientes").insert(limpiar(c)).select("*").single();
  if (error) throw new Error(mensajeError(error));
  return data as Cliente;
}

export async function actualizarCliente(id: string, c: Partial<ClienteEditable> & { activo?: boolean }): Promise<Cliente> {
  const { data, error } = await db().from("clientes").update(limpiar(c)).eq("id", id).select("*").single();
  if (error) throw new Error(mensajeError(error));
  return data as Cliente;
}

export async function listarContactos(clienteId: string): Promise<Contacto[]> {
  const { data, error } = await db()
    .from("contactos")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("es_principal", { ascending: false })
    .order("nombre");
  if (error) throw new Error(mensajeError(error));
  return (data ?? []) as Contacto[];
}

/** Si el contacto pasa a principal, primero se le quita la marca al anterior (único por cliente). */
async function liberarPrincipal(clienteId: string, exceptoId?: string) {
  let q = db().from("contactos").update({ es_principal: false }).eq("cliente_id", clienteId).eq("es_principal", true);
  if (exceptoId) q = q.neq("id", exceptoId);
  const { error } = await q;
  if (error) throw new Error(mensajeError(error));
}

export async function guardarContacto(clienteId: string, c: ContactoEditable, id?: string): Promise<void> {
  if (c.es_principal) await liberarPrincipal(clienteId, id);
  const datos = limpiar({ ...c, cliente_id: clienteId });
  const { error } = id
    ? await db().from("contactos").update(datos).eq("id", id)
    : await db().from("contactos").insert(datos);
  if (error) throw new Error(mensajeError(error));
}

export async function borrarContacto(id: string): Promise<void> {
  const { error } = await db().from("contactos").delete().eq("id", id);
  if (error) throw new Error(mensajeError(error));
}

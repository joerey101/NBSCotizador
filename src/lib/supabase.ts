// Cliente de Supabase para el CRM (clientes, presupuestos guardados, equipo, comisiones, stock).
// El catálogo y el armado del presupuesto NO dependen de esto: siguen funcionando sin conexión.
// La seguridad está en la base (RLS); la clave publishable es pública y puede ir en el navegador.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** El link de "¿Olvidaste tu contraseña?" vuelve con #...type=recovery. Se lee ANTES de crear
 *  el cliente, porque supabase-js procesa el hash y lo borra de la dirección. */
export const llegoPorRecuperacion = window.location.hash.includes("type=recovery");

/** null si faltan las variables (ej. un build sin .env): la app funciona igual, sin CRM. */
export const supabase = url && key ? createClient(url, key, { auth: { flowType: "implicit" } }) : null;

/** Dirección de la app (sin hash) para volver después de entrar, salir o recuperar la clave. */
export const URL_APP = window.location.origin + window.location.pathname;

/** Recarga la app entera: al entrar o salir no queda nada en memoria del usuario anterior. */
export function recargarApp() {
  window.location.assign(URL_APP);
}

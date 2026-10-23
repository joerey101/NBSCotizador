// Sesión y rol del usuario. El rol viene de app_metadata.rol (lo asigna un admin; el usuario
// no lo puede cambiar). Esto solo decide qué pantallas se muestran: la seguridad real de los
// datos está en la base (RLS con public.rol_actual()).
import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { llegoPorRecuperacion, supabase } from "./supabase";

export type Rol = "admin" | "vendedor" | "deposito" | "sin_acceso";

export const ROL_LABELS: Record<Rol, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  deposito: "Depósito",
  sin_acceso: "Sin acceso",
};

/** Rol del usuario para las pantallas (solo decide qué se muestra; la seguridad está en la base). */
export const RolContext = createContext<Rol>("sin_acceso");
export const useRol = () => useContext(RolContext);

export function rolDe(session: Session | null): Rol {
  const r = session?.user.app_metadata?.rol;
  return r === "admin" || r === "vendedor" || r === "deposito" ? r : "sin_acceso";
}

export type EstadoSesion =
  | { tipo: "sin_crm" } // faltan las variables de Supabase: app sin login (como antes)
  | { tipo: "cargando" }
  | { tipo: "sin_sesion" }
  | { tipo: "nueva_clave" } // entró por el link de recuperación
  | { tipo: "con_sesion"; session: Session; rol: Rol };

export function useSesion(): EstadoSesion {
  const [estado, setEstado] = useState<EstadoSesion>(
    supabase ? { tipo: "cargando" } : { tipo: "sin_crm" }
  );

  useEffect(() => {
    if (!supabase) return;
    let recuperando = llegoPorRecuperacion;
    const aplicar = (session: Session | null) => {
      if (recuperando && session) setEstado({ tipo: "nueva_clave" });
      else if (session) setEstado({ tipo: "con_sesion", session, rol: rolDe(session) });
      else setEstado({ tipo: "sin_sesion" });
    };
    supabase.auth.getSession().then(({ data }) => aplicar(data.session));
    const { data } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === "PASSWORD_RECOVERY") recuperando = true;
      aplicar(session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return estado;
}

// Navegación mínima por hash (#/clientes, #/clientes/<id>) para el CRM.
// Sin hash = cotizador. El hash de recuperación de clave (#...type=recovery) lo maneja supabase-js.
import { useEffect, useState } from "react";

export type Ruta =
  | { pantalla: "cotizador" }
  | { pantalla: "presupuestos" }
  | { pantalla: "clientes" }
  | { pantalla: "cliente_nuevo" }
  | { pantalla: "cliente"; id: string };

function leer(): Ruta {
  const partes = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (partes[0] === "presupuestos") return { pantalla: "presupuestos" };
  if (partes[0] !== "clientes") return { pantalla: "cotizador" };
  if (partes[1] === "nuevo") return { pantalla: "cliente_nuevo" };
  if (partes[1]) return { pantalla: "cliente", id: partes[1] };
  return { pantalla: "clientes" };
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(leer);
  useEffect(() => {
    const cambio = () => setRuta(leer());
    window.addEventListener("hashchange", cambio);
    return () => window.removeEventListener("hashchange", cambio);
  }, []);
  return ruta;
}

export function ir(hash: string) {
  window.location.hash = hash;
}
